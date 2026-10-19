/* FDS Calculette — service worker
 *
 * Deux objectifs, les mêmes que Scan BL :
 *  1. Démarrer sans réseau (atelier, déplacement, sous-sol).
 *  2. Rendre les mises à jour explicites : l'application annonce elle-même « une mise à jour est prête »
 *     (bandeau en haut de l'écran) ; le numéro de version est affiché en bas de l'écran Marge et dans Infos.
 *
 * IMPORTANT : changer CACHE_VERSION à chaque publication, EN MÊME TEMPS que VERSION et DATE_VERSION
 * dans app.js — sinon les appareils déjà installés continueront de servir l'ancienne version depuis
 * leur cache, sans aucun message d'erreur. `node --test` vérifie que les deux numéros concordent.
 */
const CACHE_VERSION = 'fdscalc-v2';

// Uniquement des ressources locales : aucune bibliothèque, aucun CDN, aucune police distante.
const PRECACHE_URLS = [
  './',
  './index.html',
  './calcul.js',
  './app.js',
  './manifest.json',
  './icone.svg',
  './icone-192.png',
  './icone-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Ne jamais bloquer l'installation sur l'échec d'une ressource annexe :
      // une application non installable serait pire qu'une application partiellement en cache.
      .catch((err) => console.warn('[sw] pré-cache partiel :', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// La page demande la bascule immédiate quand l'utilisateur touche « Installer » dans le bandeau.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Seuls les GET de même origine passent par ce cache : les liens « Taux du jour » partent vers Google, pas ici.
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // On lit toujours dans LE cache de cette version, pas dans tous : un ancien cache encore présent ne doit
  // jamais fournir un fichier à une version plus récente (index.html d'une version, app.js d'une autre).
  const dansLeCache = (r) => caches.open(CACHE_VERSION).then((c) => c.match(r));

  // Ouverture de l'application : le cache d'abord, pour un démarrage instantané et fiable sans réseau.
  // La mise à jour est détectée par le navigateur sur sw.js lui-même, et signalée dans l'interface.
  if (req.mode === 'navigate') {
    event.respondWith(dansLeCache('./index.html').then((hit) => hit || fetch(req)));
    return;
  }

  // Le reste (calcul.js, app.js, icônes…) : le cache d'abord, le réseau en secours.
  event.respondWith(dansLeCache(req).then((hit) => hit || fetch(req)));
});
