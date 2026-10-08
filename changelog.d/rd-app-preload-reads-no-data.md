## 2026-10-08 · fix(perf): the signed-in app preloads its pages' code again — from the build's own list, never by rendering a page

Follows `rd/app-preload-renders-nothing` (the switch-off). The owner's ruling stands (2026-10-02:
*"when someone logs in, it has their events, and their shop"*); what changes is how the shell learns
which chunk files a page needs.

- `scripts/write-app-code-map.mjs` (new, runs after `next build`): folds `.next/app-build-manifest.json`
  into ONE static file per deploy, `.next/static/app-code/<build version>.json` — every signed-in page
  (`/dashboard/…`, `/vendor-dashboard…`), its own chunks and its layouts', each chunk once.
- `lib/app-code-map.ts` (new): the file's shape; `routePatternsOf` (an address → its route, by the
  event's id); `chunksForRoute` (only `/_next/static/chunks/*.js` can ever come out of a map).
- `app/_components/app-preload.tsx`: a job asks the CDN for the map once per page load and fetches the
  chunks this tab has not loaded. No map, or a page the map does not know → nothing. It never fetches
  a page. `routeChunkUrls` (reading chunk names out of a rendered page) is removed.

| Requests by the shell's preload per signed-in page load (host with a shop, 14 pages) | before 2026-10-08 | switch-off | this PR |
|---|---|---|---|
| to app routes — full server renders | 14 | 0 | **0** |
| to `/_next/static/` — the CDN | the chunks | 0 | 1 map + the chunks |
| database requests | every read of 14 pages | 0 | **0** |

Guard `lib/app-preload-renders-nothing.test.ts` (8 tests) counts them with a counting `fetch` over the
real queue and plan. 7 sabotages, each red.

⚠ Not verifiable locally: that Vercel serves a file written into `.next/static` after `next build`. If
it does not, the preload does nothing (the switch-off's behaviour) — never a render.

SPEC IMPACT: None — DECISION_LOG 2026-10-02 "A HOST'S WHOLE APP LOADS ONCE, IN THE BACKGROUND" holds again.
