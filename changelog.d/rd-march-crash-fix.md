## 2026-10-06 · fix(maker): a cut-off request no longer reads as a crash; the Wedding March fails alone

The owner's Maker went to the root crash card ("Something on our end didn't work") on the Wedding March, iPhone,
2026-10-06 ~09:17 PHT, build ce5240d. Measured, not guessed: the Problems list (`app_telemetry_logs`, PAGE_CRASH)
holds ONE line for it — `TypeError: Load failed` — Safari's words for a `fetch` that never finished. Two minutes
earlier the same tab logged `joinEntourageLine` "no answer after 15s"; a production deploy landed at 01:15Z and the
owner had left the tab. A march action revalidates, so its reply streams the whole re-rendered Maker back; a reply cut
mid-stream throws the transport error into rendering, and the nearest boundary was the root.

- `lib/stale-bundle.ts` — a FOURTH shape beside the stale script / stale action / rejected action: a request the
  phone cut off (`isInterruptedRequestError`: Safari "Load failed", Chromium "Failed to fetch", Firefox
  "NetworkError when attempting to fetch resource.", Safari "The network connection was lost." — matched EXACTLY, on
  a `TypeError`). `app/error.tsx` and `app/global-error.tsx` reload ONCE for it (`reloadForInterruptedRequest`, the
  same one-per-session `STALE_RELOAD_KEY` budget, spent before it waits) — and never into an offline page: offline,
  it waits for `online`. The skew shapes ("Failed to find Server Action", ChunkLoadError, "Loading chunk … failed")
  already reloaded once and are unchanged.
- `details-march.tsx` — `MarchMaker` is inside its own boundary (`MarchBoundary`): a throw in the march draws one
  line in its place, "The march couldn't load — Retry" (Retry redraws from the server's copy), recorded as
  `reportCrash(…, 'march')`; the rest of the Maker stays.
- No march exception found on a march the shape of the owner's event (`lib/march-owner-shape.fixture.ts`: 80
  walking, Surname-first names, hyphenated surnames, a best woman with a best man, a walk tied across the two sides,
  unplaced people, a two-role person): every drag the maker can draw (source × target, ~1,000+ plans) plans without
  throwing and leaves no empty walk (`lib/march-owner-shape.test.ts`); the maker renders it with every walk numbered
  (`march-renders-the-owners-event.test.ts`).

Tests sabotage-verified: boundary branch removed → red; exact-match anchor removed → red; `MarchMaker` unbounded → red.

Not done here (the real cure, tracked in the tray/drafted-march work): march moves still revalidate per step, so each
step's reply re-renders the whole Maker over the phone's connection. The owner's 2026-10-06 ruling that march edits
WAIT FOR APPLY removes that storm (one draft write per move, the real writes at Apply).

SPEC IMPACT: None.
