## 2026-08-01 · fix(papic): the crew page still promised 5 seats, and the QR page never said "QR"

Both reported by the owner from the live app.

**① "Top up your 5 seats" / "Your 5 photo-crew seats"** — from
`PAPIC_SEAT_COUNT = 5`, the count of the **retired** PAPIC_SEATS pass. What an
event actually gets is `PAPIC_FREE_CAMERA_COUNT` (3) shared-pool cameras plus the
free Papic One, or however many a paid event bought. **Five was true of none of
them.**

🪤 The success message twenty lines below was fixed for this exact reason and
still carries the comment saying so — *"Was 'Your five seats are ready' — a
hardcoded count from the retired PAPIC_SEATS pass … read off the roster, never
spelled."* But that is the branch that renders when seats EXIST, and the stale
copy was in the branch that renders when they do not. **One arm got the fix; the
other kept the number.** The zero state now spells no count at all — it is the
state in which the roster it would describe does not yet exist. `PAPIC_SEAT_COUNT`
is gone from the file.

**② The QR codes were unfindable.** They live at `/studio/papic/crew` (per-camera
QR, plus printable cards at `/crew/print`), reached from a link labelled **"Crew
& claim links"** — so the word *QR* appeared nowhere on the path to them. Now
"Camera QR codes & claim links". The feature was never missing; the signpost was.

## Not changed, deliberately

The owner also asked whether the free tier should be "papic pool with 50 pts
only" and then **withdrew the question**. The 2026-07-29 lock stands: free is the
50-point shared pool **plus** one free Papic One camera at 5 points. Nothing here
touches it.

The prompt for that question was a screen reading **"Free with your unlock
pass"** on a ₱50 camera — which is the documented `is_internal` false-green
(`eventSkuActive()` returns true for every SKU on an owner-hosted event), not a
pricing bug. Recorded here because the same screen will mislead the same way on
the next owner-account test.

SPEC IMPACT: None — copy only.
