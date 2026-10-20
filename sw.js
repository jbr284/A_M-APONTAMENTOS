const CACHE_NAME = 'AM-SARIPAN-V1.0'; 

const ASSETS = [
  './',
  './index.html',
  './style.css',     
  './app.js',        
  './manifest.json',
  './logo.png',
  './icon-192x192.png',
  './icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => {
    if (k !== CACHE_NAME) return caches.delete(k);
  }))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
