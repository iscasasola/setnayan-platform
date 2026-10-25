## 2026-10-18 · fix(two-hosts): round 2 — more writers merged from what they were based on, one write at a time

Round 2 of #6626 (owner 2026-10-18, "all builds for today"): the same pattern — **merge from base**
(`apps/web/lib/merge-from-base.ts`) — on the writers #6626 ranked and left.

- **Maker canvas panels** — the part sheet, the hero's design, the cover's Animate / lines / background now send the
  canvas they were based on, through ONE shared map (`sendCanvasBase` / `forgetCanvasSent`, `lib/maker-draft-store.ts`;
  part-look's map moved there).
- **Event settings** (`updateEventMatchCriteria`) — the form sends what it started from; only the fields this screen
  changed are written (`lib/event-details-merge.ts`, the guest card's row shape). Region and feel are absent ⇒ untouched
  for a based post; names and birth data travel as groups.
- **Live JSON columns get one write at a time** — `lib/update-json-column.ts` (`updateJsonColumn`): a compare-and-set on
  the column's VALUE (jsonb equality; an enum[] as its array literal), built again on the newer value when another save
  landed between; a refusal is said at once. Used by: `saveReceptionDesign` (+ base from the editor, merged design shown
  with the one calm line) · every `print_details` writer (`lib/print-details-write.ts`: words, menu, poster photo ×2,
  name style, invite message, Apply) · `renameRole` · `addRoleToGuest` / `setGuestPrimaryRole` · `writeStylePreferenceKey`
  and Apply's QR write · `setDelegateArea`.
- **The blocks' looks** (`useBlockLooksDraft`) send their base; the draft's keyed blobs (`style_preferences`,
  `print_details`) are rebased only on the keys a save sends (`HUB_DRAFT_KEYED_COLUMNS`, `lib/hub-draft-rebase.ts`).

LEFT (named in the PR body): seating floor plan / booths / signs · Post Event `saveEditorial` · schedule answers and
nudges · E-Gifts method edit · live widget `config_json` writers · `wizard_state` · the remaining Maker words/background
canvas writers.

SPEC IMPACT: None.
