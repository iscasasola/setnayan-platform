## 2026-09-03 · feat(mood-board): AI-generated, retintable reception-decor images — PILOT (2 zones × 5 styles)

**This is explicitly a 10-image PILOT, not full coverage.** The reception
live preview (`renderVenueSvg` in `apps/web/lib/reception-scene.ts`) is a
flat, hand-coded SVG recolored via simple fill substitution. This lands the
pipeline to instead composite real AI-generated images per decor zone,
retinted to the couple's exact palette using the EXISTING recolor engine
(`apps/web/lib/color-recolor.ts` — the same region-tagging + HSL-palette-snap
math the admin Color Range Manipulator and the couple Recolor Studio already
use). No new tinting mechanism was invented.

Scope, deliberately capped: **Backdrop + Ceiling zones × the 5 existing style
families** (elegant · simple · classic / bridgerton · regal / editorial cream
/ tropical heritage / modern minimalist) = exactly 10 images. These two zones
were picked as the most visually dominant in the composited scene, to prove
the pipeline end-to-end (generate → tag color region → retint on demand →
composite with graceful fallback) before running the same process again for
more zones.

**What shipped:**
- `apps/web/lib/reception-decor-layers.ts` — pure, DOM-free fallback
  selection (`resolveDecorLayer`) + a thin wrapper (`retintDecorLayerRGBA`)
  around `recolorRGBA` (no reimplemented pixel math). Unit-tested
  (`reception-decor-layers.test.ts`, 10 cases): the ONLY way to get an image
  back is a pilot zone + a known style_family + a catalog hit — every other
  input (today, every real couple, since no style_family is ever known — see
  below) falls back to the exact existing flat SVG rendering, byte-for-byte.
- `apps/web/lib/reception-decor-layers-server.ts` — the Node/`sharp` half:
  reads the catalog from `moodboard_library_assets` +
  `moodboard_asset_color_ranges`, fetches an image via the existing
  SSRF-guarded `safeFetchImageBytes`, rasterizes, retints, re-encodes as a
  data URI. Wired into the vendor-facing read-only Mood Board page
  (`app/vendor-dashboard/clients/[eventId]/mood-board/page.tsx`), which is a
  React Server Component and could do this compositing directly server-side
  — no browser canvas needed.
- Migration `20271194970382_moodboard_reception_decor_layers_pilot.sql` —
  10 `moodboard_library_assets` rows (`asset_type='venue_scene'`,
  `asset_subtype='backdrop'|'ceiling'`, `style_theme` = one of the 5
  existing strings; no schema/constraint change needed — migration
  20260613000000's CHECK already permits any asset_type to carry a
  style_theme) + 10 `moodboard_asset_color_ranges` slot-1 rows.

**Honest status — generation only, NOT uploaded to R2, NOT live:** the 10
SVGs were generated via the Higgsfield MCP image tool (Recraft V4.1 vector,
2k) — this environment had no `RECRAFT_API_KEY` to call
`apps/web/lib/recraft.ts` directly, and no R2 credentials to upload. The raw
files are saved locally (untracked) at
`apps/web/scripts/decor-pilot-output/{zone}/{style-slug}.svg`; the seed
migration inserts them with **`approved_at = NULL`** on purpose — the
existing draft/published gate every other library asset already uses — so
merging this migration is inert until a human runs
`apps/web/scripts/upload-decor-pilot-to-r2.ts` and flips `approved_at`.
`apps/web/scripts/reception-decor-pilot-prompts.ts` documents the exact
prompts/params to regenerate or expand coverage later.

**Real, flagged gap — not solved here:** no couple's board has a stored
`style_family` anywhere on `events`. `applyMoodboardTemplate` merges a
template's palette + reception_design into the event but never persists
which of the 5 style families produced them. Until something does, every
zone falls back to the flat SVG in production — this pilot proves the
pipeline, it doesn't turn it on. Whether couples should explicitly pick a
style family independent of using a template is an owner product decision,
out of scope here.

SPEC IMPACT: None yet — this is a pilot with no couple-visible behavior
change until a human completes the R2 upload + approval step above. Once
built out fully, product intent (owner-stated) is that this ships as a FREE
upgrade to the existing preview: no paywall exists on it today, and the
coverage-gated fallback (real image if tagged, flat SVG otherwise) IS the
rollout mechanism — not a payment gate. Flag if that intent changes.
