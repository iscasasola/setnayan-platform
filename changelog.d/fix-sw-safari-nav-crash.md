## 2026-07-03 · fix(sw): stop Safari "Service Worker context closed" login crash

Owner reported Safari showing "Safari Can't Open the Page … 'Service Worker
context closed' (WebKitInternal:0)" when pressing **Login**. Root cause is a
WebKit lifecycle bug, not the login code: our service worker intercepted every
navigation with `event.respondWith(fetch(request))`, and Safari aggressively
terminates the SW context during navigation — most often in the
install→`skipWaiting()`→`clients.claim()` handover a returning user hits on
nearly every visit (the SW bytes change per deploy via `stamp-sw.mjs`, so the
worker updates constantly). Killing the context mid-`respondWith` fails the
whole navigation instead of retrying on the network. Login was the reproducer:
POST → server-action redirect → GET `/dashboard` navigation, intercepted right
inside the handover window.

Fix: the SW no longer intercepts app-shell navigations (dashboard / login /
auth / marketing) — they go straight to the network natively, immune to the
handover crash. The one genuinely-offline navigation (day-of guest `/[slug]`)
is still served network-first with its DAYOF_CACHE fallback. Asset caching
(images / fonts / JS / CSS) is untouched (those aren't navigations). Removing
the generic shell-cache navigation fallback costs nothing meaningful — those
surfaces need the network + a live auth session anyway — and it improves
freshness (app navigations can never serve a stale shell).

SPEC IMPACT: None — service-worker resilience fix, no schema/SKU/pricing/flow
change. Caching_and_Offline_Strategy § 3.2's day-of guest offline guarantee is
preserved; only the incidental dashboard shell-offline "bonus" is dropped.
