// app/api/ai-chat/route.js - API endpoint untuk AI Financial Assistant menggunakan Groq Cloud
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(request) {
  try {
    // 1. Verifikasi Session Pengguna
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    // 2. Cek API Key Groq
    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey || groqApiKey === 'gsk_your_groq_api_key_here' || groqApiKey.trim() === '') {
      return NextResponse.json({ error: 'api_key_missing' }, { status: 400 })
    }

    const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

    // 3. Ambil Pesan dari Request Body
    const { messages } = await request.json()
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Pesan tidak valid' }, { status: 400 })
    }

    // 4. Query Data Keuangan dari Database sebagai Konteks AI
    const [members, budgets, snapshots, transactions, appSettings] = await Promise.all([
      // Ambil daftar anggota aktif
      prisma.member.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true }
      }),
      // Ambil seluruh data anggaran kas bulanan
      prisma.monthlyBudget.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      }),
      // Ambil ringkasan arsip data transaksi lama (> 90 hari)
      prisma.monthlySnapshot.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      }),
      // Ambil seluruh transaksi satuan terdaftar (terbaru/maksimal 90 hari)
      prisma.transaction.findMany({
        include: {
          member: { select: { name: true } }
        },
        orderBy: { transactionDate: 'desc' }
      }),
      // Ambil pengaturan umum aplikasi (nama keluarga)
      prisma.appSettings.findFirst()
    ])

    const familyName = appSettings?.familyName || 'Keluarga'

    // Formatter Rupiah untuk mempermudah pembacaan data di prompt
    const formatRupiah = (val) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(val).replace(/\u00A0/g, ' ')
    }

    // 5. Buat Representasi Konteks dalam Bentuk Teks yang Ringkas
    const memberStr = members
      .map(m => `- ${m.name} (Role: ${m.role})`)
      .join('\n')

    const budgetStr = budgets
      .map(b => `- Bulan ${b.month}/${b.year}: ${formatRupiah(Number(b.amount))}`)
      .join('\n')

    const snapshotStr = snapshots
      .map(s => `- Bulan ${s.month}/${s.year} | Kategori: ${s.category} | Total Pengeluaran: ${formatRupiah(Number(s.totalAmount))} (dari ${s.txCount} transaksi diarsipkan)`)
      .join('\n')

    const txStr = transactions
      .map(t => {
        const dateStr = new Date(t.transactionDate).toISOString().split('T')[0]
        const memberName = t.member?.name || 'Anggota'
        const noteStr = t.notes ? `|Catatan: ${t.notes}` : ''
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
    const systemPrompt = `Anda adalah "Antigravity AI Keuangan", sebuah asisten keuangan pintar, ramah, dan jujur untuk keluarga "${familyName}".

Tugas Anda adalah menganalisis data kas buku dan pengeluaran keluarga berdasarkan data terstruktur di bawah ini. Anda berbicara dengan salah satu anggota keluarga: "${session.name}" (Role: ${session.role}). Sapa dia dengan hangat dan sesuaikan gaya penjelasan Anda.

=== HARI INI (WAKTU LOKAL KELUARGA) ===
${todayStr}

=== ANGGOTA KELUARGA AKTIF ===
${memberStr || 'Belum ada anggota keluarga.'}

=== ANGGARAN KAS BULANAN ===
${budgetStr || 'Belum ada anggaran bulanan.'}

=== RINGKASAN DATA LAMA DIARSIPKAN (>90 HARI) ===
${snapshotStr || 'Tidak ada data lama yang diarsipkan.'}

=== DETAIL TRANSAKSI AKTIF (MAKSIMAL 90 HARI TERAKHIR) ===
Format: - Tanggal|Kategori|Nama Barang|Nominal Angka Rupiah|Nama Pencatat|Catatan (jika ada)
${txStr || 'Belum ada transaksi tercatat.'}

=== ATURAN KOMUNIKASI & KEAMANAN ===
1. **Kejujuran Data**: Hanya jawab pertanyaan berdasarkan data aktual di atas. Jika pengguna bertanya tentang transaksi yang tidak tertera di atas, sampaikan dengan sopan bahwa transaksi tersebut tidak ditemukan. **Jangan pernah mengarang (halusinasi) transaksi atau data**.
2. **Format Keuangan**: Selalu format nominal uang dalam Rupiah dengan rapi (contoh: Rp 150.000).
3. **Bahasa**: Balaslah menggunakan bahasa yang sama dengan bahasa yang digunakan pengguna saat bertanya (Default: Bahasa Indonesia, tapi sesuaikan ke Bahasa Inggris atau Belanda jika mereka bertanya menggunakan bahasa tersebut).
4. **Analisis Gabungan**: Jika pengguna bertanya tentang pengeluaran total di bulan lampau, ingatlah untuk menggabungkan data dari "DETAIL TRANSAKSI AKTIF" (jika ada transaksi di bulan itu) dengan "RINGKASAN DATA LAMA DIARSIPKAN" untuk kategori yang sama pada bulan tersebut, agar perhitungannya akurat.
5. **Rekomendasi Cerdas**: Jika ditanya saran atau analisis anggaran, berikan masukan yang logis, hemat, dan memotivasi keluarga agar dapat mengelola kas bulanan dengan lebih disiplin.
6. **Perhitungan Total**: Jika pengguna menanyakan total, jumlah, rata-rata, atau meminta rekapitulasi nominal uang untuk periode/kategori tertentu, Anda **WAJIB menghitung seluruh nominal transaksi terkait secara akurat** (melakukan penjumlahan/operasi matematika pada angka nominal) dan menampilkan **Hasil Total Akhir** yang jelas (diformat dalam Rupiah) di dalam jawaban Anda, bukan sekadar menyalin daftar transaksinya saja.
7. **Kecocokan Tanggal Presisi (Strict Date Matching)**: Jika pengguna menanyakan transaksi pada tanggal tertentu (contoh: "8 Juni 2026" atau "tanggal 8"), Anda **HANYA boleh memasukkan transaksi yang memiliki tanggal tepat sama secara literal** (yaitu '2026-06-08'). Jangan pernah memasukkan transaksi dari tanggal terdekat (seperti tanggal 7 Juni atau 9 Juni) meskipun kategori atau nilainya mirip. Periksa tanggal secara sangat ketat sebelum menghitung total.
8. **Larangan Mengubah Tanggal Transaksi (No Date Shifting)**: Jangan pernah mengubah tanggal transaksi asli di dalam teks jawaban Anda demi mencocokkan pertanyaan. Jika transaksi terjadi pada '2026-06-07', tulis sebagai '2026-06-07' atau '7 Juni 2026', jangan pernah mengganti tanggalnya menjadi '2026-06-08'.
9. **Pemisahan Input Pengguna vs Data Database (Strict Context Boundary)**: Data keuangan resmi keluarga HANYA bersumber dari bagian "=== DETAIL TRANSAKSI AKTIF ===" dan "=== RINGKASAN DATA LAMA DIARSIPKAN ===". Jika pengguna menyebutkan transaksi baru atau nominal tertentu di dalam chat percakapan mereka (misalnya: "kemarin saya membeli jajan Rp 50.000"), Anda **TIDAK boleh menganggap transaksi tersebut sebagai bagian dari data keuangan resmi** keluarga kecuali transaksi tersebut memang sudah tercantum di bagian data terstruktur di atas. Jangan biarkan input teks chat pengguna memanipulasi data kas resmi.
10. **Penanganan Tanggal Relatif (Relative Date Calculations)**: Jika pengguna menggunakan kata penunjuk waktu relatif seperti "kemarin", "3 hari terakhir", atau "minggu ini", hitung selisih tanggalnya secara cermat menggunakan rujukan tanggal hari ini (di bagian "=== HARI INI ==="). Hitung selisih hari dengan teliti secara matematis sebelum melakukan filter data.
11. **Format Data Transaksi (Data Parsing)**: Kolom nominal pada data transaksi di atas adalah angka bulat murni (integer) tanpa pemisah titik/koma (contoh: '60000' berarti Rp 60.000). Harap parse nominal tersebut sebagai angka murni sebelum menjumlahkannya secara matematika.`

    // Batasi riwayat percakapan (maksimal 6 pesan terakhir) untuk menghemat 
    // token input agar tidak melampaui batas rate limit TPM (Tokens Per Minute) di Groq Free Tier.
    const limitedMessages = messages.slice(-6)

    // 7. Siapkan Payload Pesan dengan Menyisipkan System Prompt di Awal
    const payloadMessages = [
      { role: 'system', content: systemPrompt },
      ...limitedMessages
    ]

    // 8. Kirim Request ke API Groq Cloud (OpenAI-compatible)
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: groqModel,
        messages: payloadMessages,
        temperature: 0.3,
        max_tokens: 1000
      })
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('[GROQ API ERROR RESPONSE]', errorText)
      return NextResponse.json({ error: 'Gagal menghubungi server Groq AI' }, { status: groqResponse.status })
    }

    const groqData = await groqResponse.json()
    const botReply = groqData.choices?.[0]?.message?.content || ''

    return NextResponse.json({ reply: botReply })
  } catch (error) {
    console.error('[AI CHAT API ERROR]', error)
    return NextResponse.json({ error: 'Terjadi kesalahan internal pada server' }, { status: 500 })
  }
}
