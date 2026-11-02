## 2026-07-03 · feat(taxonomy): connect the representation layer end-to-end (Taxonomy Studio · PR 4)

Backfills the empty icon/photo columns on every taxonomy node and wires the
seeded photos into the couple-facing browse — so the owner never hand-fills 66
categories in the Studio.

- **Migration** `20270508616558_taxonomy_connect_backfill_tile_folder_photos_icons.sql`
  (data-only, idempotent, empty-only guards):
  - 56 tier-2 tile `sample_photo_r2_key` seeded — 45 from each tile's anchored
    active refinement leaf's `main_photo` (pure relational), 11 gap tiles from
    new repo-committed editorial photos under `/public/taxonomy/tiles/`.
  - 10 tier-1 folder photos inherit their first child tile's photo.
  - 10 folder `icon_name` seeded from the code-default `FOLDER_ICON` map — every
    name allowlist-resolved (`lib/nav-icons.ts`), a visual no-op. Tiles have no
    independent code-default icon map (their fallback is the parent folder icon),
    so tile `icon_name` stays NULL and keeps inheriting via the existing fallback.
- **11 new tile photos** (Recraft, warm editorial PH-wedding style, 900×676 WebP,
  ≤119KB): lights_sound · dance_floor · fireworks · led_wall · digital_services ·
  editorial · wellness_fitness · date_specialist · trophies_awards · orchestra ·
  host_mc. Alt text stays generic (category label); the image backend is never
  named user-facing (AI-content disclosure lock).
- **Couple read path (DB-first, fail-soft, aspect-ratio boxed):**
  - `app/explore` `CategoryTile` cards now render a quiet 3:2 editorial photo
    banner above the title when the tile has a photo; a missing/failed photo
    degrades to the prior text-only card (no broken image, no layout shift).
  - Onboarding wedding PICK step (`PickCard`) prefers the DB tile photo over the
    static `/onboarding/picker/*.webp` asset for DB-driven tiles; unresolved →
    static-asset fallback.
  - Folder icon strip stays DB-first icon-only (#2725) — no photos added.

SPEC IMPACT: None. Data + read-path wiring only; no locked decision, SKU, price,
schema shape, or ID/slug changes. The taxonomy stays code-first-with-DB-override;
this only fills the DB defaults from the existing code defaults.
