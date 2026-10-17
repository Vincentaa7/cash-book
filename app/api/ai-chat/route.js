import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { logActivity, getMonthRemainingBalance } from '@/lib/logger'
import { syncBudgetsForTransactionChange } from '@/lib/cashbook'

function cleanEnvValue(val = '') {
  return String(val)
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/^GROQ_API_KEY\s*=\s*/i, '')
    .replace(/^GROQ_MODEL\s*=\s*/i, '')
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
}

// Helper membaca nilai terbaru dari .env / process.env (aman dari tanda kutip di Vercel)
function getEnvConfig() {
  let apiKey = cleanEnvValue(process.env.GROQ_API_KEY || '')
  let model = cleanEnvValue(process.env.GROQ_MODEL || '')
  try {
    const envPath = path.join(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const keyMatch = content.match(/^\s*GROQ_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m)
      const modelMatch = content.match(/^\s*GROQ_MODEL\s*=\s*["']?([^"'\r\n]+)["']?/m)
      if (keyMatch?.[1]) apiKey = cleanEnvValue(keyMatch[1])
      if (modelMatch?.[1]) model = cleanEnvValue(modelMatch[1])
    }
  } catch {}
  return {
    groqApiKey: apiKey,
    groqModel: model || 'openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b'
  }
}

export async function POST(request) {
  try {
    // 1. Verifikasi Session Pengguna
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const familyId = session.familyId || '1'

    // Rate limiting: Max 12 pesan per menit per user
    const rateCheck = checkRateLimit(`ai-chat:${session.id}`, 12, 60000)
    if (!rateCheck.success) {
      const waitSec = Math.max(1, Math.ceil((rateCheck.resetTime - Date.now()) / 1000))
      return NextResponse.json(
        { error: `Terlalu banyak permintaan ke asisten AI. Harap tunggu ${waitSec} detik.` },
        { status: 429, headers: { 'Retry-After': String(waitSec) } }
      )
    }

    // 2. Cek API Key Groq (membaca langsung dari .env jika baru diubah)
    const { groqApiKey, groqModel } = getEnvConfig()
    if (!groqApiKey || groqApiKey === 'gsk_your_groq_api_key_here' || groqApiKey.trim() === '') {
      return NextResponse.json({ error: 'api_key_missing' }, { status: 400 })
    }

    // 3. Ambil Pesan dari Request Body
    const { messages } = await request.json()
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Pesan tidak valid' }, { status: 400 })
    }

    // 4. Query Data Keuangan Keluarga dari Database sebagai Konteks AI
    const [members, budgets, snapshots, transactions, appSettings] = await Promise.all([
      prisma.member.findMany({
        where: { familyId, isActive: true },
        select: { id: true, name: true, role: true }
      }),
      prisma.monthlyBudget.findMany({
        where: { familyId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      }),
      prisma.monthlySnapshot.findMany({
        where: { familyId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      }),
      prisma.transaction.findMany({
        where: { familyId },
        include: {
          member: { select: { name: true } }
        },
        orderBy: { transactionDate: 'desc' }
      }),
      prisma.appSettings.findUnique({ where: { id: familyId } })
    ])

    const familyName = appSettings?.familyName || 'Keluarga'

    const formatRupiah = (val) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(val).replace(/\u00A0/g, ' ')
    }

    const CATEGORY_LABELS = {
      sembako: '🛒 Sembako & Kebutuhan Dapur',
      makan: '🍽️ Makanan & Minuman',
      tagihan: '💡 Tagihan & Utilitas',
      transportasi: '🚗 Transportasi & BBM',
      kesehatan: '💊 Kesehatan & Obat',
      pendidikan: '📚 Pendidikan',
      hiburan: '🎬 Hiburan & Rekreasi',
      pakaian: '👕 Pakaian & Belanja Diri',
      rumah_tangga: '🏠 Perlengkapan Rumah',
      sosial: '🤝 Sosial & Amal',
      tabungan: '💰 Tabungan & Investasi',
      lainnya: '📦 Lain-lain',
      pemasukan: '💵 Pemasukan'
    }

    const MONTH_NAMES = [
      '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]

    const getCategoryLabel = (slug) => CATEGORY_LABELS[slug] || slug

    // 5. Buat Ringkasan Rekap Per Bulan & Kategori (Agar akurat 100% dan hemat token di bawah batas 8.000 TPM Groq Free Tier)
    const monthlyAgg = {}
    for (const t of transactions) {
      const d = new Date(t.transactionDate)
      const m = d.getUTCMonth() + 1
      const y = d.getUTCFullYear()
      const ym = `${m}/${y}`
      if (!monthlyAgg[ym]) {
        monthlyAgg[ym] = { month: m, year: y, totalExpense: 0, totalIncome: 0, byCat: {} }
      }
      const amt = Number(t.amount)
      if (t.category === 'pemasukan') {
        monthlyAgg[ym].totalIncome += amt
      } else {
        monthlyAgg[ym].totalExpense += amt
        monthlyAgg[ym].byCat[t.category] = (monthlyAgg[ym].byCat[t.category] || 0) + amt
      }
    }

    const monthlySummaryStr = Object.entries(monthlyAgg)
      .map(([ym, info]) => {
        const monthLabel = `${MONTH_NAMES[info.month] || info.month} ${info.year}`
        const catDetails = Object.entries(info.byCat)
          .sort((a, b) => b[1] - a[1])
          .map(([c, a]) => `${getCategoryLabel(c)}: ${formatRupiah(a)}`)
          .join(', ')
        return `- ${monthLabel} (${ym}) | Total Pengeluaran: ${formatRupiah(info.totalExpense)}${info.totalIncome > 0 ? ` | Pemasukan: ${formatRupiah(info.totalIncome)}` : ''} | Rincian Kategori: (${catDetails || '-'})`
      })
      .join('\n')

    const memberStr = members
      .map(m => `- ${m.name} (Role: ${m.role})`)
      .join('\n')

    const budgetStr = budgets
      .map(b => `- ${MONTH_NAMES[b.month] || b.month} ${b.year}: ${formatRupiah(Number(b.amount))}`)
      .join('\n')

    const snapshotStr = snapshots
      .map(s => `- ${MONTH_NAMES[s.month] || s.month} ${s.year} | Kategori: ${getCategoryLabel(s.category)} | Total: ${formatRupiah(Number(s.totalAmount))} (${s.txCount} tx)`)
      .join('\n')

    // Kirim maksimal 75 transaksi terbaru secara satuan agar total token prompt selalu ~1.800 token (di bawah limit 8.000 TPM Groq Free Tier)
    const recentTx = transactions.slice(0, 75)
    const txStr = recentTx
      .map(t => {
        const dateStr = new Date(t.transactionDate).toISOString().split('T')[0]
        const memberName = t.member?.name || 'Anggota'
        const noteStr = t.notes ? `|${t.notes}` : ''
        return `- ${dateStr}|${getCategoryLabel(t.category)}|${t.itemName}|${Number(t.amount)}|${memberName}${noteStr}`
      })
      .join('\n')

    const todayStr = new Date().toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // YYYY-MM-DD

    // 6. Susun System Prompt AI
    const systemPrompt = `Anda adalah "Asisten AI Keuangan", asisten keuangan pribadi yang hangat, ramah, cerdas, dan komunikatif untuk keluarga "${familyName}".
Anda sedang mengobrol dengan "${session.name}" (Role: ${session.role}).

=== HARI INI ===
${todayStr} (Tanggal ISO: ${todayIso})

=== ANGGOTA KELUARGA ===
${memberStr || 'Belum ada anggota keluarga.'}

=== ANGGARAN KAS BULANAN ===
${budgetStr || 'Belum ada anggaran bulanan.'}

=== REKAP TOTAL PENGELUARAN PER BULAN & KATEGORI (AKURAT 100%) ===
${monthlySummaryStr || 'Belum ada rekap bulanan.'}

=== RINGKASAN ARSIP LAMA (>90 HARI) ===
${snapshotStr || 'Tidak ada arsip lama.'}

=== ${recentTx.length} TRANSAKSI TERBARU (DARI TOTAL ${transactions.length} TRANSAKSI) ===
${txStr || 'Belum ada transaksi tercatat.'}

=== ATURAN WAJIB GAYA BAHASA & TATA LETAK (SANGAT PENTING) ===
1. DILARANG KERAS menggunakan simbol bintang (** atau *), tanda pagar (###), garis tabel (|---|), atau kode format kaku di dalam jawaban Anda. Tulis teks bersih tanpa tanda bintang sama sekali!
2. Gunakan bahasa percakapan manusia yang hangat, sopan, ringkas, dan enak dibaca di layar HP/chat sempit.
3. Susun jawaban menjadi maksimal 2-3 bagian pendek yang dipisahkan 1 baris kosong:
   - Kalimat pembuka yang ramah & langsung menjawab inti pertanyaan.
   - Daftar poin singkat menggunakan tanda "• " (satu poin per baris, singkat & padat, jangan menaruh daftar panjang di dalam tanda kurung).
   - Kalimat penutup singkat yang ramah.
4. JIKA PENGGUNA BERTANYA APAKAH BISA MENCATAT/MEMBUAT PENGELUARAN ATAU TRANSAKSI:
   - Jawab dengan ramah bahwa Anda BISA mencatatnya langsung.
   - JANGAN meminta format kaku seperti "YYYY-MM-DD" atau daftar kolom teknis (Tanggal, Kategori, Deskripsi, Nominal, Catatan).
   - Cukup beritahu pengguna untuk mengetik santai nama pengeluaran dan nominalnya, lalu beri 3 contoh pendek seperti:
     • Beli beras 5kg: Rp 75.000
     • Bayar listrik: Rp 350.000
     • Makan siang: Rp 45.000
   - Sampaikan bahwa tanggal otomatis memakai hari ini dan kategorinya akan Anda pilihkan otomatis.
5. JIKA PENGGUNA MEMINTA MENCATAT TRANSAKSI BARU DAN SUDAH MENYEBUTKAN NAMA BARANG + NOMINAL:
   - Konfirmasi dengan ramah bahwa transaksi sudah dicatat beserta rincian singkatnya.
   - WAJIB tambahkan tag tersembunyi ini di baris paling bawah jawaban Anda (sistem akan otomatis menyimpannya ke database dan menyembunyikan tag ini dari layar pengguna):
     [[ADD_TX:YYYY-MM-DD|kode_kategori|Nama Barang|NominalAngkaMurni|CatatanOpsional]]
     Pilihan kode_kategori valid: sembako, makan, tagihan, transportasi, kesehatan, pendidikan, hiburan, pakaian, rumah_tangga, sosial, tabungan, lainnya, pemasukan.
     Contoh: [[ADD_TX:${todayIso}|sembako|Beras 5kg|75000|]]
6. Balas menggunakan bahasa yang sama dengan pertanyaan pengguna (Indonesia / Inggris / Belanda).`

    const limitedMessages = messages.slice(-6)

    const payloadMessages = [
      { role: 'system', content: systemPrompt },
      ...limitedMessages
    ]

    // 8. Daftar model Groq (Multi-model fallback otomatis)
    const configuredModels = groqModel
      .split(',')
      .map(m => m.replace(/['"]/g, '').trim())
      .filter(Boolean)

    const fallbackPool = [
      'openai/gpt-oss-120b',
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-20b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ]

    const modelCandidates = [
      ...configuredModels,
      ...fallbackPool.filter(m => !configuredModels.includes(m)),
    ]

    const cleanBotText = (text = '') => {
      return text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/\[\[ADD_TX:[^\]]*\]\]/gi, '') // Sembunyikan tag aksi database dari teks chat
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-') // Normalisasi semua jenis strip Unicode (seperti ‑ dari gpt-oss)
        .replace(/^#{1,6}\s+/gm, '') // Hapus simbol ### di awal baris
        .replace(/^\s*[-*_]{3,}\s*$/gm, '') // Hapus garis --- atau ***
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Hapus simbol **tebal** langsung dari server agar tidak pernah bocor
        .replace(/\*([^*\n]+)\*/g, '$1') // Hapus simbol *miring*
        .replace(/\*\*/g, '') // Bersihkan sisa ** liar
        .replace(/`/g, '') // Hapus backtick
        .replace(/^\s*[-*•]\s+/gm, '• ') // Seragamkan semua daftar poin menjadi "• "
        .replace(/\n{3,}/g, '\n\n') // Rapikan jarak antar paragraf
        .trim()
    }

    let lastStatus = 500
    let lastErrorReason = ''
    for (const candidateModel of modelCandidates) {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: candidateModel,
          messages: payloadMessages,
          temperature: 0.3,
          max_tokens: 1024
        })
      })

      if (groqResponse.ok) {
        const groqData = await groqResponse.json()
        const rawReply = groqData.choices?.[0]?.message?.content || ''

        // Cek apakah AI mengeksekusi perintah tambah transaksi [[ADD_TX:...]]
        let txCreated = false
        const txMatches = [...rawReply.matchAll(/\[\[ADD_TX:([^\]]+)\]\]/gi)]
        for (const match of txMatches) {
          try {
            const parts = match[1].split('|').map(s => s.trim())
            const [rawDate, rawCat, rawItem, rawAmt, rawNotes] = parts
            const cleanAmt = parseInt(String(rawAmt || '').replace(/[^\d]/g, ''), 10)
            const validCat = CATEGORY_LABELS[rawCat] ? rawCat : 'lainnya'
            const validDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayIso

            if (rawItem && cleanAmt > 0) {
              const newTx = await prisma.transaction.create({
                data: {
                  familyId,
                  itemName: rawItem,
                  amount: BigInt(cleanAmt),
                  category: validCat,
                  transactionDate: new Date(validDate),
                  notes: rawNotes || 'Dicatat via Asisten AI',
                  memberId: session.id,
                }
              })
              const adjustedMonths = await syncBudgetsForTransactionChange(null, newTx)
              const txDateObj = new Date(validDate)
              const remainingBalance = await getMonthRemainingBalance(
                txDateObj.getUTCMonth() + 1,
                txDateObj.getUTCFullYear(),
                familyId
              )
              await logActivity({
                action: 'TRANSACTION_CREATE',
                description: `${session.name} mencatat transaksi "${rawItem}" sebesar ${formatRupiah(cleanAmt)} via Asisten AI`,
                details: {
                  id: newTx.id,
                  itemName: rawItem,
                  amount: cleanAmt,
                  category: validCat,
                  transactionDate: validDate,
                  remainingBalance,
                  adjustedMonths
                },
                memberId: session.id,
                familyId
              })
              txCreated = true
            }
          } catch (txErr) {
            console.error('[AI ADD_TX ERROR]', txErr)
          }
        }

        const botReply = cleanBotText(rawReply)
        if (botReply) {
          return NextResponse.json({ reply: botReply, modelUsed: candidateModel, txCreated })
        }
      }

      lastStatus = groqResponse.status
      const errorText = await groqResponse.text()
      try {
        const errJson = JSON.parse(errorText)
        lastErrorReason = errJson?.error?.message || errorText.slice(0, 120)
      } catch {
        lastErrorReason = errorText.slice(0, 120)
      }
      console.warn(`[GROQ FALLBACK] Model ${candidateModel} gagal (${lastStatus}):`, errorText)

      if (lastStatus === 401) break
    }

    if (lastStatus === 401) {
      return NextResponse.json(
        { error: 'API Key Groq di Vercel belum aktif/valid (Error 401). Pastikan Anda sudah klik Redeploy di Vercel setelah menyimpan GROQ_API_KEY.' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: `Gagal menghubungi server Groq AI (${lastStatus}${lastErrorReason ? ': ' + lastErrorReason : ''})` },
      { status: lastStatus }
    )
  } catch (error) {
    console.error('[AI CHAT API ERROR]', error)
    return NextResponse.json({ error: 'Terjadi kesalahan internal pada server' }, { status: 500 })
  }
}

