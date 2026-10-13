## 2026-10-13 · perf(build): one copy per layout — the Maker's first load 507.0 → 486.7 KB, every route smaller

The app router makes every layout, loading file and page its own webpack
entry; the browser loads a page together with every layout above it, but
webpack treats them as unrelated, and Next's client `splitChunks` (20KB
`minSize`, 25 `maxInitialRequests`) leaves small shared modules COPIED into
each entry. Measured on release batch 3: the Maker's cold open carried 81
modules two to four times (lucide's icon base, the loader overlay, the
client-type cookie, SubmitButton …) — 50.9KB raw shipped more than once.

`apps/web/lib/one-copy-per-layout.ts` adds one client split-chunk group per
layout / loading / template file: a module that the anchor's entry ships and
another entry under the same folder also ships moves into ONE chunk named for
the anchor. Wired in `next.config.ts` for the client production build only
(server, edge and `next dev` untouched). No page can grow: the chunk only
holds the anchor's modules and only goes to entries that already load the
anchor; async chunks are untouched, so webpack's runtime does not grow.

MEASURED (next build of `rd/batch-3-2026-10-13` @49b23e2071 vs this change,
the budget scripts' method — every chunk a cold open downloads, gzipped):
Maker 519,149 → 498,430 B (507.0 → 486.7 KB, budget 507 untouched, headroom
0.0 → 20.3 KB; 65 → 52 chunks) · shared bundle 206,415 → 206,351 B (webpack
runtime 5,099 → 5,035) · `/` 250,964 → 245,845 · `/[slug]` 485,482 → 477,726
· `/dashboard` 270,834 → 261,983 · `/dashboard/[eventId]` 374,268 → 360,653
· `/vendor-dashboard` 288,897 → 279,590 · ALL 432 app routes smaller, none
larger (net −3.63 MB) · route count unchanged.

⚠ `next build`'s printed "First Load JS" column RISES on the pages (e.g. `/`
213 → 227 kB): it counts a page's own entry only, never the layouts above it,
and the shared copies now sit in a chunk both the layout and the page list.
What a phone downloads for `/` fell 5.1 KB.

Guard: `apps/web/lib/one-copy-per-layout.test.ts` (5 tests; 5 sabotages
red → green). Walked on a production build (`next start`, Maker lab at
375×812, Chromium + WebKit): every stage, every global setting, all 11 Studio
pages, the Look › Music panel, a Love Story moment sheet, E-Gifts — each first
press changed the screen in 13–146 ms, 0 chunk-load failures.

SPEC IMPACT: None.
