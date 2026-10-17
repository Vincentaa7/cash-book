import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'

// Helper membaca nilai terbaru dari .env agar perubahan API Key / Model langsung aktif tanpa perlu restart server
function getEnvConfig() {
  let apiKey = process.env.GROQ_API_KEY || ''
  let model = process.env.GROQ_MODEL || ''
  try {
    const envPath = path.join(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const keyMatch = content.match(/^\s*GROQ_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m)
      const modelMatch = content.match(/^\s*GROQ_MODEL\s*=\s*["']?([^"'\r\n]+)["']?/m)
      if (keyMatch?.[1]) apiKey = keyMatch[1].trim()
      if (modelMatch?.[1]) model = modelMatch[1].trim()
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

    // 5. Buat Ringkasan Rekap Per Bulan & Kategori (Agar akurat 100% dan hemat token di bawah batas 8.000 TPM Groq Free Tier)
    const monthlyAgg = {}
    for (const t of transactions) {
      const d = new Date(t.transactionDate)
      const ym = `${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`
      if (!monthlyAgg[ym]) {
        monthlyAgg[ym] = { totalExpense: 0, totalIncome: 0, byCat: {} }
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
        const catDetails = Object.entries(info.byCat)
          .map(([c, a]) => `${c}: ${formatRupiah(a)}`)
          .join(', ')
        return `- Bulan ${ym} | Total Pengeluaran: ${formatRupiah(info.totalExpense)}${info.totalIncome > 0 ? ` | Pemasukan: ${formatRupiah(info.totalIncome)}` : ''} | Rincian Kategori: (${catDetails || '-'})`
      })
      .join('\n')

    const memberStr = members
      .map(m => `- ${m.name} (Role: ${m.role})`)
      .join('\n')

    const budgetStr = budgets
      .map(b => `- Bulan ${b.month}/${b.year}: ${formatRupiah(Number(b.amount))}`)
      .join('\n')

    const snapshotStr = snapshots
      .map(s => `- Bulan ${s.month}/${s.year} | Kategori: ${s.category} | Total: ${formatRupiah(Number(s.totalAmount))} (${s.txCount} tx)`)
      .join('\n')

    // Kirim maksimal 75 transaksi terbaru secara satuan agar total token prompt selalu ~1.800 token (di bawah limit 8.000 TPM Groq Free Tier)
    const recentTx = transactions.slice(0, 75)
    const txStr = recentTx
      .map(t => {
        const dateStr = new Date(t.transactionDate).toISOString().split('T')[0]
        const memberName = t.member?.name || 'Anggota'
        const noteStr = t.notes ? `|${t.notes}` : ''
        return `- ${dateStr}|${t.category}|${t.itemName}|${Number(t.amount)}|${memberName}${noteStr}`
      })
      .join('\n')

    const todayStr = new Date().toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // 6. Susun System Prompt AI
    const systemPrompt = `Anda adalah "Asisten AI Keuangan", asisten keuangan pintar, ramah, dan jujur untuk keluarga "${familyName}".
Anda berbicara dengan anggota keluarga: "${session.name}" (Role: ${session.role}).

=== HARI INI ===
${todayStr}

=== ANGGOTA KELUARGA ===
${memberStr || 'Belum ada anggota keluarga.'}

=== ANGGARAN KAS BULANAN ===
${budgetStr || 'Belum ada anggaran bulanan.'}

=== REKAP TOTAL PENGELUARAN PER BULAN & KATEGORI (AKURAT 100%) ===
${monthlySummaryStr || 'Belum ada rekap bulanan.'}

=== RINGKASAN ARSIP LAMA (>90 HARI) ===
${snapshotStr || 'Tidak ada arsip lama.'}

=== ${recentTx.length} TRANSAKSI TERBARU (DARI TOTAL ${transactions.length} TRANSAKSI) ===
Format: - YYYY-MM-DD|Kategori|Nama Barang|Nominal Rupiah|Pencatat|Catatan
${txStr || 'Belum ada transaksi tercatat.'}

=== ATURAN ===
1. Jawab berdasarkan data aktual di atas, jangan mengarang transaksi.
2. Selalu format nominal uang dalam Rupiah (contoh: Rp 150.000).
3. Balas menggunakan bahasa yang sama dengan pertanyaan pengguna (Indonesia / Inggris / Belanda).
4. Gunakan bagian "REKAP TOTAL PENGELUARAN PER BULAN & KATEGORI" untuk menjawab pertanyaan total bulanan atau kategori dengan akurat.`

    const limitedMessages = messages.slice(-6)

    const payloadMessages = [
      { role: 'system', content: systemPrompt },
      ...limitedMessages
    ]

    // 8. Daftar model Groq (Multi-model fallback otomatis)
    const configuredModels = groqModel
      .split(',')
      .map(m => m.trim())
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

    let lastStatus = 500
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
        const botReply = rawReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
        if (botReply) {
          return NextResponse.json({ reply: botReply, modelUsed: candidateModel })
        }
      }

      lastStatus = groqResponse.status
      const errorText = await groqResponse.text()
      console.warn(`[GROQ FALLBACK] Model ${candidateModel} gagal (${lastStatus}):`, errorText)

      if (lastStatus === 401) break
    }

    return NextResponse.json({ error: 'Gagal menghubungi server Groq AI' }, { status: lastStatus })
  } catch (error) {
    console.error('[AI CHAT API ERROR]', error)
    return NextResponse.json({ error: 'Terjadi kesalahan internal pada server' }, { status: 500 })
  }
}

