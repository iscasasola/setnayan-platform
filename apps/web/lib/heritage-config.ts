/**
 * heritage-config — the SECOND avatar style: the articulated mannequin rig
 * wearing its own dormant look system (owner 2026-09-06: "can we finish chibi
 * and heritage? just so there are now options").
 *
 * Heritage is the 2026-07-19 lineup's "Heritage-revival of the dormant
 * FigureSpec look system": `lib/figure-rig.ts` has carried SKIN_TONES,
 * HAIR_COLORS and HAIR_STYLE_COUNT since the blob pivot, and `FigureSpec` has
 * carried `skinTone / hairStyle / hairColor` — and kit/figure.tsx read none of
 * them. This module is the CONFIG for that look; figure.tsx now honours it.
 *
 * Same discipline as lib/chibi-config.ts, which it deliberately mirrors:
 * catalogs are the single vocabulary (nothing here invents a value), validate()
 * is strict (unknown key ⇒ rejected), resolve() never throws (field-by-field
 * repair to hash-defaults), and the stored shape is a small whitelist of ids —
 * never a photo, never derived from a face.
 *
 * The one new bit of shape: `style: 'heritage'`. A chibi config has no `style`
 * key (v1 shipped without one and every stored row is chibi), so absence means
 * chibi and `lib/guest-avatar.ts` dispatches on presence. Pure — runs under
 * tsx --test.
 */
import { SKIN_TONES, HAIR_COLORS, HAIR_STYLE_COUNT, hashId, type FigureSpec } from './figure-rig';
import { CHIBI_OUTFIT_COLORS } from './chibi-config';

export const HERITAGE_STYLE = 'heritage' as const;
/** The rig styles that share this schema: Heritage (capsule parts) and the
 *  Blocky Kit (rounded-box parts, owner 2026-09-06). Same skeleton, same
 *  poses, same look fields — the style IS the part table. */
export const RIG_STYLES = ['heritage', 'blocky'] as const;
export type RigStyle = (typeof RIG_STYLES)[number];
export const HERITAGE_CONFIG_VERSION = 1 as const;

export const HERITAGE_OUTFITS = ['gown', 'suit', 'barong', 'filipiniana', 'neutral'] as const;
/** Body build (owner 2026-09-06: the rig styles read male; the chibi has a
 *  body type, so must these). Same two values as the chibi. */
export const HERITAGE_BODY_TYPES = ['female', 'male'] as const;
export type HeritageBodyType = (typeof HERITAGE_BODY_TYPES)[number];
export type HeritageOutfit = (typeof HERITAGE_OUTFITS)[number];
export const HERITAGE_SKIN_TONES: readonly string[] = SKIN_TONES;
export const HERITAGE_HAIR_COLORS: readonly string[] = HAIR_COLORS;
export const HERITAGE_HAIR_STYLES: readonly number[] = Array.from({ length: HAIR_STYLE_COUNT }, (_, i) => i);
/** Shared with the chibi on purpose — one outfit palette across both styles. */
export const HERITAGE_OUTFIT_COLORS = CHIBI_OUTFIT_COLORS;

export type HeritageAvatarConfig = {
  v: typeof HERITAGE_CONFIG_VERSION;
  style: RigStyle;
  bodyType: HeritageBodyType;
  skinTone: string;
  hairStyle: number;
  hairColor: string;
  outfit: HeritageOutfit;
  outfitColor: string;
};

export const HERITAGE_CONFIG_KEYS = ['v', 'style', 'bodyType', 'skinTone', 'hairStyle', 'hairColor', 'outfit', 'outfitColor'] as const;

const HEX = /^#[0-9a-f]{6}$/i;

/** Is this stored value CLAIMING to be heritage? (Dispatch key only — the
 *  claim is then validated/repaired by the functions below.) */
export function isHeritageStored(stored: unknown): boolean {
  return (
    typeof stored === 'object' && stored !== null && !Array.isArray(stored) &&
    (RIG_STYLES as readonly unknown[]).includes((stored as { style?: unknown }).style)
  );
}

/** Hash-derived defaults — same id ⇒ same look forever (the resolveFigureLook convention). */
export function defaultHeritageConfig(id: string): HeritageAvatarConfig {
  const h = hashId(id);
  const bodyType: HeritageBodyType = HERITAGE_BODY_TYPES[(h >>> 15) % 2]!;
  // The default outfit follows the body so the first impression reads right:
  // gown / filipiniana for female, suit / barong for male. Any outfit stays
  // pickable for any body — this is only the default.
  const outfit: HeritageOutfit = bodyType === 'female'
    ? (['gown', 'filipiniana'] as const)[(h >>> 9) % 2]!
    : (['suit', 'barong'] as const)[(h >>> 9) % 2]!;
  return {
    v: HERITAGE_CONFIG_VERSION,
    style: HERITAGE_STYLE,
    bodyType,
    skinTone: HERITAGE_SKIN_TONES[h % HERITAGE_SKIN_TONES.length]!,
    hairStyle: bodyType === 'female' ? 3 + ((h >>> 3) % 3) : (h >>> 3) % 3, // long-ish vs short-ish defaults
    hairColor: HERITAGE_HAIR_COLORS[(h >>> 6) % HERITAGE_HAIR_COLORS.length]!,
    outfit,
    outfitColor: HERITAGE_OUTFIT_COLORS[(h >>> 12) % HERITAGE_OUTFIT_COLORS.length]!.hex,
  };
}

/** Strict: every key present, no unknown keys, every value in its catalog. */
export function validateHeritageConfig(input: unknown): string[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return ['config must be an object'];
  const rec = input as Record<string, unknown>;
  const errors: string[] = [];
  const known = new Set<string>(HERITAGE_CONFIG_KEYS);
  for (const key of Object.keys(rec)) if (!known.has(key)) errors.push(`unknown key: ${key}`);
  if (rec.v !== HERITAGE_CONFIG_VERSION) errors.push('v must be 1');
  if (!(RIG_STYLES as readonly unknown[]).includes(rec.style)) errors.push("style must be 'heritage' or 'blocky'");
  if (!(HERITAGE_BODY_TYPES as readonly unknown[]).includes(rec.bodyType)) errors.push('bodyType not in catalog');
  if (typeof rec.skinTone !== 'string' || !HERITAGE_SKIN_TONES.includes(rec.skinTone)) errors.push('skinTone not in catalog');
  if (typeof rec.hairStyle !== 'number' || !HERITAGE_HAIR_STYLES.includes(rec.hairStyle)) errors.push('hairStyle not in catalog');
  if (typeof rec.hairColor !== 'string' || !HERITAGE_HAIR_COLORS.includes(rec.hairColor)) errors.push('hairColor not in catalog');
  if (typeof rec.outfit !== 'string' || !(HERITAGE_OUTFITS as readonly string[]).includes(rec.outfit)) errors.push('outfit not in catalog');
  if (typeof rec.outfitColor !== 'string' || !HEX.test(rec.outfitColor) || !HERITAGE_OUTFIT_COLORS.some((c) => c.hex === rec.outfitColor)) errors.push('outfitColor not in catalog');
  return errors;
}

/** Never throws: repairs field-by-field to this id's defaults. */
export function resolveHeritageConfig(id: string, stored: unknown): HeritageAvatarConfig {
  const d = defaultHeritageConfig(id);
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return d;
  const r = stored as Record<string, unknown>;
  return {
    v: HERITAGE_CONFIG_VERSION,
    style: (RIG_STYLES as readonly unknown[]).includes(r.style) ? (r.style as RigStyle) : HERITAGE_STYLE,
    bodyType: (HERITAGE_BODY_TYPES as readonly unknown[]).includes(r.bodyType) ? (r.bodyType as HeritageBodyType) : d.bodyType,
    skinTone: typeof r.skinTone === 'string' && HERITAGE_SKIN_TONES.includes(r.skinTone) ? r.skinTone : d.skinTone,
    hairStyle: typeof r.hairStyle === 'number' && HERITAGE_HAIR_STYLES.includes(r.hairStyle) ? r.hairStyle : d.hairStyle,
    hairColor: typeof r.hairColor === 'string' && HERITAGE_HAIR_COLORS.includes(r.hairColor) ? r.hairColor : d.hairColor,
    outfit: typeof r.outfit === 'string' && (HERITAGE_OUTFITS as readonly string[]).includes(r.outfit) ? (r.outfit as HeritageOutfit) : d.outfit,
    outfitColor: typeof r.outfitColor === 'string' && HERITAGE_OUTFIT_COLORS.some((c) => c.hex === r.outfitColor) ? r.outfitColor : d.outfitColor,
  };
}

/** The rig's spec for this look. `statusColor` is the caller's (a remote's
 *  presence colour, a seat's table colour, '' for the viewer's own figure). */
export function heritageFigureSpec(id: string, cfg: HeritageAvatarConfig, statusColor: string): FigureSpec {
  return {
    id,
    outfit: cfg.outfit,
    outfitColor: cfg.outfitColor,
    skinTone: cfg.skinTone,
    hairStyle: cfg.hairStyle,
    hairColor: cfg.hairColor,
    statusColor,
    kit: cfg.style === 'blocky' ? 'blocky' : 'round',
    build: cfg.bodyType,
  };
}
