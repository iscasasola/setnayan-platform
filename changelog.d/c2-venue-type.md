## 2026-08-31 · feat(vendor-dashboard): a shop can now say what kind of venue it is

`vendor_profiles.venue_type` (migration 20260810000000) has been read publicly
since it shipped — by the v1 vendor profile API and by the onboarding
reception-venue leaf-match matcher — with no writer a vendor could reach. Both
live shops were stuck on the seed default (ballroom / garden / heritage).

- New shared vocabulary: `apps/web/lib/vendor-venue-type.ts` (the 7 fine
  reception-venue types, mirroring the couple's own onboarding pick).
- New writer: `app/vendor-dashboard/shop/venue-type-actions.ts`, following the
  same ownership + error-handling pattern as `venue-match-actions.ts`.
- New card: `app/vendor-dashboard/shop/_components/venue-type-card.tsx`, mounted
  on My Shop right after the "weddings you're a fit for" card. `venue_type` is
  not one of the 8 verified-locked identity fields, so it stays editable even
  once a shop is verified.
- Guard: `lib/vendor-venue-type.test.ts` pins that the writer exists, the card
  is mounted, and no second write path for the column exists in the general
  inline-profile editor. Mutation-tested: sabotaging a second write into
  `app/vendor-dashboard/actions.ts` took the suite from 6/6 to 5/6 pass.

SPEC IMPACT: None.
