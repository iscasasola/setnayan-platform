/**
 * chibi-config — THE one whitelist for the chibi avatar system (Build ② PR-1,
 * `OnTheDay_App_Build_Studies_2026-07-23.md § 2` + `Chibi_Rig_Production_Spec
 * _2026-07-19.md §§ 3/10/11`). Pure — NO three.js, NO React — so the exact
 * same catalog + sanitizer can be imported by:
 *   · the future Me-tab / venue-sheet maker client (writes a config),
 *   · the future `guestSetAvatarAction` server sanitizer (rejects junk
 *     before it reaches `guests.avatar_config`),
 *   · the 3D renderers (`kit/chibi-figure.tsx` today; the part-batched crowd
 *     in a later PR) — resolve stored JSON to a render-safe config.
 * One catalog, three consumers: values that are not in these tables do not
 * exist anywhere in the system.
 *
 * STORE OF RECORD: `guests.avatar_config` JSONB (migration
 * 20270918210897_chibi_avatar_foundation.sql — INERT until the maker/reader
 * PRs land). NULL → `resolveChibiConfig(id)` hash-derived defaults, so an
 * anonymous crowd stays varied with zero stored bytes (the blob kit's
 * `resolveFigureLook` convention, re-activated per rig spec § 3 — the skin +
 * hair ramps below are the SAME dormant tables, extended, not re-invented).
 *
 * ⚠ PRIVACY FENCE (rig spec § 3, non-negotiable): `bodyType` is an AVATAR
 * COSMETIC. It is NEVER read from, written to, or inferred from `users.sex`
 * (SPI, `sex_consent_at` pattern) — hash defaults derive from the OPAQUE
 * figure id only, and no code path may join the two. Reviewers: re-check this
 * fence on every PR that touches both columns.
 *
 * COLOUR POLICY: fail-closed whitelist. `avatar_config` is guest-authored
 * data on a zero-account subject, so normalize SNAPS any off-palette colour
 * to the hash default rather than trusting arbitrary hex (the "clamps hex
 * colours" rule in the study's write-path sketch). The V4 'paint' colour
 * mode (per-part free colour, 12-brush palette) intentionally does NOT fit
 * this shape yet — it widens the config in a later PR with a `v` bump;
 * unknown colorMode values normalize to 'custom'.
 */

import { SKIN_TONES, HAIR_COLORS } from './figure-rig';

// ─────────────────────────────────────────────────────────────────────────────
// Flag — the switch every chibi PR shares
// ─────────────────────────────────────────────────────────────────────────────

/** Build-time flag for the chibi character-system swap. Next.js inlines
 *  NEXT_PUBLIC_* so an unset flag is a byte-identical off path (the
 *  PLAN3D_SHARED_ROOM idiom). Default OFF. NOTHING consumes this in PR-1 —
 *  it is the declared gate the later rig-swap / maker / reader PRs share. */
export const FIGURE_CHIBI_ENABLED = process.env.NEXT_PUBLIC_FIGURE_CHIBI === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// Catalogs (append-only — stored configs must never dangle)
// ─────────────────────────────────────────────────────────────────────────────

/** Schema version stamped into every stored config. Bump ONLY with a
 *  migration note + a normalize upgrade path (old `v` values must keep
 *  normalizing forever — stored guest rows are never mass-rewritten). */
export const CHIBI_CONFIG_VERSION = 1;

export const CHIBI_BODY_TYPES = ['female', 'male'] as const;
export type ChibiBodyType = (typeof CHIBI_BODY_TYPES)[number];

/** Six-tone Filipino-range skin ramp — the SAME table as the blob kit's
 *  dormant look system (imported from `lib/figure-rig.ts` SKIN_TONES),
 *  unchanged per rig spec § 3. */
export const CHIBI_SKIN_TONES: readonly string[] = SKIN_TONES;

/** Rig spec § 3: HAIR_COLORS 4 → 6 (+ silver, + gold — the "fun" pair is an
 *  open owner sign-off (§ 9.4) for the DEFAULT flip, but the catalog carries
 *  them from day one so a stored pick never dangles). */
export const CHIBI_HAIR_COLORS: readonly string[] = [...HAIR_COLORS, '#8a8a92', '#b98a2f'];

/** V4 studio hair pool (chibi_studio_prototype.html HAIRS), incl. bald. */
export const CHIBI_HAIR_STYLES = [
  'bald',
  'crop',
  'side',
  'spiky',
  'curly',
  'bob',
  'buns',
  'pony',
  'long',
  'bangs',
  'knot',
] as const;
export type ChibiHairStyle = (typeof CHIBI_HAIR_STYLES)[number];

/** FACES ARE IN (rig spec § 10, owner 2026-07-19 — retires § 9.5; any doc
 *  still saying "featureless mannequin" is stale). Nose is ALWAYS on (the
 *  front-facing cue, skin ×0.88) and is not a config field. */
export const CHIBI_EYES = ['dots', 'happy', 'sleepy', 'none'] as const;
export type ChibiEyes = (typeof CHIBI_EYES)[number];
export const CHIBI_MOUTHS = ['smile', 'grin', 'soft', 'none'] as const;
export type ChibiMouth = (typeof CHIBI_MOUTHS)[number];
export const CHIBI_MARKS = ['none', 'left', 'right', 'chin'] as const;
export type ChibiMark = (typeof CHIBI_MARKS)[number];

/** Guest outfit pool for the single `outfit` config field (the study's schema
 *  comment collapses the V4 one-piece/top/bottom slots into one id — each id
 *  below is a complete look; two-tone bottoms derive from `outfitColor`).
 *  Staff garments (chef_whites/apron/vest/uniform/robe) are NOT guest picks —
 *  they arrive with the booth-staff PR on the same geometry pipeline. */
export const CHIBI_OUTFITS = [
  // one-pieces (rig spec § 4 female pool + V4 wardrobe)
  'wedding', //     wedding dress — gold waist band; default colour ivory
  'gown', //        ball gown
  'dress', //       day dress
  'cocktail', //    cocktail dress
  'filipiniana', // butterfly sleeves + gold band + long skirt
  'tee_skirt', //   two-tone: tee (outfitColor) + skirt (darkened 0.72)
  // top+bottom looks (rig spec § 4 male pool)
  'tee_shorts', //  two-tone: tee + shorts (darkened 0.6), exposed stub legs
  'barong', //      fixed ivory #f4efdf + collar + placket + #2e2c33 trousers
  'suit', //        jacket (outfitColor) + ivory shirt V + tie + dark trousers
  'tux', //         fixed black + white shirt V + satin lapels + bow tie
] as const;
export type ChibiOutfit = (typeof CHIBI_OUTFITS)[number];

/** Hash-default outfit pools per body (rig spec § 4). Every outfit stays
 *  VALID on either body (bodyType is cosmetic — it only changes the flare
 *  multiplier in geometry); the pools only steer the no-config default.
 *  'wedding' is deliberately ABSENT from the default pool: nobody should
 *  hash-roll a wedding dress in a wedding crowd — it is an explicit pick. */
export const CHIBI_DEFAULT_OUTFITS: Record<ChibiBodyType, readonly ChibiOutfit[]> = {
  female: ['dress', 'filipiniana', 'gown', 'tee_skirt', 'cocktail'],
  male: ['barong', 'suit', 'tee_shorts', 'tux'],
};

/** Curated outfit swatches (rig spec § 3: sage/champagne/blush/sky/navy/
 *  wine/gold/ivory — the prototype's COLORS table, hex-verbatim). */
export const CHIBI_OUTFIT_COLORS: readonly { hex: string; name: string }[] = [
  { hex: '#c3cdb9', name: 'Sage' },
  { hex: '#e8d9b8', name: 'Champagne' },
  { hex: '#e6c9c4', name: 'Blush' },
  { hex: '#bccbd8', name: 'Sky' },
  { hex: '#41465a', name: 'Navy' },
  { hex: '#6e3344', name: 'Wine' },
  { hex: '#b98a2f', name: 'Gold' },
  { hex: '#f2efe8', name: 'Ivory' },
];

export const CHIBI_ACCESSORIES = ['none', 'flower', 'bow', 'cap', 'specs', 'band'] as const;
export type ChibiAccessory = (typeof CHIBI_ACCESSORIES)[number];

/** 'auto' = colours derive from the room (mood-board palette — a later PR
 *  feeds the real palette; PR-1 ships the prototype's static AUTO set as the
 *  placeholder) · 'custom' = the curated swatches picked by hand. The V4
 *  'paint' mode is a later `v` bump (see the colour-policy header note). */
export const CHIBI_COLOR_MODES = ['auto', 'custom'] as const;
export type ChibiColorMode = (typeof CHIBI_COLOR_MODES)[number];

/** The prototype's AUTO palette (chibi_studio_prototype.html AUTO) —
 *  placeholder until the mood-board wire-up. */
export const CHIBI_AUTO_COLORS = {
  outfitColor: '#c3cdb9', // sage
  hairColor: '#241a12', // espresso
} as const;

/** Fixed shoe colour — the config carries no shoe field in v1 (paint mode
 *  adds per-part colour, incl. shoes, in a later version). */
export const CHIBI_SHOE_COLOR = '#f2efe8';

// ─────────────────────────────────────────────────────────────────────────────
// The config record
// ─────────────────────────────────────────────────────────────────────────────

/** EXACTLY the shape the migration comment declares on
 *  `guests.avatar_config` — the future maker writes it, the future venue
 *  reader reads it. Colour fields hold hex strings FROM the catalogs above
 *  (whitelist, not free hex). */
export type ChibiAvatarConfig = {
  v: typeof CHIBI_CONFIG_VERSION;
  bodyType: ChibiBodyType;
  skinTone: string;
  hairStyle: ChibiHairStyle;
  hairColor: string;
  eyes: ChibiEyes;
  mouth: ChibiMouth;
  mark: ChibiMark;
  outfit: ChibiOutfit;
  outfitColor: string;
  accessory: ChibiAccessory;
  colorMode: ChibiColorMode;
};

/** The ordered key list — validate() rejects unknown keys against this, and
 *  normalize() emits keys in this order so serialized configs are stable
 *  byte-wise (nice for change detection + the 2 KiB DB CHECK headroom). */
export const CHIBI_CONFIG_KEYS = [
  'v',
  'bodyType',
  'skinTone',
  'hairStyle',
  'hairColor',
  'eyes',
  'mouth',
  'mark',
  'outfit',
  'outfitColor',
  'accessory',
  'colorMode',
] as const;

/** Matches the `guests_avatar_config_size_check` DB CHECK (≤ 2048 bytes of
 *  jsonb). Serialized v1 configs are ~260 bytes — the CHECK is a backstop
 *  against a compromised writer, not a working limit. */
export const CHIBI_CONFIG_MAX_BYTES = 2048;

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic defaults (id hash → stable look)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit — the SAME algorithm (and constants) as `lib/figure-rig.ts`'s
 * private `hashId`, duplicated here because figure-rig deliberately does not
 * export it and PR-1 touches no existing files. Stability is the only
 * requirement: same id → same bits, every device, every session, forever.
 * (The chibi's hash-derived defaults do NOT need to match the blob's — the
 * swap PR replaces the whole look anyway.)
 */
function fnv1a(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const pick = <T,>(pool: readonly T[], h: number, window: number): T =>
  pool[(h >>> window) % pool.length]!;

/**
 * Hash-derived default config for a stable figure id — the render path for
 * `avatar_config IS NULL` (every guest today). Same id → same chibi forever;
 * different fields read different bit windows so they vary independently.
 * Opinionated defaults: eyes/mouth never 'none' (a friendly default crowd),
 * accessory always 'none' (an accessory is a choice, never a roll),
 * colorMode 'custom'. bodyType derives from the opaque id hash ONLY — see
 * the privacy fence in the header.
 */
export function defaultChibiConfig(id: string): ChibiAvatarConfig {
  const h = fnv1a(id);
  const bodyType = pick(CHIBI_BODY_TYPES, h, 0);
  return {
    v: CHIBI_CONFIG_VERSION,
    bodyType,
    skinTone: pick(CHIBI_SKIN_TONES, h, 2),
    // Bald stays a pick, not a roll — default crowds draw from the styled pool.
    hairStyle: pick(CHIBI_HAIR_STYLES.filter((s) => s !== 'bald'), h, 5),
    // Default hair draws from the realistic 4-tone ramp (silver/gold are
    // explicit picks pending the § 9.4 sign-off).
    hairColor: pick(HAIR_COLORS, h, 9),
    eyes: pick(['dots', 'happy', 'sleepy'] as const, h, 13),
    mouth: pick(['smile', 'grin', 'soft'] as const, h, 16),
    mark: pick(CHIBI_MARKS, h, 19),
    outfit: pick(CHIBI_DEFAULT_OUTFITS[bodyType], h, 22),
    outfitColor: pick(CHIBI_OUTFIT_COLORS, h, 26).hex,
    accessory: 'none',
    colorMode: 'custom',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate + normalize (the sanitizer)
// ─────────────────────────────────────────────────────────────────────────────

const OUTFIT_COLOR_HEXES = new Set(CHIBI_OUTFIT_COLORS.map((c) => c.hex));

const inList = (pool: readonly string[], value: unknown): boolean =>
  typeof value === 'string' && pool.includes(value);

/**
 * STRICT validation — the future server action's reject-before-write gate.
 * Returns a list of problems (empty = valid). Rejects: non-objects, wrong
 * `v`, ANY unknown key (prototype-pollution / payload smuggling), any field
 * whose value is not in its catalog, and oversized payloads. Does NOT
 * repair — that's normalize()'s job on the READ path.
 */
export function validateChibiConfig(input: unknown): string[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return ['config must be a JSON object'];
  }
  const errors: string[] = [];
  const rec = input as Record<string, unknown>;
  const known = new Set<string>(CHIBI_CONFIG_KEYS);
  for (const key of Object.keys(rec)) {
    if (!known.has(key)) errors.push(`unknown key: ${key}`);
  }
  if (rec.v !== CHIBI_CONFIG_VERSION) errors.push(`v must be ${CHIBI_CONFIG_VERSION}`);
  if (!inList(CHIBI_BODY_TYPES, rec.bodyType)) errors.push('bodyType not in catalog');
  if (!inList(CHIBI_SKIN_TONES, rec.skinTone)) errors.push('skinTone not in palette');
  if (!inList(CHIBI_HAIR_STYLES, rec.hairStyle)) errors.push('hairStyle not in catalog');
  if (!inList(CHIBI_HAIR_COLORS, rec.hairColor)) errors.push('hairColor not in palette');
  if (!inList(CHIBI_EYES, rec.eyes)) errors.push('eyes not in catalog');
  if (!inList(CHIBI_MOUTHS, rec.mouth)) errors.push('mouth not in catalog');
  if (!inList(CHIBI_MARKS, rec.mark)) errors.push('mark not in catalog');
  if (!inList(CHIBI_OUTFITS, rec.outfit)) errors.push('outfit not in catalog');
  if (typeof rec.outfitColor !== 'string' || !OUTFIT_COLOR_HEXES.has(rec.outfitColor)) {
    errors.push('outfitColor not in palette');
  }
  if (!inList(CHIBI_ACCESSORIES, rec.accessory)) errors.push('accessory not in catalog');
  if (!inList(CHIBI_COLOR_MODES, rec.colorMode)) errors.push('colorMode not in catalog');
  if (errors.length === 0) {
    const bytes = JSON.stringify(rec).length;
    if (bytes > CHIBI_CONFIG_MAX_BYTES) errors.push(`config too large (${bytes} bytes)`);
  }
  return errors;
}

/**
 * READ-path repair — resolve whatever is stored (JSONB value, null, junk)
 * into a render-safe config, NEVER throwing: valid fields win, every invalid
 * or missing field falls back to the id's hash default (a stale stored value
 * can never crash a render — the resolveFigureLook wrap-don't-throw rule).
 * Unknown keys are dropped. Output key order is CHIBI_CONFIG_KEYS.
 * Idempotent: resolve(resolve(x)) deep-equals resolve(x).
 */
export function resolveChibiConfig(id: string, stored?: unknown): ChibiAvatarConfig {
  const d = defaultChibiConfig(id);
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return d;
  const rec = stored as Record<string, unknown>;
  return {
    v: CHIBI_CONFIG_VERSION,
    bodyType: inList(CHIBI_BODY_TYPES, rec.bodyType) ? (rec.bodyType as ChibiBodyType) : d.bodyType,
    skinTone: inList(CHIBI_SKIN_TONES, rec.skinTone) ? (rec.skinTone as string) : d.skinTone,
    hairStyle: inList(CHIBI_HAIR_STYLES, rec.hairStyle)
      ? (rec.hairStyle as ChibiHairStyle)
      : d.hairStyle,
    hairColor: inList(CHIBI_HAIR_COLORS, rec.hairColor) ? (rec.hairColor as string) : d.hairColor,
    eyes: inList(CHIBI_EYES, rec.eyes) ? (rec.eyes as ChibiEyes) : d.eyes,
    mouth: inList(CHIBI_MOUTHS, rec.mouth) ? (rec.mouth as ChibiMouth) : d.mouth,
    mark: inList(CHIBI_MARKS, rec.mark) ? (rec.mark as ChibiMark) : d.mark,
    outfit: inList(CHIBI_OUTFITS, rec.outfit) ? (rec.outfit as ChibiOutfit) : d.outfit,
    outfitColor:
      typeof rec.outfitColor === 'string' && OUTFIT_COLOR_HEXES.has(rec.outfitColor)
        ? rec.outfitColor
        : d.outfitColor,
    accessory: inList(CHIBI_ACCESSORIES, rec.accessory)
      ? (rec.accessory as ChibiAccessory)
      : d.accessory,
    colorMode: inList(CHIBI_COLOR_MODES, rec.colorMode)
      ? (rec.colorMode as ChibiColorMode)
      : d.colorMode,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour resolution (shared by the individual figure AND the future crowd)
// ─────────────────────────────────────────────────────────────────────────────

/** Darken a #rrggbb by factor k ∈ [0,1] — the prototype's `darken`, used for
 *  two-tone bottoms (0.72 skirts / 0.6 trousers) and the always-on nose
 *  (skin ×0.88). Pure so the crowd PR can derive per-instance colours from
 *  the same function (instanceColor strategy — see kit/chibi-figure.tsx). */
export function darkenHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (
    '#' +
    (((c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255))
      .toString(16)
      .padStart(6, '0'))
  );
}

/** The colours a renderer actually paints with, after colorMode resolution:
 *  'auto' substitutes the room-derived palette (static placeholder for now)
 *  for outfit + hair; skin is NEVER auto-substituted (it is an identity
 *  choice, not a theme colour). */
export function effectiveChibiColors(cfg: ChibiAvatarConfig): {
  skin: string;
  hair: string;
  outfit: string;
  shoes: string;
} {
  const auto = cfg.colorMode === 'auto';
  return {
    skin: cfg.skinTone,
    hair: auto ? CHIBI_AUTO_COLORS.hairColor : cfg.hairColor,
    outfit: auto ? CHIBI_AUTO_COLORS.outfitColor : cfg.outfitColor,
    shoes: CHIBI_SHOE_COLOR,
  };
}
