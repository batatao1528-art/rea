/* Service worker do NavegaDor.
 * - Deixa o app instalável.
 * - Cache do "casco" do app (HTML/CSS/JS) para abrir offline.
 * - Cache dos tiles de mapa já visitados (cache-first), base da navegação offline:
 *   as áreas que você abrir com internet ficam disponíveis depois sem sinal.
 */
const APP_CACHE = 'carta-app-v5';
const TILE_CACHE = 'carta-tiles-v1';
const APP_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js'
];
const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'tiles.openseamap.org',
  'server.arcgisonline.com',
  'tile.opentopomap.org'
];
const MAX_TILES = 2000; // limite simples para não encher o dispositivo

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(APP_CACHE)
      .then(c => Promise.allSettled(APP_ASSETS.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== APP_CACHE && k !== TILE_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function ehTile(url) {
  return TILE_HOSTS.some(h => url.hostname.endsWith(h));
}

async function podarTiles(cache) {
  const chaves = await cache.keys();
  if (chaves.length > MAX_TILES) {
    for (let i = 0; i < chaves.length - MAX_TILES; i++) await cache.delete(chaves[i]);
  }
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (ehTile(url)) {
    // cache-first para tiles: offline nas áreas já vistas
    e.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      try {
        const resp = await fetch(e.request);
        if (resp.ok) { cache.put(e.request, resp.clone()); podarTiles(cache); }
        return resp;
      } catch (err) {
        return hit || Response.error();
      }
    })());
    return;
  }

  // app shell: cache-first com atualização em segundo plano
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
      if (resp.ok && url.origin === location.origin) {
        const clone = resp.clone();
        caches.open(APP_CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => hit))
  );
});
