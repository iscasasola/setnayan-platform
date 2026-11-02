## 2026-07-01 · feat(referrals): couple referral rewards on the voucher rail

"Happy couples refer; when their referral books you, both get a perk." Rides the
SHIPPED voucher rail (`discount_codes` + `calculate.ts` `pct_off_capped`) rather
than inventing a new discount primitive.

- **Migration `20270416213000_couple_referral_rewards.sql`** — `referral_codes`
  (one per couple ACCOUNT · `code` via `generate_public_id('R')` → `S89R-…` ·
  `owner_user_id` UNIQUE · RLS: owner/admin read, owner insert) +
  `referral_redemptions` (`referrer_user_id`, `referred_user_id` UNIQUE →
  referred once, `status open|qualified|rewarded`, `qualified_at`, reward code
  columns · RLS-at-create · CHECK + BEFORE-INSERT trigger BLOCKING self-referral
  `referrer <> referred`) + `platform_settings.referral_reward_php INTEGER
  DEFAULT 0` (admin-managed).
- **`lib/referrals.ts`** — `qualifyReferralOnFirstPaidOrder(buyerUserId)`:
  QUALIFYING EVENT = the referred couple's FIRST PAID ORDER. Marks the open
  redemption `qualified` and mints TWO single-use `pct_off_capped@100%` vouchers
  (referrer + referred), each capped at `referral_reward_php` and account-LOCKED
  via `discount_code_eligible_users` so a perk can't be shared. Best-effort:
  NEVER throws / blocks the order. **Inert when reward = 0** — advances the
  lifecycle to `qualified` but mints NOTHING until the owner sets a reward.
- **`lib/referral-actions.ts`** — `getMyReferral()` (mint-or-return the caller's
  code + share link + redemption statuses) + `applyReferralAtSignup(code, uid)`
  (records an OPEN redemption on a new `?refc=` signup · ignores self/dupe).
- **Paid-order hook** — `admin/payments/actions.ts` fires
  `after(() => qualifyReferralOnFirstPaidOrder(payment.user_id))` the moment an
  order flips to `paid` (additive; existing order logic untouched).
- **Signup** — captures `?refc=` (S89R shape), carries it as a hidden input,
  records the redemption on account creation (couples only), shows a
  referred-signup banner (no amount — reward is admin-managed / may be inert).
- **UI** — couple "Refer a couple" page at `/dashboard/[eventId]/refer` (code +
  share link + one-tap copy + per-referral status) wired into the Home nav; a
  read-only `/admin/referrals` list (reward amount + inert note + redemption
  table) wired into the admin sidebar with the `Gift` icon.

Engine ships LIVE but INERT: no vouchers are minted until an owner sets
`platform_settings.referral_reward_php`.

SPEC IMPACT: New feature — couple referral rewards. Corpus is REFERENCE/HISTORY
per the 2026-06-07 source-of-truth flip (code is canonical); a DECISION_LOG.md
row should note the referral engine + the admin-managed `referral_reward_php`
knob when the corpus is next touched. No locked decision changed. Owner
follow-up: set the reward amount to activate minting.
