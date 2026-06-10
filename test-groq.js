// test-groq.js - Menguji koneksi Groq Cloud API dengan API key di .env
const fs = require('fs')
const path = require('path')

// Load .env
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8')
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      const key = match[1]
      let value = match[2] || ''
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1)
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1)
      }
      process.env[key] = value
    }
  })
}

const groqApiKey = process.env.GROQ_API_KEY
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

console.log("Menggunakan API Key:", groqApiKey ? (groqApiKey.substring(0, 10) + "...") : "TIDAK ADA")
console.log("Menggunakan Model:", groqModel)

async function test() {
  if (!groqApiKey || groqApiKey.includes('your_groq_api_key_here')) {
    console.error("API Key belum diset dengan benar di file .env!");
    return
  }

  try {
    console.log("Mengirim request ke Groq...")
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          { role: 'system', content: 'Anda adalah asisten keuangan.' },
          { role: 'user', content: 'tes' }
        ],
        temperature: 0.3,
        max_tokens: 100
      })
    })

    console.log("Status respons:", res.status, res.statusText)
    const data = await res.json()
    if (res.ok) {
      console.log("Berhasil! Jawaban Groq:")
      console.log(data.choices?.[0]?.message?.content)
    } else {
      console.error("Gagal! Detail error dari Groq:")
      console.error(JSON.stringify(data, null, 2))
    }
  } catch (error) {
    console.error("Terjadi error koneksi:")
    console.error(error)
  }
}

test()
