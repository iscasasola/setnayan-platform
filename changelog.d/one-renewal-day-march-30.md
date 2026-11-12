## 2026-11-12 · feat(verify): one renewal day — every verified shop renews on 30 March of the next year · the early shops move to 30 March 2027

Owner, 12 Nov 2026: *"Renewal deadline. March 30. Shops who did not submit and get verified has no renewal. No deadline
for any shop until the submit. The renewal is for the shops who already submitted their documents last year."* — and of
the shops verified before the papers check: *"Yes, their due is on March 30, 2027."*

- `lib/papers-due.ts` (new, pure): `nextYearsPapersDue(at)` = the END of 30 March (Manila) of the year after `at`.
- **Approvals** (`deadlineAtApproval`): 30 March of the next year — was the Mayor's Permit's printed date, else one year.
  The reviewer's permit date is still recorded (audit `permit_valid_until`, `badge_deadline_source: 'march_30_renewal'`);
  the admin field says the badge renews on 30 March.
- **Founders verification** (`founderVouchExpiry`): the same rule — pressed in 2026 → 30 March 2027, in 2027 → 2028
  (was a fixed 2027 day with a six-month fallback). `FOUNDERS_PAPERS_DUE_ISO` retired.
- **The daily pass** tells an approved shop "Your Verified badge is up for renewal on …" (asks for this year's Mayor's
  Permit) instead of "Your Mayor's Permit runs out …".
- **Migration `20271341349934_early_shops_renew_on_march_30`** (data only): the rows still on the 2026-09-11 backfill's
  12 March 2027 — profile badge day and vouch row — move to 30 March 2027, one audit row each; nothing else moves.
  `EARLY_SHOPS_PAPERS_DUE_ISO` follows. DB test `early-shops-renew-on-march-30.db.test.ts`.
- Shops never verified still have no deadline (nothing writes one).

SPEC IMPACT: DECISION_LOG row "ONE RENEWAL DAY: 30 MARCH" needed in the spec corpus (this session could not reach it).
