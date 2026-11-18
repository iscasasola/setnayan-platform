## 2026-11-14 · feat(template): the worst-offending pages onto the approved design template

Owner-approved 2026-11-14: `Setnayan-specs/prototypes/design_template_sheet_2026-11-14_fable.html` (15 rules),
`design_template_audit_2026-11-14.md` (the ranked list) and `admin_accounts_insights_2026-11-14_fable.html`.
The frames are copied, not re-drawn; every control and fact on each page is kept.

- **Shared row kit** — `app/_components/template-rows.tsx`: section label (+ⓘ), hairline rows ≥56 px, the
  needs-you edge, numbers between hairlines, amber couldn't-read line with Try again, one-line empty. Existing
  tokens only (`--m-line`, `--m-slate-2`, `--m-orange`, `--color-ok/warn/danger`); no new style.
- **Admin · Booking fees owed** — no cards; Bookings is one row with ⓘ; **Close bookings now asks first** in a
  sheet (what stops · what keeps going · what couples see), Open does not; each fee is one row with one action
  or chip, the rest behind ⋯ (Check their payment · Open the shop); the review count is "List a supplier at − N +
  events" and saves itself (Saving… / Saved ✓ / Not saved + Try again). Same server actions, same audit rows.
- **Admin · Insights** — the 12 wrapped tabs are gone; the pinned row's "Insights · View ▾" opens every view in
  the three approved groups (How people use it · Is it healthy · What it costs).
- **Admin · Money** — at 390 each purchase is one row (who · what · when · bold money + chip); a tap opens a
  sheet with reference, email, receipt. The paragraph and queue-chip card go; the totals sit between hairlines.
  On a computer the table stays a table inside the 760 column.
- **Admin · Accounts (People)** — one line per person (initials · name · Couple/Supplier/Admin · joined · one
  chip · ⋯), every action in the ⋯ list, the irreversible ones red and still confirming; "VENDOR" → Supplier.
- **Couple · supplier Payment tab** — opens on the amount to pay, big, on the warm surface, with ONE terracotta
  "Pay <supplier>" and "Record payment" second (it rises as a sheet on this page); the schedule is plain rows in
  bold normal-font money; progress is one line; "Who can do what" moves behind its ⓘ on every page; 11 px
  half-strength words become 13 px dark grey (AA).

SPEC IMPACT: None — implements approved designs; no decision changed. Open owner calls from the sheet's
"What you decide" are left as they were (supplier page tabs vs ▾, typewriter vs plain capitals, 44 vs 40).
