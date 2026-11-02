## 2026-08-29 · fix(papic): the browser was the only thing enforcing a per-guest limit that does not exist

`papic_record_guest_capture` lifts the per-guest ceiling with **two** writes to
`v_unlimited` — an active `PAPIC_UNLOCK` **or** a celebration whose shared pot
applies (migration `20270920602517`, lines 109 and 114). `fetchGuestQuota`
mirrored only the first: the pool disjunct arrived with the one-pool model and
never crossed into TypeScript. Every celebration arms the free 50-shot grant on
render, so the per-guest cap is inert server-side **everywhere**, and
`app/api/papic/guest-capture/route.ts` never pre-checks `remaining`.

Meanwhile the guest camera counted down from a hardcoded 150, unmounted its own
shutter and painted *"That's all 150 photos, {name}!"* — so a guest at a large
celebration was locked out of a pot still holding thousands of shots, by a number
nobody chose, and the couple never learned it happened.

- The rule now lives once, in `lib/papic-guest-cap.ts`, as one entry per SQL
  write. `fetchGuestQuota` asks both sources and publishes `capApplies`,
  `poolRemaining` and `poolLow`.
- The camera draws a personal countdown, and may hide its shutter, **only** when
  `capApplies`. Otherwise it shows nothing — or the celebration's own remaining
  number once the pot crosses its soft-stop line. `"Unlimited"` is retired: a pot
  is finite.
- The two refusals are separated in **both** handlers (photo and clip are two
  copies of one rule). `res.status === 409 || json.status === 'quota_exhausted'`
  collapsed a POOL-EMPTY refusal into the per-guest congratulation, so a guest
  three photos in was congratulated for a shot that was thrown away while the buy
  panel opened to sell shots that also could not be taken. The pool case has its
  own latch and its own sentence about the celebration; offering more shots stays
  correct in both.
- `GuestPapicCamera` is declared once, in `app/[slug]/_lib/types.ts` — the loader
  re-declared the same shape inline, which is the same disease as the bug.
- Guard `lib/papic-guest-quota-mirrors-sql.test.ts` **derives** the disjunct count
  from the migration (counting both `v_unlimited :=` and `SELECT … INTO
  v_unlimited`) and compares it against what `papicGuestCapLifts` returns, so a
  third condition added in SQL fails here until the TypeScript learns it too.

No migration, no new feature, no setting. A celebration where the ceiling
genuinely binds behaves byte-identically.

SPEC IMPACT: None — this implements `WHATS_NEXT_Shots_Per_Guest_2026-08-28.md` § 1,
which already records the defect and the fix.
