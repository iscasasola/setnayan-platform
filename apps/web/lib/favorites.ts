/**
 * favorites.ts — FAVORITES COME AFTER AN EVENT (owner 2026-11-06, DECISION_LOG "APPROVED: FAVORITES ONLY AFTER AN
 * EVENT"; prototype `favorites-proto/index.html` §D–§G).
 *
 *   · Before the day, "Save" is a SHORTLIST row inside one event (`saveVendorToPicks` → `event_vendors`). Unchanged.
 *   · After the day, a person may keep a supplier's SERVICE as a FAVORITE — only one they experienced:
 *       HOST  — a host/co-host (`event_members.member_type = 'couple'`, never a coordinator) of an event whose day has
 *               passed, and the service was BOOKED on it (`event_vendors` in a booked status, with a shop);
 *       GUEST — the person's own guest row on that event was CHECKED IN at the door (`guest_checkins`), and the service
 *               was booked on it.
 *   · One row per person + shop + service (`guest_saved_vendors`, migration 20271316625547). The same service
 *     experienced at two events stays ONE favorite naming the first event, "and 1 more event".
 *   · Host or guest is decided at READ time: does this person host the favorite's event?
 *
 * Pure: no I/O. The reads are `favorites.server.ts`; this file decides and words. Executed by `favorites.test.ts`.
 */

/** The statuses that are BOOKED — the database's own list (`set_supplier_where`, `lib/supplier-where.ts`). */
export const FAVORITE_BOOKED_STATUSES = ['contracted', 'deposit_paid', 'delivered', 'complete'] as const;

export type FavoriteRefusal = 'signed_out' | 'not_host' | 'before_day' | 'not_booked' | 'not_checked_in' | 'unread';
export type FavoriteVerdict = { ok: true } | { ok: false; why: FavoriteRefusal };

const OK: FavoriteVerdict = { ok: true };
const no = (why: FavoriteRefusal): FavoriteVerdict => ({ ok: false, why });

/** One booked line of an event: the shop, and the service when the booking names one. */
export type BookedService = { shopId: string; serviceId: string | null };

/** Was THIS shop (+ service) booked on the event? A shop-level ask (service null) needs the shop booked at all. */
export function isBookedOn(booked: readonly BookedService[], shopId: string, serviceId: string | null): boolean {
  return booked.some((b) => b.shopId === shopId && (serviceId === null || b.serviceId === serviceId));
}

/**
 * HOST — may this person favorite this service from this event?
 * `eventDate` is the LOCKED date (`events.event_date`, YYYY-MM-DD); `today` is Manila's calendar day. The day must be
 * BEHIND us: on the day itself the service is still being delivered.
 */
export function hostFavoriteVerdict(f: {
  isHost: boolean;
  eventDate: string | null;
  today: string;
  booked: readonly BookedService[];
  shopId: string;
  serviceId: string | null;
}): FavoriteVerdict {
  if (!f.isHost) return no('not_host');
  const day = (f.eventDate ?? '').slice(0, 10);
  if (!day || !(day < f.today)) return no('before_day');
  if (!isBookedOn(f.booked, f.shopId, f.serviceId)) return no('not_booked');
  return OK;
}

/** GUEST — checked in at the door, and the service was booked on the event. */
export function guestFavoriteVerdict(f: {
  checkedIn: boolean;
  booked: readonly BookedService[];
  shopId: string;
  serviceId: string | null;
}): FavoriteVerdict {
  if (!f.checkedIn) return no('not_checked_in');
  if (!isBookedOn(f.booked, f.shopId, f.serviceId)) return no('not_booked');
  return OK;
}

/** What a refused press says — plain words, never the database's. */
export function favoriteRefusalWords(why: FavoriteRefusal): string {
  switch (why) {
    case 'signed_out':
      return 'Sign in to keep favorites.';
    case 'not_host':
      return 'Only the event’s hosts can add its suppliers to favorites.';
    case 'before_day':
      return 'Favorites open after the day.';
    case 'not_booked':
      return 'Only suppliers booked for this event can be favorites.';
    case 'not_checked_in':
      return NOT_CHECKED_IN_LINE;
    case 'unread':
      return 'We couldn’t check that just now. Nothing changed — try again.';
  }
}

/** The Hub's line under the names for a guest the app cannot place at the event (prototype §F). */
export const NOT_CHECKED_IN_LINE = 'Favorites open for guests who checked in at the door.';
/** The Hub block's sub line for a checked-in guest (prototype §F). */
export const GUEST_FAVORITES_SUB = 'Favorites wait in your Library for your own event.';
/** Library › Suppliers, the two groups (prototype §G). */
export const SHORTLIST_GROUP = 'Shortlisted for your events';
export const FAVORITES_GROUP = 'Favorites';
export const FAVORITES_EMPTY = 'No favorites yet. They come from events you host or attend.';
export const FAVORITE_REMOVE_HINT = 'Swipe left on the row to remove. Removing does not touch your review.';

/* ── Where a favorite came from ─────────────────────────────────────────────────────────────────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDay(iso: string | null | undefined): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso ?? '').trim());
  if (!m) return null;
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12) return null;
  return { y: Number(m[1]), m: mm, d: Number(m[3]) };
}

/** "Dec 2026" — the row's short date. Null when there is no date to say. */
export function favoriteMonth(iso: string | null | undefined): string | null {
  const p = parseDay(iso);
  return p ? `${MONTHS[p.m - 1]} ${p.y}` : null;
}

/** "12 Dec 2026" — the ⓘ's and the thank-you's long date. */
export function favoriteDay(iso: string | null | undefined): string | null {
  const p = parseDay(iso);
  return p ? `${p.d} ${MONTHS[p.m - 1]} ${p.y}` : null;
}

function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

/** The event as the person says it: "your wedding" (host) · "Maria & Jose’s wedding" (guest). */
export function favoriteEventPhrase(f: { role: 'host' | 'guest'; hostsName: string | null; eventWord: string | null }): string {
  const word = (f.eventWord ?? '').trim() || 'event';
  if (f.role === 'host') return `your ${word}`;
  const hosts = (f.hostsName ?? '').trim();
  if (!hosts) return `the ${word}`;
  if (hosts.toLowerCase().includes(word.toLowerCase()) || word === 'event') return hosts;
  return `${possessive(hosts)} ${word}`;
}

export type FavoriteSource = {
  role: 'host' | 'guest';
  hostsName: string | null;
  eventWord: string | null;
  eventDate: string | null;
  /** OTHER events this person experienced the same service at (never counts the named one). */
  moreEvents: number;
};

/**
 * The row's line (prototype §G): "From your wedding · Dec 2026" · "From Maria & Jose’s wedding · you were a guest",
 * then " · and 1 more event" when the same service was experienced elsewhere too.
 */
export function favoriteSourceLine(s: FavoriteSource): string {
  const head = `From ${favoriteEventPhrase(s)}`;
  const tail = s.role === 'host' ? favoriteMonth(s.eventDate) : 'you were a guest';
  const more = s.moreEvents > 0 ? `and ${s.moreEvents} more ${s.moreEvents === 1 ? 'event' : 'events'}` : null;
  return [head, tail, more].filter(Boolean).join(' · ');
}

/** The ⓘ's line: "From your wedding · 12 Dec 2026 · you were a host". */
export function favoriteSourceDetail(s: FavoriteSource): string {
  return [`From ${favoriteEventPhrase(s)}`, favoriteDay(s.eventDate), s.role === 'host' ? 'you were a host' : 'you were a guest']
    .filter(Boolean)
    .join(' · ');
}

/* ── One row per shop + service ─────────────────────────────────────────────────────────────────────────────────── */

export type FavoriteRow = {
  id: number;
  shopId: string;
  serviceId: string | null;
  sourceEventId: string | null;
  savedAt: string;
};

export type CollapsedFavorite = FavoriteRow & {
  /** Every stored row this one stands for (a duplicate shop-level row is removed with it). */
  ids: number[];
};

export const favoriteKey = (shopId: string, serviceId: string | null) => `${shopId}|${serviceId ?? ''}`;

/**
 * One favorite per shop + service, the FIRST kept (earliest `saved_at`) — the controller's call: "same shop at two
 * events = one favorite naming the first event". Duplicate shop-level rows (possible by design — see the migration)
 * fold into it. Newest favorite first in the list.
 */
export function collapseFavorites(rows: readonly FavoriteRow[]): CollapsedFavorite[] {
  const byKey = new Map<string, CollapsedFavorite>();
  const ordered = [...rows].sort((a, b) => a.savedAt.localeCompare(b.savedAt) || a.id - b.id);
  for (const r of ordered) {
    const k = favoriteKey(r.shopId, r.serviceId);
    const kept = byKey.get(k);
    if (kept) kept.ids.push(r.id);
    else byKey.set(k, { ...r, ids: [r.id] });
  }
  return [...byKey.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.id - a.id);
}

/**
 * "and N more" — the OTHER events where this person experienced the same shop + service (a shop-level favorite counts
 * any booking of the shop). `experienced` = every (event, shop, service) the person may favorite from.
 */
export function moreEventsFor(
  fav: { shopId: string; serviceId: string | null; sourceEventId: string | null },
  experienced: ReadonlyArray<{ eventId: string; shopId: string; serviceId: string | null }>,
): number {
  const events = new Set<string>();
  for (const e of experienced) {
    if (e.shopId !== fav.shopId) continue;
    if (fav.serviceId !== null && e.serviceId !== fav.serviceId) continue;
    if (e.eventId === fav.sourceEventId) continue;
    events.add(e.eventId);
  }
  return events.size;
}

/* ── The ♡ pill (prototype `.heart` / `.heart.on`, in the app's tokens) ─────────────────────────────────────────── */

/** min-height 36 · rounded-full · 13 px semibold; ON = the accent wash with a filled heart. */
export function heartClass(on: boolean): string {
  return [
    'inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors',
    on ? 'border-mulberry/40 bg-mulberry/10 text-mulberry-700' : 'border-ink/20 bg-cream text-ink hover:border-mulberry/40',
  ].join(' ');
}

/** The favorite's door: the shop page, opened at that service (`/v/[slug]?service=<public_id>`). */
export function favoriteHref(slug: string | null, servicePublicId: string | null): string | null {
  if (!slug) return null;
  const base = `/v/${encodeURIComponent(slug)}`;
  return servicePublicId ? `${base}?service=${encodeURIComponent(servicePublicId)}` : base;
}
