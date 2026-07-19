## 2026-07-08 · fix(plan3d): figure silhouette pass — dress-form shells + attire-true demo wardrobe

Owner feedback on slice 1: figures "look like christmas trees instead of a realistic person."

- Re-authored the three outfit shells (`kit/outfits.ts`) as LatheGeometry dress-form profiles — collar → shoulders → bust → **waist** → hips → hem — replacing the lab-era cones that flared from the neck. Gowns are now fitted bodice + A-line skirt from the hips (shins visible for footfall); suits get a shoulder line, chest→waist taper, and a hip-length jacket over trousers; neutral is a soft humanoid column.
- Added a neck (skin cylinder bridging collar→head) so heads read attached, not balanced (`kit/figure.tsx`).
- **Demo wardrobe is now attire-true**: `Plan3DGuest` carries the guest's resolved attire via the SAME `resolveGuestAttire` chain the couple lab uses; the scene's hash only picks the cultural variant within the class (gown↔filipiniana, suit↔barong). The old side+hash derivation dressed male-named sample guests in gowns (owner caught Antonio Bautista in one).
- Sample-cast wardrobe set explicitly (14 suits / 14 gowns) in prod data AND persisted in `scripts/seed-sample-event-maria-jose-content.sql` so re-seeding keeps it.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md (slice-1 silhouette addendum)
