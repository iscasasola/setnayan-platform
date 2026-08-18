## 2026-08-18 · feat(event-hub): the seat pass and the album get a way out too (S14, second slice)

**What a person gets.** Five of the Event Hub's rooms now offer the other rooms
this event actually has, instead of a single Back link or nothing.

**Mounted here:** the seat pass (all nine of its states, through the shared
shell) and the album (both its published and not-yet states). With the previous
slice that makes **find-seat · find-my-table · gifts · album · seat pass**.

🪤 **THE GUARD WAS DECORATION ON ITS FIRST RUN, AND MY OWN CODE WAS THE PROOF.**
The coverage check matched the string `RoomFooter` anywhere in a room's files —
so deleting every `<RoomFooter …/>` left `import { RoomFooter }` behind, the
name still matched, and the guard stayed **GREEN while the room was a dead end
again**. Re-anchored to the JSX mount `/<RoomFooter\b/`.

🔑 **And the moment it was fixed, the baseline went RED — because the seat pass
took the prop and never rendered it.** I had added `roomLinks` to
`SeatPassShell`, threaded it through all nine call sites, and never put the
component in the markup. **A guard that matches the symbol proves the import; a
guard that matches the mount proves the render.** This repo has recorded that
exact defect before; this is the first time it caught mine.

**Now mutation-proved per room:** recap (2→0 mounts) · seat (1→0) · gifts (1→0) ·
find-seat (1→0) — **each turns the guard RED**; the excluded 3D room GAINING one
also fails; restored **13 pass**.

⛔ **THE 3D ROOM IS DELIBERATELY WITHOUT ONE, and it is now pinned as such.**
`/venue` is a DARK art-directed surface (`#0b0d12`); the strip is cream chips on
a hairline rule. Dropping it into someone else's canvas is a design decision, not
a mount, and it cannot be judged without looking at the page — which is not
possible here. **Deferred on purpose, with the reason in the guard rather than a
comment**, so a future session either honours it or deletes it deliberately.
`/welcome` and `/invite` stay excluded for the door-register reason already
recorded.

⚠ **NOT OBSERVED** — no local build; the only non-wedding events are two
hand-made test rows.

SPEC IMPACT: None.
