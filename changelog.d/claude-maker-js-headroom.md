## 2026-11-27 · perf(maker): the event pages stop downloading Node's Buffer polyfill

The Maker's first-load JavaScript sat at its 508 KB gzipped ceiling (main 67e905f: 507.9 KB), so batch PRs failed on 0.0–0.2 KB of build-to-build drift.

- **Cause:** `lib/print-mark.ts` reaches the browser on every event page (event layout → `event-rail-context` → `event-monogram` → `monogram-svg-safe` → `logo-layers` → `print-mark`). One line in it, `rasterMarkPayload`, decoded base64 with a bare `Buffer`, so the client build injected the whole `buffer` polyfill (plus `base64-js` and `ieee754`, ~8.2 KB gzipped) into the event layout's chunk. Only the print server (`lib/print-set.server.ts`) calls that function.
- **Fix:** the decode now uses `atob` (in every browser and in Node ≥ 16) through a small `base64Bytes` helper. It gives the same bytes `Buffer.from(s, 'base64')` gave for everything the wrapper regex accepts, including missing padding and a lone trailing character.
- **No behaviour or visual change:** same bytes to the print server. Nothing else in the Maker referenced the polyfill.
- **Budget:** not raised. The before and after figures are in the PR body.
- **New guard:** `lib/print-mark-has-no-buffer.test.ts` checks that no `Buffer` appears in the file (comments stripped) and that the bytes match `Buffer` across 90+ samples.
- **Server actions:** none added. No migration.

SPEC IMPACT: None. A size fix with no product change.
