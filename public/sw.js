const CACHE_NAME = 'chat-app-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/auth.js',
    '/js/chatUI.js',
    '/js/userManager.js',
    '/js/messenger.js',
    '/assets/default-avatar.png'
];

// Cài đặt Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
    );
});

// Kích hoạt Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
});

// Xử lý fetch requests
self.addEventListener('fetch', event => {
    // Bỏ qua các requests WebSocket
    if (event.request.url.includes('ws://') || event.request.url.includes('wss://')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request).then(response => {
                    // Chỉ cache các responses hợp lệ
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
});

// Xử lý push notifications
self.addEventListener('push', event => {
    const data = event.data.json();
    const options = {
        body: data.message,
        icon: '/assets/notification-icon.png',
        badge: '/assets/badge-icon.png',
        data: {
            url: data.url
        }
    };

    event.waitUntil(
        self.registration.showNotification('Tin nhắn mới', options)
    );
});

// Xử lý click vào notification
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
}); 