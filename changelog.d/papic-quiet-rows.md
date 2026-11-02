## 2026-08-26 · feat(papic): the look becomes one quiet line instead of five cards

Owner, opening his own wedding's Papic page: *"entering papic inside an event needs to me simpler and better to manage. if I am a customer and I see this, I will be confused."*

**The first thing on that screen was five large gradient cards asking him to pick a look** — a decision made once, months before the day, occupying exactly the space where *"what do I do"* belongs. Fourth slice of the control-centre rearrange (`prototypes/papic_control_center_2026-08-25.html`).

**🔑 THE RULE IS HOW OFTEN YOU TOUCH THE THING**, and it now applies consistently across this screen:

| how often | treatment |
|---|---|
| you decide it **once** | a quiet **row** showing its current answer, opening a sheet |
| you **come back** to it | stays on the page — the library, the ways in, the credits |
| **we** can answer it | deleted outright — photo quality, "where your photos go" |

**⚠ THE PICKER IS NOT REDRAWN.** `StylePicker` is passed into the sheet as `children` and rendered exactly as it ships, lock note and all. **A row is a different DOOR to the same control, never a second copy of it.**

🚨 **AND THAT IS THE FAILURE THE GUARD IS FOR — duplication, not layout.** The tempting next edit is to reimplement the five looks inside the sheet "so the row owns its own UI". That is how this codebase ends up with two copies of one control, drifting — **the exact shape that produced a tier title with three different values in three places on this same day** (seed `Papic Mini`, code `Papic One`, production `Dedicated camera (legacy)`).

**The row shows the current answer, derived** from the style table rather than re-typing those five words — a second copy of the labels would drift from the picker the same way. **A row without its answer is strictly worse than the card it replaced.**

⚠ **The sheet is mounted only while open.** The pickers inside carry forms and their own state; keeping them mounted behind a closed sheet leaves that state alive, and for a server child keeps its work on the page for a screen nobody is looking at.

**🛡 Guard `_lib/a-row-is-a-door-not-a-copy.test.ts`** — 4 rules: the primitive still opens a sheet and renders its children · the look is a row and its old page-body heading has not returned · **the sheet renders `StylePicker` and none of the five look names is drawn inside the row** · the answer is shown and derived.

**Mutations**, counts printed before → after: the picker reproduced instead of rendered (1→0) 🔴 · the row stops showing the answer (1→0) 🔴 · the label hard-typed instead of derived (1→0) 🔴 · the row stops rendering its children (1→0) 🔴. Green on both clean sides.

⏭ **The other set-once choices stay cards for now** — face matching and guest cameras each render their own full card with its own heading, so converting them means changing those components rather than wrapping them. The primitive is built for it; this slice is the one the owner actually pointed at.

**SPEC IMPACT:** None — under the purpose lock in `DECISION_LOG.md` 2026-08-26.
