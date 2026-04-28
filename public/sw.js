const CACHE = 'dayflow-v2'

const PRECACHE = ['/', '/today/', '/calendar/', '/habits/', '/weekly/', '/sleep/', '/screen-time/', '/goals/', '/manifest.json']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.hostname.includes('supabase.co')) return
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const net = fetch(e.request).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()))
        }
        return res
      })
      return cached || net
    })
  )
})

// ── Push notifications ────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? { title: 'Dayflow', body: 'Time to log your habits!' }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      tag: 'dayflow-reminder',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(clients.openWindow('/today/'))
})

// ── Scheduled local notifications ────────────────────────────────────────
// Called from the app via postMessage to schedule a reminder
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delayMs } = e.data
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon.svg',
        tag: 'dayflow-reminder',
        renotify: true,
      })
    }, delayMs)
  }
})
