## 2026-10-12 · perf(guest-page): the guest page's reads ask side by side, and none can hang (WIP — handed over)

Built, not live, and UNFINISHED — see `HANDOVER.md` at the repo root of this
branch. Full `tsc` has not been run on it.

- `lib/guest-page-reads.harness.ts` + `.test.ts`: the guest page's own loaders
  run against a counting stand-in; requests and serial depth pinned per viewer.
- Side by side, no read added or removed, each awaited where it was:
  `loadLiveLayer`, `loadEntourage`, `loadGuestContext`, the bundle list beside
  the orders read (`skuActiveInRender`), the prep-release switch started ahead.
  Steps one after another — a stranger 10 → 5 (6 on the day); an invited guest
  17 → 7 (20 → 8 on the day). Requests unchanged: 23 / 34 / 37.
- `lib/read-limit.ts`: every read of `/[slug]`, its layout, `invite/enter` and
  `invite/reply` waits at most 6 s, and all of one request's reads share a 10 s
  deadline. An essential read that does not answer ends the page with the guest
  boundary's words, never a "not found" or an empty page; a decoration read is
  left out for that view and logged. Writes are never limited.
- NOT built: remembering same-for-everybody facts; reading the `events` row
  once; the Maker's canvas path; flattening the two invite pages.

SPEC IMPACT: None. No schema, no env switch, no copy. The 6 s / 10 s limits and
which reads count as decoration are this session's choices, not owner rulings.
