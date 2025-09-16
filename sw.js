const CACHE_NAME = 'basketball-map-tiles';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([]);
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('tile.openstreetmap.org')) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request, {
                    headers: {
                        'User-Agent': 'BasketballMap/1.0'
                    }
                }).then((networkResponse) => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                }).catch((err) => {
                    console.error('圖磚加載失敗:', err);
                    throw err;
                });
            })
        );
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            cache.keys().then((keys) => {
                keys.forEach((request) => {
                    cache.match(request).then((response) => {
                        if (response) {
                            response.headers.get('date').then((date) => {
                                if (date && new Date() - new Date(date) > CACHE_DURATION) {
                                    cache.delete(request);
                                }
                            });
                        }
                    });
                });
            });
        })
    );
});