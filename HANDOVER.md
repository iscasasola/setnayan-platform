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

## Also done
- B4 Your details "from your invite" (honest count, not the prototype's illustrative "2 of 6") · B6 counted
  inspiration step + gift Shop line · C2 gift door row (caption's "one row under Also waiting", not a Next card) ·
  C1/C3 gift words, ₱0 picker, Portfolio photos row.
- Labs + side-by-sides in ~/Documents/Claude/Projects/shots-2026-10-23/personal-invite/side-*.png (scripts/ there).
- Corpus: prototype + DECISION_LOG row pushed (Setnayan-specs e937eba) via a temp clone (local corpus checkout is
  14 ahead / 387 behind with others' edits — untouched).

## Known gaps
- Dark side-by-sides: built screens stay Light by ruling — DARK_READY (lib/appearance.ts) does not list
  /vendor-dashboard, /admin or the claim door; signed-out is always Light.
- B5 tour: shipped script unchanged; landing on Your details, the engine skips ahead to the first present stop
  (Shop tab, step 2), not step 3 as drawn.
- B4 inline "→ Fill in" button not drawn — the shipped thumb "Add what is left" does that (tools in the lower third).

## Next
- PR draft, label do-not-auto-merge, --disable-auto; watch CI with one loop.
