## 2026-07-03 · feat(seating): booth "offerings" copy — vendors & couples describe what each booth serves (feeds the 3D walk booth card)

Slice A of the 3D walk-around interaction program (owner decision 2026-07-03): a
guest tapping a booth in the 3D venue walk should see which vendor runs it AND
what it serves. This slice adds the data + the two editing surfaces; the 3D tap
card that reads it is a later slice (no 3D renderer / `public_venue_scene` code
touched here).

- **Migration** `20270509511134_booth_offerings.sql`: `event_floor_booths.offerings
  TEXT` (nullable, `CHECK char_length <= 280`, commented as the guest-facing 3D-walk
  copy). `CREATE OR REPLACE` (from the current origin/main v2 definitions, additive,
  every gate preserved) of `vendor_upsert_cocktail_booth` (new trailing
  `p_offerings TEXT DEFAULT NULL` param, trimmed/capped/persisted) and
  `get_vendor_cocktail_editor` (returns each booth's `offerings`).
- **Couple 2D seat-plan editor**: "Offerings" textarea in the booth type-picker
  popover with a 280-char cap + live counter + helper line; round-trips through the
  existing lock-gated `saveBooths` replace-all path (`parseBoothsPayload` +
  `persistBooths` + `FloorBoothRow` / `fetchBooths` extended) so saves never drop it.
- **Vendor cocktail editor**: pencil affordance on editable booths (own booth for
  BOOTH-tier, any for ARRANGE-tier — mirrors existing capability logic) opens an
  inline offerings panel (cap + counter + "guests see this in the 3D venue walk"
  helper), persisted optimistically via the updated `vendor_upsert_cocktail_booth`
  RPC with rollback on failure.

SPEC IMPACT: None. (Additive data + editor wiring for an already-decided feature;
no pricing, SKU, or locked-decision change. The 3D read-side card is a separate
future slice.)
