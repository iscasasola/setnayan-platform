/**
 * lib/supplier-suggest-board.ts — 🤝🖼 THE BOOKED SUPPLIER'S VIEW OF THE COUPLE'S PALETTE (owner 2026-10-19; prototype
 * `supplier_inspiration_suggestions_2026-10-19.html` frame 1: *"Same list the couple sees, their own parts first. Only
 * the Flowers blocks carry '＋ Suggest a photo' … The Room and Cake are plainly 'For their stylist' / 'For their cake
 * maker' — look, not add."*).
 *
 * 🔑 THE COUPLE'S OWN LIST, NOT A SECOND ONE: the five main colours, then the room / flowers / cake parts exactly as the
 * couple's one-list Palette draws them (`ROOM_LANE_PARTS` · `FLORIST_LANE_PARTS` · `CAKE_LANE_PARTS`, each part's colour
 * from `lanePartColour`, its photos from its board — `paletteBoardOf`), then the Attire boards for a shop that makes
 * attire. WHICH blocks carry "Suggest a photo" is handed in (`suggestable`, from `suggestablePartsForShop` — the one
 * slot→trade map) and nothing here widens it.
 *
 * Pure and client-safe: the vendor page and the dev lab build the same board from it.
 */
import { CAKE_LANE_PARTS, FLORIST_LANE_PARTS, MAIN_COLOUR_SLOTS, ROOM_LANE_PARTS, lanePartColour, type LanePart } from './colour-access';
import { MAIN_PALETTE_BOARD, STUDIO_INSPIRATION_SLOTS, paletteBoardOf, type PhotoPartGroup } from './inspiration-slots';
import { nearestColorName } from './color-names';
import type { RolePalette } from './mood-board';

export type BoardPart = {
  slotKey: string;
  label: string;
  /** "Follows Dominant" / "Set by the couple" — absent on an attire board (it has no colour of its own here). */
  line: string | null;
  colour: { hex: string; name: string | null } | null;
  /** The couple's photos on it, in place order. */
  photos: string[];
  /** May THIS shop suggest a photo to it (the one slot→trade map). */
  canSuggest: boolean;
};

export type BoardLane = {
  key: Exclude<PhotoPartGroup, 'main' | 'more'>;
  /** "Flowers — yours to add to" · "The room — for their stylist". */
  title: string;
  /** Nothing in it is this shop's — "Look only". */
  lookOnly: boolean;
  parts: BoardPart[];
};

export type SupplierBoard = {
  five: Array<{ slot: string; hex: string; name: string | null }>;
  /** Venue & decor — the photos under the five, offered only to a shop that dresses the whole room. */
  main: BoardPart;
  lanes: BoardLane[];
};

/** The lane's name in the supplier's words — whose it is, when it is not this shop's. */
const LANE: Record<BoardLane['key'], { name: string; whose: string }> = {
  room: { name: 'The room', whose: 'for their stylist' },
  flowers: { name: 'Flowers', whose: 'for their florist' },
  cake: { name: 'Cake', whose: 'for their cake maker' },
  attire: { name: 'Attire', whose: 'for their attire makers' },
};

export function buildSupplierBoard(input: {
  palette: RolePalette;
  five: readonly string[];
  /** The couple's photos by board: slot_key → urls by place (1–3). */
  photosBySlot: Readonly<Record<string, ReadonlyArray<string | undefined>>>;
  suggestable: ReadonlySet<string>;
}): SupplierBoard {
  const { palette, five, photosBySlot, suggestable } = input;
  const photos = (slot: string) => (photosBySlot[slot] ?? []).filter((u): u is string => typeof u === 'string' && u.length > 0);
  const partOf = (p: LanePart): BoardPart | null => {
    const board = paletteBoardOf(p.field);
    if (!board) return null;
    const c = lanePartColour(p, five, palette);
    return {
      slotKey: board.slotKey,
      label: p.label,
      line: c.setByYou ? 'Set by the couple' : `Follows ${c.followsLabel}`,
      colour: { hex: c.hex, name: nearestColorName(c.hex) },
      photos: photos(board.slotKey),
      canSuggest: suggestable.has(board.slotKey),
    };
  };
  const lane = (key: BoardLane['key'], parts: BoardPart[]): BoardLane => {
    const mine = parts.filter((p) => p.canSuggest).length;
    const l = LANE[key];
    return { key, title: `${l.name} — ${mine === parts.length && mine > 0 ? 'yours to add to' : l.whose}`, lookOnly: mine === 0, parts };
  };
  const drop = (x: BoardPart | null): x is BoardPart => x !== null;
  const attire = STUDIO_INSPIRATION_SLOTS.filter((s) => s.attire).map(
    (s): BoardPart => ({ slotKey: s.slotKey, label: s.label, line: null, colour: null, photos: photos(s.slotKey), canSuggest: suggestable.has(s.slotKey) }),
  );
  const lanes = [
    lane('room', ROOM_LANE_PARTS.map(partOf).filter(drop)),
    lane('flowers', FLORIST_LANE_PARTS.map(partOf).filter(drop)),
    lane('cake', CAKE_LANE_PARTS.map(partOf).filter(drop)),
    /* The attire boards only for a shop that makes attire — a florist's page has no business listing six gowns. */
    ...(attire.some((p) => p.canSuggest) ? [lane('attire', attire)] : []),
  ];
  /* Their own parts first (prototype frame 1): a lane that is wholly theirs, then one they share, then "Look only" —
     each group in the couple's order. */
  const own = (l: BoardLane) => l.parts.filter((p) => p.canSuggest).length;
  const rank = (l: BoardLane) => (l.lookOnly ? 2 : own(l) === l.parts.length ? 0 : 1);
  const ordered = [...lanes].sort((a, b) => rank(a) - rank(b));
  return {
    five: five.slice(0, 5).map((hex, i) => ({ slot: MAIN_COLOUR_SLOTS[i] ?? '', hex, name: nearestColorName(hex) })),
    main: {
      slotKey: MAIN_PALETTE_BOARD,
      label: STUDIO_INSPIRATION_SLOTS.find((s) => s.slotKey === MAIN_PALETTE_BOARD)?.label ?? 'Venue & decor',
      line: null,
      colour: null,
      photos: photos(MAIN_PALETTE_BOARD),
      canSuggest: suggestable.has(MAIN_PALETTE_BOARD),
    },
    lanes: ordered,
  };
}

/** The lanes this shop may add to, in the board's order, as the role line says them ("Flowers and the room"). */
export function ownLaneWords(board: SupplierBoard): string[] {
  const words = board.lanes.filter((l) => !l.lookOnly).map((l) => (l.key === 'room' ? 'the room' : LANE[l.key].name));
  return board.main.canSuggest ? [...words, board.main.label] : words;
}

/** The first part this shop may add to, in the board's order — whose trade names the shop in the role line. */
export function firstOwnPart(board: SupplierBoard): string | null {
  for (const l of board.lanes) for (const p of l.parts) if (p.canSuggest) return p.slotKey;
  return board.main.canSuggest ? board.main.slotKey : null;
}
