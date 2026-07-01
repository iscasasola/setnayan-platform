## 2027-04-13 · feat(vendor): stand-up-for-yourself dispute mediation — neutral review gates the rating hit

Reworks vendor dispute handling so a **neutral team reviews the record before a
dispute can touch a vendor's rating**, and gives vendors a place to contest.

- **Silent-demotion fix (root cause).** `vendor_disputes.counts_toward_demotion`
  defaulted to `TRUE` and every dispute is born `status='open'`, so the
  dispute-counter cron + `count_vendor_disputes_30d` counted UNREVIEWED disputes
  toward the 3-in-30-days demote-to-`coming_soon` trigger. A vendor could be
  demoted on unproven accusations before anyone looked. Migration
  `20270413204817_vendor_dispute_mediation_review_gate.sql`:
  - `counts_toward_demotion` now DEFAULTS `FALSE`; existing `open` rows
    backfilled to `FALSE`.
  - `count_vendor_disputes_30d` tightened to count ONLY
    `status='resolved_for_couple' AND counts_toward_demotion=TRUE` (rolling index
    rebuilt to match). An `open` dispute can never count.
  - The cron inline query (`app/api/admin/cron/dispute-counter/route.ts`) is
    aligned to the same `resolved_for_couple`-only predicate.
  - Admin `resolveDispute` now sets `counts_toward_demotion` explicitly: `TRUE`
    for `resolved_for_couple`, `FALSE` for `resolved_for_vendor` / `withdrawn`
    (audit-logged).
- **Vendor mediation.** New `vendor_contest` + `vendor_contested_at` columns +
  a narrow RLS UPDATE policy + a column-guard trigger
  (`guard_vendor_dispute_contest_columns`, mirrors `guard_pax_finalize_columns`)
  let a vendor set ONLY those two fields on their own OPEN dispute rows — they
  can never self-clear the demotion flag or flip status. New vendor route
  `/vendor-dashboard/disputes` (RLS-scoped read) to see disputes filed against
  the shop, contest an open one, and track the outcome.
- **Admin console.** `/admin/disputes` now surfaces the vendor's contest text so
  the team adjudicates against both sides.
- **Nav.** One "Disputes" entry added under My Shop in `vendor-sidebar.tsx`
  (owner/admin scope).

SPEC IMPACT: Iteration 0023 § 3.6 (Disputes & Refunds) + 0006 demote-to-coming_soon
trigger — the demotion trigger is now gated on neutral-team review
(`resolved_for_couple`) rather than firing on raw open-dispute counts. Owner
sign-off requested on the review-gate policy (an open dispute no longer demotes)
and on the 3-in-30 threshold staying keyed to `resolved_for_couple` only. Corpus
edit to follow per direct-edit authorization.
