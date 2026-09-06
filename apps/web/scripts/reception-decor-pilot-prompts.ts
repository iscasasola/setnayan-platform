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
 * largest remaining color cluster as slot 1's sampledHex.
 *
 * ⚠ CORRECTED 2026-09-07 (RA1). This file used to end "toleranceDe = 15,
 * matching the figure_attire seed's existing value." THAT IS WRONG and it has
 * cost two sessions. A UNIFORM TOLERANCE IS NOT A MEASUREMENT — it is the
 * defect MB28 spent a session correcting, and on the `stage` zone it shipped
 * THREE tolerances that repaint the room (migration 20271212320441 corrects
 * them). Across the nine cells measured so far the values are 9, 8, 12, 15, 9,
 * 8, 7, 5 and 6 — no two files agree, and 15 is right for exactly one of them.
 *
 * Measure each file, per `build-sessions/RECEPTION-ART-PLAN.md` Part 2:
 * rasterise at the component's own MAX_PREVIEW_PX (520) with `sharp`, push it
 * through the REAL `recolorRGBA`, and take the largest integer tolerance at
 * which nothing OUTSIDE the tagged object recolours — a spatial question, not
 * a census one, and with NO area floor. A "fills >= 0.2% of the opaque area"
 * census cannot see hairline strokes, and hairline strokes are exactly what a
 * too-wide tolerance repaints first.
 */

export const PILOT_ZONES = ['backdrop', 'ceiling', 'stage', 'tables'] as const;
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
  /** The `colors` array ACTUALLY passed to Recraft, verbatim.
   *
   *  🔑 THE PILOT'S THIRD FINDING, MADE EXPLICIT IN THE DATA. The ten
   *  backdrop/ceiling entries above all passed `[seedColor, backgroundColor]`,
   *  and on `bridgerton · regal` that second hex is where the run went wrong:
   *  Recraft invented its own dominant region and spent the passed seed on a
   *  DIFFERENT object, producing two same-hue regions 12.6 apart — one
   *  recolours, one does not. A second hex is a second object the model may
   *  choose to paint with it. Every entry below passes ONE colour and names the
   *  neutral palette in WORDS instead. Omit this field to mean the legacy pair. */
  colorsPassed?: readonly string[];
  /** What the generation was judged to be, on a REAL recolour through
   *  `recolorRGBA` — never a fill-swap simulation, which structurally cannot
   *  show a tolerance bleeding into a neighbour. Recorded so the next session
   *  inherits the misses as well as the hits. */
  outcome?: string;
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

/**
 * ── TABLES · RA1 PART B, 2026-09-07 ────────────────────────────────────────
 *
 * 🔑 FIVE KEEPERS FROM FIVE GENERATIONS — against the stage's 1 per 2.25, and
 * including the `tropical heritage` cell the stage never solved in four
 * attempts. The difference is not the prompt wording, it is the COMPOSITION.
 *
 * Every stage failure needed a room to put the colour in: across four attempts
 * Recraft spent the sage seed on the wall, the floor or the riser and left the
 * cloth cream or mint. These five say "no floor, no wall, no room, no horizon
 * line" and put the tables in a horizontal band with empty margins above and
 * below — so there is no surface left to mis-paint, and the model has nowhere
 * to put the colour except the cloth.
 *
 * That composition was chosen for a RENDERING reason (a scene zone's background
 * is knocked out before compositing, and `tables` spans four scattered tables
 * with the aisle between them, so the room has to show through), and the yield
 * improvement came free. ➡ Prefer object-on-plain-background for every
 * remaining zone: it is cheaper to generate AND it composites correctly.
 *
 * All five pass ONE colour in `colors`, name the neutrals in words, and tag a
 * draped surface — the pilot's findings 3 and 4, now with a third.
 */
/**
 * ── STAGE · RA1, 2026-09-06 ────────────────────────────────────────────────
 *
 * ⚠ THE PILOT'S OWN FOUR STAGE PROMPTS WERE NEVER WRITTEN DOWN. That session
 * generated nine stage images and kept four but recorded neither its prompts
 * nor its files; oversight recovered the SVGs from the Higgsfield history by
 * job id. Their prompts are lost. That is the reason this file exists, and the
 * reason the entry below is recorded even though only one cell needed it.
 *
 * 🔑 `bridgerton · regal` WAS UNSOLVED AFTER FOUR PILOT GENERATIONS (ornate
 * carved chairs and a piped sofa were tagged, or two same-hue regions appeared
 * 12.6 apart so one recoloured and one did not). It landed FIRST TRY on the
 * pilot's own findings applied together: pass ONE colour in `colors` rather
 * than two — a second hex is a second object the model can spend it on — name
 * the neutral palette in WORDS, and tag a DRAPED surface, never ornate
 * furniture.
 *
 * ⚠ `tropical heritage` FAILED THREE MORE TIMES ON THIS ZONE (four in total,
 * past the plan's stop rule) and always the same way: Recraft painted the WALL,
 * the FLOOR or the RISER sage and left the cloth cream or mint. See
 * TABLES_PROMPTS below for what finally fixed that — removing the room.
 */
export const STAGE_PROMPTS: DecorPromptEntry[] = [
  {
    zone: 'stage',
    style: 'bridgerton · regal',
    aspectRatio: '16:9',
    backgroundColor: '#F3ECE0',
    seedColor: '#8C6BA6',
    colorsPassed: ['#8C6BA6'],
    outcome:
      'KEEPER (job 755b04e0-e19c-439d-bad1-b51e8447acee) — solved a cell four pilot ' +
      'generations could not. NOT shipped in the end: PR #5270 landed a richer 286-path ' +
      'bridgerton from another session first, which measures to the same clean maximum of 8. ' +
      'Kept here because the PROMPT is the finding, not the file.',
    prompt:
      "A wedding reception stage viewed head-on: a round sweetheart table for two on a low platform, covered by a floor-length draped tablecloth in ONE single flat solid jewel-tone purple, the SAME single purple across the whole cloth including its top surface and every fold — no second shade, no highlight, no lighter top, no piping or trim. The chairs behind are plain simple outlines with no carving and no upholstery. Everything else in the scene — the platform, the wall, the floor, the chair outlines, the glassware — is drawn in muted warm cream, oatmeal and soft grey neutrals only. Bridgerton Regency aesthetic conveyed by the drape and the room, not by ornament. " +
      COMMON_SUFFIX,
  },
];

export const TABLES_PROMPTS: DecorPromptEntry[] = [
  {
    zone: 'tables',
    style: 'elegant · simple · classic',
    aspectRatio: '16:9',
    backgroundColor: '#F3ECE0',
    seedColor: '#C9A059',
    colorsPassed: ['#C9A059'],
    outcome:
      'KEEPER — shipped, slot #C9A059 tol 9. Job e866d8aa.',
    prompt:
      'A horizontal row of four round wedding guest tables seen straight on, each covered by a floor-length draped tablecloth in ONE single flat solid warm gold, the SAME single colour across every cloth including its top surface and every fold — no second shade, no highlight, no trim. The tables sit on a completely plain empty background with generous empty margins above and below the row: no floor, no wall, no room, no horizon line. Plain simple chair outlines and tableware drawn in muted warm grey and cream neutrals only. ' +
      COMMON_SUFFIX,
  },
  {
    zone: 'tables',
    style: 'bridgerton · regal',
    aspectRatio: '16:9',
    backgroundColor: '#F3ECE0',
    seedColor: '#8C6BA6',
    colorsPassed: ['#8C6BA6'],
    outcome:
      'KEEPER — shipped, slot #8C6BA6 tol 8 (its cliff: 6 px outside at 8, 593 at 9). Job aff7123c.',
    prompt:
      'A horizontal row of four round wedding guest tables seen straight on, each covered by a floor-length draped tablecloth in ONE single flat solid jewel-tone purple, the SAME single colour across every cloth including its top surface and every fold — no second shade, no highlight, no trim. The tables sit on a completely plain empty background with generous empty margins above and below the row: no floor, no wall, no room, no horizon line. Plain simple chair outlines and tableware drawn in muted warm grey and cream neutrals only. ' +
      COMMON_SUFFIX,
  },
  {
    zone: 'tables',
    style: 'editorial cream',
    aspectRatio: '16:9',
    backgroundColor: '#F7F3EA',
    seedColor: '#D98BA6',
    colorsPassed: ['#D98BA6'],
    outcome:
      'KEEPER — shipped, slot #D98BA6 tol 7. Job bfb9bd90.',
    prompt:
      'A horizontal row of four round wedding guest tables seen straight on, each covered by a floor-length draped tablecloth in ONE single flat solid blush pink, the SAME single colour across every cloth including its top surface and every fold — no second shade, no highlight, no trim. The tables sit on a completely plain empty background with generous empty margins above and below the row: no floor, no wall, no room, no horizon line. Plain simple chair outlines and tableware drawn in muted warm grey and cream neutrals only. ' +
      COMMON_SUFFIX,
  },
  {
    zone: 'tables',
    style: 'tropical heritage',
    aspectRatio: '16:9',
    backgroundColor: '#E4D9CC',
    seedColor: '#9CB29A',
    colorsPassed: ['#9CB29A'],
    outcome:
      'KEEPER — shipped, slot #9CB29A tol 5. FIRST ATTEMPT, after four failures on the stage: with no wall, floor or foliage in frame there was nothing else for the sage to land on. Job 903a3114.',
    prompt:
      'A horizontal row of four round wedding guest tables seen straight on, each covered by a floor-length draped tablecloth in ONE single flat solid sage green, the SAME single colour across every cloth including its top surface and every fold — no second shade, no highlight, no trim. The tables sit on a completely plain empty background with generous empty margins above and below the row: no floor, no wall, no room, no horizon line. Plain simple chair outlines and tableware drawn in muted warm grey and cream neutrals only. ' +
      COMMON_SUFFIX,
  },
  {
    zone: 'tables',
    style: 'modern minimalist',
    aspectRatio: '16:9',
    backgroundColor: '#F5F3EF',
    seedColor: '#4A3B45',
    colorsPassed: ['#4A3B45'],
    outcome:
      'KEEPER — shipped, slot #4A3B45 tol 6. Job 07102f92.',
    prompt:
      'A horizontal row of four round wedding guest tables seen straight on, each covered by a floor-length draped tablecloth in ONE single flat solid deep charcoal plum, the SAME single colour across every cloth including its top surface and every fold — no second shade, no highlight, no trim. The tables sit on a completely plain empty background with generous empty margins above and below the row: no floor, no wall, no room, no horizon line. Plain simple chair outlines and tableware drawn in muted warm grey and cream neutrals only. ' +
      COMMON_SUFFIX,
  },
];
