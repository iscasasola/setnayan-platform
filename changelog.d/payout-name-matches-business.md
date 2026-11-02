## 2026-09-18 · feat(verify): the desk checks that payout accounts are in the business's or the owner's name (SUP-27)

- The bank-proof slot always told shops the account name "should match your DTI/SEC business name (or your own name if sole proprietor)", but nothing compared the two. New check `payout_account_name` in `lib/verification-checks.ts` compares every `vendor_payment_methods.account_name` (the accounts couples pay into) against `registered_business_name`, the registry's name, the shop name and `business_owner_name`.
- Names are compared as sorted identifying words: case, accents, punctuation, company suffixes, honorifics and initials are folded, and word order is ignored.
- **Same** passes. **Overlap** (a shared word, e.g. a longer trading name or a relative's account) goes `manual` for the admin, per the brief. **Nothing in common** is a named `mismatch`, and like every check it only warns at the grant. No account, a blank name, nothing to compare against, or a failed read all go `manual`, never pass.
- `readPayoutNameFacts(ids)` fetches for a whole screen in two queries. It's used by the queue page and `buildVerificationChecksForVendors`. The single-shop builder reads for itself only when not handed the facts.
- 12 new cases in `lib/verification-checks.test.ts`. Sabotaging the mismatch branch turns 4 of them red.

SPEC IMPACT: None. This implements the requirement already stated in the bank-proof help copy (`lib/vendor-verification.ts`).
