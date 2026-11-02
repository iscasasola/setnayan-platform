## 2026-10-30 · feat(maker): Event Hub Pro slice 2 — the editing toolbar shows and hides, with its slim "You're editing … ▴" head

Builds slice 2 of the approved Event Hub Pro look redesign (DECISION_LOG 2026-10-30 "EVENT HUB PRO (look redesign) —
THE APP'S NAV STAYS; THE EDITING TOOLBAR SHOWS AND HIDES; THREE OPEN CALLS SETTLED"; prototype
`prototypes/build-contracts-2026-10-30/event-hub-pro/` "Hide the toolbar"). Stacked on slice 1.

- **Hides** on a tap on the empty page (it let the picked part go until now — the part now STAYS picked, its frame on
  the page: something is always picked), a scroll of the page (a finger or a wheel only — the canvas says
  `pageScroll`, never for the Maker's own scrolling of a pick into view), and a swipe down on the toolbar (40 px; never
  from a field, a slider or a card strip). Never while a scene is held, never in the ▶-held guest preview.
- **Nothing else closes on that tap** (`aGroundTapStows`, lib/element-sheet-state.ts): the work area's part sheet and the
  lower third's tool used to close on a tap on the ground, which let the part go under the stowed toolbar (seen in the
  lab) — on the Stages side of a phone they now stay, so the head brings back the same part, the same tool.
- **Shows** on arrival (call 2), and comes back for any part picked (the picked one tapped again too), any tool
  picked, and a tap on its head.
- **Stowed, its own head is left** — the 14 px handle and the "You're editing · … ▴" line, one named 44 px button
  (`STAGE_BAR_STOW_PX` · `STAGE_BAR_STOW_BUTTON`, lib/maker-stage-room.ts) — so the slim handle is the toolbar's head,
  never a second bar.
- **Glides** with the app's ONE pin motion (`pin-glide.css`, 300 ms, the Guests curve): the lower third's height, the
  guests' bar riding it, the work area's tool leaving with the four rows; no glide under Reduce Motion.
- **A desktop's tools column never stows** (it is docked). 701–1023 px is still the phone layout (the shipped Maker has
  no tablet column; it stows there like a phone).

Guards: new `lib/the-toolbar-shows-and-hides.test.ts`. Amended where the 30 Oct row amends the 07 Oct "a tap on the
ground lets the part go": the-stages-panel-is-the-prototypes, the-preview-only-selects, the-play-button-previews,
the-rsvp-stage-is-parts (the RSVP stage's ground stows too); the-toolbar-is-four-rows (1) counts one more height said
(stowed: its head).

SPEC IMPACT: builds the 2026-10-30 row's toolbar show/hide as ruled; amends the 2026-10-07 "a tap on the page's ground
lets the picked part go" (the part stays picked; the toolbar is put away). No new ruling.
