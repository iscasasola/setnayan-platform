## 2026-11-14 · style(home): T12 — the couple's event Home pieces, the day-of grid and the Papic credit sheet follow the design template

Batch T12 of `design_template_full_audit_2026-11-14.md` (Setnayan-specs). Every fact and action kept; shared pieces only
(`ActionButton` / `ab` classes, `Sheet`, `InfoTip`, `Badge`). Nine T12 files are left to open PRs that already edit them:
`page.tsx` (#7675 · #7605 · #7542), `event-dashboard.tsx` (#7542), `inline-checkout-drawer.tsx` · `home-first-screen.tsx` ·
`home-hub-card.tsx` · `set-date-nudge.tsx` (#7605), `home-control-row.tsx` · `home-todo-list.tsx` · `papic-outcome-banners.tsx` (#7677).

- **Day-of grid** — no frame around the day and no card per part: one column divided by hairlines; Happening now is the one
  warm surface (`--m-paper-2`, no typed colour codes); Head table, Up next, Memory lane, Coordinator broadcast and Get help
  are grey-capital sections over plain rows; the close-out door, Broadcast, Email call-times and Get help are shared pills;
  a refused schedule read is amber with Try again (rules 2 · 3 · 5 · 6 · 7 · 12 · 13 · 14).
- **After the event** — the parts are hairline rows with a terracotta ›; the Editorial maker is the one framed next step with
  the one main button (rules 2 · 3 · 13).
- **Coordinator pieces** — Colour access, the access-level sheet's two answers, the grant chips and the date-change sheet:
  no cards inside cards, soft chips, explaining lines behind ⓘ, shared pills (red Drop, grey Keep waiting, terracotta Use).
- **Papic** — the credit stepper's − / + are the shared pill (no boxes); the buy sheet's errors use the danger token class;
  the Papic-ready nudge and the Setnayan AI offer sit on the warm surface with grey-capital eyebrows, money bold in the
  words' font, the buy is `ab ab-brand ab-main`.
- **Type and motion** — no words under 12 px, no ink under 70 % on words; spinners are the pill's `waiting`; two typed
  200 ms durations are the `--sn-dur-control` token. The 420 ms fold on the Papic / service cards is kept — it is the
  pinned house fold (`papic-opens-in-memories.test.ts`).
- Guard re-pointed, not weakened: `the-venues-and-ceremony-time-wait-for-apply` reads the address hint's new class.

SPEC IMPACT: None — implements the approved design template (Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`); no decision changed.
