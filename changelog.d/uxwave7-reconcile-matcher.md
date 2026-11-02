## 2026-06-20 · feat(admin): paste-and-match reconciliation helper on /admin/payments

2-step-down program (Wave 7) — manual GCash/BDO reconciliation (iteration 0034) made the admin eyeball the whole pending queue to find which order a bank notification belongs to. That's the difficulty-5 step. Now they paste the SMS/app alert into a box at the top of the queue and the matcher surfaces the pending payment whose **reference code** appears in the text (strong match), or whose **amount** does (weak, amount-only) — with a one-tap jump link to that row.

- **`app/admin/payments/_components/inbox-matcher.tsx`** (new client component) — `InboxMatcher` does client-side substring matching: reference-code hit first (decisive), amount fallback (comma-normalised so "3,999" matches a bare 3999). Takes NO action — only finds the row and links to it; the admin still approves through the existing `ConfirmForm` guard.
- **`app/admin/payments/page.tsx`** — mounts the matcher above the payments list, builds a lightweight `MatcherPayment[]` from the already-loaded rows (no extra query), and gives each row an `id="payment-<id>"` anchor (`scroll-mt-20`) for the jump link.

Scope: zero-migration client slice. The persisted `payment_inbox_messages` table + the 4-tier SQL `match_inbox_to_order` auto-matcher (0034 spec) remain a later server-side layer — this is the no-schema win shipped first.

No schema change. tsc clean (only pre-existing unrelated `paper`/`paperjs-offset` resolution noise in the borrowed typecheck store).

SPEC IMPACT: iteration 0034 reconciliation UX. Logged in `DECISION_LOG.md`.
