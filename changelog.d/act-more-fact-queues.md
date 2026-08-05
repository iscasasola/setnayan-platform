## 2026-08-04 · feat(admin): three more queues open in place — verify, approvals, reviews

Extends the work-list drawer from one queue to four. Opening a row now shows the actual waiting items for **payments · verify · approvals · reviews**, so the "what is actually in there?" question stops requiring a page load.

What each row shows is the one fact that decides what happens next, not a generic summary:

- **Verify** — whether the documents are complete. An application waiting on documents is not reviewable yet, and that is the only thing worth knowing at a glance.
- **Approvals** — the colleague's **rationale**. A second admin is being asked to agree to something; their reason *is* the decision.
- **Reviews** — the matched signal and the vendor's appeal reason.

### ⚠ Seeing is not acting, and the gap is deliberate

All three are **fact** queues and will earn one-click buttons. Each needs its real server action traced first — inventing three at once is how a wrong one ships on a surface that changes a vendor's verification state or a couple's public review.

**Payments stays the only one wired end to end**, because its non-redirecting core already existed. The others remove the hunt now and act later.

### The column guard, again

It passed first try this time — because the columns were read out of the migrations before the query was written, rather than guessed and corrected. The previous slice had **all three** names wrong.

Verified: unit suite **6,487 pass / 4 fail** — the same four pre-existing `@electric-sql/pglite` module failures on unmodified `origin/main` · zero typecheck errors in the changed file · `select-column-scan` green.

⏭ Next: one-click actions for these three, then the payouts form (method + reference), then search.

SPEC IMPACT: None — read-only additions to an existing drawer.
