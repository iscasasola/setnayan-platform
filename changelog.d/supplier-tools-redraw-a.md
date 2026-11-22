## 2026-11-21 · feat(supplier-tools): the tool pages redraw, part A — Theft Watch · Track record · Disputes · Creators

The owner-approved redraw of the supplier tool pages (DECISION_LOG "11 SUPPLIER TOOL PAGES REDRAW — APPROVED (v3)";
drawing `Setnayan-specs/prototypes/supplier_tools_redraw_2026-11-21/supplier_tools_redraw_v3_fable.html`), built 1:1.
Look only: every page keeps what it does, its words and the same server actions.

- **Shared pieces** (`app/vendor-dashboard/_components/tool-page.tsx`): the pinned row (round ‹ on a phone, "‹ Shop"
  crumb from 701 — `BackButton variant="tool"`, the home still from `lib/page-home.ts`), the supplier section label with
  its count pill, the status chip with its dot, the failed-read line with Try again, rows with more than one line.
- **Theft Watch** — rows in one white frame, chip under the line, the long footer in its ⓘ. 🔴 A FAILED READ NO LONGER
  SAYS "your work is clean": `fetchVendorReposts` returns `null` when nothing was checked, and the page says *"We
  couldn't check for reposts just now. This is not a clean result."* with Try again.
- **Track record** — "Across life events" (the old label in its ⓘ), "N completed · N types". 🔴 A FAILED READ NO LONGER
  SAYS "No completed events yet": *"We couldn't read your track record."* with Try again.
- **Disputes** — one line + ⓘ under the pinned row (the intro and the green box, word for word), the count of open ones
  as a chip in the pinned row; each dispute opens in place (the shared Fold): your response and its box while open, the
  team's decision once ruled. Same contest action, same 2,000 characters, same pager and partial-read notice.
- **Creators** — the reach bar is the thumb row's sliders (dot while a bar is set) opening the shipped field; "Send offer"
  rises as one sheet (the same `sendCreatorOffer`, same fields, the Pro note); rows not cards.
- The ‹ of nine tool pages goes to Shop (their doors are Shop ⚙'s shelves); My lines' goes to Clients.
- Guard: `app/vendor-dashboard/a-failed-tool-read-is-never-clean.test.ts` (shape of `reads-are-honest.test.ts`).
- Lab (dev only): `/dev/supplier-tools-lab?p=<page>&s=<state>`.

SPEC IMPACT: None — builds an approved drawing; the corpus row already exists.
