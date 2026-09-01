## 2026-09-01 · feat(papic): the currently-armed challenge reaches the live wall

Papic Build Order §4 (re-measured 2026-08-31): the challenge library, the
armed-on-camera UX, and `papic_mission_completions` already shipped — the wall
itself rendered zero references to any of it. Added `fetchWallArmedChallenge`
(`lib/live-wall.ts`), which resolves the live board's top mission (lowest
`board_slot`, same ordering the v4 guest board reader already uses) plus the
`papic_mission_completions` answer count, folded into the existing
`getWallSnapshot`/`WallSnapshot` shape rather than a second read path.
`live-wall-block.tsx` (the guest-phone mirror) now renders the prompt and a
live "N guests have answered" count.

THE READ IS HONEST: a refused query reports `measured:false` and the banner
says "Challenge status unavailable right now" — it never collapses into the
same render as a genuinely un-armed wall (`measured:true, challenge:null`),
mirroring `guests-read-is-honest.test.ts` / `vendor-sponsored-shots-are-
scoped.test.ts`. Covered by
`apps/web/lib/live-wall-challenge-is-honest.test.ts` (source guards on the
reader, since `live-wall.ts` pulls in `server-only` transitively; behavioural
+ render-source assertions on the block), mutation-checked.

No new columns and no migration — a parallel session owns the challenge clock
that will eventually replace "top of board" with a real armed/expiry window.

SPEC IMPACT: `WHATS_NEXT_Papic_Build_Order_2026-08-29.md` § 4 — item 4 is now
built against what ships today (the clock lands separately). Corpus not
edited further; no schema/decision changed.
