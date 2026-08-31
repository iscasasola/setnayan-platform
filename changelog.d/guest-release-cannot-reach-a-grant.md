## 2026-08-31 · fix(papic): remove the guest give-back button — it INCREASED her balance

`revert` of PR #5028's release path (the UI, the action and the pure helpers), on a
measured defect, live in production since 2026-08-31.

**What was wrong.** A guest who bought credits with *"keep them for me"* was offered
*"Give the unused N to the celebration"*. Pressing it moved credits the WRONG WAY on
both sides of the ledger. Measured against the replayed migrations — pot 3,000, her
purchase 137, already shot 41:

| | before | after |
|---|---|---|
| her dedicated balance | 137 | **178** (+41) |
| the couple's shared pot | 3,050 | **3,009** (−41) |

The button read *"Give 96 to the celebration"*. Nothing was given; 41 was taken FROM
the shared pot and added to hers. A second press is a no-op, which is part of why it
read as working.

**Why.** A guest's purchase is a `one_reload` rung granted through
`papic_grant_camera_points` — it lands in `papic_event_point_grants` (`seat_id` SET).
`papic_dedicate_shots` reads and writes `papic_seat_allocations` ONLY, the host's
hand-out layer. On a grant-funded camera the allocation row is `0`, so a TARGET of
her spend against a current of zero takes the **giving** branch.

**Why removed rather than rebuilt.** Releasing a grant needs a primitive that does not
exist, and per the corpus correction of 2026-08-31 whether that feature is wanted at
all is an **owner call that has not been made**. The purchase-time keep-or-share
choice the owner actually locked (*"both. they can claim it all or share it to
everybody"*) is untouched and still ships.

**Tests.** `tests/db/papic-a-grant-cannot-be-released.db.test.ts` pins the measured
figures and carries `releasesContract` — the assertions a real primitive must satisfy
(balance DOWN, pot UP by the same, spend untouchable). `lib/a-guest-cannot-release-a-grant.test.ts`
fails CI if the guest buy surface reaches for `papic_dedicate_shots` again.

SPEC IMPACT: `WHATS_NEXT_Shots_Per_Guest_2026-08-28.md` § 7b — the "✅ BUILDABLE WITH A
SHIPPED PRIMITIVE — nothing new" claim is false for the release half and is corrected
there. `WHATS_NEXT_Shots_Per_Guest_SESSIONS_2026-08-28.md` S5 updated: the release is
removed from prod, not merely unbuilt.
