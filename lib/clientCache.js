// lib/clientCache.js - Near-Zero-Latency In-Memory SWR Cache & Request Deduplication Engine

const memoryCache = new Map()
const inFlightRequests = new Map()

/**
 * Mengambil data dari cache secara sinkron (0ms) untuk inisialisasi state React
 * sehingga perpindahan antar-halaman tidak menampilkan loading spinner berulang.
 */
export function peekCache(url) {
  const entry = memoryCache.get(url)
  return entry ? entry.data : null
}

/**
 * Menyimpan atau memperbarui data langsung ke dalam cache memori.
 */
export function setCache(url, data) {
  memoryCache.set(url, {
    data,
    timestamp: Date.now(),
  })
}

/**
 * Fetch dengan fitur Stale-While-Revalidate (SWR) & Request Deduplication.
 * - Jika data masih segar (< ttlMs) dan !forceRefresh, kembalikan langsung dari RAM (0ms).
 * - Jika ada request ke URL yang sama sedang berjalan, gabungkan ke Promise yang sama (Deduplication).
 */
export async function cachedFetch(url, { ttlMs = 30000, forceRefresh = false } = {}) {
  const now = Date.now()
  const existing = memoryCache.get(url)

  if (!forceRefresh && existing && now - existing.timestamp < ttlMs) {
    return existing.data
  }

  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url)
  }

  const requestPromise = fetch(url)
    .then(async (res) => {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const err = new Error(errData.error || `HTTP ${res.status}`)
        err.status = res.status
        err.data = errData
        throw err
      }
      const json = await res.json()
      memoryCache.set(url, {
        data: json,
        timestamp: Date.now(),
      })
      return json
    })
    .finally(() => {
      inFlightRequests.delete(url)
    })

  inFlightRequests.set(url, requestPromise)
  return requestPromise
}

/**
 * Menghapus cache berdasarkan prefix URL (misal setelah tambah/edit/hapus transaksi).
 * Jika patterns tidak diisi, bersihkan seluruh cache.
 */
export function invalidateCache(patterns = null) {
  if (!patterns) {
    memoryCache.clear()
    return
  }
  const list = Array.isArray(patterns) ? patterns : [patterns]
  for (const key of memoryCache.keys()) {
    if (list.some((prefix) => key.startsWith(prefix))) {
      memoryCache.delete(key)
    }
  }
}

/**
 * Pre-warm beberapa endpoint API di background saat browser sedang idle
 * agar klik menu pertama kali langsung instan (0ms).
 */
export function prefetchApiCache(urls = [], ttlMs = 45000) {
  if (typeof window === 'undefined') return
  const runner = () => {
    for (const url of urls) {
      if (!memoryCache.has(url) && !inFlightRequests.has(url)) {
        cachedFetch(url, { ttlMs }).catch(() => {})
      }
    }
  }
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(runner, { timeout: 1500 })
  } else {
    setTimeout(runner, 350)
  }
}
