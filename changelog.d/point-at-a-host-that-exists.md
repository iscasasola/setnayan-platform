## 2026-09-09 · fix(desktop): the updater and CSP point at a host that exists

S14 (`build-sessions/encoder/S14.md`). `media.setnayan.com` never resolves and the
owner ruled it is not being set up (2026-09-05) — but `tauri.conf.json`'s updater
endpoint and `updater.rs`'s `EXPECTED_ENDPOINT_HOST` guard both pinned that dead
host, so S12's updater could never work even once the four R2 secrets (X0-TRACKER
item 6) are set: its own "endpoint not R2 -> red" guard would refuse the address
production actually serves from.

- Repointed `tauri.conf.json`'s `plugins.updater.endpoints` and `updater.rs`'s
  `EXPECTED_ENDPOINT_HOST` together, in one commit, to
  `pub-37d64fe618584c2981a88610a55dd439.r2.dev` — the `setnayan-media` bucket's
  `r2.dev` dev subdomain production is actually measured serving R2 media from
  (live `/download` page + homepage asset URLs, 2026-09-08). Kept pinned to
  exactly one host; re-pointed the two existing evil-host-shape tests
  (`...evil.example` suffix and host-in-path) against the new host, and added a
  regression test that the retired `media.setnayan.com` host is explicitly
  refused.
- Added `img-src`/`media-src`/`connect-src` entries for the live `r2.dev` host in
  `next.config.ts`'s report-only CSP, alongside (not replacing) the dead
  `media.setnayan.com` entries — `R2_PUBLIC_URL` is unset in production today, so
  a future custom domain needs the same additive treatment. The enforced header
  only carries `frame-ancestors`+`frame-src` and is unaffected.
- Added `apps/web/lib/csp-r2-media-host-consistency.test.ts`: every R2 media host
  must be named in `connect-src`, `img-src` AND `media-src` together, anchored on
  the parsed directive value (not a whole-file string search, which a retired-host
  comment could satisfy without the CSP actually allowing anything).
- `build-sessions/encoder/README.md` and `X0-TRACKER.md` already carry this
  session's premise and are not touched here — PR #5326 (merged) got there first.

Mutation-tested: the exact-host-match guard (naive `.contains()` sabotage) —
0 → 2 failures; the config/constant agreement guard (mismatched host) — 0 → 1
failure; the new CSP three-directive consistency guard (dropped host from
`img-src`) — 0 → 3 failures.

SPEC IMPACT: None — this closes X0-TRACKER item 7's open engineering half; the
tracker text itself already reflects it and needs no further edit.
