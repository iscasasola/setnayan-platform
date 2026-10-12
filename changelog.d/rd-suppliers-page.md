## 2026-10-12 · feat(suppliers): the Suppliers page stack on today's main — the kind "usually booked" line, and Save / Remove answer in place

Brings the four drafts (#6422 shell · #6425 Find · #6455 walk fixes · #6459 the
supplier sheet) onto today's `main` in one branch (their own changelog fragments
come with them), plus the two items the owner ruled on 2026-10-12.

- **"Usually booked N months ahead"** replaces "⚠ Nd overdue" on the Build
  decision rows and the accordion chip (approval 12, the NOW part). One helper,
  `usuallyBookedAheadLine` in `lib/vendors-plan-budget.ts`, reads the same
  lock-by floor the planning clock uses; the chip is the quiet gold one. The
  status stays `overdue`, so ordering is unchanged.
- **Save and Remove on a supplier card no longer refresh the page.** Remove
  takes the card off the bench the moment the couple confirms (a refusal puts it
  back, saying so); Save in "More to compare" says "Saved to your …" the moment
  the write answers. Both send `answer_in_place=1` (`lib/answer-in-place.ts`),
  so `deleteVendor` / `saveVendorToPicks` skip their `revalidatePath` — in
  Next 15 that revalidate alone shipped a whole render of the page (≈47 reads)
  back with every press, before the caller's own `router.refresh()` asked for a
  second one. The bench keeps what changed for the visit
  (`vendors/_components/bench-local.ts`) and pays ONE refresh when the couple
  leaves Find (or on the next mount), however many presses there were. Every
  other caller of the two actions is unchanged.

SPEC IMPACT: None — implements DECISION_LOG 2026-10-12 "SUPPLIERS PAGE — THE LAST OPEN APPROVALS ANSWERED" items 1 (NOW part) and 5.
