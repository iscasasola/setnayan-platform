## 2026-10-18 · fix(papic): a guest shot's points and its photo commit together — a death between them can no longer leave points spent

Owner 2026-10-18, on "Papic: points can stay used up if a shot's save fails partway": "build it". Named and left open
by #6621.

- **One transaction** — `papic_record_guest_capture_and_spend` (migration `20271276810836`, service-role only) books
  the shot's points against the same ledgers the route used (`papic_reserve_capture_split` when the guest holds her own
  camera, else `papic_reserve_event_points`) with the same cost, and writes the row through the unchanged
  `papic_record_guest_capture` — so the per-guest ceiling meters exactly as before. Either side refusing undoes the
  other; a timeout, an eviction or a deploy mid-call rolls back both. A repeat of a landed shutter books nothing.
- **Order, forced per ledger**: a guest with her own camera books BEFORE the row (the ceiling reads her self-funded
  spend off that ledger); everyone else books AFTER it, so the event pot's row lock is held only to the commit.
- **Route** (`app/api/papic/guest-capture/route.ts`): the reserve, the 9→2 signature ladder and the hand unwind are
  replaced by the one call (no fallback ladder — the seat path's measured reasoning). `reserveGuestOwnCameraCapture`,
  `papicReserveEventPoolForCapture`, `lib/papic-release-capture.ts` and the now caller-less
  `papic_release_capture_split` and `papic_release_event_points` RPCs are dropped.
- **Proofs** — `tests/db/a-guest-shot-spends-with-its-row.db.test.ts`: (a) a fault injected after the row and after the
  booking leaves every balance as it was, on both ledgers, with a control showing the same fault leaks on the old
  two-call shape; (b) one shot spends exactly once ("spend 2 and take 6" intact); (c) a retry with the same shutter id
  spends nothing. `papic-guest-own-credits-are-hers.db.test.ts` now drives the new function — all 14 ceiling tests pass
  through it unchanged.

SPEC IMPACT: None.
