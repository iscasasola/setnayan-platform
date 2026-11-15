## 2026-11-14 · feat(template): T01 — the supplier client card's surfaces onto the approved design template

Owner-approved 2026-11-14: `Setnayan-specs/prototypes/design_template_sheet_2026-11-14_fable.html` (15 rules), batch
T01 of `design_template_full_audit_2026-11-14.md` (`/vendor-dashboard/clients/[eventId]`, `script-tab`,
`payment-asks-panel`, `script-composer`, `booking-ask-panel`). Shared pieces only (ActionButton / AskSubmit, InfoTip,
Badge, PickMenu); tokens only; every fact and every action kept.

- **Script tab** — no cards: the privacy lock, "Drafted from your lines" and "saved to My lines" are one line each
  with the explaining behind an ⓘ; "Get these right" is a section label + hairline rows with the gold edge (were
  pressable pills); every moment is a hairline row; the empty state is one honest line. The private-moment worded
  banner stays.
- **Script composer** — Save is the shared ActionButton (44 px), the draft mark is a Badge, an error is red not gold.
- **Ask for a payment** — section label, hairline rows with bold money in the words' font, AskSubmit buttons, 48 px
  fields, a couldn't-load line in amber; the "Setnayan never holds this money" paragraph moves behind an ⓘ.
- **Booking ask** — "what you can see before you agree" moves behind an ⓘ.
- **Client card body** — booth poster / booth words / Papic Challenges / notes / money rows / fee lock lose their
  tinted cards (sections and hairline rows; due notes wear the gold edge, overdue the red one); the booth's native
  channel select is the shared PickMenu; three spinners become the "Saving…" word; hand-made Send / Save / Pay pills
  are ActionButtons; long paragraphs on Today's ask cards, Files, Locks and Settings move behind an ⓘ.
- **Strength** — ink at ≤60 % → 70 %; 9–11 px captions → 12 px; half-pixel sizes → the house 13/15; typewriter
  meta lines → plain tabular figures; inline `rgb(var(--color-*))` → the matching status ramp classes.

Skipped (another open PR edits them): `clients/[eventId]/page.tsx` (#7621, #7544),
`_components/booth-event-section.tsx` (#7635, #7608), `_pages/event-files.tsx` (#7622).

SPEC IMPACT: None — implements the approved design template; no decision changed.
