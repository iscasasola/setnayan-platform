/**
 * Pure derivation logic for Mood Board section 04, "Make it real" (MB7).
 *
 * Everything here is DOM-free and Supabase-free — it takes the same three
 * pieces of state the rest of the board already reads (`role_palette`,
 * `reception_design`, which inspiration slots hold a photo) and derives what
 * section 04 shows. Nothing in this file stores a second copy of a fact the
 * app already has.
 *
 * 🔑 THE LOAD-BEARING RULE (MB7.md): the "what your render already knows"
 * panel must read the SAME selection state `buildPrompt()` reads
 * (`lib/reception-scene.ts`), or the panel and the eventual render disagree
 * about what was designed. `designRevisionKey` below is built from exactly
 * the three arguments `buildPrompt(design, palette, roleColors, venue)`
 * closes over — `receptionDesign`, `palette.reception`, and the venue
 * setting — so a caller that threads the same props to both can never let
 * them drift.
 *
 * 🔑 THE SECOND LOAD-BEARING RULE: nothing here hand-lists a part, a zone or
 * an attire role. `gridParts` takes `RENDER_PARTS` (or a caller-filtered
 * subset of it) as an argument — it is derived from `RECEPTION_PARTS` /
 * `PALETTE_ORDER` / `MOODBOARD_SLOT_KEYS` in `moodboard-render-parts.ts` — so
 * a new zone or attire role reaches this module and the tiles it drives with
 * no edit here. See `moodboard-make-it-real.test.ts`.
 */

import {
  RECEPTION_PARTS,
  optionIds,
  venueZoneApplies,
  type PartId,
  type ReceptionDesign,
} from './reception-scene';
import { type PaletteKey, type RolePalette } from './mood-board';
import {
  inspirationSlotsForPart,
  type RenderPart,
} from './moodboard-render-parts';
import { type MoodboardSlotKey } from './moodboard-slots';

/**
 * The inspiration slot keys that currently hold at least one photo.
 *
 * `ReadonlySet<string>`, not `ReadonlySet<MoodboardSlotKey>` — this crosses
 * the server/client boundary as plain strings read from
 * `event_inspiration_assets.slot_key`, and narrowing the type here would
 * force every real caller into an unsound cast rather than catch anything:
 * membership (`.has(slotKey)`) is checked with a real `MoodboardSlotKey` on
 * the other side regardless of how this set is typed.
 */
export type InspirationPresence = ReadonlySet<string>;

export type DesignContext = {
  palette: RolePalette;
  receptionDesign: ReceptionDesign;
  inspirationPresence: InspirationPresence;
  /** `events.venue_setting`. A room zone the venue does not have (a beach's
   *  ceiling, a garden's walls) is never "designed" and never eligible here —
   *  see `venueZoneApplies` (reception-scene.ts), the single predicate every
   *  gate in this module and the SVG drawing share. */
  venueSetting?: string | null;
};

/**
 * `eligibleParts`, with any ROOM part the venue does not have removed.
 * Apply this to the caller-supplied `RENDER_PARTS` subset BEFORE it reaches
 * `gridParts` — a part filtered out here can never be shown, suggested, or
 * offered in the chooser, and never contributes a brief line, which is what
 * "excluded from the render brief, not just hidden" means in practice.
 * People/place parts are untouched — only a `room` part can be venue-gated.
 */
export function eligiblePartsForVenue(
  parts: readonly RenderPart[],
  venueSetting: string | null | undefined,
): RenderPart[] {
  return parts.filter(
    (p) => p.group !== 'room' || venueZoneApplies(venueSetting, p.sourceKey as PartId),
  );
}

// ── colour source ────────────────────────────────────────────────────────
//
// A ROOM or PLACE part is conditioned on the reception palette — the same
// `palette` argument `buildPrompt` takes. A PEOPLE part is conditioned on
// that role's own attire colours. There is no third source: `moodboard-
// render-parts.ts` only ever produces these two groups plus `places`, which
// reads the room palette too (a cocktail area or a cake table is still part
// of the reception's own colour story).

export function colorsForPart(part: RenderPart, palette: RolePalette): string[] {
  if (part.group === 'people') {
    return (palette[part.sourceKey as PaletteKey] ?? []).filter(Boolean);
  }
  return (palette.reception ?? []).filter(Boolean);
}

export function colorsForWholeLook(palette: RolePalette): string[] {
  return (palette.reception ?? []).filter(Boolean);
}

// ── "designed" — read, never stored ─────────────────────────────────────
//
// A part earns its tile once the couple has actually put something into it:
// a room zone moved off "nothing chosen" (`optionIds(...).length > 0` — an
// unanswered attribute holds no ids at all, only `selAll`'s fallback fills
// one in, so this is the one honest read of "did the couple touch this"), an
// attire role with any colour set, or an inspiration photo tagged to one of
// this part's own slots.

function roomZoneDesigned(
  partId: PartId,
  design: ReceptionDesign,
  venueSetting: string | null | undefined,
): boolean {
  // A zone the venue does not have is never "designed" — even if a choice
  // from before the couple switched venues is still sitting in storage. The
  // second (belt-and-suspenders) enforcement of the same rule
  // `eligiblePartsForVenue` applies upstream; a caller that forgot to
  // pre-filter still cannot show a stale beach ceiling as a live tile.
  if (!venueZoneApplies(venueSetting, partId)) return false;
  const attrs = design[partId];
  if (!attrs) return false;
  return Object.values(attrs).some((v) => optionIds(v).length > 0);
}

export function isPartDesigned(part: RenderPart, ctx: DesignContext): boolean {
  if (
    part.group === 'room' &&
    roomZoneDesigned(part.sourceKey as PartId, ctx.receptionDesign, ctx.venueSetting)
  ) {
    return true;
  }
  if (part.group === 'people' && (ctx.palette[part.sourceKey as PaletteKey]?.length ?? 0) > 0) {
    return true;
  }
  return inspirationSlotsForPart(part.id).some((slot) => ctx.inspirationPresence.has(slot));
}

// ── render gate ───────────────────────────────────────────────────────────
//
// A render — free library match aside — needs BOTH a reference photo and a
// deliberately-chosen colour (owner, 2026-09-03). A part with no inspiration
// category of its own reads the "overall vibe" slot as its reference, same
// as `isDesigned` does NOT do (a generic vibe photo alone doesn't make one
// specific part "designed", but it is enough to condition a render of it).

function inspirationKeysOrOverall(part: RenderPart): MoodboardSlotKey[] {
  const slots = inspirationSlotsForPart(part.id);
  return slots.length > 0 ? slots : ['overall'];
}

export type RenderGate = { ok: boolean; needColor: boolean; needPhoto: boolean };

export function renderGateForPart(
  part: RenderPart,
  ctx: Pick<DesignContext, 'palette' | 'inspirationPresence'>,
): RenderGate {
  const needColor = colorsForPart(part, ctx.palette).length === 0;
  const needPhoto = !inspirationKeysOrOverall(part).some((s) => ctx.inspirationPresence.has(s));
  return { ok: !needColor && !needPhoto, needColor, needPhoto };
}

export function renderGateForWholeLook(
  ctx: Pick<DesignContext, 'palette' | 'inspirationPresence'>,
): RenderGate {
  const needColor = colorsForWholeLook(ctx.palette).length === 0;
  const needPhoto = ctx.inspirationPresence.size === 0;
  return { ok: !needColor && !needPhoto, needColor, needPhoto };
}

// ── the derived brief — plain language, never prompt text ─────────────────

export function briefColorLine(
  hexes: readonly string[],
  nameFor: (hex: string) => string | null,
): string {
  const names = [...new Set(hexes.map((h) => nameFor(h) ?? h))];
  return names.length ? `Your colours — ${names.join(' · ')}` : 'Your colours — none picked yet';
}

/**
 * One line per attribute of a reception zone — "Ceiling — Draped canopy +
 * Fairy lights". Returns `[]` for a zone the venue does not have — a beach
 * reception's brief never lines up a ceiling treatment, even one still
 * sitting in storage from before the venue changed.
 */
export function briefZoneLines(
  partId: PartId,
  design: ReceptionDesign,
  venueSetting?: string | null,
): string[] {
  if (!venueZoneApplies(venueSetting, partId)) return [];
  const part = RECEPTION_PARTS.find((p) => p.id === partId);
  if (!part) return [];
  return part.attributes.map((a) => {
    const labels = optionIds(design[partId]?.[a.id])
      .map((id) => a.options.find((o) => o.id === id)?.label)
      .filter((l): l is string => Boolean(l));
    return `${a.label} — ${labels.length ? labels.join(' + ') : 'not chosen yet'}`;
  });
}

/** Every reception zone's lines, room only (People is a modifier, not a treatment). */
export function briefWholeLookZoneLines(
  design: ReceptionDesign,
  venueSetting?: string | null,
): string[] {
  return RECEPTION_PARTS.filter((p) => p.id !== 'people').flatMap((p) =>
    briefZoneLines(p.id, design, venueSetting),
  );
}

/**
 * The reference-photo count a part's brief can honestly cite — derived from
 * the same slot list the render gate reads, never a hand-typed "1 photo".
 */
export function referencePhotoCount(part: RenderPart, presence: InspirationPresence): number {
  return inspirationKeysOrOverall(part).filter((s) => presence.has(s)).length;
}

// ── staleness — the same state buildPrompt() reads, nothing narrower ──────
//
// One global revision key, not a per-part one: the prototype this ports
// bumps its `designRev` counter on ANY palette, reception or venue change
// (`designRev++` fires from the palette editor, the reception editor and the
// venue correction alike), so every tile — including a Bride tile that has
// nothing to do with the ceiling — goes stale the moment the room changes.
// Recomputed fresh from the live props on every render rather than an
// incrementing counter, so there is no separate value to forget to bump.

export function designRevisionKey(
  palette: RolePalette,
  receptionDesign: ReceptionDesign,
  venueSetting: string | null,
): string {
  return JSON.stringify({
    reception: palette.reception ?? [],
    attire: Object.fromEntries(
      Object.entries(palette)
        .filter(([k]) => k !== 'reception' && k !== 'room_dressing' && k !== 'custom_roles')
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    design: receptionDesign,
    venue: venueSetting,
  });
}

// ── which tiles show ────────────────────────────────────────────────────
//
// Never twenty empty boxes: the couple's own parts (designed, chooser-added,
// or already carrying work) lead — never truncated — topped up to a
// four-tile floor with SUGGESTED showcase parts. `eligibleParts` is supplied
// by the caller (RENDER_PARTS, filtered to attire roles actually present in
// the guest list) so this function never decides eligibility itself.

export const SHOWCASE_PART_IDS: readonly string[] = [
  'room:backdrop',
  'room:tables',
  'people:bride',
  'room:ceiling',
  'room:tunnel',
  'place:flowers',
];

export const MIN_PART_TILES = 4;

/** Ephemeral, per-part UI state the caller tracks (React state, MB7 — nothing here is persisted). */
export type PartWorkState = {
  /** Pulled in via the "Render another part" chooser. */
  added?: boolean;
  /** A render, a lock, a keep, a note, or an open brief — the tile stays even if the underlying design reverts. */
  hasWork?: boolean;
  /** A render, a lock, a keep, or a note — NOT merely an open brief. Governs the "Suggested" badge only. */
  committed?: boolean;
};

function isVisible(
  part: RenderPart,
  ctx: DesignContext,
  work: ReadonlyMap<string, PartWorkState>,
): boolean {
  const w = work.get(part.id);
  return isPartDesigned(part, ctx) || !!w?.added || !!w?.hasWork;
}

function isSuggestion(
  part: RenderPart,
  ctx: DesignContext,
  work: ReadonlyMap<string, PartWorkState>,
  dismissed: ReadonlySet<string>,
): boolean {
  const w = work.get(part.id);
  return (
    SHOWCASE_PART_IDS.includes(part.id) &&
    !dismissed.has(part.id) &&
    !isPartDesigned(part, ctx) &&
    !w?.added &&
    !w?.committed
  );
}

export function gridParts(
  eligibleParts: readonly RenderPart[],
  ctx: DesignContext,
  work: ReadonlyMap<string, PartWorkState>,
  dismissedSuggestions: ReadonlySet<string>,
): { own: RenderPart[]; suggested: RenderPart[] } {
  const visibleParts = eligibleParts.filter((p) => isVisible(p, ctx, work));
  const own = visibleParts.filter((p) => !isSuggestion(p, ctx, work, dismissedSuggestions));
  const mustShow = new Set(visibleParts.map((p) => p.id));
  const suggested: RenderPart[] = [];
  for (const id of SHOWCASE_PART_IDS) {
    if (own.some((o) => o.id === id) || dismissedSuggestions.has(id)) continue;
    if (!mustShow.has(id) && own.length + suggested.length >= MIN_PART_TILES) continue;
    const p = eligibleParts.find((r) => r.id === id);
    if (p) suggested.push(p);
  }
  return { own, suggested };
}

// ── the tile view-model ─────────────────────────────────────────────────
//
// Lock / Keep / stale marking are UI STATE ONLY (MB7.md) — nothing here is
// persisted, and NO credit reserve is ever called (that is MB8's job, once a
// provider call exists to spend one on). `PartRenderState` is exactly what a
// caller keeps in React state per tile.
//
// `buildTileViewModel` exists so "does the stale marker reach the RENDER" is
// something a plain unit test can prove without a render harness (this repo
// has none — see scripts/port-controls.mjs's own docblock): the component is
// a thin renderer of this object, so `moodboard-make-it-real.test.ts` can
// assert `staleBannerText` is populated exactly when generated art is stale,
// and a source guard on the component can assert that field is the thing
// actually printed.

export type GeneratedRender = {
  /** The `designRevisionKey` the couple's board carried at generation time. */
  revisionKey: string;
  hexes: string[];
  note?: string;
  whole?: boolean;
};

export type PartRenderState = {
  generated: GeneratedRender | null;
  locked: boolean;
  kept: boolean;
  note: string;
  briefOpen: boolean;
};

export const EMPTY_PART_STATE: PartRenderState = {
  generated: null,
  locked: false,
  kept: false,
  note: '',
  briefOpen: false,
};

export type TileViewModel = {
  id: string;
  label: string;
  cost: number;
  costLabel: string;
  hexes: string[];
  hasColor: boolean;
  /** "Free preview" · "No colours yet" · "✦ Photoreal — simulated" (never a real image — MB8). */
  tag: string;
  isStale: boolean;
  /** Non-null exactly when `isStale` — the one thing the tile must show for a stale render. */
  staleBannerText: string | null;
  gate: RenderGate;
  briefLines: string[];
};

export function buildTileViewModel(args: {
  id: string;
  label: string;
  cost: number;
  hexes: string[];
  gate: RenderGate;
  briefLines: string[];
  state: PartRenderState;
  currentRevisionKey: string;
}): TileViewModel {
  const { id, label, cost, hexes, gate, briefLines, state, currentRevisionKey } = args;
  const hasColor = hexes.length > 0;
  const gen = state.generated;
  const isStale = !!gen && gen.revisionKey !== currentRevisionKey;
  const tag = gen ? '✦ Photoreal — simulated' : hasColor ? 'Free preview' : 'No colours yet';
  return {
    id,
    label,
    cost,
    costLabel: `${cost} credit${cost === 1 ? '' : 's'}`,
    hexes,
    hasColor,
    tag,
    isStale,
    staleBannerText: isStale ? '⟳ Generated before your latest changes' : null,
    gate,
    briefLines,
  };
}
