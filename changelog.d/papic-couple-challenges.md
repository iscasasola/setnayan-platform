## 2026-07-22 · feat(papic-games): couple-authored challenges + curation surface

Gap-analysis fix (#1 scope + #8 curation): only `vendor_booth` missions had a
producer, so a flag flip delivered nothing for events without a booked vendor, and
the couple had no way to see/hide/remove the missions on their own landing page.
This gives the couple a first-class **Photo Challenges** surface — makes it a real
game family, not just booth missions. No migration: the couple already has RLS
`FOR ALL` on `papic_missions`, so authoring + curation are RLS-direct writes.
Flag-gated (`NEXT_PUBLIC_PAPIC_GAMES_V1`, OFF).

- **`couple-challenges-manager.tsx`** (new, async server component) on the couple's
  Papic studio — a compose box to **author your own** challenge (`source='couple'`,
  `mission_type='prompt'`, pre-approved so it goes live to guests) + a **curation
  list** of every approved mission (booth / vendor / yours) with **hide/show** and
  **delete** (own only). Pending vendor challenges stay in the separate approval
  panel.
- **Actions** (`studio/papic/actions.ts`) — `createCoupleChallengeAction`,
  `setCoupleChallengeActiveAction` (hide/show any source), `deleteCoupleChallengeAction`
  (scoped `source='couple'`). RLS is the authoritative gate (member `WITH CHECK` /
  `USING`); plain redirects, revalidated manager is the feedback.

A couple challenge is vendorless, so the guest panel (consent-rework PR) shows it
with no share tap — the two compose cleanly.

SPEC IMPACT: None — implements the couple mission authoring the spec §5 / §6 Q5
already contemplate (`source='couple'` was in the Phase-1 enum). `tsc --noEmit`
clean.
