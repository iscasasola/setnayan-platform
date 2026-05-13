import type { RoleGroup } from './role-groups';

/**
 * Palette keys: every role group plus a `guest` key for plain guests (no
 * special role). Each key maps to an ARRAY of hex colors so the couple can
 * set a coordinated palette per group, not a single accent.
 */
export type PaletteKey = RoleGroup | 'guest';

export type RolePalette = Partial<Record<PaletteKey, string[]>>;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/**
 * Per-key min/max color counts.
 *   - Wedding Party: 3–6 (matching attire, more coordination)
 *   - Guests with a role: 1–3 (sponsors, bearers, officiants)
 *   - Plain guests: 3–6 (dress-code options guests pick from)
 */
export const PALETTE_LIMITS: Record<
  PaletteKey,
  { min: number; max: number; label: string; hint: string }
> = {
  wedding_party: {
    min: 3,
    max: 6,
    label: 'Wedding Party',
    hint: 'Bridesmaids · groomsmen · MoH · best man — 3 to 6 coordinated colors',
  },
  principal_sponsors: {
    min: 1,
    max: 3,
    label: 'Principal Sponsors',
    hint: 'Ninongs & ninangs — 1 to 3 colors',
  },
  secondary_sponsors: {
    min: 1,
    max: 3,
    label: 'Secondary Sponsors',
    hint: 'Candle · veil · cord · coin — 1 to 3 colors',
  },
  bearers_flower_girl: {
    min: 1,
    max: 3,
    label: 'Bearers & Flower Girl',
    hint: 'Ring / bible / coin bearers and flower girl — 1 to 3 colors',
  },
  officiants: {
    min: 1,
    max: 3,
    label: 'Officiants & Readers',
    hint: 'Officiant · lectors · soloists — 1 to 3 colors',
  },
  other_roles: {
    min: 1,
    max: 3,
    label: 'Other roles',
    hint: 'Anyone else with a named role — 1 to 3 colors',
  },
  guest: {
    min: 3,
    max: 6,
    label: 'Plain guests',
    hint: 'Dress-code palette guests can choose from — 3 to 6 colors',
  },
};

export const PALETTE_ORDER: ReadonlyArray<PaletteKey> = [
  'wedding_party',
  'principal_sponsors',
  'secondary_sponsors',
  'bearers_flower_girl',
  'officiants',
  'other_roles',
  'guest',
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
  return out;
}

export function getPrimaryColor(
  palette: RolePalette,
  key: PaletteKey,
): string | undefined {
  const arr = palette[key];
  return arr && arr.length > 0 ? arr[0] : undefined;
}

export const DEFAULT_PALETTE_SUGGESTIONS: Record<PaletteKey, string[]> = {
  wedding_party: ['#C97B4B', '#824A2A', '#D08654'],
  principal_sponsors: ['#7C3AED'],
  secondary_sponsors: ['#D97706'],
  bearers_flower_girl: ['#059669'],
  officiants: ['#0284C7'],
  other_roles: ['#525252'],
  guest: ['#FAF7F2', '#1A1A1A', '#C97B4B'],
};
