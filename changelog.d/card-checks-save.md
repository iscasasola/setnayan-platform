## 2026-10-26 · feat(card-checks): the automatic check runs inside the card save — a flagged card waits, the rest go live

Owner 2026-10-26: *"Cards go live right away after automatic checks; only flagged cards wait for admin review."*
PR 2 of the approved PLAN's order (corpus `prototypes/service_card_checks_2026-10-26/`), stacked on the schema PR.

- `lib/service-card-checks.ts` (pure) + `.server.ts` (reads, flag write): photo (open repost-watch matches on the
  card's cover and showcase), price BELOW the band only (OFF until the owner sets the tolerance), card-vs-service
  mismatch (reviewed search words, both halves), claim words (admin list; the per-shop allowance read joins with PR 3,
  which writes it). Unverified
  shop is never a hold. **Fail-closed**: a read the check could not make holds the card ("We couldn't finish the
  automatic check").
- `commitVendorService`: checks run after every bounce and before the one write; a hit saves the card hidden
  (`p_publish` = the checked value), opens/refreshes the one holding flag, sends an in-app notice (no email). A resave
  that passes clears an open / asked-to-fix hold by itself; after a Reject every save re-queues.
- Repost-watch now hashes showcase photos too (`service_showcase`, also in the admin backfill); a match that lands
  after the save pulls the card and holds it. Repost watch's surface labels learn Inspiration + Service showcase.
- The three drawn supplier deltas only: the gold "Saved · waiting for a quick check" box replacing the sage one, the
  row word "· waiting for a check" (switch greys, title "Waits for the check"), and the maker helper
  "Waits for the check · hidden cards keep their bookings". The switch asks the hold first.
- New in-app notice type `service_card_check`: enum migration `20271290823350` (its own file) + the TS union, label
  "Card check", amber — not on the email allowlist.
- Tests: `lib/service-card-checks.test.ts` (20), `lib/service-card-check-copy.test.ts` (6),
  `app/vendor-dashboard/services/card-checks-run-inside-the-save.test.ts` (5) — each guard sabotaged red → restored.

SPEC IMPACT: corpus `prototypes/service_card_checks_2026-10-26/PLAN.md` gains a "What was built" section; implements DECISION_LOG 2026-10-26 "APPROVED — SERVICE CARD CHECKS AS DRAWN" (no new decision).
