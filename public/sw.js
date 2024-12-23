const CACHE_NAME = 'secure-messenger-v1';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/css/styles.css',
                '/js/auth.js',
                '/js/userManager.js',
                '/js/chatUI.js',
                '/js/app.js',
                '/assets/default-avatar.png',
                '/assets/upload-icon.png',
                '/assets/file-icon.png'
            ]);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
}); 