# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-02 · fix(venue): there is only one of you in the room, and you sit down

A token-holding guest on the public 3D walk saw **two of themselves.**

`GuestTable` drew a seated accent figure at their own chair the moment the page
opened, while `GuestAvatar` walked a second copy of them across the room toward
that same chair — and because `seatApproachPath` ends **on** the chair (its own
test pins "path ends exactly on the chair"), the walker finished by standing
*inside* the seated one. Meanwhile the on-screen hint promised **"tap your gold
seat to sit"** on a surface that mounted **no `SitController` at all** — grep
returned zero references.

🔑 **Nothing was broken.** Every piece did exactly what it said; they were merely
all true at the same time. That is why no test caught it, and why the guard for
it asserts about the render graph rather than a return value.

### What changed

- **The own seat draws no body.** The gold ring marks it; your body walks there.
- **The walk stops beside the chair**, retargeting its last waypoint to
  `approachPoint(seat, SIT_TIMING.APPROACH_M)` — the last 0.55 m belongs to the
  sit clip, which steps into the gap it opens by pulling the chair back.
- **`<SitController>` is mounted**, taking the heading and frozen gait phase from
  the walker so the arrival blend starts in the pose it actually stopped in
  (`arrivePose="run"` — this avatar jogs at 2.2 m/s and renders the run cycle).
- **`InstancedChairs` now registers `tableId`.** Without it `detachChair()`
  no-ops and the guest sits through a chair that never moves.
- **The walker hides its body rather than unmounting.** Unmounting would reset
  its tracked position and teleport the guest to the entrance the moment they
  tapped to stand up again. Any new destination clears the sit and hands the
  body back.

Every piece already existed in the kit — the demo scene has done exactly this
since 2026-07-08. This wires the public surface to the same proven path.

### The guard, and its honest limit

`lib/there-is-only-one-of-you-in-the-room.test.ts` pins the four properties that
each alone re-create the bug, plus the geometry the retarget depends on
(`approachPoint` lands 0.55 m behind the gaze for all 24 tested directions,
never on the table side) and the fact that the walk's retarget and the sit's
step-in read the **same** constant.

| Sabotage | Caught |
|---|---|
| restore the seated copy of you | ✅ |
| walk all the way onto the chair again | ✅ |
| drop the chair registry | ✅ |

⚠ **What no test here can do: prove the sit LOOKS right.** The choreography is
visual. This change was verified by type, test, sabotage and by reading the
demo's proven implementation — **not by watching it play.** The in-app browser
could not move the camera close enough to inspect the figures, and a fresh
worktree's dev server has no `.env.local`. Worth a real look on the deployed
preview before this is considered visually confirmed.

Verified: typecheck ✅ · lint ✅ · 11,893 unit tests ✅ · all 29 CI guards ✅

SPEC IMPACT: None.
