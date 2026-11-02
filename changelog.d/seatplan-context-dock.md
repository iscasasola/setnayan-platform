## 2026-07-17 · feat(seating): the Context Dock — one contextual surface, controls-council verdict

Implements `Seat_Plan_Controls_Council_Verdict_2026-07-17` — the seat-plan
control-surface redesign, presentation/interaction ONLY (no route/action/schema
change; `changeStyle`/`toggleSeat`/`doUnlink`/`linkTables` untouched).

- **§1 Context Dock** — the four competing per-object chromes (table-anchored
  popover, floating pills, always-on marker micro-control scatter, per-seat ×
  chips) collapse into ONE docked surface. New component family
  `seating-context-dock.tsx` (`ContextDock` shell + `ShapeGlyph` + `ShapePicker`);
  desktop dock + phone-sheet variant, one glass recipe. Deterministic bottom↔top
  occlusion flip via a screen-space AABB test (no camera pan). Attached panels
  expand away from the occupied edge with a REAL measured max-height (the 380px
  constant is gone). State precedence: picked-guest > picked-group > selected-object
  > notice; a displaced notice falls back to the command-bar "N notices" expander.
- **§1.2/§1.3** — table dock row in the exact order (name inline-edit · Seat people
  emphasized-not-gold · seats stepper · rotate cluster · labeled ⋯ overflow · divider ·
  delete+done); phone sheet reordered to parity (180° one tap on phone). Keyboard
  parity: Delete/Backspace deletes, Esc exits edit-chairs / deselects, Enter commits.
- **§1.4** — markers/booths/signs join the select→dock model (tap = select ring →
  dock verbs). Deleted the ambient ×/toggle scatter, the booth on-canvas picker,
  the sign `window.prompt` rename + ambient rotate, the entrance Door/Walk-through +
  depth on-canvas controls. Resize grips render only while selected. Per-type dock
  contents (booth vendor/station/offerings picker as attached panel; entrance
  segmented+depth; cocktail worded [With entrance | Separate]; sign inline rename +
  45° cluster; stage permanent, no remove).
- **§1.5** — view-only honesty: `!canEdit` renders a read-only summary + one
  "Edit / Take over" button; the silent no-op path is gone.
- **§2 rotation canon** — anchored popover + POP_H flip heuristic deleted; the
  rotate handle is the only surviving on-object chrome, at 12 o'clock. Dock cluster
  ±15° with press-and-hold repeat + click-to-type exact degrees; Flip button dies
  (180° → overflow on desktop, one-tap chip on phone); signs step 45°.
- **§3 seats** — Seats stepper over `toggleSeat` (− highest-index empty / + lowest-index
  removed, "Seat N removed · Undo"); the × / + chips render ONLY in the surgical
  "Edit chairs…" mode (canvas tint + banner + ≥44px hit areas), exits on Done/Esc/
  deselect/guest-pick.
- **§4 shape-change** — the instant-swap native `<select>` becomes a visual glyph
  picker with ghost preview + impact readout + Apply gate (single-tap when empty,
  explicit Apply/Cancel when seated); reused in `AddTablePanel`; the 3D lab type
  select gains the seated-guard copy.
- **§5** — BarMenu leaf-only close (`data-close`; steppers/radios/inputs keep the
  menu open); SaveStatusChip tiers (spinner / calm ink dot / warm Retry-only /
  phone condensed); stats chip → "N to seat" doorway; Auto Arrange gold split-button
  (caret = Build draft + Fill-around-locked, moved out of Arrange); + Add minus Room
  size; Arrange gains Room size + stay-open; clickable scale bar; peer avatar stack;
  ⋯ More section headers; zoom cluster Fit-first + ≥44px.
- **§6 legacy/icon debt** — 3D lab "Link to another table" creator UI deleted
  (`linkTables` action untouched); `Unlink` retired everywhere (keep-apart → "Keep
  apart" badge, relax → "Relax" text, cocktail → worded segmented, break-apart →
  `Ungroup`); `Link2` retitled "Grouped (legacy)".
- **§7 empty state** — blueprint-styled 3-step starter card; gold transfers to
  "Build my seating draft" (command-bar Auto disabled-with-reason on an empty floor).

Files: `seating-editor.tsx`, `seating-frame.tsx`, `lab/_components/seating-lab-3d.tsx`,
new `seating-context-dock.tsx`.

SPEC IMPACT: None — presentation/interaction only. The verdict doc
`Seat_Plan_Controls_Council_Verdict_2026-07-17.md` is the reference; no corpus SKU/
schema/decision change. (Owner sign-offs open per verdict §12: dock placement
screen-check, empty-floor gold transfer, "Build my seating draft" label collapse,
day-of watch item — flagged, not code-blocking.)
