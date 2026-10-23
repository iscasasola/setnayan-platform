# HANDOVER — rd/supplier-personal-invite → cloud session (2026-10-23)

## Goal
Build the owner-approved prototype `HANDOVER-ASSETS/supplier_personal_invite_2026-10-23.html` (corpus copy:
`prototypes/supplier_personal_invite_2026-10-23.html`, pushed to Setnayan-specs e937eba): an admin/owner creates a
PERSONAL invite for one supplier — a plan (Solo · Pro · Ultra) free until a day + optional 100 portfolio photos, a QR
card, and a message to copy. Build exactly what the frames show, delta over the shipped admin invite + claim flow.
Delete `HANDOVER-ASSETS/` (and this file) before opening the PR.

## Owner rulings (verbatim where we have them)
- 23 Oct: *"their personal invite will have special features. It should automatically register their shop. one
  login. Then asks for the user info first, then directly proceeds to the shop info, quick tour, and when you arrive
  on the important parts: Submit Documents · Create a service Card · Upload Inspiration Box (only if their category
  offers it) · Block schedules in calendar. Actually, this QR code should be quite similar to when a user manually
  inputs a supplier. The only difference is we can offer what plan they get for free and until when, how many
  portfolio photos they can upload (normal is 50. we can make it 100)."* → *"making it 100 is optional"* (a switch,
  off by default).
- 23 Oct (relayed by the controller): **the optional 100 photos are KEPT by the supplier after the offer ends — only
  new invites stop offering them.** Recorded: corpus DECISION_LOG row 2026-10-23 "THE PERSONAL INVITE'S 100
  PORTFOLIO PHOTOS ARE KEPT AFTER THE OFFER ENDS" (pushed, Setnayan-specs e937eba).
- 23 Oct (#6820, merged): *"Your first booking is on us. Not 5."* — `FIRST_BOOKING_ON_US` in lib/booking-fee-lock.ts.
- 2026-10-08 launch offer: first 2,000 platform bookings fee-free — settings in `platform_settings.launch_offer_*`;
  the message says it ONLY while `launchOfferIsOpen` (lib/launch-offer.ts).
- 23 Oct plans (#6823, still OPEN — its branch `rd/plans-price-reach-not-income` is merged INTO this branch): top plan
  is "Ultra" (key `enterprise`), 50 free portfolio photos on every plan (`PORTFOLIO_FREE_BASE`).
- House: no new emails (message is copied by hand); any set of choices = PickMenu; frames only on pressable things;
  phone-first 375; "event" never "celebration"; no "gallery" word; money numbers only from stored values.

## Done (all committed on this branch)
- Migration `supabase/migrations/20271286262047_the_personal_invite_carries_its_offer.sql`:
  `vendor_invites.offer_tier · offer_until · offer_photo_allowance` (+4 CHECKs); `vendor_profiles.portfolio_photo_allowance`
  (+CHECK, authenticated SELECT, anon revoked, guard trigger `guard_vendor_portfolio_photo_allowance`, `vendor_profiles_self`
  rebuilt); `claim_ready_the_invited_shop(user, token)` (service role) — ALSO FIXES a shipped bug: an admin invite
  never reached its staged shop (vendor sign-up opens an empty shop first, so finalize's "has a shop" branch won).
  It hands over / fills blanks + drops the staged row, seats admin, applies the offer as an admin comp only when it
  raises the shop and while its day is ahead, writes one `vendor_tier_set` audit row "Personal invite <id>", raises
  the allowance (never lowers).
- db test `apps/web/tests/db/the-personal-invite-carries-its-offer.db.test.ts` — last LOCAL run 6/8; the 2 failures
  were test bugs, FIXED in commit 50d63cc (empty-string name; gift now ends via `sweep_vendor_tier_expiry`) but the
  fixed file was NOT re-run locally (heavy-lane queue). **Run it first.**
- lib: `personal-invite-offer.ts` (parse, words, message), `personal-invite-card.ts` (card SVG = shipped QR drawing),
  `personal-invite-prices.server.ts` (catalogue prices), `portfolio-allowance.server.ts`, `plan-gift.ts`;
  `vendor-tier-caps.ts` `portfolioPhotoCap` + `portfolioOverCapMessage` (3 enforcement sites + gallery widget).
- A2/A3 admin form + `InviteResult` (app/admin/vendors/_components/invite-vendor-form.tsx; prices passed from
  vendors-surface); B1 `TeamInviteDoor` (claim-parts.tsx, used by claim page admin branch); finalize admin branch →
  RPC → redirect `/vendor-dashboard/profile`; B4 "from your invite" (details-data + details-screen); B6 counted
  inspiration step (vendor-first-steps + .server) + gift Shop line; C2 gift door row ('gift' door id); C1/C3 plan page
  gift line, picker ₱0 + "Pro · gift", Portfolio photos row.
- Labs: `/dev/personal-invite-lab?f=form|result|door|door-bare`, `/dev/supplier-lab?s=details&invited=1`,
  `?easy=setup&sup=caterer&rail=service&library=1&gift=running`, `?easy=normal&sup=caterer&gift=soon`,
  `/dev/supplier-plan-lab?s=plan&gift=running|ended&photos=100`.
- Side-by-sides (prototype left, built right, 375, light): `HANDOVER-ASSETS/side-*-light.png`.
- Changelog fragment `changelog.d/supplier-personal-invite.md`. Guards updated (doors-are-designed bill, active-shop
  enumerations, vendor-publish-guard, credit-warning select, plans-price-reach 3c, palette-library 4), baselines
  regenerated with their generators (home-shelf-writes, ugat screens, no-door).
- Checks run locally: preflight `--only guards,lint,types,pins` (42 CI guards, eslint, changed-file tsc, 375 related
  unit files) — all fixed after; 107 touched unit tests green; sabotage runs on the two new guards (red → green).

## Left, in order
1. `cd apps/web && npx tsx --test tests/db/the-personal-invite-carries-its-offer.db.test.ts tests/db/ugat-schema-claims.db.test.ts tests/db/ugat-concept-coverage.db.test.ts tests/db/a-supplier-joins-from-the-couples-link.db.test.ts`
   (Ugat rule 4: new columns + function — if concept-coverage fires, add a reasoned line to
   `tests/db/ugat-concept.baseline.txt` or a node in `lib/ugat/graph.ts`).
2. Full typecheck: `cd apps/web && NODE_OPTIONS=--max-old-space-size=7168 npx tsc --noEmit -p .` (never run in full).
3. `node scripts/preflight.mjs` (whole, from repo root); fix reds.
4. Merge `origin/main` (and `origin/rd/plans-price-reach-not-income` if #6823 is still open) again.
5. Delete `HANDOVER-ASSETS/` + this file; open DRAFT PR, `gh pr edit <N> --add-label do-not-auto-merge`,
   `gh pr merge <N> --disable-auto`, check `autoMergeRequest` is null; body ends "🤖 Generated with [Claude Code](https://claude.com/claude-code)";
   include the side-by-sides (upload) and the deviations below. One push per CI round (Actions is capped at 20 jobs).

## Deviations to state in the PR (decided, not asked)
- Dark: built screens stay Light — by ruling, `DARK_READY` (lib/appearance.ts) lists none of /vendor-dashboard,
  /admin or the claim door, and signed-out is always Light. The prototype assumed "dark follows the phone".
- B4 counts honestly from the live checklist ("1 of 6 done" for name+category+email) — the prototype's "2 of 6" was
  illustrative. The inline "→ Fill in" button is not drawn; the shipped thumb "Add what is left" does it.
- B5 tour: script unchanged; on Your details the engine skips to its first present stop (Shop tab, step 2), not 3.
- B6 order follows the shipped rail (service card before documents); inspiration sits right after the service card.
  The Today "Add to the inspiration library" Shop row hides while that step is still to do.
- C2 is a door row under Also waiting (the frame caption), not a Next card.
- Fee line uses the merged one-booking rule (the prototype's "first 5 †" was Q1, now settled by #6820).
- Service category on the admin form became a PickMenu of `VENDOR_CATEGORIES` (A2 draws a dropdown).
- Untraced numbers: none — prices from `vendor_billing_catalog` (`<tier>_vendor_monthly`; missing → named without a
  price), 100 = owner, 2,000 = `platform_settings.launch_offer_booking_cap`, 7-day window = `CREDIT_WARNING_WINDOW_DAYS`.

## Learned
- `/signup?as=vendor` always creates an empty shop (trigger `handle_new_vendor_user`) before any finalize runs.
- `vendor_profiles` SELECT for `authenticated` is column-scoped: a new column needs `GRANT SELECT (col)` and a
  `vendor_profiles_self` rebuild (`lint-vendor-profiles-column-grants.mjs`); UPDATE is table-level, so guard with a trigger.
- A tier downgrade by plain UPDATE is refused (`TIER_DOWNGRADE_BLOCKED`); end a gift via `sweep_vendor_tier_expiry`.
- en-PH `Intl` prints "Jan 31, 2027" — day words are composed by hand (`offerDayWords`).
- New raw numbers in copy trip `numbers-carry-commas` → `formatCount`.
