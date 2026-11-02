## 2026-09-18 · chore(papic): drop the pre-split camera gate — five functions nothing calls (S37)

**SPEC IMPACT:** None — the owner's 2026-08-11 "spend 2 and take 6" ruling already replaced this gate;
this removes the leftover functions.

S26's both-ends guard (#5625) ranked `papic_reserve_camera_capture`, `papic_camera_remaining`,
`papic_reserve_camera_points`, `papic_release_camera_points` and `papic_reserve_event_points_for_seat`
as `rpc-no-caller`. **The question the controller asked — is guest capture wired to spend credits at
all? — yes, on every path, and through none of these:**

- guest phone → `app/api/papic/guest-capture` → `papic_reserve_capture_split` (or the pool reserve)
  → `papic_record_guest_capture`, unwound by `papic_release_capture_split`;
- QR camera → `app/api/upload` presign probe → `papic_record_seat_capture`, which calls
  `papic_reserve_capture_split` and inserts in one transaction.

#5585 retired seat *products*, not the camera table (`paparazzi_seats` is still how a camera is
identified). What these five encode is the pre-split gate — two of them the retired **ceiling**
("the 11th shot is refused", the exact defect the floor ruling fixed). Re-measured in production: no
function body calls them (one comment names one), no policy, no view. **(b) delete** —
`20271234330879_drop_the_pre_split_papic_camera_gate.sql`. `papic_camera_remaining` was still
anon-executable in production; the exposure baseline loses that line and gains none.

Also removed: `resolveEventPoolReserve()` (the decoder of the dropped function's -1/0/1 result; no
caller but its own test).

**Tests moved onto the live gate, none weakened:**
- `lib/papic-dedicated-camera-metering.test.ts` — "dedicated means unshared" and the pool probe now run
  through `papic_reserve_capture_split`; the two ceiling assertions are gone because the ceiling is
  gone, and the split's all-or-nothing rule is owned by `tests/db/papic-dedicated-is-a-floor.db.test.ts`.
- `lib/papic-pool-metering.test.ts` — the 30-reserve passthrough loop through the dropped per-seat gate
  is replaced by the two facts it proved (no per-seat ledger, per-seat uncapped).
- `tests/db/papic-one-product-hand-out.db.test.ts` — "never billed twice" asserted through the split
  gate (`pool_spent = 0` on a camera paying from its hand-out).
- `tests/db/papic-camera-grant-authz.db.test.ts` — "closed to anon" becomes "does not exist", asserted
  directly (a privilege check on a missing function also reads false).
- Comments in eleven files that described the dropped gate as live now name the split gate.

Local: 43/43 across the six affected files, including the floor suite.

⏭ Not in scope, named: `vendor_papic_capture_grants` (no writer — the admin-comp `unli` tier) is an
owner call, reported separately.
