## 2026-09-11 · feat(verify): the Verified badge has a deadline; the shop does not (owner Q4 + Q5)

Owner rulings 2026-09-11 (DECISION_LOG "SEVEN SUPPLIER-SIDE QUESTIONS"):
**Q4** — the two shops verified before the papers check keep the badge six months
while their papers come in, then it comes off; **Q5** — a Mayor's Permit that runs
out: a reminder 60 days ahead, then the badge comes off and the shop stays
findable and bookable.

- **The badge reads its own deadline.** `verification_state = 'verified'` is the
  public read policy AND the booking trigger AND the badge, so it is never touched
  at a deadline. The badge alone now reads `vendor_profiles.next_renewal_due_at`
  (already written at approval): `hasVerifiedBadge()` in `lib/verified-badge.ts`,
  expiry-on-read. The marketplace badge engine (`lib/vendor-badges.ts`) and
  `/explore` use it; the admin desk shows "Verified badge until …" / "off since …
  — still listed and bookable".
- **Q5 — the permit's printed date.** Approving an application now asks for
  "Mayor's Permit valid until (as printed)", prefilled 31 December (a Mayor's
  Permit runs for the calendar year); it becomes the badge deadline (end of that
  day, Manila). Blank keeps the one-year renewal it always wrote. An expired or
  >400-day date is refused.
- **Q4 — the two early shops,** chosen by condition (verified, no approved papers,
  not already vouched), get a vouch row and the deadline **12 March 2027**
  (2026-09-11 + 182 days, end of day Manila), with audit rows. Nothing about their
  listing changes.
- **The 60-day reminder and the "badge is off" note** ride `runDailyEmailJobs`
  (public-page `after()` + a daily claim) through `emitNotification`
  (`vendor_status_change` → in-app + email via Resend). Once per shop per
  deadline, deduped on `admin_audit_log`; a lapse never sends a "days left" line.
- **Vouch fixes.** (1) The vouch expiry sweep used to HIDE the shop — it had no
  caller, so it never ran; it now lives in `lib/verified-badge-sweep.ts` and only
  stamps the vouch lapsed. (2) Granting a vouch wrote `verified` without
  `last_verified_at`, which the stamp CHECK refuses on every UPDATE — vouching a
  never-verified shop failed; the grant now writes the stamp and the deadline.
  Approving papers clears a vouch's countdown.
- **Trust guard.** `next_renewal_due_at` was writable by the shop itself; it joins
  `last_verified_at` in `guard_vendor_profiles_entitlement` (re-emitted from a
  body confirmed byte-identical to production).

Migration `20271221359289_verified_badge_deadlines.sql`. Tests:
`lib/verified-badge.test.ts`, `lib/verification-bypass.test.ts`,
`lib/vendor-badges.test.ts`, `tests/db/verified-badge-deadlines.db.test.ts`.

**Not in this PR (owned by parallel sessions):** the shop page's own badge
(`app/v/[slug]/page.tsx:2105`) and the other `verification_state === 'verified'`
badge renders still read the state alone — listed in the PR for a follow-up that
routes them through `hasVerifiedBadge`.

SPEC IMPACT: DECISION_LOG.md row appended 2026-09-11 (badge deadline = `next_renewal_due_at`; a missed vouch/papers deadline costs the badge, not the listing — reverses the never-run "withdraw the listing" sweep; the permit's printed date is recorded at approval).
