const CACHE_NAME = "chatapp-v3";
const ASSETS = ["./", "./index.html", "./manifest.json", "./bubble-actions.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function shouldInject(request, response) {
  const url = new URL(request.url);
  const type = response.headers.get("content-type") || "";
  return url.origin === self.location.origin && type.includes("text/html");
}

async function injectActions(request, response) {
  if (!shouldInject(request, response)) return response;
  const text = await response.text();
  if (text.includes("bubble-actions.js")) return new Response(text, response);
  const injected = text.replace("</body>", '<script src="./bubble-actions.js"></script></body>');
  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then(async (response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return injectActions(request, response);
      })
      .catch(() => caches.match(request))
  );
});
