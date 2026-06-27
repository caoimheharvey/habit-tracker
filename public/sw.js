self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? 'Morning Accountability'
  const options = {
    body:    data.body ?? '',
    icon:    data.icon ?? '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.tag ?? 'default',
    renotify: !!data.renotify,
    data:    { url: data.url ?? '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
