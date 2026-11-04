## 2026-11-04 · fix(schedule): event chapters — the Schedule matches the approved 4 Nov prototype

Owner, on the side-by-side screenshots: *"prototype and build do not look the same"*; then, asked about the shipped 1–2 Nov top rows: **"Match the 4 Nov prototype"**. Follows #7238 (slices 1–3), which merged before these could ride it.

- **Event Day's one line** (frame 1): `Event Day ▾ · 4 chapters · 👤 · ⚙`. The round 👤 is the shipped View as (`ViewAsMenu round`); ⚙ opens **Schedule settings** — one sheet holding the date line and its ⓘ, Announce, Share, and the day's tools (supplier requests, Host / MC, the emcee script, Running late), handed up by the one line and the rail (`ChaptersApi.setSettingsPart`). Where no chapters are drawn (the Maker, a failed read) the line is unchanged.
- **A chapter's page** (frame 2): one row — `Cocktail + Reception ▾ · N moments · N suppliers · 👤 · ⚙` — replaces the ‹ back button, the big title and the date line (Event Day / Planning Stage are in the dropdown). View as is shared with Event Day (`ChaptersApi.lens`).
- **The tip** "Your event starts with four chapters…" sits under the one line.
- **The rail**: a chapter shows its venue on a phone ("Venue TBA" until it has one), reads "10:30 PM onward" when it has no end, and is tinted by its kind (`Chapter.block_type`).
- **Sections**: the Event's own hours ("5:00 PM – 10:00 PM · 4"); an open section's letter in the accent; "+ Add a moment" at the foot of each open section.
- **Held hours**: "setup from 1 PM, out by 11:30 PM" (`heldHoursLine`); "Ask <venue> to change" on its own (`AskSupplierSection bare`).
- **Delete**: the swipe's warning is titled "Delete <chapter>?".
- **Restored**: `lib/a-venue-holds-its-chapter-hours.test.ts` shipped EMPTY in #7238 (a lab edit truncated it before its first commit) — rewritten, 5 tests.

SPEC IMPACT: The 4 Nov prototype now outranks the 1–2 Nov one-line frame (19 · 19b · 20) and the 1 Nov chapter page header on the Schedule page — owner's choice, 4 Nov. Not changed: the shared "+ Add a chapter" pill (approved 2 Nov) and the Undo toast's place (the 8 Oct "peek from the top" rule).
