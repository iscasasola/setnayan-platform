# Event Hub Pro — proof shots (prototype vs built)

NOT FOR MERGING. Left: the approved prototype (`Setnayan-specs/prototypes/build-contracts-2026-10-30/event-hub-pro/index.html`,
its "Try it" states). Right: the built stack (slices 1 → 2 → 4 → 3) in `/dev/maker-lab` — no database, no real event.

| Shot | What |
|---|---|
| stages-390 / 820 / 1280 | The Hub inside the app's top bar and bottom nav (rail from 701); pinned row [Stage ▾ \| Studio ▾] · ↺ · ✓ · ⚙; no ✕ |
| hidden-390 / 820 | The toolbar stowed after a tap on the empty page: the part stays picked, the head reads "You're editing · … ▴" |
| shown-again-390 | A tap on the head brings back the same part and tool |
| menu-stages-* | Stages ▾ (unchanged list) |
| menu-studio-* | Studio ▾ = Logo · Palette + Dress Code · Love Story (+ Prints until PR #7020), "2 of 4 ready" |
| settings-* | ⚙ Event Hub settings: Look · Your Event Hub (open) · What guests see · E-Gifts |

Known differences: at 820 the prototype draws a two-column tablet (tools docked); the shipped Maker has no tablet column
(it is the phone layout from 701 to 1023), and this build does not add one. The prototype's selector thumb is white; the
app's one pill colour (terracotta, DECISION_LOG 2026-10-08 "SELECTORS ARE PILLS THAT SLIDE") is kept. The lab's top bar
is the lab's (search box), the real event layout's bar is the app's.
