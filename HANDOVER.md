# HANDOVER — rd/supplier-personal-invite (builder, 2026-10-23)

Contract: corpus `prototypes/supplier_personal_invite_2026-10-23.html` (owner-approved). Branch includes #6823's
branch (rd/plans-price-reach-not-income) merged locally — #6823 was still OPEN.

## Done (committed)
- Migration `20271286262047_the_personal_invite_carries_its_offer.sql`: vendor_invites.offer_tier/offer_until/
  offer_photo_allowance (+4 CHECKs); vendor_profiles.portfolio_photo_allowance (+CHECK, authenticated SELECT,
  guard trigger); `claim_ready_the_invited_shop(user, token)` — FIXES a pre-existing bug: the admin invite's staged
  shop was never reached (signup trigger opens an empty shop first); applies the offer as an admin comp + audit row.
- db test `tests/db/the-personal-invite-carries-its-offer.db.test.ts`.
- lib/personal-invite-offer.ts (pure words + parse), lib/personal-invite-card.ts (card SVG),
  lib/personal-invite-prices.server.ts (catalogue prices), lib/portfolio-allowance.server.ts.
- Admin form (A2/A3), door (B1, `TeamInviteDoor`), finalize admin branch → RPC → lands on /vendor-dashboard/profile.
- Portfolio cap: `portfolioPhotoCap` + `portfolioOverCapMessage` at the 3 enforcement sites + gallery widget.

## Decisions taken (not in the record)
- Service category on the admin form became a PickMenu of VENDOR_CATEGORIES (prototype A2 draws a dropdown; free
  text could never match MOODBOARD_SLOT_TRADES).
- Offer applied only when it RAISES the shop's running plan, and only while the gift date is ahead.
- "Free until" stored as 23:59:59 Manila of the picked day.
- Message fee line = the merged #6820 rule ("Your first booking from Setnayan is on us."), launch-offer sentence only
  while `launchOfferIsOpen`.

## Next
- B4 "from your invite" on Your details · B6 inspiration step + Shop line gift words · C2 gift door ·
  C1/C3 plan page gift words + Portfolio photos row · lab fixtures + screenshots · checks · PR.
