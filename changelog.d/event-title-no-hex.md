## 2026-10-16 · fix(maker): the couple's names are the "Event title"; the small line above them is the "Top line"

Owner 2026-10-16, pointing at "Indalecio & Claire" on his cover: "The event title". The Maker had the
labels backwards — the small line above the names (`ename`, "WITH THANKSGIVING TO GOD…") was tagged
"TITLE ▾" and the names were "Names". LABELS ONLY — no key, source, field or schema changes; the Prints'
"Opening line" (`opening`) is untouched.

- `lib/maker-parts.ts` `MAKER_PARTS.names.label` → "Event title", `MAKER_PARTS.ename.label` → "Top line".
  That one label is what the canvas part tag, "You're editing · … › …", the keyboard bar ("Typing · …"),
  the ＋ sheet, the part menus and the Apply sheet's cover lines all read (`makerPartLabelOn`,
  `makerPartWordAt`, `makerPartWordOfStyle`).
- `lib/scene-styles-parts.ts` — the parts' Style sets `hero_names` / `hero_eyebrow` say the same words.
- `lib/element-style.ts` `HUB_ELEMENT_LABEL` — `names` "Event title", `eyebrow` "Top line" (was "Small line on top").
- `lib/hub-draft-change-lines.ts` — the Apply list's typed-fact line for `display_name` / `bride_name` /
  `groom_name` reads "Event Details · Event title".
- Tests/goldens updated to the new words: `the-badge-the-sheet-and-undo-agree` (now also pins
  `names.label`), `the-toolbar-is-four-rows`, `the-maker-lower-third-holds-every-tool`,
  `the-apply-sheet-names-each-change`, `try-pro-pay-at-apply` (the Pro line "Animation · Event title on the Hero" reads `HUB_ELEMENT_LABEL`).

SPEC IMPACT: owner ruling 2026-10-16 (Maker part labels "Event title" / "Top line") — DECISION_LOG row not
written by this PR; flagged to the controller. Note the Details workspace still names `display_name`
"Event Name" (owner 2026-10-06) — not changed here.
