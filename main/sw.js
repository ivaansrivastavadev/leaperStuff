self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.activateAll()));

self.addEventListener('message', e => {
  const { type, task, delay } = e.data;
  if (type !== 'SCHEDULE') return;
  setTimeout(() => {
    self.registration.showNotification('leprTodo — ' + task.title, {
      body: task.desc || 'Tap to open leprTodo',
      icon: '/assets/roundedlogo.gif',
      badge: '/assets/roundedlogo.gif',
      tag: 'lepr-' + task.id,
      data: { url: self.location.origin + '/leprTodo/' },
      actions: [{ action: 'done', title: '✅ Mark done' }],
      requireInteraction: true,
    });
  }, delay);
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'done') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'MARK_DONE', id: e.notification.tag.replace('lepr-','') }));
      })
    );
  } else {
    e.waitUntil(self.clients.openWindow(e.notification.data.url));
  }
});