## 2026-11-14 · style(supplier-shop): batch T02 onto the approved design template (15 rules)

Batch T02 of `prototypes/design_template_full_audit_2026-11-14.md` (template `design_template_sheet_2026-11-14_fable.html`,
approved, unchanged). Only T02's files; every fact and action kept; shared pieces and tokens only; no new colour code,
motion speed, server action or migration.

- **Word strength (rule 13):** ink under 70% on words → `text-ink/70` (the floor the config already renders, so the look
  holds); 9–12 px hand-typed sizes → `text-xs`; money out of the typewriter font (`tabular-nums` instead) in the offer
  editor, the offer tile and the Makers preview.
- **Tier gate + teaser (rules 1 · 2 · 3 · 5):** no card and no visible `<h1>`; the upgrade is the shared main
  `ActionButton`; the inline teaser is a hairline row with the plan as a soft `Badge` and an outlined button.
- **Verified market price (rules 2 · 5 · 7 · 13):** no card; the section label carries its ⓘ (the explanation word for
  word); "Soon" is a soft chip; the median is the one strong number on the warm surface; the spread is a plain row.
- **Offers (rules 3 · 5 · 7):** the status and offer pills use the shared chip shape (`BADGE_CLASS`); three field hints
  keep their first half and put the rest behind ⓘ; the slim preview row presses at 44.
- **Shop › Makers:** "Open <tool>" is the shared `ActionButton`, not a hand-made pill.
- **Failed reads (rule 6):** "Couldn't load …" lines are amber and short (shop parts, couple photos, the shop wallet).
- **Services, empty (rules 2 · 6):** no box around the empty part — the label, one plain line, New service.

Skipped (another open PR edits them): `shop/page.tsx` (#7627, #7613) · `editable-row`, `profile-checklist-editor`
(#7613) · `docs-body`, `verify-pairs`, `verify-section` (#7624, #7627) · `shop-cover`, `shop-settings-body`,
`shop-settings-rows` (#7627) · `verify-pairs` (#7544).

Shots (390 and 1280, Now beside Proposed): `build-sessions/shots-template-t02/`.

SPEC IMPACT: None — applies the approved template.
