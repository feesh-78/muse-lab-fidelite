// Garde l'application disponible même sans réseau.
// Réseau d'abord (pour toujours avoir la dernière version), copie locale si le réseau ne répond pas.
const CACHE = 'pilotage-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    // Les données et fichiers Supabase ne passent jamais par ce cache
    if (url.hostname.endsWith('supabase.co')) return;
    const appFile = url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.hostname);
    if (!appFile) return;
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            })
            .catch(() => caches.match(request, { ignoreSearch: true })),
    );
});
