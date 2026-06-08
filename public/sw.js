// DS POS Service Worker — v2
// Strategy: network-first for _next/static (prevents stale chunk bugs), network-first for API/pages

const CACHE_NAME = 'ds-pos-v2'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/billing',
  '/manifest.json',
]

// ─── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can; ignore failures (app might not be running yet)
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    })
  )
  self.skipWaiting()
})

// ─── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept non-GET or cross-origin requests
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // Next.js static chunks — network-first so code updates are never stale
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(networkFirstWithCache(request))
    return
  }

  // API routes — network only (real-time data)
  if (url.pathname.startsWith('/api/')) {
    return // let browser handle normally
  }

  // App pages — network first, fall back to cache
  event.respondWith(networkFirstWithCache(request))
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    // Return a basic offline page if no cache
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DS POS — Offline</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0F172A;color:white;text-align:center}
      h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#94a3b8;font-size:.9rem}</style>
      </head><body><div><h1>DS POS</h1><p>You are offline. Open the billing page to continue.</p></div></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
}
