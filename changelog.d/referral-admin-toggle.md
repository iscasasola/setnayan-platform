## 2026-07-01 · feat(referral): admin master toggle for the couple referral program

Owner decision: gate the whole couple referral program behind an admin master
switch (default OFF) rather than leaving the "Refer a couple" surface visible
with no reward. Off by default; an admin flips it on from /admin/referrals to
run the program (separate from the reward amount `referral_reward_php`).

- `supabase/migrations/20270419213000_*.sql` — additive `platform_settings.referral_program_enabled BOOLEAN NOT NULL DEFAULT FALSE`.
- `lib/platform-settings.ts` — the flag joins the row type/select/fallback + a
  new `isReferralProgramEnabled()` reader (admin-client, fail-closed to false).
- Engine gated inert when off: `applyReferralAtSignup` and
  `qualifyReferralOnFirstPaidOrder` both early-return, so no redemption is
  recorded and no voucher is minted while the program is off.
- Couple surface hidden when off: `/dashboard/[eventId]/refer` redirects to the
  dashboard, and the `refer` nav item is added to `navHideKeys` in the event
  layout so it's hidden from the sidebar, bottom nav, and sub-nav everywhere.
- Admin toggle: new `app/admin/referrals/actions.ts` (`setReferralProgramEnabled`,
  admin-guarded) + a checkbox/Save toggle on `/admin/referrals`, mirroring the
  `admin_digest_enabled` settings-toggle pattern.

Net: the referral feature ships completely dormant + invisible until an admin
turns it on — no misleading "refer for a perk" surface while there's no program.

SPEC IMPACT: none — additive admin toggle on an already-inert feature; no
schema-rename/SKU/price/public-copy change.
