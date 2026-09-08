## 2026-09-09 · fix(papic): a photograph lands on the minute it was TAKEN

Both Papic write paths let `captured_at` fall to its column default of `now()`,
so a capture was filed under the minute its bytes finished arriving. At a venue
with patchy signal a 2 PM photograph landed at 8 PM — and every surface built on
that column (the day timeline, the recap selection, the magazine chapters, and
the by-the-minute story dial this is the foundation for) measured where the
reception had signal rather than what happened.

* `20271214644139_the_minute_is_the_shutter.sql` — `p_captured_at` as the last,
  defaulted argument on `papic_record_guest_capture` and `papic_record_seat_capture`
  (drop-then-create, never an overload: 20271184624871 measured the 42725 trap),
  plus `public.papic_capture_minute(event, claimed)` — the one validation both
  writers consult. It **refuses a time, never a photograph**: absent, in the
  future, or from before the celebration existed all resolve to `now()`, which is
  byte-for-byte the behaviour every row had before. `created_at` is untouched and
  stays the upload minute.
* The shutter is now carried end to end: stamped at the frame grab (photos) and
  at the recorder's start (clips) on both cameras, through the multipart form,
  through `papic-sink.ts`'s `deps.record(...)` — the arity where the seat path
  dropped it — and through both offline queues, including the guest drain, which
  had written `captured_at_ms` into its payload since it shipped and never put it
  back on the wire.
* Deploy-window rungs on both callers, so the minutes where the code is live and
  the migration is not record the capture with its upload minute instead of
  refusing it.

Tests: `tests/db/the-minute-is-the-shutter.db.test.ts` (5) proves a six-hour-late
upload does not move a bar, that a believable time is believed, and that four
kinds of unbelievable clock each still record the capture;
`lib/papic-capture-minute.test.ts`, `lib/camera-bridge/papic-sink.test.ts` and
`lib/offline/service-handlers/papic-drain.test.ts` cover the carry.

Owner ruling 2026-09-07: *"when we get the photos and snippets, we know. but the
guest does not need to know."* Read on ingest — never asked, never surfaced.

SPEC IMPACT: None. `Design_Editorial_By_The_Minute_2026-09-07/03_Data_Requirements.md`
§2.1 and `08_Build_Order.md` step 0.1 specify exactly this; the corpus is updated
separately when the phase closes.

### Guards this change had to answer to (2026-09-09)

Six existing guards fire on the code and the surface this touches. None was weakened;
each was answered.

* `app/papic/the-meter-is-the-only-door.test.ts` §3/§4 — **exactly one**
  `writer.rpc('papic_record_seat_capture')` in `actions.ts`, with the caller identity and the
  metered cost inline at that call. A first cut added a signature-fallback rung there, which
  made two call sites into the authoritative writer. The rung is **removed**, for a measured
  reason rather than to go green: `deploy-prod.yml` applies migrations **before** it triggers
  the Vercel deploy hook (gate step printed "✅ Configured" on the 2026-09-08 `main` runs), and
  even without that, a `42883` on this path answers `unavailable`, which is not in
  `PAPIC_TERMINAL_ERRORS` — so the capture UI queues the shot and a later drain lands it.
  Nothing is lost by waiting, so the rung bought nothing and cost a money-safety property.
* `lib/papic-guest-ceiling-is-wired.test.ts` — the guest ladder's expected shape moves from
  `[7,6,3,2]` to `[8,7,6,3,2]`. **Widened by one entry at the front, not loosened.** That rung
  IS load-bearing and outlives the deploy race: without it a `42883` on the 8-arg call is caught
  by the next rung's own `/function .*papic_record_guest_capture/` arm and falls straight to the
  6-arg shape, which cannot carry `media_type` — silently recording every clip of that window as
  a photo, the exact degradation the test exists to prevent. Sabotage-checked: removing the rung
  turns the guard red.
* `tests/db/papic-guest-own-credits-are-hers.db.test.ts` and
  `tests/db/papic-guest-spend-ceiling.db.test.ts` pin the writer's exact `regprocedure`; both
  updated to the 8-argument signature.
* `supabase/security/exposure-surface.baseline.txt` regenerated. The diff is **one line**: the
  same anon/authenticated-callable function with one more argument — same grantees, same
  `secdef`, same `search_path`, no new capability. `papic_capture_minute` deliberately does not
  appear; it is service_role only.

Local verification after the fixes: unit `13870 tests · 0 fail` · db replay `2383 tests · 0 fail`
· `TSC_EXIT=0 ERROR_LINES=0`.
