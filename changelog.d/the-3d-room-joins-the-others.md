## 2026-08-18 · fix(event-hub): the 3D room gets a way out too — all six rooms now do

**What a person gets.** Standing in the 3D walk-through of the venue, a guest can
reach the other parts of the event — the same strip the other five rooms got —
instead of only "← Back".

🔑 **I DEFERRED THIS AND THE OWNER WAS RIGHT TO ASK WHY.** I wrote that mounting
the strip on `/venue` was *"a design decision about someone else's canvas that
cannot be judged without looking at the page"*, because the room renders on
near-black (`#0b0d12`) and the strip is cream. He asked what the problem was.

**There wasn't one. The page had already answered the question** — its own chrome
uses `bg-white/10` chips and `text-white/60` links. The strip gained a
`tone="dark"` that matches exactly that, and nothing was invented.

⚠ **The lesson is narrower than "just do it".** Deferring a design call I could
not verify was reasonable. Deferring it **without reading what the page already
did** was not: it took thirty seconds and removed the entire objection. **A
surface that already has chrome has already made the decision you think you are
being asked to make.**

**Also:** `event_date` joins the row the page was ALREADY reading for the palette
— one more column on an existing query, not a second round trip — so the strip
knows whether the live hub's window is open.

🛡 `room-links.test.ts` — the coverage bill moves `venue` from the EXCLUDED list
to the REQUIRED one, so **all six rooms are now pinned**: any of them losing the
mount fails. `welcome` and `invite` stay excluded for the door-register reason.
**Mutation-proved:** the 3D room losing its strip (1→0) **1 fail** · restored
**13 pass**.

⚠ **NOT OBSERVED** — no local build, and the 3D room needs a published floor plan
which no production event has. Test-proved, not seen. The dark tone matches the
page's own values by construction rather than by eye.

SPEC IMPACT: None.
