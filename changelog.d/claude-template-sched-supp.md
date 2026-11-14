## 2026-11-14 · style(couple): T-SCHED-SUPP — the couple's Schedule page and Suppliers list move onto the design template

Re-audit follow-up (origin/main a2a872a): the two most-seen couple pages with no open PR on the approved sheet
(Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`). Every fact and action kept; shared pieces only.

- **Type** — no word under 12 px (the 7.5–11.5 px captions and the 0.6/0.66 rem labels are 12 px), no typewriter
  captions, no serif-italic headings or numbers (call times and the takeover/fact-sheet headings are the body face, bold),
  no ink below 70 % on words — in Tailwind classes AND in the in-file stylesheets (rules 1 · 13).
- **Colour (Schedule + small Suppliers pieces)** — palette codes swapped only where a token is the SAME colour
  (`--m-*` fallbacks dropped, the ink/gold/green washes as `rgb(var(--color-*) / a)`, the status green/red as
  `--color-ok` / `--color-danger`); a dark-mode rule's literal dark is kept literal, and shadows keep their fixed dark (rule 14).
- **Cards → rows** — Supplier requests (gold-edged rows that need you), Itinerary clashes (red-edged rows), Meetings with
  suppliers (hairline rows, `Badge` state), the run-of-show templates, the preparation-agenda note and its empty state are no
  longer boxes; explaining paragraphs sit behind `InfoTip`; refused reads are one amber "We couldn't…" line (rules 2 · 5 · 6 · 7 · 11).
- **Buttons** — Decline / Approve on a request are `ActionButton`s; "Add N to my timeline", "Save answers", Save (bulk
  retime) and "Open budget" wear the shared pill; the day's ⋯/＋ dot buttons meet the 44 px floor (rule 3).
- **Picks** — the four native `<select>`s on Schedule (block type, from/through block, tag booked suppliers) are ▾ `PickMenu`s
  through `PostedPick`, which gains a ticks mode for the multi-select — same field names, same server actions (rule 4).
- **Motion** — no spinners: Save / Save plan / Add / Lock wait grey or show a still hourglass, the saved-request shell shows a
  shimmer in its own shape (rule 15).
- **Kept on purpose:** `shortlist-categories`' colours (its contrast guard reads the literal codes — type fixes only there);
  `plan-budget-accordion` untouched (it renders only on the `BUDGET_BUILD_ENABLED=false` kill-switch path); the shared
  `LockPopup` / `GuestPopup` frames; the desktop-only "Suppliers" name row (owner 2026-10-07, now in the body face).

SPEC IMPACT: None — implements the approved design template; no decision changed.
