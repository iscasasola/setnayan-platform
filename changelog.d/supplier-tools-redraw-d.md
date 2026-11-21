## 2026-11-21 · feat(supplier-tools): the tool pages redraw, part D (last) — Manpower

The last page of the owner-approved redraw (DECISION_LOG "11 SUPPLIER TOOL PAGES REDRAW — APPROVED (v3)"; drawing
`Setnayan-specs/prototypes/supplier_tools_redraw_2026-11-21/supplier_tools_redraw_v3_fable.html` § 11, "build last"),
on part A's shared pieces. Look only. **The page still has NO door** (owner 9 Nov, "lets not deal with this first") —
reachable by its address only; nothing links to it.

- The pinned row "Manpower gigs" (‹ Shop), the boxed "Setnayan note" as one line + ⓘ with the full Form 2307 note.
- Open / Accepted / Wrapped as supplier section labels with counts; gigs as rows in one white frame; status chips by
  job. Accept gig (with its race-lost and already-claimed words), Mark wrapped, Cancel gig with a reason (4+ characters)
  and the open-gigs failed-read line are unchanged — `GigCard` keeps every handler.
- 🔴 **A refused "my gigs" read is said** (controller 21 Nov): Accepted and Wrapped used to say "You haven't accepted any
  gigs yet." when the read failed; both now show "We couldn't read your gigs just now. This is not a statement that you
  have none." with Try again. Held by `a-failed-tool-read-is-never-clean.test.ts`.
- `the-four-small-lists-read-to-the-end.test.ts` reads the drawn groups in `manpower-view.tsx`; the surface still measures.

SPEC IMPACT: None — builds an approved drawing; the corpus row already exists.
