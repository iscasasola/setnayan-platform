/**
 * reception-decor-pilot-prompts.ts
 *
 * Pure data: the exact (zone, style_family) → prompt + Recraft V4.1 params
 * used to generate the 10-image reception-decor pilot
 * (changelog.d/moodboard-ai-decor-layers-pilot.md). Kept as data — not a
 * runnable script — because the actual generation this session went through
 * the Higgsfield MCP `generate_image_batch` tool interactively (no
 * RECRAFT_API_KEY was available in that environment to call
 * apps/web/lib/recraft.ts's HTTP client directly). This module is the
 * reproducible record of what to (re)send, however it gets sent.
 *
 * TO EXPAND COVERAGE LATER (more zones, or regenerate a style that didn't
 * land well):
 *
 *   Option A — Higgsfield MCP (what this session used):
 *     Add entries to DECOR_PROMPTS below for the new (zone, style) cells,
 *     then call the `generate_image_batch` tool with one requests[] entry per
 *     cell: { model: 'recraft_v4_1', prompt: entry.prompt, params: {
 *     model_type: 'vector', resolution: '2k', aspect_ratio: entry.aspectRatio,
 *     background_color: entry.backgroundColor, colors: [entry.seedColor,
 *     entry.backgroundColor] } }. Batch cap is 12 requests per call — for the
 *     other zones (5 remaining × 5 styles = 25 more cells) split into 3 calls.
 *
 *   Option B — apps/web/lib/recraft.ts (once RECRAFT_API_KEY is available):
 *     Mirrors apps/web/scripts/generate-attire-guide-figures.ts's shape
 *     almost exactly — swap its ROLES/STYLES loop for DECOR_PROMPTS below,
 *     call `generateVectorSvg({ prompt, style: 'vector_illustration', size:
 *     '1024x1024' })`, and reuse that script's R2-upload + seed-SQL-emit
 *     tail verbatim (getR2Client / uploadSvgToR2 / the WHERE-NOT-EXISTS
 *     INSERT template) — it already does exactly this job for figure_attire.
 *
 * THEN — for either path — re-run the color-sampling step: rasterize each new
 * SVG (sharp `.resize(...).raw()`), exclude pixels near the exact
 * background_color used (NOT a generic saturation threshold — a warm cream
 * background has enough HSL "saturation" from its low lightness denominator
 * to fool a naive filter; excluding by RGB distance to the known
 * background_color is what actually works, learned the hard way this
 * session) and near-white/near-black line-art strokes, then take the
 * largest remaining color cluster as slot 1's sampledHex. toleranceDe = 15,
 * matching the figure_attire seed's existing value.
 */

export const PILOT_ZONES = ['backdrop', 'ceiling'] as const;
export type PilotZone = (typeof PILOT_ZONES)[number];

export const STYLE_SLUGS = {
  'elegant · simple · classic': 'elegant-simple-classic',
  'bridgerton · regal': 'bridgerton-regal',
  'editorial cream': 'editorial-cream',
  'tropical heritage': 'tropical-heritage',
  'modern minimalist': 'modern-minimalist',
} as const;
export type StyleFamily = keyof typeof STYLE_SLUGS;

const COMMON_SUFFIX =
  'Full-bleed flat vector illustration, no text, no watermark, no people, ' +
  'one dominant color region occupies most of the frame, rest of scene in ' +
  'muted neutral tones so the region is easy to isolate for recoloring. ' +
  'Clean flat color blocking, minimal outlines, soft magazine-illustration style.';

export type DecorPromptEntry = {
  zone: PilotZone;
  style: StyleFamily;
  prompt: string;
  aspectRatio: '4:5' | '16:9';
  backgroundColor: string;
  /** Seed hex fed to Recraft's `colors` control — NOT necessarily the final
   *  sampled hex (Recraft followed these closely this run, but always
   *  re-sample the actual pixels rather than trusting the seed). */
  seedColor: string;
};

export const DECOR_PROMPTS: DecorPromptEntry[] = [
  {
    zone: 'backdrop',
    style: 'elegant · simple · classic',
    aspectRatio: '4:5',
    backgroundColor: '#ECE6DD',
    seedColor: '#C9A059',
    prompt:
      "A wedding reception backdrop panel behind a couple's stage: an elegant draped fabric backdrop in a single solid warm gold color, floor-to-ceiling vertical folds, softly lit, set against a plain cream wall. Sophisticated editorial illustration, refined minimal aesthetic, magazine-clipping style. " +
      COMMON_SUFFIX,
  },
  {
    zone: 'backdrop',
    style: 'bridgerton · regal',
    aspectRatio: '4:5',
    backgroundColor: '#F3ECE0',
    seedColor: '#8C6BA6',
    prompt:
      "A wedding reception backdrop panel behind a couple's stage: an ornate Regency-era floral wall backdrop covered edge-to-edge in a single rich jewel-tone purple flower color, with gold leaf accents at the frame corners, dramatic and romantic. Bridgerton aesthetic, ornate flat-vector detail. " +
      COMMON_SUFFIX,
  },
  {
    zone: 'backdrop',
    style: 'editorial cream',
    aspectRatio: '4:5',
    backgroundColor: '#F7F3EA',
    seedColor: '#D98BA6',
    prompt:
      "A wedding reception backdrop panel behind a couple's stage: a soft draped fabric backdrop in a single blush-pink color, with delicate corner floral sprays in cream and champagne-gold, refined wedding-magazine editorial look. " +
      COMMON_SUFFIX,
  },
  {
    zone: 'backdrop',
    style: 'tropical heritage',
    aspectRatio: '4:5',
    backgroundColor: '#E4D9CC',
    seedColor: '#9CB29A',
    prompt:
      "A wedding reception backdrop panel behind a couple's stage: a Filipino-heritage backdrop of iridescent capiz shell panels and banana-leaf fronds at the edges, with one large draped fabric swag across the center in a single bold sage-green color as the dominant accent, warm earthy neutral surround. Tropical Filipino heritage illustration, abaca and piña textile inspiration. " +
      COMMON_SUFFIX,
  },
  {
    zone: 'backdrop',
    style: 'modern minimalist',
    aspectRatio: '4:5',
    backgroundColor: '#F5F3EF',
    seedColor: '#4A3B45',
    prompt:
      'A wedding reception backdrop panel behind a couple\'s stage: a clean architectural backdrop, one flat rectangular color block in a single deep charcoal-plum color centered on a plain white wall, no ornamentation, sharp geometric lines. Modern minimalist illustration, architectural clean lines. ' +
      COMMON_SUFFIX,
  },
  {
    zone: 'ceiling',
    style: 'elegant · simple · classic',
    aspectRatio: '16:9',
    backgroundColor: '#F3ECE0',
    seedColor: '#C9A059',
    prompt:
      'A wedding reception ceiling treatment viewed from below: an elegant draped fabric canopy in a single solid warm gold color swooping across the ceiling, soft warm string lights peeking through, plain cream ceiling surround. Sophisticated editorial illustration, refined minimal aesthetic. ' +
      COMMON_SUFFIX,
  },
  {
    zone: 'ceiling',
    style: 'bridgerton · regal',
    aspectRatio: '16:9',
    backgroundColor: '#F3ECE0',
    seedColor: '#8C6BA6',
    prompt:
      'A wedding reception ceiling treatment viewed from below: a dramatic draped fabric canopy in a single rich jewel-tone purple color paired with crystal chandeliers, ornate Regency romance, cream plaster ceiling surround. Bridgerton aesthetic, ornate flat-vector detail. ' +
      COMMON_SUFFIX,
  },
  {
    zone: 'ceiling',
    style: 'editorial cream',
    aspectRatio: '16:9',
    backgroundColor: '#F7F3EA',
    seedColor: '#D98BA6',
    prompt:
      'A wedding reception ceiling treatment viewed from below: a soft flowing fabric canopy in a single blush-pink color with delicate hanging floral clusters in cream and champagne-gold, refined editorial wedding-magazine aesthetic. ' +
      COMMON_SUFFIX,
  },
  {
    zone: 'ceiling',
    style: 'tropical heritage',
    aspectRatio: '16:9',
    backgroundColor: '#E4D9CC',
    seedColor: '#9CB29A',
    prompt:
      'A wedding reception ceiling treatment viewed from below: a canopy of banana leaf and monstera fronds with hanging capiz shell lanterns, and one long fabric ribbon streamer in a single bold sage-green color as the dominant accent, warm neutral surround. Tropical Filipino heritage illustration. ' +
      COMMON_SUFFIX,
  },
  {
    zone: 'ceiling',
    style: 'modern minimalist',
    aspectRatio: '16:9',
    backgroundColor: '#F5F3EF',
    seedColor: '#4A3B45',
    prompt:
      'A wedding reception ceiling treatment viewed from below: a geometric hanging installation, one flat polygon shape in a single deep charcoal-plum color suspended against a plain white ceiling, architectural clean lines, no ornamentation. Modern minimalist illustration. ' +
      COMMON_SUFFIX,
  },
];
