/**
 * lib/guests-views.ts — GUESTS = LIST · MAP · SEATS · MARCH (R4 of the event-menu reorganisation).
 *
 * Owner, 2026-10-27 (DECISION_LOG "GUESTS = LIST · MAP · SEATS · MARCH; RSVP SETTINGS LIVE IN THE GUESTS ⚙"), and
 * 2026-10-28: *"On guests we have things to move there: March, Seat, Rsvp"* · Q7/Q8 *"3D plan: yes, inside Seats"* ·
 * *"all mapping will be kept"*. The Guests view row gains **Seats** (the shipped seat-plan maker, rendered whole — its
 * 2D plan, its 3D room and the guests' map to their table, the Indoor Blueprint's wayfinding) and **March** (the
 * shipped Wedding March maker) beside List · Map. ⚠ "Map" stays the guest TREE (`GuestMapCanvas`), never seating.
 *
 * ONE place answers "which view, and where is it": the Guests page parses `?gview=` here, its selector draws these
 * labels, and every old door — the Maker's `?tool=details&item=seating|march`, `/seating`, `/plan3d`,
 * `/studio/indoor-blueprint`, the Guest list's own retired `?gview=walk` — lands through `guestsViewHref`.
 * Held by `lib/r4-seats-march-forwards.test.ts`.
 *
 * Pure: no I/O, no React — the pages, the redirects, the guided flow and the guards all ask it.
 */

export const GUESTS_VIEWS = ['list', 'map', 'seats', 'march'] as const;
export type GuestsView = (typeof GUESTS_VIEWS)[number];

/** The view row's words, in its order. `march` is the default word — an event type may say its own (`marchLabel`). */
export const GUESTS_VIEW_LABEL: Readonly<Record<GuestsView, string>> = {
  list: 'List',
  map: 'Map',
  seats: 'Seats',
  march: 'March',
};

/** The two views R4 brought in — each a shipped maker, drawn whole, with no list under it. */
export const GUESTS_MAKER_VIEWS = ['seats', 'march'] as const satisfies readonly GuestsView[];
export type GuestsMakerView = (typeof GUESTS_MAKER_VIEWS)[number];

export function isGuestsMakerView(v: GuestsView): v is GuestsMakerView {
  return (GUESTS_MAKER_VIEWS as readonly string[]).includes(v);
}

/**
 * The Seat plan's own views inside Seats, carried as `seat=` — the 3D room (`3d`), the list of tables (`list`), and
 * the guests' map to their table (`map`, the Indoor Blueprint). Absent: the 2D plan.
 */
export const SEAT_VIEWS = ['3d', 'list', 'map'] as const;
export type SeatView = (typeof SEAT_VIEWS)[number];

export function parseSeatView(raw: string | null | undefined): SeatView | null {
  return raw && (SEAT_VIEWS as readonly string[]).includes(raw) ? (raw as SeatView) : null;
}

/**
 * The view an address asks for. Anything unknown is the List. `walk` is the Guest list's march view of 2026-09 (the
 * march went to the Maker on 2026-09-29 and comes home now), so its old link opens the March.
 */
export function parseGuestsView(raw: string | null | undefined): GuestsView {
  if (raw === 'walk') return 'march';
  return raw && (GUESTS_VIEWS as readonly string[]).includes(raw) ? (raw as GuestsView) : 'list';
}

/** A view of Guests — the List is the page's bare address; `seat` rides along on Seats only. */
export function guestsViewHref(eventId: string, view: GuestsView, opts: { seat?: SeatView | null } = {}): string {
  const base = `/dashboard/${eventId}/guests`;
  if (view === 'list') return base;
  const seat = view === 'seats' && opts.seat ? `&seat=${opts.seat}` : '';
  return `${base}?gview=${view}${seat}`;
}

/**
 * 🗂 R4 · THE MAKER'S ITEMS THAT LEFT FOR GUESTS (owner 2026-10-28, *"all mapping will be kept"*). The Studio tiles
 * Seat plan and Wedding March opened the Maker's Event Details items `seating` and `march`; their address —
 * `/launch?tool=details&item=seating|march` (bookmarks, tours, a print's "Open Seat plan", the old guided steps) —
 * lands on the Guests view, before anything is read (the launch page's first step, beside R1's).
 */
export const MAKER_ITEMS_MOVED_TO_GUESTS_VIEWS = {
  seating: 'seats',
  march: 'march',
} as const satisfies Record<string, GuestsMakerView>;

/** Where a moved Maker item's address lands now — or null when the item did not move here. */
export function makerItemMovedToViewHref(eventId: string, item: string | undefined, seat?: string | undefined): string | null {
  if (!item || !Object.prototype.hasOwnProperty.call(MAKER_ITEMS_MOVED_TO_GUESTS_VIEWS, item)) return null;
  const view = MAKER_ITEMS_MOVED_TO_GUESTS_VIEWS[item as keyof typeof MAKER_ITEMS_MOVED_TO_GUESTS_VIEWS];
  return guestsViewHref(eventId, view, { seat: parseSeatView(seat) });
}

/**
 * 🚪 The standalone pages R4 folded into Seats (owner Q7/Q8, 2026-10-28): each old address and the Seats view it lands
 * on. `/seating` keeps its `?view=list`; the 3D Plan's control centre is the 3D room; the Indoor Blueprint is the
 * guests' map to their table. Each page forwards by its address alone, before any read.
 */
export const SEAT_PAGES_MOVED_TO_SEATS = {
  seating: null,
  plan3d: '3d',
  'studio/indoor-blueprint': 'map',
} as const satisfies Record<string, SeatView | null>;

/**
 * 🎚 THE TOP ROW — ONE MENU FOR THE PAGE AND ITS MODE (owner 2026-10-29, slice 2, confirmed ~18:35: *"Guests ▾ List·Map ·
 * Seats ▾ List·2D·3D · March"*; prototype v14 `renderTop` / `viewMenu`). Three segments; the SELECTED one (Guests or
 * Seats) carries a small ▾ that opens its modes. The four views above stay the addresses — this only groups them.
 */
export const GUESTS_TOPS = ['guests', 'seats', 'march'] as const;
export type GuestsTop = (typeof GUESTS_TOPS)[number];
export const GUESTS_TOP_LABEL: Readonly<Record<GuestsTop, string>> = { guests: 'Guests', seats: 'Seats', march: 'March' };

/** Which segment a view sits under — List and Map are both Guests. */
export function topOfView(v: GuestsView): GuestsTop {
  return v === 'seats' ? 'seats' : v === 'march' ? 'march' : 'guests';
}

/** Seats' three modes in the menu (List · 2D · 3D). The guests' map to their table (`seat=map`) is the 2D family. */
export const SEAT_MODES = ['list', '2d', '3d'] as const;
export type SeatMode = (typeof SEAT_MODES)[number];
export const SEAT_MODE_LABEL: Readonly<Record<SeatMode, string>> = { list: 'List', '2d': '2D', '3d': '3D' };
/** The menu's longer words for each mode (prototype v14: "2D floor plan" · "3D room"). */
export const SEAT_MODE_MENU_LABEL: Readonly<Record<SeatMode, string>> = { list: 'List', '2d': '2D floor plan', '3d': '3D room' };

export function seatModeOf(seat: SeatView | null | undefined): SeatMode {
  return seat === '3d' ? '3d' : seat === 'list' ? 'list' : '2d';
}

/** The `seat=` a mode is carried as (2D is the bare Seats address). */
export function seatOfMode(mode: SeatMode): SeatView | null {
  return mode === '2d' ? null : mode;
}

/**
 * 🗺 AUTO-PINNED FULL SCREEN (owner 2026-10-29 ~18:35: *"3d map, 2d map and guest map are all auto pinned full screen"*):
 * Guests › Map, Seats › 2D and Seats › 3D. Entering one glides the top row and the count row into the ONE slim pinned row,
 * and the map fills the rest of the screen. Lists (Guests › List, Seats › List, March) scroll and pin as before.
 */
export function isFullScreenView(view: GuestsView, seatMode: SeatMode): boolean {
  return view === 'map' || (view === 'seats' && seatMode !== 'list');
}

/** The pinned row's one menu: its words ("Guests · List", "Seats · 3D", "March"). */
export function pinnedMenuWords(view: GuestsView, seatMode: SeatMode): string {
  if (view === 'march') return GUESTS_TOP_LABEL.march;
  if (view === 'seats') return `${GUESTS_TOP_LABEL.seats} · ${SEAT_MODE_LABEL[seatMode]}`;
  return `${GUESTS_TOP_LABEL.guests} · ${GUESTS_VIEW_LABEL[view]}`;
}
