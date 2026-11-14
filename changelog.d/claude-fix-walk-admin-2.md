## 2026-11-14 · fix(admin): admin walk round 2 (F-A-08 · 10 · 16 · 20 · 21)

- **F-A-08** Each paper on Verification documents names its supplier (the shop's own name; "Supplier name couldn't
  load" when that read is refused, never a blank).
- **F-A-10** Payouts drops the old escrow stage filters ("Immediate (verified)", "Stage 1 · at confirmation", …). An
  older row still shows its own stage on its card.
- **F-A-16** Problems lines are plain words: code names split into words, a template placeholder reads "…", database
  calls read "Saving/Loading the …" with "could not save / could not load", and "vendor" reads "supplier".
- **F-A-20** Admin tab titles read "X · Admin": the console's title template is the page's own words (no
  "· Setnayan"), a page with none reads "Admin", and Booking fees + Verification documents name themselves.
- **F-A-21** The revenue card's five-line "what this counts" note sits behind an ⓘ (the shared `Explain`).
- Guard: `apps/web/lib/admin/the-admin-walk-2.test.ts`.

SPEC IMPACT: None.
