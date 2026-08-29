/* Service worker.

   Correzione rispetto alla v1: il guscio dell'applicazione NON è più servito
   con strategia cache-first. Quella scelta rendeva impossibile aggiornare
   index.html — il browser continuava a servire la copia memorizzata anche
   dopo la pubblicazione di una versione nuova.

   Strategia attuale:
     - index.html e i dati -> rete per prima, cache solo come rete di scorta
     - manifest e icone    -> cache per prima (non cambiano mai)
*/
const CACHE = "orario-v2";
const SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                 // API GitHub: mai intercettata

  const isShell = req.mode === "navigate"
               || url.pathname.endsWith("/")
               || url.pathname.endsWith(".html")
               || (url.pathname.endsWith(".json") && !url.pathname.endsWith("manifest.json"));

  if (isShell) {
    // Rete per prima: si aggiorna da sé. Senza rete, l'ultima copia scaricata.
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return r;
    }))
  );
});
