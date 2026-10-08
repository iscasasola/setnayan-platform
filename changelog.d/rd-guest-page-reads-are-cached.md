## 2026-10-08 · fix(perf): the guest page starts its independent reads together — and its render time has names

**Production, 2026-10-08** (controller): one guest page for a real event rendered in 2.2 s; its own
timing line said `slug/invitation-body` total ≈ 1,150 ms with phases summing to ≈ 270 ms.

**Cause.** The body is two dozen `await`s in single file. Most need nothing from the one before; each
simply could not start until its neighbour had finished. And three quarters of the time belonged to
no named phase, so nobody could say which reads it was.

**Change** (no read added, none removed, no cache, no staleness — the same 35 requests):
- `lib/start-ahead.ts` — start a read now, await the SAME promise where it always was; a rejection
  is neither lost nor an unhandled rejection. The page's own idiom (`skeletonHeroDesign`), named.
- `app/[slug]/page.tsx` — the scene list, the guest session and the account start beside the media;
  the doorway facts and the entourage start beside the day-of layer; "is this their event?" and "are
  they a booked supplier?" no longer wait for each other.
- `app/[slug]/_lib/loaders.ts` — inside the media: Pro, the venue bookings and the paid openings
  start together; inside the day-of layer the camera check starts beside the schedule.
- `lib/server-timing.ts` — `mark(label)` names everything since the last named stretch, and `flush`
  SAYS what is left (`unnamed`). The guest body now logs draft-look · media · widgets · guest-session
  · gates · live-layer · capabilities · supplier-desk+seat · pabuya-admission · doorway-facts ·
  chapters+entourage+identity · guest-context.

**Measured** (harness, a 30 ms database round trip, signed-in view of `/<slug>`): body 861–937 ms →
596–629 ms; requests 35 → 35. Where the time is now: live-layer ≈ 260 ms, media ≈ 210 ms, gates ≈ 65,
capabilities ≈ 47, unnamed ≈ 39.

**Caching across requests is NOT in this PR** — the read map and the three ways to do it safely are
in the PR body; the safe one needs one migration (a per-event revision stamp) and the owner's word.

SPEC IMPACT: None. Status in `PERF_FANOUT_BUILD_STATUS_2026-10-08.md`.
