## 2026-08-10 · feat(papic): the challenge board shows what it commits guests to spend

**PR 7 of 12** of the Papic three-room plan.

Every challenge a couple puts on the board is a shot a guest will spend, out of
the ONE shared pool. The board lives in **Set up**; the pool balance lives in
**Cameras**. So a couple could sign their guests up for hundreds of shots on a
screen with **no number anywhere on it**.

The board now says, in one line: what a guest doing every live challenge spends,
and how many shots are left.

🔑 **Every figure is DERIVED.** New `papicMissionCost(kind)` sits beside
`papicCaptureCost` in `lib/papic-cameras.ts` and defers to it — a photo costs
what a photo costs, a clip what a clip costs. **A second hand-typed 8 is how a
screen and a till come to disagree**, and the guard fails if anyone re-types one.

`pabati` — a video greeting — costs a clip's worth, spelled out rather than
defaulted: a kind added later must be a deliberate decision about money, not
whatever the fallback happened to be. A mission with no kind recorded costs a
photo, never **zero** — a zero there would let a whole board read as free.

🪤 **A failed pool read says nothing rather than a confident zero.**
`fetchEventPoolStatus` degrades to "absent" on any error, and printing `0` there
tells a couple they are out of shots at the worst possible moment. The balance is
`null` when the pool does not apply, and the copy branches on that.

⚠ **`papicMissionCost` deliberately does NOT live in `lib/papic-missions.ts`**,
where `CaptureKind` is declared. That module is imported by **client** components
and its own header says "no DB"; importing the cost helper there would drag
server code toward a client bundle. It lives with the constants it derives from.

No new schema — `papic_missions.capture_kind` already ships.

Mutation-tested four ways, baseline green, every sabotage verified applied: a
video greeting priced as a photo (caught) · the clip cost hard-coded into the copy
(caught) · a failed pool read printing zero (caught) · an unknown kind costing
nothing (caught).

SPEC IMPACT: None — no price changed; a cost that was always being charged is now
stated before it is committed to.
