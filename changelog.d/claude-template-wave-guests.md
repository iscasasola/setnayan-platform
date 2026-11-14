## 2026-11-14 · style(couple): template wave — guests, sponsors, seating extras, access requests, manpower, people onto the design template

Stacked on T13 (#7683). The controller's template wave for `dashboard/[eventId]/` seating · plan3d · guests · sponsors ·
hosts · people · access-requests · manpower · prints. Style only — same words, same data, same actions; shared pieces
only (`ActionButton`/`actionButtonClass`, `Sheet`, `InfoTip`, `PickMenu`/`PostedPick`, `Badge`).

- **Sponsors** — the add, edit and invitation modals are the house `Sheet` (✕, Esc, Back; no hand-drawn overlay);
  Cancel/Save are the shared pills; the status is a `Badge`; Marked yes/Declined wear the shared pill; the pairs picker is
  a ▾ `PickMenu` (a count below the filled pairs was a disabled option — it is no longer offered); typewriter captions are
  the section label; the long notes sit behind ⓘ.
- **Guests** — check-in and souvenir desks: the headcount on the warm surface, rows not cards, the main actions the shared
  pill, the RSVP chip a `Badge`; the duplicate-guest warnings (new guest and quick add) are an amber edge with hairline
  rows and `Badge` tags; the new-group form's native select is a ▾ `PostedPick` (same `team_side` field); claims' Accept /
  Link summaries are the shared pill and Keep's Role select is a ▾ `PickMenu` (same `role` field); the quick-add list,
  import, send and people-sheet explanations sit behind ⓘ.
- **Seating extras** — the walkthrough manager's zones are rows, its buttons the shared pill; the lab's loader and frame
  lose their card border; Switch to 2D is the shared pill.
- **Access requests · Manpower · People** — rows not cards, the shared main pill (no spinner), the BIR note behind ⓘ,
  typewriter captions → the section label.
- Port baseline regenerated and `drawn-in-place.baseline.txt` loses the three sponsor modals (they are house Sheets now — the ratchet only shrinks).

SPEC IMPACT: None — implements the approved design template (Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`); no decision changed.
