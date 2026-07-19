import type { RoleGroup } from './role-groups';
import type { GuestRole } from './guests';

/**
 * Palette keys split into three families:
 *   • Venue — ceremony / reception (overall event vibe)
 *   • Couple — bride / groom (attire palettes for the couple)
 *   • Roles — wedding_party (the shared FALLBACK) + its four split sub-keys
 *     (maid_of_honor / best_man / bridesmaids / groomsmen), parents & immediate
 *     family, sponsors, bearers, officiants, muslim_principals (Nikah cast) and
 *     plain `guest` — each shown only when a guest actually holds that role.
 *
 * Reception palette has named slots (dominant, supporting, accents) for the
 * first four indexes; the 5th + 6th are extra accents without labels.
 */
export type CouplePaletteKey = 'bride' | 'groom';

// The mood-board's 'bride' and 'groom' palette keys (attire palettes)
// stand in for the 'couple' role group from role-groups.ts — there's no
// separate 'couple' palette. Excluded here to avoid forcing a redundant
// key on every palette record.
//
// TAXONOMY v2 (owner-locked 2026-07-08): the Wedding Party palette SPLITS into
// four specific role keys (maid_of_honor / best_man / bridesmaids / groomsmen);
// `wedding_party` STAYS as the shared FALLBACK when a specific key is unfilled.
// `parents_immediate_family` supersedes the dormant `vip_family` palette key
// (which was never in PALETTE_ORDER, so no saved event ever carried it). And
// `muslim_principals` — the Nikah cast (wali/witness/imam/wakil) — is now a REAL
// attire key (the old exclusion is lifted); it surfaces ONLY for muslim weddings
// via the existing Nikah role set, so non-muslim boards are unchanged.
export type PaletteKey =
  | 'ceremony'
  | 'reception'
  | CouplePaletteKey
  // wedding_party (fallback) · principal/secondary sponsors · bearers ·
  // officiants · muslim_principals. 'couple' + 'other_roles' have no palette;
  // 'vip_family' is superseded by 'parents_immediate_family' (added below).
  | Exclude<RoleGroup, 'other_roles' | 'couple' | 'vip_family'>
  // Wedding-party SPLIT — specific role keys that fall back to wedding_party.
  | 'maid_of_honor'
  | 'best_man'
  | 'bridesmaids'
  | 'groomsmen'
  // Parents + immediate family of both sides (was the dormant vip_family key).
  | 'parents_immediate_family'
  | 'guest';

/**
 * Advanced room-dressing overrides. Each field is DERIVED from the reception
 * palette by default (see `resolveRoomDressing`) and is honored ONLY when the
 * couple explicitly sets it. NOT a `PaletteKey`: its value is a single hex per
 * field (not a color list), so it never flows through the PaletteKey machinery
 * — `sanitizeRolePalette` and the editor handle it explicitly.
 */
export type RoomDressing = {
  linens?: string;
  chairs?: string;
  florals?: string;
  lighting_warmth?: string;
};

export type RolePalette = Partial<Record<PaletteKey, string[]>> & {
  room_dressing?: RoomDressing;
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export type PaletteLimits = {
  min: number;
  max: number;
  label: string;
  hint: string;
  /** Per-index labels (e.g. ["Dominant", "Supporting", "Accent", "Accent 2"]). */
  slotLabels?: ReadonlyArray<string>;
  /** Grouping tag for UI sectioning. */
  family: 'venue' | 'couple' | 'role';
};

/**
 * Per-key min/max color counts.
 *   • Ceremony: 1–3 (smaller, more reverent)
 *   • Reception: 3–4 (dominant + supporting + 1–2 accents)
 *   • Wedding Party: 3–6 (matching attire, more coordination)
 *   • Guests with a role: 1–3 (sponsors, bearers, officiants)
 *   • Plain guests: 3–6 (dress-code options guests pick from)
 */
export const PALETTE_LIMITS: Record<PaletteKey, PaletteLimits> = {
  ceremony: {
    min: 1,
    max: 3,
    label: 'Ceremony palette',
    hint: 'Overall ceremony venue setting — 1 to 3 colors',
    family: 'venue',
  },
  reception: {
    min: 3,
    max: 6,
    label: 'Reception palette',
    hint: 'Dominant + supporting + accents — 3 to 6 colors',
    slotLabels: ['Dominant', 'Supporting', 'Accent', 'Accent 2'],
    family: 'venue',
  },
  bride: {
    min: 1,
    max: 3,
    label: 'Bride',
    hint: "The bride's attire palette — 1 to 3 colors",
    family: 'couple',
  },
  groom: {
    min: 1,
    max: 3,
    label: 'Groom',
    hint: "The groom's attire palette — 1 to 3 colors",
    family: 'couple',
  },
  // Wedding Party — the shared FALLBACK palette (taxonomy v2). Still set-once for
  // couples who don't want per-role colors; the four specific keys below override
  // it when filled.
  wedding_party: {
    min: 3,
    max: 6,
    label: 'Wedding Party (all)',
    hint: 'Shared fallback — colors any entourage role without its own palette · 3 to 6 colors',
    family: 'role',
  },
  // Wedding-party SPLIT keys (taxonomy v2). MoH covers maid + matron of honor.
  maid_of_honor: {
    min: 1,
    max: 3,
    label: 'Maid / Matron of Honor',
    hint: 'The honor attendant — 1 to 3 colors (falls back to Wedding Party)',
    family: 'role',
  },
  best_man: {
    min: 1,
    max: 3,
    label: 'Best Man',
    hint: 'The best man — 1 to 3 colors (falls back to Wedding Party)',
    family: 'role',
  },
  bridesmaids: {
    min: 3,
    max: 6,
    label: 'Bridesmaids',
    hint: 'Coordinated bridesmaid attire — 3 to 6 colors (falls back to Wedding Party)',
    family: 'role',
  },
  groomsmen: {
    min: 3,
    max: 6,
    label: 'Groomsmen',
    hint: 'Coordinated groomsmen attire — 3 to 6 colors (falls back to Wedding Party)',
    family: 'role',
  },
  // Parents + immediate family of both sides (was the dormant vip_family key).
  // The 4 immediate-family roles (bride/groom parents + bride/groom immediate
  // family) share one palette since they're seated as one cluster on iteration
  // 0008's Tier-1 ring.
  parents_immediate_family: {
    min: 1,
    max: 3,
    label: 'Parents & Immediate Family',
    hint: 'Parents and immediate family of both sides — 1 to 3 colors',
    family: 'role',
  },
  // Nikah principals (wali · witnesses · imam · wakil). Surfaces ONLY for muslim
  // weddings (those roles only appear via the ceremony-aware MUSLIM_ROLE_SET), so
  // a non-muslim board never shows this section.
  muslim_principals: {
    min: 1,
    max: 3,
    label: 'Nikah Principals',
    hint: 'Wali · witnesses · imam · wakil — 1 to 3 colors',
    family: 'role',
  },
  principal_sponsors: {
    min: 1,
    max: 3,
    label: 'Principal Sponsors',
    hint: 'Ninongs & ninangs — 1 to 3 colors',
    family: 'role',
  },
  secondary_sponsors: {
    min: 1,
    max: 3,
    label: 'Secondary Sponsors',
    hint: 'Candle · veil · cord · coin — 1 to 3 colors',
    family: 'role',
  },
  bearers_flower_girl: {
    min: 1,
    max: 3,
    label: 'Bearers & Flower Girl',
    hint: 'Ring / bible / coin bearers and flower girl — 1 to 3 colors',
    family: 'role',
  },
  officiants: {
    min: 1,
    max: 3,
    label: 'Officiants & Readers',
    hint: 'Officiant · lectors · soloists — 1 to 3 colors',
    family: 'role',
  },
  guest: {
    min: 3,
    max: 6,
    label: 'Plain guests',
    hint: 'Dress-code palette guests can choose from — 3 to 6 colors',
    family: 'role',
  },
};

// Importance order — mirrors ROLE_IMPORTANCE (role-groups.ts): couple → parents
// & immediate family → Nikah principals → wedding party (specific sub-keys BEFORE
// the shared `wedding_party` fallback) → sponsors → bearers → officiants → guest.
// Anything not in this list is NOT sanitized/saved, so every new color key MUST
// appear here to round-trip.
export const PALETTE_ORDER: ReadonlyArray<PaletteKey> = [
  'ceremony',
  'reception',
  'bride',
  'groom',
  'parents_immediate_family',
  'muslim_principals',
  'maid_of_honor',
  'best_man',
  'bridesmaids',
  'groomsmen',
  'wedding_party',
  'principal_sponsors',
  'secondary_sponsors',
  'bearers_flower_girl',
  'officiants',
  'guest',
];

/**
 * Family membership lookup — drives conditional rendering. Venue and couple
 * palettes always show. Role-family palettes only show when the event has at
 * least one guest with a role mapping to that key, so the Mood Board doesn't
 * present empty palette slots couples will never use.
 */
export const ROLE_FAMILY_KEYS: ReadonlyArray<PaletteKey> = [
  'parents_immediate_family',
  'muslim_principals',
  'maid_of_honor',
  'best_man',
  'bridesmaids',
  'groomsmen',
  'wedding_party',
  'principal_sponsors',
  'secondary_sponsors',
  'bearers_flower_girl',
  'officiants',
];

/**
 * Accepts both the legacy shape (`{ key: "#RRGGBB" }`) and the new shape
 * (`{ key: ["#RRGGBB", …] }`). Drops invalid colors, clamps to per-key max,
 * upper-cases for consistency. Min is NOT enforced here — the UI surfaces a
 * warning but doesn't block save (couples may want to draft incrementally).
 */
export function sanitizeRolePalette(raw: unknown): RolePalette {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: RolePalette = {};
  for (const key of PALETTE_ORDER) {
    const v = (raw as Record<string, unknown>)[key];
    let colors: string[] = [];
    if (typeof v === 'string') {
      if (HEX_RE.test(v)) colors = [v.toUpperCase()];
    } else if (Array.isArray(v)) {
      colors = v
        .filter((c): c is string => typeof c === 'string' && HEX_RE.test(c))
        .map((c) => c.toUpperCase());
    }
    const max = PALETTE_LIMITS[key].max;
    colors = colors.slice(0, max);
    if (colors.length > 0) out[key] = colors;
  }
  // Room-dressing overrides live OUTSIDE the PaletteKey machinery (single hex per
  // field, not a color list), so preserve/validate them explicitly rather than
  // letting the PALETTE_ORDER rebuild silently drop them. Only valid hex fields
  // are kept; the block is omitted entirely when nothing survives.
  const rd = sanitizeRoomDressing((raw as Record<string, unknown>).room_dressing);
  if (rd) out.room_dressing = rd;
  return out;
}

/** Validate a raw room-dressing object → keep only the #RRGGBB fields. Returns
 *  undefined when nothing valid remains (so callers can omit the key). */
function sanitizeRoomDressing(raw: unknown): RoomDressing | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const src = raw as Record<string, unknown>;
  const out: RoomDressing = {};
  for (const field of ROOM_DRESSING_FIELDS) {
    const v = src[field];
    if (typeof v === 'string' && HEX_RE.test(v)) out[field] = v.toUpperCase();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function getPrimaryColor(
  palette: RolePalette,
  key: PaletteKey | RoleGroup | 'guest',
): string | undefined {
  // 'other_roles' is the fallback bucket from role-groups.ts (no palette).
  // 'couple' is the role group bride + groom belong to, but the palette splits
  // attire colors into separate `bride` and `groom` keys, so there's no
  // aggregate "couple" primary to surface here.
  if (key === 'other_roles' || key === 'couple') return undefined;
  // The guest-list role chip passes the ROLE GROUP; `vip_family` is the group
  // name for the parents/immediate-family cluster whose palette key was renamed
  // to `parents_immediate_family` in taxonomy v2 — normalize so the chip colors.
  const pk: PaletteKey = key === 'vip_family' ? 'parents_immediate_family' : key;
  const arr = palette[pk];
  return arr && arr.length > 0 ? arr[0] : undefined;
}

export const DEFAULT_PALETTE_SUGGESTIONS: Record<PaletteKey, string[]> = {
  ceremony: ['#FAF7F2', '#824A2A'],
  reception: ['#C97B4B', '#824A2A', '#D08654'],
  bride: ['#FAF7F2'],
  groom: ['#1A1A1A'],
  // Wedding-party fallback + its four split sub-keys share the terracotta trio so
  // an unfilled specific key visually degrades to the same family as the fallback.
  wedding_party: ['#C97B4B', '#824A2A', '#D08654'],
  maid_of_honor: ['#C97B4B'],
  best_man: ['#824A2A'],
  bridesmaids: ['#C97B4B', '#824A2A', '#D08654'],
  groomsmen: ['#C97B4B', '#824A2A', '#D08654'],
  // Parents & immediate family — deep rose pairs with the rose-200 sidebar chip
  // tint locked in role-groups.ts (formerly vip_family).
  parents_immediate_family: ['#BE185D'],
  // Nikah principals — emerald, matching the muslim_principals chip tint.
  muslim_principals: ['#059669'],
  principal_sponsors: ['#7C3AED'],
  secondary_sponsors: ['#D97706'],
  bearers_flower_girl: ['#059669'],
  officiants: ['#0284C7'],
  guest: ['#FAF7F2', '#1A1A1A', '#C97B4B'],
};

// ── Role → palette-key resolver (taxonomy v2) ───────────────────────────────

/**
 * The palette key that colors a guest's 3D attire. Wedding-party roles map to
 * their SPECIFIC split key (MoH covers maid + matron); parents/immediate-family
 * roles collapse to `parents_immediate_family`; Nikah roles to `muslim_principals`.
 * Generic (non-wedding) roles + plain guests map to `guest`. Pure + total.
 */
export function paletteKeyForRole(role: GuestRole): PaletteKey {
  switch (role) {
    case 'bride':
      return 'bride';
    case 'groom':
      return 'groom';
    case 'maid_of_honor':
    case 'matron_of_honor':
      return 'maid_of_honor';
    case 'best_man':
      return 'best_man';
    case 'bridesmaid':
      return 'bridesmaids';
    case 'groomsman':
      return 'groomsmen';
    case 'bride_parents':
    case 'groom_parents':
    case 'bride_immediate_family':
    case 'groom_immediate_family':
      return 'parents_immediate_family';
    case 'wali':
    case 'witness':
    case 'imam':
    case 'wakil':
      return 'muslim_principals';
    case 'principal_sponsor':
      return 'principal_sponsors';
    case 'candle_sponsor':
    case 'veil_sponsor':
    case 'cord_sponsor':
    case 'coin_sponsor':
      return 'secondary_sponsors';
    case 'ring_bearer':
    case 'bible_bearer':
    case 'coin_bearer':
    case 'flower_girl':
      return 'bearers_flower_girl';
    case 'officiant':
    case 'reader_lector':
    case 'soloist_musician':
      return 'officiants';
    // Plain + generic (host/vip/family/helper) roles share the guest palette.
    default:
      return 'guest';
  }
}

/** The specific split keys whose 3D attire falls back to the shared
 *  `wedding_party` palette when unset (taxonomy v2 resolution chain). */
const WEDDING_PARTY_FINE_KEYS: ReadonlySet<PaletteKey> = new Set<PaletteKey>([
  'maid_of_honor',
  'best_man',
  'bridesmaids',
  'groomsmen',
]);

/** True when a palette key is one of the four wedding-party split sub-keys. */
export function isWeddingPartyFineKey(key: PaletteKey): boolean {
  return WEDDING_PARTY_FINE_KEYS.has(key);
}

/** The bride/groom SIDE attire color for a guest — the 3rd link of the attire
 *  chain. 'both'-side guests prefer the bride color, then groom. */
export function sideAttireColor(
  palette: RolePalette,
  side: 'bride' | 'groom' | 'both',
): string | null {
  if (side === 'groom') return palette.groom?.[0] ?? null;
  if (side === 'bride') return palette.bride?.[0] ?? null;
  return palette.bride?.[0] ?? palette.groom?.[0] ?? null;
}

/**
 * The 3D attire motif color for a guest, per the owner-locked STRICT chain
 * (taxonomy v2): specific role palette key → `wedding_party` → bride/groom SIDE
 * color → kit default. Returns `null` for the terminal "kit default" so the
 * figure kit applies its own neutral cloth (#FFFFFF mannequin base) — the same
 * null-means-default contract `attireColor`/`FigureSpec.outfitColor` already use.
 *
 * BACKWARD COMPAT: a couple who set ONLY `wedding_party` (no specific key) gets
 * the wedding_party color for every entourage member — identical to what the old
 * gown bucket produced (`wedding_party ?? bride`).
 */
export function resolveAttirePaletteColor(
  role: GuestRole,
  palette: RolePalette,
  sideColor: string | null,
): string | null {
  // 1. specific role palette key
  const specific = palette[paletteKeyForRole(role)]?.[0];
  if (specific) return specific;
  // 2. shared wedding_party fallback
  const party = palette.wedding_party?.[0];
  if (party) return party;
  // 3. bride/groom side color
  if (sideColor) return sideColor;
  // 4. kit default (null → the kit's own neutral cloth)
  return null;
}

// ── Room-dressing resolver (taxonomy v2) ────────────────────────────────────

const ROOM_DRESSING_FIELDS = [
  'linens',
  'chairs',
  'florals',
  'lighting_warmth',
] as const;

// Warm-neutral defaults, matching `resolvePalette([])` in seating-3d.ts so a
// room with no reception palette AND no override renders byte-identically to the
// pre-taxonomy scene.
const ROOM_DRESSING_DEFAULTS: Required<RoomDressing> = {
  linens: '#F3EFE9',
  chairs: '#E7E1D8',
  florals: '#C89B6C',
  lighting_warmth: '#FBE9D8',
};

/**
 * Resolve every room-dressing surface color. Each field is the couple's explicit
 * override if set, else DERIVED from the reception palette (Dominant/Supporting/
 * Accent), else a warm-neutral default. Defaults mirror the pre-taxonomy 3D scene
 * mapping (linen = Supporting, lighting = Dominant) so overriding nothing keeps
 * the room look unchanged. Pure.
 */
export function resolveRoomDressing(palette: RolePalette): Required<RoomDressing> {
  const r = (palette.reception ?? []).filter((h) => HEX_RE.test(h));
  const o = palette.room_dressing ?? {};
  return {
    // Supporting (r[1]) = the tablecloth — matches the pre-taxonomy `table` slot.
    linens: o.linens ?? r[1] ?? ROOM_DRESSING_DEFAULTS.linens,
    // Accent (r[2]) for chairs.
    chairs: o.chairs ?? r[2] ?? ROOM_DRESSING_DEFAULTS.chairs,
    // Dominant (r[0]) for the floral statement.
    florals: o.florals ?? r[0] ?? ROOM_DRESSING_DEFAULTS.florals,
    // Dominant (r[0]) = the warm ambient wash — matches the pre-taxonomy
    // `ambient` slot (NOT Accent2, so 4-color receptions keep today's ambient).
    lighting_warmth: o.lighting_warmth ?? r[0] ?? ROOM_DRESSING_DEFAULTS.lighting_warmth,
  };
}
