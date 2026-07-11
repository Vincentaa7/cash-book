// public/sw.js — Service Worker for Cash Book Daily Reminder
// Handles scheduling of daily push notifications via the browser's Notification API

const SW_VERSION = 'cashbook-sw-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Handle messages from the main page
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {}

  if (type === 'SCHEDULE_REMINDER') {
    const { time, familyName } = payload || {}
    scheduleReminder(time, familyName)
  }

  if (type === 'CANCEL_REMINDER') {
    cancelReminder()
  }

  if (type === 'TEST_NOTIFICATION') {
    const { familyName } = payload || {}
    showReminderNotification(familyName || 'Cash Book')
  }
})

let reminderTimerId = null

function cancelReminder() {
  if (reminderTimerId !== null) {
    clearTimeout(reminderTimerId)
    reminderTimerId = null
  }
}

function scheduleReminder(time = '21:00', familyName = 'Cash Book') {
  cancelReminder()

  const [hours, minutes] = time.split(':').map(Number)
  const now = new Date()
  const target = new Date()
  target.setHours(hours, minutes, 0, 0)

  // Jika waktu target sudah lewat hari ini, jadwalkan untuk besok
  if (target <= now) {
    target.setDate(target.getDate() + 1)
  }

  const delayMs = target.getTime() - now.getTime()

  reminderTimerId = setTimeout(() => {
    showReminderNotification(familyName)
    // Jadwalkan ulang untuk besok (setiap 24 jam)
    reminderTimerId = setInterval(() => {
      showReminderNotification(familyName)
    }, 24 * 60 * 60 * 1000)
  }, delayMs)
}

function showReminderNotification(familyName) {
  const title = `📌 ${familyName} — Pengingat Buku Kas`
  const options = {
    body: 'Sudah catat semua pengeluaran hari ini? Jangan sampai ada yang terlewat!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'cashbook-daily-reminder',
    renotify: true,
    requireInteraction: false,
    data: { url: '/dashboard' },
  }

  self.registration.showNotification(title, options)
    .catch(err => console.error('SW: Failed to show notification', err))
}

// Handle notification click — buka tab dashboard
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Jika ada tab Cash Book yang sudah terbuka, fokuskan
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(targetUrl)
          return
        }
      }
      // Jika tidak, buka tab baru
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
