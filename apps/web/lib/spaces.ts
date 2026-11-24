/**
 * 🏛 SPACES — a shop's halls, rooms and the things it rents out, set once (owner 19 Nov 2026; build drawing specs
 * `prototypes/spaces_final_screens_2026-11-19.html`; rulings DECISION_LOG 2026-11-19 "Spaces on the Shop" → "SHOP PAGE
 * FINAL + SPACES COMBINED WITH ROOMS & SEATING").
 *
 * A space IS a schedule pool with a kind (`vendor_schedule_pools.space_kind`, migration 20271356372536): the shipped
 * Uses pick, the booking path's seat per pool and the day's halls view (`lib/vendor-halls.ts`) serve it unchanged.
 *   · Booked whole (one booking a day): hall · room · cart · vehicle · item ("Others").
 *   · Counted (a number, never one booking a day): object · clothing.
 * Names: the generic label by kind below Pro (Hall001 · Room001 · Cart001 …, `nextGenericNames` in the shared engine);
 * Pro and up type their own, and rooms number by floor (201 … 212) or letters (2A, 2B …).
 *
 * Pure: no React, no database. 🔒 lib/spaces.test.ts
 */
import { duplicateNames, floorName, nextGenericNames, roomNamesOnFloor, type RoomNaming, type SpaceKind } from '@/lib/seat-plan-engine';
import { hallGuests, hallsOnDay, type Hall, type HallBlock, type HallBooking } from '@/lib/vendor-halls';

export type { SpaceKind, RoomNaming };

export const SPACE_KINDS: readonly SpaceKind[] = ['hall', 'room', 'cart', 'clothing', 'object', 'vehicle', 'item'];
export function isSpaceKind(v: unknown): v is SpaceKind {
  return typeof v === 'string' && (SPACE_KINDS as readonly string[]).includes(v);
}

/** Booked whole (a card takes it for the day) — the pool is `is_hall`. Objects and clothing are counted instead. */
export function bookedWhole(kind: SpaceKind): boolean {
  return kind !== 'object' && kind !== 'clothing';
}

/** The ＋ menu's six kinds, the drawing's order and words (screen 3). "Halls and rooms" is one choice. */
export type KindChoice = 'hall' | 'cart' | 'clothing' | 'object' | 'vehicle' | 'item';
export const KIND_MENU: ReadonlyArray<{ key: KindChoice; label: string; hint: string }> = [
  { key: 'hall', label: 'Halls and rooms', hint: 'Dimensions · seated · standing' },
  { key: 'cart', label: 'Carts', hint: 'One of a kind · space · power' },
  { key: 'clothing', label: 'Clothing', hint: 'Type · colour · sizes' },
  { key: 'object', label: 'Objects', hint: 'Tables, chairs, sound · one or hundreds' },
  { key: 'vehicle', label: 'Vehicles', hint: 'Seats · with a driver' },
  { key: 'item', label: 'Others', hint: 'A name, how many, a photo' },
];
/** The Show filter (sliders): All, then the six kinds. */
export const SHOW_CHOICES: ReadonlyArray<{ key: 'all' | KindChoice; label: string }> = [{ key: 'all', label: 'All' }, ...KIND_MENU.map((k) => ({ key: k.key, label: k.label }))];
export function choiceOf(kind: SpaceKind): KindChoice {
  return kind === 'room' ? 'hall' : kind;
}

/** One word for one space of a kind ("Add the cart", "New vehicle"). */
export const KIND_WORD: Record<SpaceKind, string> = {
  hall: 'hall',
  room: 'room',
  cart: 'cart',
  clothing: 'clothing',
  object: 'object',
  vehicle: 'vehicle',
  item: 'item',
};
/** The sheet's one line under its title (screens 4–5). */
export const KIND_LINE: Record<SpaceKind, string> = {
  hall: 'Free on every plan. Join halls on a card to sell a bigger one.',
  room: 'One type, numbered for you.',
  cart: 'One of a kind. A card can use any free one.',
  clothing: 'Photos first. Colour follows.',
  object: 'One of a kind, or hundreds.',
  vehicle: 'Seats and a driver.',
  item: 'Anything else you rent out.',
};

/**
 * The kind's own rows, kept in `space_details` (never a person). Only the keys a kind uses are kept — anything else is
 * dropped on save, so one kind's rows never ride on another.
 */
export type SpaceDetails = {
  /** Clothing type · object / cart / vehicle / item type ("Gown", "Chairs", "Fries", "Bridal car", "Arch"). */
  type?: string;
  colour?: string;
  /** Clothing: how many of each size. */
  sizes?: Record<string, number>;
  /** Room: beds. Vehicle: seats. */
  beds?: number;
  seats?: number;
  driver?: boolean;
  needsPower?: boolean;
  withPerson?: boolean;
  /** Days held before and after an event (Out and back). */
  daysBefore?: number;
  daysAfter?: number;
  /** Clothing: days of cleaning before it goes out again. */
  cleaningDays?: number;
  fitting?: boolean;
};
const DETAIL_KEYS: Record<SpaceKind, ReadonlyArray<keyof SpaceDetails>> = {
  hall: [],
  room: ['type', 'beds'],
  cart: ['type', 'needsPower'],
  clothing: ['type', 'colour', 'sizes', 'cleaningDays', 'fitting'],
  object: ['type', 'needsPower', 'withPerson', 'daysBefore', 'daysAfter'],
  vehicle: ['type', 'seats', 'driver', 'colour'],
  item: ['type'],
};
export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
const int = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : undefined;
};
const word = (v: unknown, max = 40): string | undefined => {
  const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  return t ? t.slice(0, max) : undefined;
};
/** The details a kind keeps, cleaned: words trimmed, numbers in range, booleans true/false. */
export function cleanDetails(kind: SpaceKind, raw: unknown): SpaceDetails {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: SpaceDetails = {};
  for (const k of DETAIL_KEYS[kind]) {
    const v = r[k];
    if (k === 'type' || k === 'colour') {
      const t = word(v);
      if (t) out[k] = t;
    } else if (k === 'sizes') {
      const sizes: Record<string, number> = {};
      const src = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      for (const s of CLOTHING_SIZES) {
        const n = int(src[s], 0, 10000);
        if (n) sizes[s] = n;
      }
      if (Object.keys(sizes).length) out.sizes = sizes;
    } else if (k === 'beds' || k === 'seats') {
      const n = int(v, 1, 60);
      if (n) out[k] = n;
    } else if (k === 'daysBefore' || k === 'daysAfter' || k === 'cleaningDays') {
      const n = int(v, 0, 60);
      if (n !== undefined) out[k] = n;
    } else if (v === true) {
      out[k] = true;
    }
  }
  return out;
}

/** Clothing: the count is the sizes added up (one number, never two that disagree). */
export function clothingCount(sizes: SpaceDetails['sizes']): number {
  return Object.values(sizes ?? {}).reduce((s, n) => s + n, 0);
}

/** A space as the screen holds it. */
export type Space = {
  id: string;
  kind: SpaceKind;
  name: string;
  seated: number | null;
  standing: number | null;
  widthM: number | null;
  lengthM: number | null;
  connectsTo: string | null;
  floor: string | null;
  /** Counted kinds: how many the shop owns, and how many are in repair. */
  count: number | null;
  inRepair: number;
  details: SpaceDetails;
};

/** "12 × 20 m · 240 sqm" — a Floor size in words, or '' when none is set. */
export function sizeWords(widthM: number | null, lengthM: number | null): string {
  if (widthM == null || lengthM == null) return '';
  const sqm = Math.round(widthM * lengthM);
  return `${widthM} × ${lengthM} m · ${sqm} sqm`;
}

/** The tile's second line, from the drawing: "300 seated" · "2 beds" · "Fries" · "Chairs · 200" · "Gown · M" · "Arch · 1". */
export function tileLine(s: Space): string {
  const t = s.details.type;
  switch (s.kind) {
    case 'hall':
      return hallGuests(s) || sizeWords(s.widthM, s.lengthM) || 'Hall';
    case 'room': {
      const beds = s.details.beds ? `${s.details.beds} ${s.details.beds === 1 ? 'bed' : 'beds'}` : '';
      return [s.floor, beds || t].filter(Boolean).join(' · ') || 'Room';
    }
    case 'object':
      return [t, s.count != null ? String(s.count) : ''].filter(Boolean).join(' · ') || 'Object';
    case 'clothing': {
      const sizes = Object.keys(s.details.sizes ?? {});
      return [t, sizes.join(' ')].filter(Boolean).join(' · ') || 'Clothing';
    }
    case 'vehicle':
      return [t, s.details.seats ? `${s.details.seats} seats` : ''].filter(Boolean).join(' · ') || 'Vehicle';
    case 'cart':
      return t || 'Cart';
    case 'item':
      return t || 'Item';
  }
}

/** What a tile says on the picked date. Booked-whole kinds read the day's halls view; counted kinds their own count. */
export type TileState =
  | { tone: 'booked'; word: 'Booked'; who: string[] }
  | { tone: 'closed'; word: string }
  | { tone: 'free'; word: 'Free' }
  | { tone: 'count'; word: string };

export function tilesOnDay(
  day: string,
  spaces: readonly Space[],
  bookings: readonly HallBooking[],
  blocks: readonly HallBlock[],
): Map<string, TileState> {
  const whole = spaces.filter((s) => bookedWhole(s.kind));
  const halls: Hall[] = whole.map((s) => ({ poolId: s.id, name: s.name, capacity: 1, seated: s.seated, standing: s.standing }));
  const out = new Map<string, TileState>();
  for (const h of hallsOnDay(day, halls, bookings, blocks)) {
    if (h.closedBy) out.set(h.hall.poolId, { tone: 'closed', word: h.closedBy === 'Not available' ? 'Closed' : h.closedBy });
    else if (h.used.length > 0) out.set(h.hall.poolId, { tone: 'booked', word: 'Booked', who: h.used.map((u) => u.title) });
    else out.set(h.hall.poolId, { tone: 'free', word: 'Free' });
  }
  for (const s of spaces) {
    if (bookedWhole(s.kind)) continue;
    // Pieces out on a day are counted on the card that uses them (availability step 4); until a card's Uses names this
    // object (screen 8, not built), the tile says only what is true: how many are owned and in repair.
    out.set(s.id, { tone: 'count', word: s.inRepair > 0 ? `${s.inRepair} in repair` : `${s.count ?? 0} owned` });
  }
  return out;
}

/** "Sat 14 Feb" for an ISO date (YYYY-MM-DD), read as a calendar day — never shifted by a time zone. */
export function dayWords(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  // Built by hand: a locale's own order differs between runtimes ("Sun Feb 14" vs "Sun 14 Feb"), and the server and
  // the phone must say the same words.
  return `${WEEKDAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
/** The date pick: Today, Tomorrow, then the next days, each in words. `today` is the shop's calendar day. */
export function dateChoices(today: string, days = 30): Array<{ key: string; label: string }> {
  const [y, m, d] = today.split('-').map(Number);
  return Array.from({ length: days }, (_, i) => {
    const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + i));
    const iso = dt.toISOString().slice(0, 10);
    return { key: iso, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayWords(iso) };
  });
}

/** Search matches a name, a kind or the tile's line ("chairs" finds Object001 · Chairs). */
export function matchesSearch(s: Space, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return [s.name, KIND_WORD[s.kind], tileLine(s), s.details.type ?? ''].some((x) => x.toLowerCase().includes(t));
}

/** The kind a shop's categories point to — first in the ＋ menu, marked "For your shop". Null = no hint. */
export function kindForShop(categoryLabels: readonly string[]): KindChoice | null {
  const all = categoryLabels.join(' · ').toLowerCase();
  if (/venue|hall|hotel|resort|restaurant|garden|events place|function room/.test(all)) return 'hall';
  if (/cart|food stall|booth/.test(all)) return 'cart';
  if (/gown|barong|attire|dress|suit|clothing|wardrobe/.test(all)) return 'clothing';
  if (/car|vehicle|transport|limo|van|bus/.test(all)) return 'vehicle';
  if (/rental|chairs|tables|tent|lights|sound|led|décor|decor|styling/.test(all)) return 'object';
  return null;
}

/** How a run is named. Below Pro it is always Generic; Pro picks Generic · By floor · Letters · Your own. */
export type NameRun = { naming: RoomNaming; floorLevel?: number; startAt?: number; own?: string };

/**
 * The names for `count` new spaces of a kind, counting on from the shop's own names. Refused whole (never half-made)
 * when a name would repeat one the shop already uses ("No two the same in a branch").
 */
export function namesForRun(kind: SpaceKind, existing: readonly string[], count: number, run: NameRun): { ok: true; names: string[] } | { ok: false; error: string } {
  const n = Math.floor(count);
  if (!Number.isFinite(n) || n < 1 || n > MAX_RUN) return { ok: false, error: `Add 1 to ${MAX_RUN} at once.` };
  let names: string[] | null = null;
  if (run.naming === 'generic') names = nextGenericNames(kind, existing, n);
  else if (run.naming === 'by_floor' || run.naming === 'letters') {
    if (kind !== 'room') return { ok: false, error: 'Only rooms are numbered by floor.' };
    const level = Math.floor(run.floorLevel ?? 1);
    if (level < 1 || level > 99) return { ok: false, error: 'Pick the floor.' };
    names = roomNamesOnFloor(run.naming, level, n, run.startAt);
  } else {
    const base = (run.own ?? '').trim().replace(/\s+/g, ' ');
    if (!base) return { ok: false, error: 'Type a name.' };
    if (base.length > MAX_SPACE_NAME) return { ok: false, error: `Keep the name under ${MAX_SPACE_NAME} letters.` };
    names = n === 1 ? [base] : Array.from({ length: n }, (_, i) => `${base} ${i + 1}`);
  }
  if (!names) return { ok: false, error: 'Pick how to name them.' };
  const taken = new Set(existing.map((x) => x.trim().toLowerCase()));
  const clash = names.find((x) => taken.has(x.toLowerCase()));
  if (clash) return { ok: false, error: `${clash} is already a name in your shop.` };
  if (duplicateNames(names).length) return { ok: false, error: 'Two of those names are the same.' };
  return { ok: true, names };
}

/** "Room001, Room002 … Room012" — the preview line under the Names row, before anything is saved. */
export function previewWords(names: readonly string[]): string {
  if (names.length <= 3) return names.join(', ');
  return `${names[0]}, ${names[1]} … ${names[names.length - 1]}`;
}

/** The floor of a by-floor run in words ("On 2F"). */
export function floorWords(level: number): string {
  return floorName(level);
}

/** Admin's read-only line: "2 halls · 12 rooms · 3 objects". */
export function spacesCountLine(spaces: readonly Space[]): string {
  const order: SpaceKind[] = ['hall', 'room', 'cart', 'clothing', 'object', 'vehicle', 'item'];
  const plural: Record<SpaceKind, string> = { hall: 'halls', room: 'rooms', cart: 'carts', clothing: 'clothing', object: 'objects', vehicle: 'vehicles', item: 'others' };
  return order
    .map((k) => [k, spaces.filter((s) => s.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${n === 1 && k !== 'clothing' ? KIND_WORD[k] : plural[k]}`)
    .join(' · ');
}

/** Limits, matched to the database CHECKs (migration 20271356372536 · calendar_name ≤ 80). */
export const MAX_SPACE_NAME = 80;
/** One Add may make at most this many (a typo like "How many 1000" is refused, never half-made). */
export const MAX_RUN = 200;
export const MAX_COUNT = 100000;
