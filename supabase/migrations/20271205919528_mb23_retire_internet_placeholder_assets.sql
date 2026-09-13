-- MB23 · "In your colors" tells the truth — two data fixes, both measured.
--
-- Owner's bug report (2026-09-05, verbatim): "we do not have a design yet for
-- the palette and there are already samples on in your colors." A couple with
-- NO palette saw coloured figures and a random stock photograph labelled
-- "Ceremony". Owner ruling for this section: RECOLOURED DRAWINGS ONLY — never a
-- photograph, never a Make-it-real render, never another couple's anything.
--
-- ── PART A · the placeholder photographs come down ──────────────────────────
-- `moodboard_library_assets` still carries the 2026-05-31 bring-up seed:
-- picsum.photos stock photographs marked `source = 'internet_placeholder'`.
-- Measured on prod 2026-09-05: 12 such rows exist; 10 (the figure_attire ones,
-- retired by 20260612000000) are already retired, and exactly TWO are still
-- live and customer-visible —
--
--   venue_scene/church     'Catholic church ceremony'      picsum … church-1
--   venue_scene/reception  'Banquet hall reception setup'  picsum … reception-1
--
-- The church row is the "Ceremony" card in the owner's report. It is a random
-- stock photograph of nothing in particular, shown to the couple as their
-- ceremony space "in their colors".
--
-- RETIRE, never DELETE — the gallery rule is that a seeded photo is never
-- deleted (owner decisions, 2026-09-04). `retired_at` is the visibility gate the
-- couple-facing queries already read (`approved_at IS NOT NULL AND retired_at
-- IS NULL`), so this hides them everywhere at once without losing the history of
-- what we once shipped.
--
-- With no live `venue_scene`, `churchRow` in the mood-board page is undefined
-- and the Ceremony card simply does not build. That is the intended end state:
-- the section is honest about having nothing to show rather than showing a
-- stranger's photograph. The replacement is an owner-supplied Ceremony DRAWING
-- (SVG with colour regions tagged); until it exists the card is absent by
-- design. Nothing in the app substitutes a photograph.
--
-- Guarded by `tests/db/no-placeholder-photo-is-ever-live.db.test.ts` and, on the
-- write side, by `lib/moodboard-library-placeholder.ts` (imported by the admin
-- approve action) so this cannot be undone by a click.

UPDATE public.moodboard_library_assets
   SET retired_at = NOW()
 WHERE retired_at IS NULL
   AND (
     source = 'internet_placeholder'
     OR storage_path ILIKE '%picsum.photos%'
   );

-- ── PART B · the white attire must not repaint the whole card ───────────────
-- Section 01 is untouched by this migration. This half is about the ATTIRE
-- figures, which MB23 makes recolourable for the first time (the query never
-- selected their colour ranges, so `recolorable` was always false — a query
-- shape, not the "no-CORS host" the code comments claimed; the host echoes
-- every origin we run on, re-measurable with the curl in moodboard-board.tsx).
--
-- All 75 live `figure_attire` rows already carry a `moodboard_asset_color_ranges`
-- row from the `attire_guide_*_seed` migrations. Turning the recolour on exposes
-- a defect in FOUR of those seeded ranges.
--
-- 🔑 MEASURED, not assumed. Every one of the 40 figures behind the 8 cards the
-- board builds was rasterised at the component's own MAX_PREVIEW_PX (520) with
-- rsvg-convert and pushed through the real `recolorRGBA` with a burgundy palette
-- (#7A1F2B). 10 of the 40 SVGs carry an OPAQUE flat background rect rather than
-- transparency, and in four of them that background colour falls INSIDE its
-- slot's tolerance. Deviation measured per region — the 6px outer frame as the
-- background sample, the slot-matched pixels as the attire region:
--
--   asset                        bg colour   d(slot,bg)   frame changed   ink
--   modern-minimalist/bride      #ECEBE7      6.0          100%           88.85%
--   bridgerton-regal/groom       #EDECE6      8.3          100%           91.28%
--   tropical-heritage/male_ps    #FAF8F2     12.6          100%           91.60%
--   bridgerton-regal/male_ps     #F8F8F1     12.4          100%           90.15%
--
-- 100% of the background frame recoloured: the gown AND the page behind her both
-- turn burgundy. That is the exact failure the brief warned about, and it is
-- real — the other 36 figures leave the frame at 0%.
--
-- THE FIX IS THE DATA, NOT THE COMPONENT.
--
-- ── B1 · three ranges re-sampled from the garment ───────────────────────────
-- Each slot was re-sampled from the garment itself (the largest opaque
-- non-background colour in the file) and its tolerance set below that file's
-- measured distance to its own background, so the background can never be the
-- best-matching slot:
--
--   asset                      old            new            d(new,bg)  tol
--   bridgerton-regal/groom     #E8D9B8/15  →  #E7C99F/12     14.1       12
--   tropical-heritage/male_ps  #E8D9B8/15  →  #F7D79E/12     14.8       12
--   bridgerton-regal/male_ps   #E8D9B8/15  →  #F4DDAC/10     12.1       10
--
-- Re-measured after the fix, in a real browser render: frame max saturation 7–8
-- (unchanged from the source background) while the garment reaches saturation
-- 111–133 across 11–13% of the card. The garments recolour; the backgrounds do
-- not.
--
-- ── B2 · one range DELETED, because it was never taggable ───────────────────
-- ⚠ `modern-minimalist/bride` is not a mis-tuned tolerance. Its gown is filled
-- with #ECEBE7 — the SAME COLOUR, ΔE 0.0, as its background rect. 76.6% of the
-- figure column is that one value. No `sampled_hex` and no tolerance can select
-- the dress without also selecting the backdrop, because to the recolour engine
-- they are not two regions; they are one. A tighter tolerance (#D3D2D1 ± 8)
-- protects the background but then catches only the gown's shading, which
-- renders as a white dress with pink trim — a card that looks broken rather than
-- one that looks recoloured.
--
-- So the range is DELETED rather than adjusted. A colour range is a claim that a
-- region can be isolated, and for this file that claim is false; leaving a
-- plausible-looking row would be the same kind of lie as the "no-CORS host"
-- comment this session removed. With no range the figure is not recolourable,
-- and `page.tsx` now prefers a representative that HAS one — the other four
-- bride variants (editorial-cream, elegant-simple-classic, tropical-heritage,
-- bridgerton-regal) all have transparent backgrounds and recolour correctly on
-- their seeded #FAFAFA ± 15, verified in the same render.
--
-- Fixing the artwork (re-cutting the gown in a fill distinct from the backdrop,
-- or removing the background rect) is an owner/asset decision, not a migration.
--
-- Both halves are pinned by
-- `app/dashboard/[eventId]/studio/mood-board/_components/the-background-never-wears-the-palette.test.ts`,
-- whose fixture is these measurements and whose slot values are PARSED out of
-- this file — so editing the numbers below re-runs the guard against them.
--
-- Addressed by storage_path (stable, unique per file) rather than asset_id so
-- this migration replays identically into the PGlite test database, which has no
-- prod UUIDs. Idempotent: re-running sets the same values.

UPDATE public.moodboard_asset_color_ranges c
   SET sampled_hex = v.hex,
       tolerance_de = v.tol
  FROM (VALUES
    ('figure_attire/bridgerton-regal/groom.svg',    '#E7C99F', 12),
    ('figure_attire/tropical-heritage/male_ps.svg', '#F7D79E', 12),
    ('figure_attire/bridgerton-regal/male_ps.svg',  '#F4DDAC', 10)
  ) AS v(path_suffix, hex, tol)
  JOIN public.moodboard_library_assets a
    ON a.storage_path LIKE '%' || v.path_suffix
 WHERE c.asset_id = a.asset_id
   AND a.asset_type = 'figure_attire'
   AND c.region_label = 'attire';

DELETE FROM public.moodboard_asset_color_ranges c
 USING public.moodboard_library_assets a
 WHERE c.asset_id = a.asset_id
   AND a.asset_type = 'figure_attire'
   AND a.storage_path LIKE '%figure_attire/modern-minimalist/bride.svg';
