## 2026-11-14 · style(workspace): T10 — the couple's picked-supplier workspace pieces follow the design template

Batch T10 of `design_template_full_audit_2026-11-14.md` (Setnayan-specs). Every fact and action kept; shared pieces only
(`ActionButton`, `Sheet`, `InfoTip`, `PickMenu`, `Badge`). Three T10 files are left to `claude/template-pages` (#7632),
which already edits them: `workspace/page.tsx`, `deposit-reservation.tsx`, `picked-supplier-who.tsx`.

- **No cards** — Quotes, Shot list, Notes, Colour access, Reservation terms, Delivery handover, Change orders, What's
  included, Your details, Promote your coordinator, the marketplace Services / Contact / Reviews and the payments ledger
  are sections in grey capitals over plain hairline rows; nothing read-only sits in a box (rules 2 · 12).
- **Sheets** — the RA 10173 coordinator consent, the quote-to-build gate and the change-order form rise as the house
  `Sheet` (✕, equal-width Cancel + main at the foot) instead of hand-drawn overlays or a box inside a box (rule 9).
- **Buttons** — every hand-made button is the shared pill (`ActionButton`, or the `ab` classes on a server form's
  submit/link), 44 px floor, grey `waiting` instead of a spinner (rules 3 · 15).
- **Picks** — the two native dropdowns on "Log a payment" are ▾ `PickMenu`s posting through a hidden input
  (`_components/posted-pick.tsx`, the T09 reuse-request pattern); same field names, same server action (rule 4).
- **Chips** — every status (quote, change order, handover, form, booking, note visibility, on/off) is the shared `Badge`
  with no border (rule 5).
- **ⓘ instead of paragraphs** — explaining lines moved behind `InfoTip` on their label; a refused read is one amber line
  ("Couldn't …— not the same as none"), an empty one a plain line (rules 6 · 7).
- **Type** — no 9–11 px words (12 px floor), no ink below 70 % on words, no serif-italic headings, money bold with
  tabular digits; dates rendered in Asia/Manila (rules 1 · 13 · 14).
- **Kept on purpose:** the ledger's three `Money` figures stay in the mono face — `tour/budget/the-tour-copy-does-not-drift`
  pins them to their public-tour fork (batch T30): both move together.
- Guards re-pointed, not weakened: `drawn-in-place.baseline.txt` drops consent-gated-invite-form and quote-bridge (no
  longer hand-drawn overlays); `gold-is-not-text` bill shrinks (consent 4 → 2, handover 2 → 1); the mirrored-ramp ALLOW
  entry for the colour card's Reject chip is deleted (the chip is now the shared pill); the port baseline is
  regenerated (the hand overlays left the workspace route).

SPEC IMPACT: None — implements the approved design template (Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`); no decision changed.
