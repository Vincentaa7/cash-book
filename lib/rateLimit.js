// lib/rateLimit.js - In-Memory Sliding Window Rate Limiter
// Melindungi endpoint dari brute-force dan DoS / DDoS application-layer

const rateLimitStore = new Map()

// Pembersihan berkala memori setiap 5 menit agar tidak terjadi memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000).unref?.()
}

/**
 * Memeriksa apakah request melampaui batas rate limit
 * @param {string} identifier - Kunci unik (contoh: IP address atau userId)
 * @param {number} limit - Jumlah maksimal request yang diizinkan dalam rentang waktu
 * @param {number} windowMs - Rentang waktu dalam milidetik (default: 60000 / 1 menit)
 * @returns {{ success: boolean, remaining: number, resetTime: number, total: number }}
 */
export function checkRateLimit(identifier, limit = 10, windowMs = 60000) {
  const now = Date.now()
  let record = rateLimitStore.get(identifier)

  if (!record || now > record.resetTime) {
    // Buat jendela baru jika belum ada atau sudah kedaluwarsa
    record = {
      count: 1,
      resetTime: now + windowMs,
    }
    rateLimitStore.set(identifier, record)
    return {
      success: true,
      remaining: limit - 1,
      resetTime: record.resetTime,
      total: limit,
    }
  }

  // Jika masih dalam jendela waktu
  if (record.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
      total: limit,
    }
  }

  record.count += 1
  return {
    success: true,
    remaining: limit - record.count,
    resetTime: record.resetTime,
    total: limit,
  }
}

/**
 * Ekstraksi IP Address dari header request Next.js
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return '127.0.0.1'
}
