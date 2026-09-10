/**
 * The RENDERABLE PART REGISTRY for Mood Board section 04, "Make it real".
 *
 * Owner, 2026-09-03: *"make it real is not just 4, it can grow? … they can
 * render each one or … a more expensive render to see the whole look in one
 * photo."* — so a render is addressed to a PART, and the whole look is one more
 * part that happens to cost five credits instead of one.
 *
 * ── EVERY PART IS DERIVED. NOTHING HERE IS HAND-LISTED. ────────────────────
 * The decision row that defines this says the parts were *"taken from the
 * shipped data model rather than invented"*, and that is the load-bearing part
 * of it, not the count. Three shipped sources, read at module load:
 *
 *   ROOM    ← `RECEPTION_PARTS` (lib/reception-scene.ts) minus `people`.
 *             `people` is a modifier on the room, not a place in it — it is the
 *             part that carries attire colours rather than treatments, and the
 *             PEOPLE group below is where those live.
 *   PEOPLE  ← the `PaletteKey` ATTIRE roles: `PALETTE_ORDER` filtered to
 *             `PALETTE_LIMITS[k].family !== 'venue'`, minus the four
 *             wedding-party FINE keys (`isWeddingPartyFineKey`). Those four are
 *             documented refinements that FALL BACK to `wedding_party`; giving
 *             each its own render would produce five near-identical photographs
 *             of one entourage.
 *   PLACES  ← the inspiration slot keys (`MOODBOARD_SLOT_KEYS`) that are not
 *             already a ROOM zone, not already a PEOPLE role, and are a place
 *             at all. See SLOT_ROLE below, which is exhaustive BY TYPE.
 *
 * 🔑 WHY DERIVATION, AND NOT A LIST OF TWENTY STRINGS. A hand-list goes stale
 * the first time a zone is added — and it goes stale SILENTLY: the couple
 * designs the new zone, section 04 simply never offers to render it, and
 * nothing anywhere is red. This repo has shipped that exact class of bug more
 * than once. Add a zone to `RECEPTION_PARTS`, an attire role to
 * `PALETTE_ORDER`, or a slot to `MOODBOARD_SLOT_KEYS`, and it appears here with
 * no edit to this file — except a new slot key, which is a COMPILE ERROR until
 * somebody says what kind of thing it is (see SLOT_ROLE).
 *
 * ── WHAT THIS MODULE IS NOT ────────────────────────────────────────────────
 * It does NOT decide what section 04 shows. Twenty empty boxes is the flooding
 * the owner has objected to repeatedly; 04 shows only parts the couple has
 * actually DESIGNED — a zone with chosen treatments, a role with set colours, a
 * filled inspiration slot — with the rest behind one quiet chooser. That
 * filter reads live event state and belongs to MB7, not here. This registry is
 * the vocabulary; the surface is the editing.
 *
 * It also carries NO PRICE and NO CREDIT COST. Credits per part and per whole
 * look live in `moodboard_render_config` (admin-editable, migration
 * `20271199871696`), and the peso price of the pack lives in
 * `platform_retail_catalog_v2` and nowhere else.
 *
 * Pure + DOM-free + no Supabase import, so it runs in a server action, a client
 * component and a `tsx --test` unit test identically.
 */

import { RECEPTION_PARTS, type PartId } from './reception-scene';
import {
  PALETTE_LIMITS,
  PALETTE_ORDER,
  isWeddingPartyFineKey,
  type PaletteKey,
} from './mood-board';
import { MOODBOARD_SLOT_KEYS, type MoodboardSlotKey } from './moodboard-slots';

export type RenderPartGroup = 'room' | 'people' | 'places';

/**
 * A part a couple can spend credits to see photographed.
 *
 * `id` is what lands in `event_renders.part_id` and what MB9 keys its cache on
 * alongside the config digest. It is NAMESPACED because the three sources
 * genuinely collide: `bride` is both a `PaletteKey` and an inspiration slot,
 * `ceiling` is both a `RECEPTION_PARTS` zone and an inspiration slot. An
 * un-namespaced id would silently merge two different pictures.
 */
export type RenderPart = {
  /** `room:<zone>` · `people:<role>` · `place:<slot>` — see RENDER_PART_ID_PATTERN. */
  id: string;
  /** Human label. Taken from the source, never re-typed. */
  label: string;
  group: RenderPartGroup;
  /** Which shipped list this part came out of. */
  source: 'reception_part' | 'palette_role' | 'inspiration_slot';
  /** The key in that list. `room:ceiling` → `ceiling`; `people:guest` → `guest`. */
  sourceKey: string;
};

/**
 * The combined image — every part in one photograph, five credits.
 *
 * Deliberately NOT in `RENDER_PARTS`: it is not a part, it is all of them, and
 * treating it as one more row would let it be filtered out by "show only what
 * the couple designed" exactly when it is most worth offering. It is also the
 * hero of the pricing — twenty parts singly costs twenty credits, the whole
 * look costs five — so it must never be reachable only through a chooser.
 */
export const WHOLE_LOOK_PART_ID = 'whole_look';

/**
 * The shape `event_renders.part_id` must match. Mirrors the CHECK constraint in
 * migration `20271200273322_moodboard_event_renders.sql`, which constrains the
 * SHAPE and not the list for the same reason this file derives rather than
 * enumerates. `moodboard-render-parts.test.ts` asserts every generated id
 * matches, so the two cannot drift apart without going red.
 */
export const RENDER_PART_ID_PATTERN = /^(?:whole_look|(?:room|people|place):[a-z0-9_]+)$/;

/**
 * The one `RECEPTION_PARTS` entry that is not a room ZONE.
 *
 * `people` carries `RoleColors` — who is standing in the room — rather than
 * treatments applied to a surface. Its render identities are the PEOPLE group,
 * derived from the attire palettes, so including it here would give the same
 * subject two ids.
 */
const RECEPTION_PART_NOT_A_ZONE: PartId = 'people';

/**
 * What kind of thing each inspiration slot is.
 *
 * 🔑 THIS RECORD IS THE ANTI-STALENESS DEVICE, AND IT WORKS BY TYPE.
 * `Record<MoodboardSlotKey, …>` means a slot added to `MOODBOARD_SLOT_KEYS`
 * fails `tsc` here until somebody classifies it. The alternative — a filter
 * with a hard-coded exclusion list — would silently swallow the new slot, and
 * "silently swallowed" is precisely the failure this registry exists to make
 * impossible.
 *
 * `alias_of_room` / `alias_of_people` are the slots that photograph something
 * the ROOM or PEOPLE group already owns; they contribute their reference
 * images to that part rather than a second part of their own. The alias
 * TARGETS are checked against the real `RECEPTION_PARTS` / `PALETTE_ORDER` at
 * module load, so a renamed zone throws instead of quietly dropping a part.
 */
type SlotRole =
  | { kind: 'place' }
  | { kind: 'alias_of_room'; partId: PartId }
  | { kind: 'alias_of_people'; paletteKey: PaletteKey }
  | { kind: 'not_a_part'; why: string };

const SLOT_ROLE: Record<MoodboardSlotKey, SlotRole> = {
  // ── places in their own right ──
  // `venue` is the CEREMONY venue and is NOT renamed (real rows carry that key
  // from onboarding Card 15); `reception_venue` is its counterpart.
  venue: { kind: 'place' },
  reception_venue: { kind: 'place' },
  flowers: { kind: 'place' },
  cocktail: { kind: 'place' },
  cake: { kind: 'place' },

  // ── the same subject as a room zone ──
  backdrop: { kind: 'alias_of_room', partId: 'backdrop' },
  tunnel: { kind: 'alias_of_room', partId: 'tunnel' },
  stage: { kind: 'alias_of_room', partId: 'stage' },
  ceiling: { kind: 'alias_of_room', partId: 'ceiling' },
  table: { kind: 'alias_of_room', partId: 'tables' },

  // ── the same subject as an attire role ──
  groom: { kind: 'alias_of_people', paletteKey: 'groom' },
  bride: { kind: 'alias_of_people', paletteKey: 'bride' },
  principal_sponsor: { kind: 'alias_of_people', paletteKey: 'principal_sponsors' },
  entourage: { kind: 'alias_of_people', paletteKey: 'wedding_party' },
  parents: { kind: 'alias_of_people', paletteKey: 'parents_immediate_family' },
  guests: { kind: 'alias_of_people', paletteKey: 'guest' },

  // ── not a part at all ──
  overall: {
    kind: 'not_a_part',
    why: 'the whole look — that is WHOLE_LOOK_PART_ID, the five-credit combined render',
  },
  palette: {
    kind: 'not_a_part',
    why: 'a colour source, not a place — it conditions every render rather than being one',
  },
};

/** Friendly labels for the place slots. Only the five `place` slots need one. */
const PLACE_LABELS: Partial<Record<MoodboardSlotKey, string>> = {
  venue: 'Ceremony venue',
  reception_venue: 'Reception venue',
  flowers: 'Flowers',
  cocktail: 'Cocktail hour',
  cake: 'Cake',
};

function buildRoomParts(): RenderPart[] {
  return RECEPTION_PARTS.filter((p) => p.id !== RECEPTION_PART_NOT_A_ZONE).map((p) => ({
    id: `room:${p.id}`,
    label: p.label,
    group: 'room' as const,
    source: 'reception_part' as const,
    sourceKey: p.id,
  }));
}

/** The `PaletteKey`s that dress a PERSON — everything in the order that is not a venue palette. */
export function attirePaletteKeys(): PaletteKey[] {
  return PALETTE_ORDER.filter(
    (k) => PALETTE_LIMITS[k].family !== 'venue' && !isWeddingPartyFineKey(k),
  );
}

function buildPeopleParts(): RenderPart[] {
  return attirePaletteKeys().map((k) => ({
    id: `people:${k}`,
    label: PALETTE_LIMITS[k].label,
    group: 'people' as const,
    source: 'palette_role' as const,
    sourceKey: k,
  }));
}

function buildPlaceParts(): RenderPart[] {
  const out: RenderPart[] = [];
  for (const slot of MOODBOARD_SLOT_KEYS) {
    const role = SLOT_ROLE[slot];
    if (role.kind !== 'place') continue;
    const label = PLACE_LABELS[slot];
    if (!label) {
      // Unreachable via the type system alone: a slot can be marked `place`
      // without gaining a label. Throw rather than fall back to the raw key —
      // a couple must never be shown `reception_venue`.
      throw new Error(`moodboard-render-parts: place slot "${slot}" has no label`);
    }
    out.push({
      id: `place:${slot}`,
      label,
      group: 'places',
      source: 'inspiration_slot',
      sourceKey: slot,
    });
  }
  return out;
}

/**
 * Every alias target must resolve to something that really exists, checked once
 * at module load. A renamed zone or a retired palette key would otherwise turn
 * an alias into a dangling pointer, and the visible symptom would be a slot's
 * reference photos quietly conditioning nothing.
 */
function assertAliasesResolve(): void {
  const zoneIds = new Set(RECEPTION_PARTS.map((p) => p.id));
  const attire = new Set<string>(attirePaletteKeys());
  for (const slot of MOODBOARD_SLOT_KEYS) {
    const role = SLOT_ROLE[slot];
    if (role.kind === 'alias_of_room' && !zoneIds.has(role.partId)) {
      throw new Error(
        `moodboard-render-parts: slot "${slot}" aliases room zone "${role.partId}", which is not in RECEPTION_PARTS`,
      );
    }
    if (role.kind === 'alias_of_people' && !attire.has(role.paletteKey)) {
      throw new Error(
        `moodboard-render-parts: slot "${slot}" aliases attire role "${role.paletteKey}", which is not an attire PaletteKey`,
      );
    }
  }
}

function buildRenderParts(): RenderPart[] {
  assertAliasesResolve();
  return [...buildRoomParts(), ...buildPeopleParts(), ...buildPlaceParts()];
}

/**
 * Every renderable part, in Room → People → Places order.
 *
 * Computed, never literal. If you are about to push a part into this array by
 * hand, you are about to make the list this module exists to abolish — add it
 * to `RECEPTION_PARTS`, `PALETTE_ORDER` or `MOODBOARD_SLOT_KEYS` instead, which
 * is where the app already reads it from.
 */
export const RENDER_PARTS: readonly RenderPart[] = Object.freeze(buildRenderParts());

const RENDER_PART_BY_ID: ReadonlyMap<string, RenderPart> = new Map(
  RENDER_PARTS.map((p) => [p.id, p]),
);

export function renderPartById(id: string): RenderPart | undefined {
  return RENDER_PART_BY_ID.get(id);
}

/** `whole_look` counts: it is a legal `event_renders.part_id`, just not a RenderPart. */
export function isRenderPartId(id: string): boolean {
  return id === WHOLE_LOOK_PART_ID || RENDER_PART_BY_ID.has(id);
}

export function renderPartsInGroup(group: RenderPartGroup): RenderPart[] {
  return RENDER_PARTS.filter((p) => p.group === group);
}

/**
 * Which inspiration slots supply reference photos for one part.
 *
 * A place part is fed by its own slot; a room zone or an attire role is fed by
 * every slot that aliases it. This is the join MB8 needs to decide which
 * uploads condition which render, and it is derived from SLOT_ROLE rather than
 * restated.
 */
export function inspirationSlotsForPart(partId: string): MoodboardSlotKey[] {
  const part = renderPartById(partId);
  if (!part) return [];
  const out: MoodboardSlotKey[] = [];
  for (const slot of MOODBOARD_SLOT_KEYS) {
    const role = SLOT_ROLE[slot];
    if (role.kind === 'place' && part.source === 'inspiration_slot' && slot === part.sourceKey) {
      out.push(slot);
    } else if (
      role.kind === 'alias_of_room' &&
      part.source === 'reception_part' &&
      role.partId === part.sourceKey
    ) {
      out.push(slot);
    } else if (
      role.kind === 'alias_of_people' &&
      part.source === 'palette_role' &&
      role.paletteKey === part.sourceKey
    ) {
      out.push(slot);
    }
  }
  return out;
}

/**
 * The admin-editable render parameters, as the app sees them.
 *
 * Shape of one `moodboard_render_config` row. There is deliberately no default
 * object here: a caller that cannot read the row must say so, not substitute a
 * guess — "1 credit" quietly assumed while the owner has moved it to 2 is a
 * charge nobody authorised. And the peso price is NOT in this shape at all;
 * `packServiceCode` points at `platform_retail_catalog_v2`, which is the only
 * place a customer price exists.
 */
export type MoodboardRenderConfig = {
  creditsPerPart: number;
  creditsWholeLook: number;
  creditsPerPack: number;
  packServiceCode: string;
  maxNoteChars: number;
  isActive: boolean;
};

/** What one render of `partId` costs, in credits, given the live config row. */
export function creditsForPart(partId: string, config: MoodboardRenderConfig): number {
  return partId === WHOLE_LOOK_PART_ID ? config.creditsWholeLook : config.creditsPerPart;
}
