## 2026-10-08 · fix(maker): ✕ offers both ways out — Back to this event · All events (two taps to Events)

Owner, on the live Maker at 896 px, verbatim: *"why can't i go back to events?"* → *"Okay, fix the three step."* The Maker is a full-screen layer over the app's top bar and rail, so their "Events" link is covered; ✕ went to this event's page and Events was two more taps from there.

- ✕ (`maker-shell.tsx`, the one toolbar both the shipped Maker and the new one draw) is now a button that opens the Maker's ONE bottom sheet (`MakerSheet`) with exactly two doors as ActionButtons: **Back to this event** (`/dashboard/<eventId>`, where ✕ always went) and **All events** (`/dashboard`). It no longer leaves by itself.
- When the draft has unapplied changes, one line says they are kept — "Your N changes are saved as a draft." — from the draft bar's own ✓ count (`MakerDraftDoor.count`); nothing is said for a clean draft.
- Escape and a tap on the dimmed page close the sheet; neither leaves the Maker. The sheet is shown at every width (`MakerSheet everyWidth`; every other Maker sheet stays a phone's).
- Lazy (`details-lazy.tsx` `MakerExitSheet`): the first load carries the button and its open state only.
- Guard: `lib/the-maker-exit-offers-events.test.ts`.

SPEC IMPACT: None — no prototype existed for this sheet; it is built from the Maker's own sheet and the button rule (BUTTON_RULE_2026-10-07). Captures for the owner: corpus `prototypes/maker-exit-2026-10-08/`.
