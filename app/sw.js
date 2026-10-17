/* Service worker do NavegaDor.
 * No app empacotado (Capacitor) e no PWA, a "tela" (HTML/CSS/JS) é sempre
 * carregada da versão instalada — o SW NÃO cacheia o casco do app, para que
 * toda atualização apareça na hora (sem ficar preso numa versão antiga).
 * O SW serve só para cachear os tiles de mapa já visitados (cache-first),
 * base da navegação offline: áreas abertas com internet ficam disponíveis
 * depois sem sinal.
 */
const TILE_CACHE = 'carta-tiles-v1';
const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'tiles.openseamap.org',
  'server.arcgisonline.com',
  'tile.opentopomap.org',
  'wms.gebco.net'
];
const MAX_TILES = 2000; // limite simples para não encher o dispositivo

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== TILE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
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
  if (!ehTile(url)) return; // casco do app e tudo mais: deixa a rede/bundle resolver

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
});
