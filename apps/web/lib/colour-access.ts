/**
 * lib/colour-access.ts — MB16's PURE core: who may change which colour.
 *
 * "Let this vendor adjust colours in their own part of your design — you'll
 *  always see what changed, and you can undo any single change without
 *  touching their access."
 *
 * Four questions, and nothing else:
 *
 *   1. WHICH DOMAINS EXIST?        → COLOUR_DOMAINS (+ label / blurb)
 *   2. WHAT IS THIS BOOKING'S LANE? → laneForVendorCategory
 *   3. IS THIS COLOUR IN THAT LANE? → domainCovers
 *   4. HOW DOES THE LOG READ?       → describeColourChange
 *
 * ── 🛑 THIS FILE IS A MIRROR, NOT THE GATE ─────────────────────────────────
 * The gate is `public.apply_colour_change`, and the two functions it consults —
 * `colour_domains_for_category` and `colour_domain_covers` — are SQL
 * (migration 20271204966904). A screen that offers the wrong control is a
 * correctness bug; a screen that could *perform* the wrong write would be a
 * security one, and it cannot, because the database refuses independently of
 * anything here.
 *
 * `tests/db/the-colour-lane-is-one-map.db.test.ts` asks the real database for
 * every `vendor_category` enum member and every palette key, and fails if this
 * module and those functions disagree about ANY of them. Same discipline
 * `resolveAreaLevel` ↔ `public.moderator_area_level` keeps, and for the same
 * stated reason: where they differ the database wins at runtime, and the screen
 * has already told the person otherwise — which is worse than either answer
 * alone.
 *
 * ── PURE, AND IT HAS TO BE ─────────────────────────────────────────────────
 * No Supabase import, no `next/headers`, nothing outside `lib/mood-board.ts`'s
 * pure vocabulary. Both surfaces that render colour access are `'use client'`
 * components, and MB12 shipped exactly this chain to CI once already —
 * `lib/moodboard-finalization.ts` reaches `next/headers` through
 * taxonomy → vendor-counts → supabase/server, and neither `tsc` nor
 * `tsx --test` can see it. `scripts/lint-server-only-boundary.mjs` can, in
 * about a second.
 */

import {
  PALETTE_LIMITS,
  PALETTE_ORDER,
  resolveRoomDressing,
  type PaletteKey,
  type RolePalette,
  type RoomDressing,
} from './mood-board';

/* ══════════════════════════════════════════════════════════════════════════
   1 · THE DOMAINS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The four colour domains a grant can be scoped to.
 *
 * Mirrors the `*_domain_chk` CHECK on all three MB16 tables. Widening this
 * union without widening those constraints in the same PR means the INSERT is
 * refused and the couple sees a switch that silently does nothing.
 */
export type ColourDomain = 'main_colours' | 'decor' | 'florals' | 'attire';

export const COLOUR_DOMAINS: readonly ColourDomain[] = [
  'decor',
  'main_colours',
  'florals',
  'attire',
] as const;

export function isColourDomain(v: unknown): v is ColourDomain {
  return typeof v === 'string' && (COLOUR_DOMAINS as readonly string[]).includes(v);
}

/** The checklist's own words — the prototype's coordinator card, verbatim. */
export const COLOUR_DOMAIN_LABEL: Readonly<Record<ColourDomain, string>> = {
  decor: 'Reception decor',
  main_colours: 'Main wedding colours',
  florals: 'Florals',
  attire: 'Attire',
};

/**
 * The second line under each checkbox.
 *
 * ⚠ `decor` DOES NOT SAY "walls, ceiling" — AND THE PROTOTYPE DID.
 * There is no per-zone colour to change: a wall, a backdrop, a tunnel, an
 * entrance, a photo wall and a welcome sign are all drawn from
 * `palette.reception` directly (see `lib/moodboard-finalization.ts`'s own
 * reading of it), so "change the backdrop's colour" is not a thing the schema
 * can express for anybody, couple included. The three fields below are the
 * real room-dressing overrides `resolveRoomDressing` honours. Promising the
 * walls and delivering the linens is the shape of failure this whole session
 * exists to stop, so the copy says what is true.
 */
export const COLOUR_DOMAIN_BLURB: Readonly<Record<ColourDomain, string>> = {
  decor: 'Table linens, chairs, and the room’s ambient warmth.',
  main_colours: 'Your 5 core colours — reaches your whole board.',
  florals: 'Bouquets, centrepieces, floral accents.',
  attire: 'Entourage and sponsor attire colours.',
};

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE LANE — mirror of public.colour_domains_for_category
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The colour domains a booking of this `event_vendors.category` may hold.
 *
 * 🔑 THE STYLIST IS THE ONE WIDE LANE, AND IT IS AN OWNER RULING (2026-09-04).
 * `reception_decor` reaches the couple's five main colours as well as the
 * room's dressing, because a stylist shapes the whole look. Every other trade
 * is narrow. The card says so in words every time, because a change to the
 * majors ripples into the palette, the 3D room and everything else that reads
 * them.
 *
 * 🔑 `planner_coordinator` IS EMPTY HERE ON PURPOSE, and it is not an
 * oversight. A coordinator holds SEVERAL independent domains at once, which a
 * single per-booking switch cannot express — their grants live on
 * `/dashboard/[eventId]/hosts`, keyed to the person. The vendor card points
 * there instead of showing a switch that would mean the wrong thing.
 *
 * An empty array is an ANSWER everywhere else too: a caterer, a photographer
 * and a band do not adjust anybody's palette, and their card renders one
 * sentence rather than a dead control.
 */
export function laneForVendorCategory(category: string | null | undefined): ColourDomain[] {
  switch (category) {
    case 'reception_decor':
      return ['decor', 'main_colours'];
    case 'florist':
      return ['florals'];
    case 'gown_designer':
    case 'suit_designer':
      return ['attire'];
    default:
      return [];
  }
}

/** TRUE for the one category whose lane reaches the couple's five majors. */
export function laneIsWide(domains: readonly ColourDomain[]): boolean {
  return domains.includes('main_colours');
}

/**
 * The prototype's "Can change: …" sentence, built from the lane rather than
 * written once per trade — three hand-written sentences would drift the first
 * time a lane moved, and the drift would read as a correct sentence.
 */
export function scopeLine(domains: readonly ColourDomain[]): string {
  if (domains.length === 0) return '';
  if (laneIsWide(domains)) {
    return 'your reception decor colours — and, because a stylist shapes your whole look, your 5 main wedding colours too';
  }
  const parts = domains.map((d) => COLOUR_DOMAIN_LABEL[d].toLowerCase());
  return parts.length === 1
    ? `your ${parts[0]} colours`
    : `your ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]} colours`;
}

/* ══════════════════════════════════════════════════════════════════════════
   3 · WHAT A DOMAIN REACHES — mirror of public.colour_domain_covers
   ══════════════════════════════════════════════════════════════════════════ */

/** How a colour is addressed: a slot in a palette list, or a dressing field. */
export type ColourTargetKind = 'palette' | 'room_dressing';

/**
 * The `room_dressing` fields the DECOR domain reaches.
 *
 * DERIVED from `RoomDressing`'s own keys minus the floral one, so adding a
 * fifth dressing field is a compile error here until somebody says which
 * domain owns it — rather than a field silently belonging to nobody.
 */
export const FLORAL_DRESSING_FIELD: keyof RoomDressing = 'florals';

export const DECOR_DRESSING_FIELDS: readonly (keyof RoomDressing)[] = (
  ['linens', 'chairs', 'florals', 'lighting_warmth'] satisfies (keyof RoomDressing)[]
).filter((f) => f !== FLORAL_DRESSING_FIELD);

/**
 * Every attire `PaletteKey` — DERIVED, never listed.
 *
 * `PALETTE_LIMITS[k].family !== 'venue'` is the same filter
 * `lib/moodboard-render-parts.ts`'s `attirePaletteKeys()` uses, minus its
 * wedding-party collapse: a grant addresses a KEY, and `bridesmaids` is a real
 * key somebody can change.
 *
 * ⚠ `ceremony` AND `reception` FALL OUT AS THE VENUE FAMILY, and only one of
 * them gets a domain. `reception` is `main_colours`; `ceremony` belongs to NO
 * domain at all and nobody but the couple ever changes it. Putting it under
 * `decor` to be tidy would hand a stylist the church.
 */
export const ATTIRE_PALETTE_KEYS: readonly PaletteKey[] = PALETTE_ORDER.filter(
  (k) => PALETTE_LIMITS[k].family !== 'venue',
);

/** The one palette key the MAIN COLOURS domain reaches. */
export const MAIN_COLOURS_PALETTE_KEY: PaletteKey = 'reception';

/**
 * TRUE when a colour target lies inside a domain — the mirror of the SQL gate.
 *
 * A florist holding `florals` asking for `reception` is FALSE here and is
 * refused in `apply_colour_change` regardless of what this returns.
 */
export function domainCovers(
  domain: ColourDomain,
  kind: ColourTargetKind,
  key: string,
): boolean {
  switch (domain) {
    case 'main_colours':
      return kind === 'palette' && key === MAIN_COLOURS_PALETTE_KEY;
    case 'decor':
      return (
        kind === 'room_dressing' &&
        (DECOR_DRESSING_FIELDS as readonly string[]).includes(key)
      );
    case 'florals':
      return kind === 'room_dressing' && key === FLORAL_DRESSING_FIELD;
    case 'attire':
      return kind === 'palette' && (ATTIRE_PALETTE_KEYS as readonly string[]).includes(key);
    default:
      return false;
  }
}

/** Every target the holder of these domains may address, in display order. */
export type ColourTarget = {
  domain: ColourDomain;
  kind: ColourTargetKind;
  key: string;
  label: string;
};

const DRESSING_LABEL: Readonly<Record<keyof RoomDressing, string>> = {
  linens: 'Table linens',
  chairs: 'Chairs',
  florals: 'Floral statement',
  lighting_warmth: 'Ambient warmth',
};

export function targetsForDomains(domains: readonly ColourDomain[]): ColourTarget[] {
  const out: ColourTarget[] = [];
  for (const domain of COLOUR_DOMAINS) {
    if (!domains.includes(domain)) continue;
    if (domain === 'main_colours') {
      out.push({
        domain,
        kind: 'palette',
        key: MAIN_COLOURS_PALETTE_KEY,
        label: PALETTE_LIMITS[MAIN_COLOURS_PALETTE_KEY].label,
      });
    } else if (domain === 'decor') {
      for (const f of DECOR_DRESSING_FIELDS) {
        out.push({ domain, kind: 'room_dressing', key: f, label: DRESSING_LABEL[f] });
      }
    } else if (domain === 'florals') {
      out.push({
        domain,
        kind: 'room_dressing',
        key: FLORAL_DRESSING_FIELD,
        label: DRESSING_LABEL[FLORAL_DRESSING_FIELD],
      });
    } else {
      for (const k of ATTIRE_PALETTE_KEYS) {
        out.push({ domain, kind: 'palette', key: k, label: PALETTE_LIMITS[k].label });
      }
    }
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   4 · THE LOG — how one change reads
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * One `event_colour_changes` row, as every surface reads it.
 *
 * Deliberately the DB column names: this shape is what the query returns, and
 * renaming on the way in is how a field quietly stops being read.
 */
export type ColourChangeRow = {
  change_id: string;
  domain: string;
  target_kind: string;
  target_key: string;
  target_index: number | null;
  old_value: string | null;
  new_value: string;
  actor_kind: string;
  actor_label: string | null;
  vendor_id: string | null;
  created_at: string;
  reverted_at: string | null;
};

/**
 * The log line — "Main colour #2 — #C9A227 → #6E4B26".
 *
 * 🔑 THE PROTOTYPE PRINTS COLOUR NAMES ("Antique Rose → Dusty Rose") AND THIS
 * PRINTS HEX. There is no colour-naming call on this path: `lib/color-space.ts`
 * names a colour, but it is a server-reachable module and this line is rendered
 * in a client component beside the swatch itself. A wrong name next to the
 * right swatch is worse than the hex — the couple would be told a colour
 * changed to something it did not. Naming them here is a real follow-up, not a
 * thing to fake.
 */
export function describeColourChange(
  row: Pick<ColourChangeRow, 'target_kind' | 'target_key' | 'target_index' | 'old_value' | 'new_value'>,
): { what: string; from: string | null; to: string } {
  const what =
    row.target_kind === 'palette'
      ? paletteTargetLabel(row.target_key, row.target_index)
      : DRESSING_LABEL[row.target_key as keyof RoomDressing] ?? row.target_key;
  return { what, from: row.old_value, to: row.new_value };
}

function paletteTargetLabel(key: string, index: number | null): string {
  const limits = PALETTE_LIMITS[key as PaletteKey];
  if (!limits) return key;
  if (index === null) return limits.label;
  // The five majors have their own per-slot names ("Dominant", "Accent 2");
  // every other role is just "#n of the bridesmaids' colours".
  const slot = limits.slotLabels?.[index];
  return slot ? `${limits.label} · ${slot}` : `${limits.label} #${index + 1}`;
}

/** The domain chip printed on a coordinator's log row — "Reception decor". */
export function domainLabelOf(domain: string): string {
  return isColourDomain(domain) ? COLOUR_DOMAIN_LABEL[domain] : domain;
}

/* ══════════════════════════════════════════════════════════════════════════
   5 · WHAT THE HOLDER SEES — the editable swatches, expanded
   ══════════════════════════════════════════════════════════════════════════ */

/** One swatch a grant holder may change: where it lives and what it is now. */
export type EditableSwatch = ColourTarget & {
  /** 0-based slot inside a palette list; null for a room-dressing field. */
  index: number | null;
  /** The colour ON SCREEN right now — resolved, so a derived dressing field
   *  shows the colour it is actually painting rather than a blank. */
  current: string;
};

/**
 * Expand a lane into the individual swatches its holder may change.
 *
 * ⚠ A PALETTE ROLE EXPANDS TO THE SLOTS IT ALREADY HAS, AND NO FURTHER.
 * `apply_colour_change` refuses an index that holds no colour — a role's LENGTH
 * is the couple's own decision, and letting a supplier add a sixth colour to
 * the entourage would be an edit to the design, not to a colour. So a role with
 * no colours at all contributes NOTHING here, which is the same answer the
 * database gives.
 *
 * ⚠ AND A ROOM-DRESSING FIELD ALWAYS APPEARS, even with no override saved.
 * `resolveRoomDressing` derives one from the majors, so there is always a
 * colour on screen to change — and `old_value` for that first change is
 * recorded as NULL, so rejecting it puts the field back to FOLLOWING the
 * majors rather than pinning it to whatever they happened to be that day.
 */
export function editableSwatches(
  domains: readonly ColourDomain[],
  palette: RolePalette,
): EditableSwatch[] {
  const dressing = resolveRoomDressing(palette);
  const out: EditableSwatch[] = [];
  for (const target of targetsForDomains(domains)) {
    if (target.kind === 'room_dressing') {
      const current = dressing[target.key as keyof RoomDressing];
      if (!current) continue;
      out.push({ ...target, index: null, current });
      continue;
    }
    const colours = palette[target.key as PaletteKey] ?? [];
    colours.forEach((colour, index) => {
      out.push({
        ...target,
        index,
        current: colour,
        label: slotLabel(target.key, target.label, index),
      });
    });
  }
  return out;
}

function slotLabel(key: string, base: string, index: number): string {
  const named = PALETTE_LIMITS[key as PaletteKey]?.slotLabels?.[index];
  return named ? `${base} · ${named}` : `${base} #${index + 1}`;
}
