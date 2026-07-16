## 2026-07-16 · feat(creator): vendor↔creator discount collab loop (token-gated offer → accept → profile influence) [P1]

The first rung of the Creator Economy three-party money engine. A vendor spends a
REACH TOKEN to send a discount offer to a creator (a user with ≥1 published
Adventure Chapter on a public profile); the creator accepts/declines; an accepted
collab surfaces as "influence" on the creator's public profile. Setnayan holds NO
money — it records the collab + gates the outreach with a token; the discount
settles off-platform.

- **Schema** `supabase/migrations/20270817214733_vendor_creator_offers_collab_p1.sql`:
  new `vendor_creator_offers` table (the row is its OWN token hold ledger — no new
  table, mirroring `lead_token_holds`). RLS at CREATE, canonical patterns only:
  SELECT = vendor owns via `current_vendor_ids('viewer')` OR the addressed creator
  (`creator_user_id = auth.uid()`) OR `is_admin()`; admin-all override; no public
  read; all mutations via SECURITY DEFINER RPCs.
- **Token spend REUSES the existing per-voucher burn** — no fork. The send
  RESERVES a reach token (`offer_creator_reach_hold`, mirroring
  `unlock_vendor_event_hold`'s gates + soft reservation against the SAME wallet
  sources, minus outstanding lead holds AND offer holds); accept/decline CONSUMES
  it via the existing `consume_vendor_assets_per_voucher` (founder) /
  `consume_member_purchased_tokens` (member) — best-effort so a vendor's overspend
  never blocks the creator; expiry past the window RELEASES it (refund) via the
  cron-free `sweep_expired_creator_offers` wired into the vendor-dashboard
  `after()` hook (durable daily claim, mirrors `maybeSweepGhostedLeadHolds`).
- **Vendor surface** `/vendor-dashboard/creators` (doorway = My Shop → tools card):
  browse eligible creators (reach ≥ a vendor-set bar, ordered by followers/views),
  send a token-gated offer (creator rate + optional audience rate), see sent
  offers + status.
- **Creator inbox** on `/dashboard/creator`: incoming offers with Accept/Decline;
  on accept the creator may credit the vendor in a published chapter (the
  deliverable — simple linkage in P1).
- **Profile influence** on `/u/[userSlug]`: an aggregate "Partnered with" strip of
  accepted-collab vendors (name/logo → `/v/[slug]`). Public + terms-free — never
  exposes the offer terms or the offer graph.
- Two transactional notification types (`creator_offer_received`,
  `creator_offer_responded`) reuse the existing notification pipeline.
- Deferred: **P2** viewer promo + attribution (audience-rate Book CTA →
  chapter-tagged lead); **P3** vendor ROI line + bookings-driven influence.

SPEC IMPACT: Implements P1 of `Creator_Economy_Discount_Collab_Build_Plan_2026-07-16.md`.
Corpus DECISION_LOG.md row appended (P1 shipped; P2/P3 deferred). No pricing/SKU
change; reuses the live vendor token economy (flat ₱200/token) — no new token
primitive.
