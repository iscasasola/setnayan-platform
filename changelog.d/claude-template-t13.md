## 2026-11-14 · style(seating): T13 — the seat plan and its editor follow the design template

Batch T13 of `design_template_full_audit_2026-11-14.md` (Setnayan-specs): `/dashboard/[eventId]/seating` and the
`seating-editor` surface (13 files). Every fact and action kept; shared pieces only (`ActionButton`, `EqualRow`,
`Sheet`, `InfoTip`, `PickMenu`, `PillTrack`, `SwitchRow`, `Badge`).

- **No cards** — the Tables, Member Groups, Seating Priority, Seating Guide and List-view tables are hairline rows
  (44–56 tall), not boxed tiles; the add-table form, shape picker and seat-people panel sit on a hairline, not a tinted
  box; an empty List is one plain line (rules 2 · 6). The empty floor's "Lay out your floor" is the one framed thing, on
  the warm surface.
- **Sheets** — the Auto Arrange and Fill-around-locked confirms and the phone's "Move … to…" rise as the house `Sheet`
  (title, ✕, equal-width Cancel + main at the foot) instead of hand-drawn overlays. The table's ⋯, Auto Arrange's ▾, the
  bar menus and the phone's pops close on a press outside or Esc (`_components/close-outside.ts`) instead of an invisible
  full-page catcher (rule 9).
- **Buttons** — hand-made terracotta/mulberry buttons (+ Table, Add table, Apply, Seat here, Seat group here, Seat next
  unseated, Relax, Add rule) are the shared pill; the dock, bar, zoom, steppers, closes and row icons press at 44 (rule 3).
- **Picks** — the keep-apart adder's two native `<select>`s are ▾ `PickMenu`s; the walkway presets are the app's pill
  selector; "Show room to scale" is a switch row (rule 4).
- **Chips** — Filled/Open, Keep apart, On/Off, here, held, diet, table labels, Yes/No, Viewing only are the shared `Badge`
  with no border (rule 5).
- **ⓘ instead of paragraphs** — Seating Priority, Seating Guide, Who sits together, the room-size hint and the List
  how-to sit behind ⓘ on their label (rule 7).
- **Type and colour** — no 9–11 px words outside the room drawing (12 px floor), no ink below 70 % on words, no
  typewriter captions, sheet titles at 17 px bold instead of the serif, the phone's "Seat plan" title screen-reader only
  (the pinned row names the page); the command bar's glass and the canvas grid read the house tokens, not typed
  white/rgba; the drawer's duration is a token; the save chip says "Saving…" with a still dot, never a spinner
  (rules 1 · 13 · 14 · 15).
- **Kept on purpose:** the room drawing inside the zoomed world layer (wall dimensions, chair names, table numbers,
  stage/dance/booth/entrance labels, peer cursors) keeps its blueprint lettering — it scales with the zoom and is the
  drawing, not page words (directive 2026-07-15 "hairline walls, mono dims"); the group colour `NEUTRAL` stays a hex
  because it is compared against the generated group palette.
- The port baseline is regenerated (`OverlayBackdrop` left the seating route — the two confirms are house Sheets now).

SPEC IMPACT: None — implements the approved design template (Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`); no decision changed.
