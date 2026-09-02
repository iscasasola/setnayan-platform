import {
  MOODBOARD_STYLE_FAMILIES,
  MOODBOARD_MOOD_TAGS,
  STYLE_FAMILY_LABELS,
  MOOD_LABELS,
  type MoodboardStyleFamily,
  type MoodboardMoodTag,
  type MoodboardThemeTemplate,
} from './moodboard-templates';
import { nearestColorName } from './color-names';
import { sanitizeRolePalette } from './mood-board';
import { sanitizeReceptionDesign, type ReceptionDesign } from './reception-scene';

/**
 * Theme-template PROCEDURAL GENERATOR — 10 style families × 10 moods ×
 * ≥25 themes per combination = ≥2,500 rows (Mood Board redesign, taxonomy
 * expansion, 2026-09-03). Hand-authoring 2,500 rows one at a time isn't
 * tractable — this module is a deterministic function of (style, mood,
 * variantIndex) → a schema-valid `moodboard_theme_templates` row, run once by
 * `apps/web/scripts/generate-moodboard-theme-seed.ts` to emit the seed SQL
 * for migration 20271196372720. Re-run that script any time this generator
 * changes (e.g. to widen the taxonomy further or refresh naming).
 *
 * Design, mirroring the ORIGINAL 100 hand-authored rows
 * (20271194462267_moodboard_theme_templates.sql) rather than inventing a new
 * shape:
 *   • Every row uses the SAME 6 role_palette keys the hand-authored rows used
 *     (ceremony/reception/bride/groom/wedding_party/guest) and the SAME
 *     `reception_design` part→attribute→option shape from
 *     `apps/web/lib/reception-scene.ts` — no new schema, only more content.
 *   • Every generated row is validated against the REAL
 *     `sanitizeRolePalette` / `sanitizeReceptionDesign` before being emitted
 *     — see `validateGeneratedTemplate` below, called by the seed script for
 *     every one of the 2,500 rows, and by the generator's own unit tests for
 *     a representative sample.
 *   • Colors vary by transforming a per-style ANCHOR palette through a
 *     per-mood HSL transform (dark_moody lowers lightness + raises
 *     saturation, minimalist trims to fewer/desaturated colors, etc.) —
 *     never by generating near-duplicate rows with trivial 1-hex diffs.
 *   • Reception materials vary by cycling through the REAL option
 *     vocabulary already defined in `RECEPTION_PARTS` (including the
 *     Filipino-specific options — capiz/banig/bamboo/sampaguita/banana_leaf —
 *     and the newer Walls/Photo Wall/Welcome & Signage zones), per style.
 *   • Names lean emotional/evocative (word-bank prefix × noun, per
 *     style × mood) rather than the literal "{Color} & {Color} {Style}
 *     Reception" pattern most of the original 100 used.
 */

// Style/mood taxonomy, labels: single source of truth is moodboard-templates.ts
// (MOODBOARD_STYLE_FAMILIES / MOODBOARD_MOOD_TAGS / STYLE_FAMILY_LABELS /
// MOOD_LABELS), re-exported here under the names this module's own tests and
// the seed script already reference.
export const ALL_STYLE_FAMILIES = MOODBOARD_STYLE_FAMILIES;
export type AllStyleFamily = MoodboardStyleFamily;
export const ALL_MOOD_TAGS = MOODBOARD_MOOD_TAGS;
export type AllMoodTag = MoodboardMoodTag;
export { STYLE_FAMILY_LABELS, MOOD_LABELS };

// ── HSL utilities ────────────────────────────────────────────────────────

type HSL = { h: number; s: number; l: number };

function hexToHsl(hex: string): HSL {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) / 255;
  let g = ((n >> 8) & 255) / 255;
  let b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: HSL): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toByte = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── per-style anchor palettes + reception defaults ──────────────────────

type StyleSpec = {
  /** 4-6 signature hex colors, dominant → accent order. */
  anchors: string[];
  /** Reception material candidates to cycle through per (part, attr) —
   *  every id here MUST be a real option id from RECEPTION_PARTS. */
  reception: {
    ceiling: string[];
    backdropStyle: string[];
    backdropFlorals: string[];
    stageSetup: string[];
    stageFlorals: string[];
    tableShape: string[];
    tableChairs: string[];
    tableLinen: string[];
    tableCenter: string[];
    tablePlace: string[];
    tunnel: string[];
    entranceRunner: string[];
    walls: string[];
    photoWall: string[];
    welcome: string[];
    people: string[];
  };
};

const STYLE_SPECS: Record<AllStyleFamily, StyleSpec> = {
  'elegant · simple · classic': {
    anchors: ['#FAF7F2', '#C5A059', '#824A2A', '#D4AF37', '#CFD3D6'],
    reception: {
      ceiling: ['chandeliers', 'draped', 'fairy_lights'],
      backdropStyle: ['draped', 'capiz'],
      backdropFlorals: ['corner', 'full', 'cascading'],
      stageSetup: ['sweetheart', 'king_queen'],
      stageFlorals: ['arch', 'pedestals'],
      tableShape: ['round'],
      tableChairs: ['chiavari', 'cross_back', 'ghost'],
      tableLinen: ['plain', 'runner', 'sequin'],
      tableCenter: ['tall', 'candelabra', 'low'],
      tablePlace: ['gold', 'silver'],
      tunnel: ['floral', 'crystal'],
      entranceRunner: ['fabric', 'candle'],
      walls: ['bare', 'uplighting_only'],
      photoWall: ['floral_wall', 'none'],
      welcome: ['framed_seating_chart', 'minimal'],
      people: ['couple_party', 'everyone'],
    },
  },
  'bridgerton · regal': {
    anchors: ['#7A1F2B', '#D4AF37', '#5C2542', '#059669', '#824A2A'],
    reception: {
      ceiling: ['chandeliers'],
      backdropStyle: ['draped', 'capiz', 'moon_gate'],
      backdropFlorals: ['full', 'cascading'],
      stageSetup: ['king_queen', 'sweetheart', 'lounge'],
      stageFlorals: ['arch', 'pedestals'],
      tableShape: ['round'],
      tableChairs: ['velvet', 'chiavari'],
      tableLinen: ['full_drape', 'sequin', 'runner'],
      tableCenter: ['candelabra', 'tall'],
      tablePlace: ['gold'],
      tunnel: ['crystal', 'draped', 'floral'],
      entranceRunner: ['candle', 'mirror'],
      walls: ['fabric_drape', 'floral_garland'],
      photoWall: ['floral_wall', 'step_repeat'],
      welcome: ['framed_seating_chart', 'floral_guestbook'],
      people: ['everyone', 'couple_party'],
    },
  },
  'editorial cream': {
    anchors: ['#CFD3D6', '#1E2229', '#FAF7F2', '#C97B4B', '#824A2A'],
    reception: {
      ceiling: ['bare', 'geometric'],
      backdropStyle: ['draped', 'led'],
      backdropFlorals: ['none', 'corner'],
      stageSetup: ['sweetheart', 'lounge'],
      stageFlorals: ['none', 'table_runner'],
      tableShape: ['long', 'square'],
      tableChairs: ['ghost', 'bentwood'],
      tableLinen: ['plain', 'runner'],
      tableCenter: ['low', 'greenery_runner'],
      tablePlace: ['glass', 'none'],
      tunnel: ['none'],
      entranceRunner: ['none', 'floral_lined'],
      walls: ['uplighting_only', 'bare'],
      photoWall: ['none', 'neon_backdrop'],
      welcome: ['minimal', 'easel_sign'],
      people: ['couple', 'couple_party'],
    },
  },
  'tropical heritage': {
    anchors: ['#E8735A', '#D4AF37', '#059669', '#3A5746', '#8A9A6B'],
    reception: {
      ceiling: ['banana_leaf', 'hanging_greenery', 'lanterns'],
      backdropStyle: ['capiz', 'greenery'],
      backdropFlorals: ['full', 'cascading'],
      stageSetup: ['sweetheart', 'riser_arch'],
      stageFlorals: ['pedestals', 'arch'],
      tableShape: ['round', 'long'],
      tableChairs: ['cross_back', 'bentwood'],
      tableLinen: ['banig', 'runner'],
      tableCenter: ['sampaguita', 'tall'],
      tablePlace: ['none', 'gold'],
      tunnel: ['bamboo', 'greenery'],
      entranceRunner: ['floral_lined', 'petals'],
      walls: ['greenery_wall', 'floral_garland'],
      photoWall: ['greenery_wall', 'floral_wall'],
      welcome: ['floral_guestbook', 'easel_sign'],
      people: ['everyone', 'couple_party'],
    },
  },
  'modern minimalist': {
    anchors: ['#1E2229', '#CFD3D6', '#FAF7F2', '#000000', '#BE185D'],
    reception: {
      ceiling: ['geometric', 'bare'],
      backdropStyle: ['led', 'draped'],
      backdropFlorals: ['none'],
      stageSetup: ['lounge', 'sweetheart'],
      stageFlorals: ['none'],
      tableShape: ['square', 'long'],
      tableChairs: ['ghost'],
      tableLinen: ['plain', 'sequin'],
      tableCenter: ['candles', 'low'],
      tablePlace: ['none', 'silver'],
      tunnel: ['none'],
      entranceRunner: ['none', 'mirror'],
      walls: ['uplighting_only', 'bare'],
      photoWall: ['neon_backdrop', 'none'],
      welcome: ['minimal'],
      people: ['couple', 'couple_party'],
    },
  },
  'boho beach': {
    anchors: ['#E8DCC8', '#C97B4B', '#8AA9B8', '#FAF7F2', '#824A2A'],
    reception: {
      ceiling: ['fairy_lights', 'hanging_greenery', 'bare'],
      backdropStyle: ['greenery', 'draped', 'fringe'],
      backdropFlorals: ['cascading', 'corner'],
      stageSetup: ['lounge', 'sweetheart'],
      stageFlorals: ['pedestals', 'none'],
      tableShape: ['round', 'long'],
      tableChairs: ['bentwood', 'cross_back'],
      tableLinen: ['runner', 'plain'],
      tableCenter: ['lanterns', 'greenery_runner'],
      tablePlace: ['none'],
      tunnel: ['bamboo', 'none'],
      entranceRunner: ['petals', 'none'],
      walls: ['bare', 'fabric_drape'],
      photoWall: ['balloon_garland', 'none'],
      welcome: ['easel_sign', 'minimal'],
      people: ['couple_party', 'couple'],
    },
  },
  'vintage ilustrado': {
    anchors: ['#F7F3EA', '#D4AF37', '#7A1F2B', '#824A2A', '#C5A059'],
    reception: {
      ceiling: ['chandeliers', 'lanterns'],
      backdropStyle: ['capiz', 'draped'],
      backdropFlorals: ['corner', 'full'],
      stageSetup: ['sweetheart', 'king_queen'],
      stageFlorals: ['arch', 'table_runner'],
      tableShape: ['round'],
      tableChairs: ['cross_back', 'chiavari'],
      tableLinen: ['plain', 'banig'],
      tableCenter: ['candelabra', 'sampaguita'],
      tablePlace: ['gold'],
      tunnel: ['floral', 'bamboo'],
      entranceRunner: ['fabric', 'candle'],
      walls: ['fabric_drape', 'bare'],
      photoWall: ['floral_wall', 'none'],
      welcome: ['framed_seating_chart', 'easel_sign'],
      people: ['couple_party', 'everyone'],
    },
  },
  'industrial loft': {
    anchors: ['#8A8F94', '#1E2229', '#C97B4B', '#FAF7F2', '#3A3A3A'],
    reception: {
      ceiling: ['bare', 'geometric'],
      backdropStyle: ['led', 'draped', 'fringe'],
      backdropFlorals: ['none', 'corner'],
      stageSetup: ['lounge', 'sweetheart'],
      stageFlorals: ['none'],
      tableShape: ['long', 'square'],
      tableChairs: ['ghost', 'bentwood'],
      tableLinen: ['plain', 'runner'],
      tableCenter: ['candles', 'low'],
      tablePlace: ['glass', 'none'],
      tunnel: ['none'],
      entranceRunner: ['none'],
      walls: ['uplighting_only', 'bare'],
      photoWall: ['neon_backdrop', 'step_repeat'],
      welcome: ['minimal', 'easel_sign'],
      people: ['couple', 'couple_party'],
    },
  },
  'moody garden': {
    anchors: ['#2C3B2E', '#5C2542', '#7A1F2B', '#D4AF37', '#1B1F1C'],
    reception: {
      ceiling: ['hanging_greenery', 'fairy_lights', 'hanging_florals'],
      backdropStyle: ['greenery', 'draped'],
      backdropFlorals: ['cascading', 'full'],
      stageSetup: ['riser_arch', 'sweetheart'],
      stageFlorals: ['arch', 'pedestals'],
      tableShape: ['round', 'long'],
      tableChairs: ['velvet', 'cross_back'],
      tableLinen: ['full_drape', 'runner'],
      tableCenter: ['candles', 'candelabra'],
      tablePlace: ['gold', 'none'],
      tunnel: ['greenery', 'draped'],
      entranceRunner: ['candle', 'floral_lined'],
      walls: ['greenery_wall', 'fabric_drape'],
      photoWall: ['floral_wall', 'greenery_wall'],
      welcome: ['easel_sign', 'framed_seating_chart'],
      people: ['everyone', 'couple_party'],
    },
  },
  'destination resort': {
    anchors: ['#2FA6A0', '#FAF7F2', '#E8735A', '#D4AF37', '#8AA9B8'],
    reception: {
      ceiling: ['bare', 'fairy_lights', 'hanging_greenery'],
      backdropStyle: ['greenery', 'draped'],
      backdropFlorals: ['corner', 'cascading'],
      stageSetup: ['lounge', 'sweetheart'],
      stageFlorals: ['pedestals', 'none'],
      tableShape: ['round', 'long'],
      tableChairs: ['bentwood', 'cross_back'],
      tableLinen: ['runner', 'plain'],
      tableCenter: ['tall', 'lanterns'],
      tablePlace: ['none', 'gold'],
      tunnel: ['bamboo', 'none'],
      entranceRunner: ['petals', 'none'],
      walls: ['bare', 'greenery_wall'],
      photoWall: ['greenery_wall', 'none'],
      welcome: ['easel_sign', 'minimal'],
      people: ['couple_party', 'everyone'],
    },
  },
};

// ── per-mood HSL transform ───────────────────────────────────────────────

/**
 * Transform one style's anchor HSL colors for a mood. `variant` (0..n) jitters
 * hue/sat/light slightly (deterministically) so successive variants in the
 * same (style, mood) combination don't collapse to identical hexes, without
 * drifting so far the palette stops reading as that mood.
 */
function moodTransform(mood: AllMoodTag, hsl: HSL[], variant: number): HSL[] {
  const jitterH = (i: number) => (((variant * 7 + i * 13) % 11) - 5); // -5..5
  const jitterL = (i: number) => (((variant * 5 + i * 3) % 7) - 3); // -3..3
  const withJitter = (c: HSL, i: number): HSL => ({
    h: c.h + jitterH(i),
    s: c.s,
    l: c.l,
  });

  switch (mood) {
    case 'dark_moody':
      return hsl.map((c, i) => withJitter({ h: c.h, s: clamp(c.s + 10, 0, 100), l: clamp(c.l - 22 + jitterL(i), 8, 55) }, i));
    case 'minimalist':
      return hsl.slice(0, 3).map((c, i) => withJitter({ h: c.h, s: clamp(c.s * 0.45, 0, 100), l: clamp(c.l + 4, 0, 96) }, i));
    case 'simple_understated':
      // Near-monochrome: pull every color toward the FIRST anchor's hue.
      return hsl.slice(0, 3).map((c, i) =>
        withJitter({ h: hsl[0]!.h + (c.h - hsl[0]!.h) * 0.15, s: clamp(c.s * 0.55, 0, 100), l: clamp(c.l, 12, 92) }, i),
      );
    case 'bold_contrasting':
      return hsl.map((c, i) =>
        withJitter({ h: c.h, s: clamp(c.s + 20, 0, 100), l: i % 2 === 0 ? clamp(c.l + 28, 60, 96) : clamp(c.l - 28, 6, 40) }, i),
      );
    case 'whimsical_storybook':
      return hsl.map((c, i) =>
        withJitter({ h: c.h, s: clamp(i === hsl.length - 1 ? c.s + 15 : c.s - 15, 0, 100), l: clamp(c.l + 16, 0, 94) }, i),
      );
    case 'maximalist_complex':
      return hsl.map((c, i) => withJitter({ h: c.h, s: clamp(c.s + 8 + i * 2, 0, 100), l: clamp(c.l + jitterL(i), 10, 90) }, i));
    case 'romantic_ethereal':
      return hsl.map((c, i) => withJitter({ h: c.h, s: clamp(c.s - 22, 5, 100), l: clamp(c.l + 26, 0, 95) }, i));
    case 'nostalgic_vintage':
      // Sepia-shift: pull hue toward warm ~35°, desaturate, lift midtones.
      return hsl.map((c, i) =>
        withJitter({ h: c.h + (35 - c.h) * 0.35, s: clamp(c.s * 0.6, 0, 100), l: clamp(c.l + 6, 10, 88) }, i),
      );
    case 'glam_luxurious': {
      // Push toward metallics: raise saturation, and force the LAST slot
      // toward a gold/silver accent (alternating by variant) rather than
      // whatever hue the anchor happened to carry.
      const metallic = variant % 2 === 0 ? { h: 46, s: 62, l: 55 } : { h: 210, s: 8, l: 78 }; // gold / silver
      const out = hsl.map((c, i) => withJitter({ h: c.h, s: clamp(c.s + 18, 0, 100), l: clamp(c.l + jitterL(i), 8, 90) }, i));
      out[out.length - 1] = metallic;
      return out;
    }
    case 'organic_natural':
      // Desaturate toward earth tones: pull hue toward ~30° (brown/terracotta).
      return hsl.map((c, i) =>
        withJitter({ h: c.h + (30 - c.h) * 0.5, s: clamp(c.s - 25, 5, 100), l: clamp(c.l - 6 + jitterL(i), 8, 85) }, i),
      );
    default:
      return hsl.map((c, i) => withJitter(c, i));
  }
}

// ── naming ───────────────────────────────────────────────────────────────

const STYLE_NOUNS: Record<AllStyleFamily, string[]> = {
  'elegant · simple · classic': [
    'Timeless Vows', 'Quiet Grace', 'Heirloom Promise', 'Classic Devotion', 'Ivory Chapter',
    'Enduring Elegance', 'Grace Everlasting', 'Golden Vow', 'Understated Romance', 'Forever Simple',
    'Poised Beginning', 'Refined Union',
  ],
  'bridgerton · regal': [
    'Court Romance', 'Regency Waltz', 'Ballroom Reverie', 'Gilded Court', 'Duchess Diaries',
    'Royal Devotion', 'Velvet Crown', 'Court of Two Hearts', 'Regal Promenade', 'Grand Cotillion',
    'Sovereign Vow', 'Palace Waltz',
  ],
  'editorial cream': [
    'Gallery Vow', 'Studio Romance', 'Cream Page', 'Editorial Chapter', 'Muted Frame',
    'Quiet Editorial', 'Blank Canvas Vow', 'Understated Feature', 'Concrete Poetry', 'Modern Manuscript',
    'Cream Manifesto', 'Minimal Frame',
  ],
  'tropical heritage': [
    'Island Homecoming', 'Sampaguita Vow', 'Heritage Harvest', 'Bayanihan Romance', 'Coastal Ancestry',
    'Filipiniana Chapter', 'Kundiman Evening', 'Waling-Waling Bloom', 'Provincial Feast', 'Homeland Reunion',
    'Tropic Harvest Vow', 'Ancestral Garden',
  ],
  'modern minimalist': [
    'Clean Line Vow', 'Architects’ Romance', 'Negative Space', 'Modern Manifesto', 'Structured Devotion',
    'Geometric Heart', 'Sleek Chapter', 'Studio Vow', 'Concrete Romance', 'Precision Promise',
    'Monochrome Manifesto', 'Silhouette Vow',
  ],
  'boho beach': [
    'Barefoot Promise', 'Salt Air Romance', 'Driftwood Vow', 'Tidepool Reverie', 'Windswept Union',
    'Seaglass Chapter', 'Sandy Toes Forever', 'Coastal Wanderer', 'Free Spirit Vow', 'Shoreline Reverie',
    'Sun-Bleached Romance', 'Wild Coast Union',
  ],
  'vintage ilustrado': [
    'Ilustrado Romance', 'Ancestral House Vow', 'Sepia Chapter', 'Antique Lace Promise', 'Colonial Courtyard',
    'Heirloom Ilustrado', 'Piña Silk Vow', 'Old Manila Romance', 'Baroque Homecoming', 'Vintage Portrait Vow',
    'Narra Wood Devotion', 'Gilded Age Vow',
  ],
  'industrial loft': [
    'Warehouse Romance', 'Loft Chapter', 'Steel & Vow', 'Raw Space Devotion', 'Concrete Canvas',
    'Foundry Promise', 'Brick & Ember Vow', 'Exposed Beam Romance', 'Urban Foundry', 'Riveted Devotion',
    'Factory Floor Vow', 'Copper Pipe Romance',
  ],
  'moody garden': [
    'Moonlit Garden Vow', 'Twilight Bloom', 'Candlelit Hillside', 'Gothic Garden Romance', 'Wildflower Dusk',
    'Shadowed Bloom Vow', 'Evening Garden Reverie', 'Dusk Hollow Promise', 'Bramble & Vow', 'Nightfall Garden',
    'Overgrown Romance', 'Hillside Twilight Vow',
  ],
  'destination resort': [
    'Sunset Voyage', 'Horizon Vow', 'Island Escape Romance', 'Tide & Promise', 'Beachfront Reverie',
    'Palm-Lined Vow', 'Turquoise Horizon', 'Getaway Devotion', 'Seabreeze Chapter', 'Faraway Shore Vow',
    'Resort Reverie', 'Wanderlust Union',
  ],
};

const MOOD_PREFIXES: Record<AllMoodTag, string[]> = {
  whimsical_storybook: [
    'A Storybook', 'Once Upon a', 'Fairy-Tale', 'Enchanted', 'Wishing-Well', 'Daydream',
    'Pixie-Light', 'Charmed', 'Wonderland', 'Spellbound', 'Whimsical', 'Fable-Bright',
  ],
  minimalist: [
    'A Quiet', 'Bare', 'Distilled', 'Pared-Back', 'Unadorned', 'Essential',
    'A Single Line of', 'Clean', 'Restrained', 'Uncluttered', 'Plainspoken', 'A Simple',
  ],
  dark_moody: [
    'Midnight', 'Smoldering', 'A Dramatic', 'Shadowed', 'Candlelit', 'Velvet-Dark',
    'A Brooding', 'Twilight', 'Ember-Lit', 'Deep-Toned', 'A Sultry', 'Storm-Kissed',
  ],
  bold_contrasting: [
    'A Bold', 'High-Contrast', 'Fearless', 'Graphic', 'A Striking', 'Vivid',
    'Electric', 'A Daring', 'Sharp-Edged', 'Uncompromising', 'A Vibrant', 'Loud & Proud',
  ],
  simple_understated: [
    'A Quiet', 'Understated', 'A Gentle', 'Unhurried', 'A Soft-Spoken', 'Modest',
    'A Still', 'Grounded', 'A Humble', 'Low-Key', 'A Calm', 'Unfussy',
  ],
  maximalist_complex: [
    'A Lavish', 'Layered', 'An Opulent', 'Abundant', 'A Rich', 'Ornate',
    'A Grand', 'Densely-Bloomed', 'A Sumptuous', 'Baroque', 'An Elaborate', 'Full-Spectrum',
  ],
  romantic_ethereal: [
    'An Ethereal', 'Dreamlike', 'A Gauzy', 'Soft-Focus', 'Cloud-Soft', 'A Wistful',
    'Gossamer', 'A Tender', 'Featherlight', 'A Dreamy', 'Pastel-Kissed', 'Sighing',
  ],
  nostalgic_vintage: [
    'A Nostalgic', 'Sepia-Toned', 'A Vintage', 'Faded-Photograph', 'Old-World', 'A Wistful Vintage',
    'Time-Worn', 'A Keepsake', 'Antique', 'A Remembered', 'Yesteryear’s', 'A Cherished',
  ],
  glam_luxurious: [
    'A Glamorous', 'Gilded', 'An Opulent', 'Diamond-Bright', 'A Lavish Glam', 'Champagne-Soaked',
    'A Red-Carpet', 'Jewel-Toned', 'A Radiant', 'Star-Studded', 'A Luxe', 'Mirror-Bright',
  ],
  organic_natural: [
    'An Earthy', 'Sun-Warmed', 'A Grounded', 'Wildgrown', 'A Rustic', 'Root-Deep',
    'A Weathered', 'Bare-Foot Natural', 'An Unpolished', 'Field-Grown', 'A Windblown', 'Moss-Soft',
  ],
};

function generateName(style: AllStyleFamily, mood: AllMoodTag, variant: number, usedNames: Set<string>): string {
  const nouns = STYLE_NOUNS[style];
  const prefixes = MOOD_PREFIXES[mood];
  // `variant -> (variant % prefixes.length, floor(variant / prefixes.length) %
  // nouns.length)` is INJECTIVE for variant < prefixes.length * nouns.length
  // (12 * 12 = 144 here, well above the ≥25-per-combination requirement) — so
  // every variant in a combination gets a genuinely distinct (prefix, noun)
  // pair, not just a distinct-looking one. `attempt` only kicks in past that
  // range (defensive; never hit at the current bank sizes/variant count).
  let name = '';
  for (let attempt = 0; attempt < prefixes.length * nouns.length; attempt++) {
    const k = variant + attempt * prefixes.length * nouns.length;
    const prefix = prefixes[k % prefixes.length]!;
    const noun = nouns[Math.floor(k / prefixes.length) % nouns.length]!;
    name = `${prefix} ${noun}`;
    if (!usedNames.has(name)) break;
  }
  usedNames.add(name);
  return name;
}

function generateDescription(
  style: AllStyleFamily,
  mood: AllMoodTag,
  anchors: string[],
  reception: ReceptionDesign,
): string {
  const leadName = nearestColorName(anchors[0] ?? '#FAF7F2') ?? 'soft neutral';
  // Walk the rest of the palette for a color whose NAME actually differs from
  // the lead's — two similar-but-not-identical hexes can both resolve to the
  // same nearest name (e.g. two near-creams), which read as an odd "Cream
  // and Cream" repeat. Falls back to a generic phrase only if the whole
  // palette really is one name (near-monochrome moods like simple_understated).
  let accentName: string | null = null;
  for (let i = anchors.length - 1; i >= 1; i--) {
    const candidate = nearestColorName(anchors[i] ?? '');
    if (candidate && candidate !== leadName) {
      accentName = candidate;
      break;
    }
  }
  const styleLabel = STYLE_FAMILY_LABELS[style].toLowerCase();
  const moodLabel = MOOD_LABELS[mood].toLowerCase();
  const backdropStyle = reception.backdrop?.style;
  const highlight = backdropStyle ? ` behind a ${backdropStyle.replace(/_/g, ' ')} backdrop` : '';
  const colorPhrase = accentName ? `${leadName} and ${accentName}` : `${leadName} tones throughout`;
  const article = /^[aeiou]/i.test(moodLabel) ? 'an' : 'a';
  return `${colorPhrase}${highlight} — ${article} ${moodLabel} take on ${styleLabel}.`;
}

// ── row generation ───────────────────────────────────────────────────────

export const THEMES_PER_COMBINATION = 25;

function cycle<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!;
}

/** Build one (style, mood, variant) row. Pure + deterministic. */
export function generateTemplate(
  style: AllStyleFamily,
  mood: AllMoodTag,
  variant: number,
  sortOrder: number,
  usedNames: Set<string>,
): Omit<MoodboardThemeTemplate, 'template_id'> {
  const spec = STYLE_SPECS[style];
  const baseHsl = spec.anchors.map(hexToHsl);
  // Rotate which anchor leads for this variant so "which color leads vs.
  // supports" varies across the 25 rows, not just the transform.
  const rotated = baseHsl.map((_, i) => baseHsl[(i + variant) % baseHsl.length]!);
  const transformed = moodTransform(mood, rotated, variant);
  const hexes = transformed.map(hslToHex);

  const rolePalette: MoodboardThemeTemplate['role_palette'] = {
    ceremony: [hexes[0]!, hexes[Math.min(3, hexes.length - 1)]!],
    reception: hexes.slice(0, 3),
    bride: [hexes[0]!],
    groom: [hexes[Math.min(2, hexes.length - 1)]!],
    wedding_party: hexes.slice(0, 3),
    guest: [hexes[0]!, ...hexes.slice(1, 3)],
  };

  const r = spec.reception;
  const reception_design: ReceptionDesign = {
    ceiling: { treatment: cycle(r.ceiling, variant) },
    backdrop: { style: cycle(r.backdropStyle, variant + 1), florals: cycle(r.backdropFlorals, variant) },
    stage: { setup: cycle(r.stageSetup, variant), florals: cycle(r.stageFlorals, variant + 2) },
    tables: {
      shape: cycle(r.tableShape, variant),
      chairs: cycle(r.tableChairs, variant + 1),
      linen: cycle(r.tableLinen, variant + 2),
      centerpiece: cycle(r.tableCenter, variant),
      place: cycle(r.tablePlace, variant + 3),
    },
    tunnel: { style: cycle(r.tunnel, variant) },
    entrance: { runner: cycle(r.entranceRunner, variant + 1) },
    walls: { treatment: cycle(r.walls, variant) },
    photo_wall: { style: cycle(r.photoWall, variant + 1) },
    welcome_signage: { style: cycle(r.welcome, variant) },
    people: { who: cycle(r.people, variant) },
  };

  const name = generateName(style, mood, variant, usedNames);
  const description = generateDescription(style, mood, hexes, reception_design);

  return {
    style_family: style as MoodboardThemeTemplate['style_family'],
    mood_tag: mood as MoodboardThemeTemplate['mood_tag'],
    name,
    description,
    role_palette: rolePalette,
    reception_design,
    sort_order: sortOrder,
  };
}

/**
 * Every (style, mood) combination, THEMES_PER_COMBINATION rows each.
 * `startSortOrder` lets the seed script offset past the 100 hand-authored
 * rows' own 0-99 `sort_order` range (both tables' rows are ordered together
 * by page.tsx's single `.order('sort_order')`), while unit tests can call
 * this with the default 0 to check combination counts in isolation.
 */
export function generateAllThemes(startSortOrder = 0): Array<Omit<MoodboardThemeTemplate, 'template_id'>> {
  const out: Array<Omit<MoodboardThemeTemplate, 'template_id'>> = [];
  let sortOrder = startSortOrder;
  for (const style of ALL_STYLE_FAMILIES) {
    for (const mood of ALL_MOOD_TAGS) {
      const usedNames = new Set<string>();
      for (let variant = 0; variant < THEMES_PER_COMBINATION; variant++) {
        out.push(generateTemplate(style, mood, variant, sortOrder, usedNames));
        sortOrder += 1;
      }
    }
  }
  return out;
}

/**
 * Validate one generated row against the REAL sanitizers — a generator that
 * silently produces schema-invalid values (a key the sanitizer drops, an
 * option id the sanitizer doesn't recognize) is worse than no generator.
 * Returns a list of problems; empty means the row round-trips cleanly.
 */
export function validateGeneratedTemplate(
  row: Omit<MoodboardThemeTemplate, 'template_id'>,
): string[] {
  const problems: string[] = [];
  const sanitizedPalette = sanitizeRolePalette(row.role_palette);
  for (const key of Object.keys(row.role_palette)) {
    const before = (row.role_palette as Record<string, unknown>)[key];
    const after = (sanitizedPalette as Record<string, unknown>)[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      problems.push(`role_palette.${key} was altered/dropped by sanitizeRolePalette`);
    }
  }
  const sanitizedDesign = sanitizeReceptionDesign(row.reception_design);
  for (const [partId, attrs] of Object.entries(row.reception_design)) {
    for (const [attrId, value] of Object.entries(attrs ?? {})) {
      const kept = (sanitizedDesign as Record<string, Record<string, string>>)[partId]?.[attrId];
      if (kept !== value) {
        problems.push(`reception_design.${partId}.${attrId}="${value}" was dropped by sanitizeReceptionDesign`);
      }
    }
  }
  if (!row.name || row.name.trim().length === 0) problems.push('name is empty');
  if (!row.description || row.description.trim().length === 0) problems.push('description is empty');
  return problems;
}
