## 2026-09-03 · fix(plan3d-room): a peer whose position never arrived is not standing at the origin

Presence carries a **name and a colour** — it has never carried a position. So a
peer joins the roster before anyone knows where they are, and `sendMove`
transmits only while moving (plus one settle frame), so nothing closes that gap
on its own. `reconcilePresence` filled it by seeding `x: 0, z: 0`.

That is not a neutral placeholder. `pctToWorldM` maps 50%/50% to the origin, so
**(0,0) is the exact centre of the room** — on most floors, the dance floor.
Every un-broadcast peer was drawn standing in the middle of the party, stacked
on top of each other.

⚠ **Why it stopped being cosmetic.** This was a rendering wart for as long as
nothing consumed those coordinates. The moment the public walk began yielding to
peers (previous PR), the same phantom pile started **shoving the local walker**
away from the room centre — a guest joining could nudge your avatar from a spot
nobody was standing in. A wrong answer that had merely been visible became
load-bearing on movement. Fixing the walk is what made this worth fixing now.

**Fix — say "unknown" instead of guessing.** `RemotePlayer` gains `placed`,
false until real coordinates arrive and flipped true by the first `applyMove`.
`activeRemotes` — the ONE point both the renderer and `remoteMovers` read — drops
unplaced peers, so an unknown position is neither drawn in an invented spot nor
walked around in one. `onlineCount` is computed separately and is untouched: an
unplaced peer still counts as here, because they are.

The field is REQUIRED, not optional-with-default. Three existing fixtures failed
to typecheck on the change, which is the point — an optional flag would have let
a future construction site silently re-introduce a peer with an unexamined
position.

**Guard — `lib/a-peer-you-have-not-placed-is-not-in-your-way.test.ts`.** Pins
that presence alone never places; that unplaced peers are neither drawn nor
dodged; that the first real position enables both; that a presence re-sync never
UN-places a settled peer (a sync fires on every join, so this would blink a
located guest back to the origin whenever anyone else opened the page); and that
a peer who LEFT but was located still renders while they walk home, since that
is a separate shipped contract this change must not quietly break.

SPEC IMPACT: None.
