/**
 * lib/offline-copies.ts — THE SAVED COPY FOR A NO-SIGNAL VENUE (EV3, owner 2026-10-28).
 *
 * DECISION_LOG "OFFLINE SAVING IS ALWAYS ON" + "APPROVED — EVENT DAY NEVER FAILS (always-on) … + BROWSER OFFLINE
 * SUPPORT" + "APP-WIDE SPEED RULE": whenever a coordinator or a supplier opens their event's pages with signal, the
 * phone refreshes its OWN saved copy of them; with no signal the saved copy opens instead of `/offline.html`. Page HTML
 * stays NETWORK-FIRST online — the copy is only the no-signal fallback, never a stale-while-revalidate answer.
 *
 * WHO KEEPS WHAT (the four rules, each held by `lib/offline-copies.test.ts` and `app/sw-offline-copies.test.ts`):
 *   1. ONE VIEWER AT A TIME. The worker records whose copies it holds (`OfflineRegistry.viewer`). A save by anyone else
 *      erases every copy first — a shared phone never opens the previous person's guest list.
 *   2. ONLY THEIR OWN EVENT VIEWS. A copy is a page the viewer's own session just rendered, at one of the addresses
 *      (`OFFLINE_COPY_SHAPES` — incl. each person's "Your schedule"), for the event named in the save — never a page the worker composes, never another
 *      event's address, never a redirect (a refused or signed-out render is never kept).
 *   3. ERASED AFTER THE EVENT. Every copy carries its event's `until` (the end of the day after the event, Philippine
 *      time); past it the worker deletes it. Sign-out deletes them all (`OFFLINE_COPIES_WIPE_SCRIPT`); a guest's
 *      "Remove it from this browser" (the POST to `/<slug>/sign-out`, every guest sign-out door) deletes that event's.
 *   4. SMALL. Four pages per event at most; no photos or albums are kept by this cache.
 *
 * `public/sw.js` cannot import this file, so it holds a COPY of `isOfflineCopyPath` / `offlineCopyEventId` (those two live
 * in `./offline-copy-addresses.ts`);
 * `app/sw-offline-copies.test.ts` runs both over one table and fails if they ever disagree.
 *
 * PURE — no I/O. Client-safe.
 */

import { AUTH_COOKIE } from '@/lib/last-seen/wipe';

/** The Cache Storage name. NOT tied to the deploy VERSION in sw.js: a deploy must not erase a venue's copy. */
export const OFFLINE_COPIES_CACHE = 'setnayan-offline-pages-v1';

/** Where the worker keeps its registry document, inside that cache. The page reads it directly. */
export const OFFLINE_REGISTRY_PATH = '/__setnayan-sw/offline/registry.json';

/**
 * ⏱ THE AMBER LINE — a saved copy older than this, on the event day, turns amber: "update before you leave".
 *
 * THREE HOURS, and why (written down per the owner's "threshold chosen by the build, measured, written down"):
 *   · The copy refreshes itself on every open with signal — the page the coordinator opens is re-saved by the worker
 *     on that very navigation, and the rest at most every `AUTO_REFRESH_AFTER_MS` (30 min). A coordinator who uses the
 *     app with signal therefore never holds a copy older than ~30 min. A copy past 3 h means the phone has not been
 *     opened with signal for three hours — i.e. at least six refreshes were missed, which only happens to a phone that
 *     was put away (the night before, the drive in). That is exactly the phone that should be updated before leaving.
 *   · The run of show is the fastest-moving thing on the day; a ceremony call-time is usually set ~3 h before the
 *     start, so a copy older than that predates the last round of the day's changes.
 *   · The prototype's example ("Saved 9 hours ago") is a morning-of read of a copy saved the night before — amber.
 * ⚠ NOT YET MEASURED ON PRODUCTION DATA: the read of real event-day edit times was refused to this build by the
 * session's permission gate. The query to measure it (read-only) is in the EV3 changelog fragment; re-tune this one
 * number from its answer, never a second constant elsewhere.
 */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

/** An automatic (not pressed) refresh re-renders a saved page only when its copy is older than this. */
export const AUTO_REFRESH_AFTER_MS = 30 * 60 * 1000;

/** A copy is kept from this many days before the event (the shipped "Event day soon" window, T-3d). */
export const SAVE_FROM_DAYS_BEFORE = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const PH_OFFSET = '+08:00';

/** An event id as the routes carry it — a UUID or a public id; nothing with a slash, dot or query. */
const EVENT_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * The page shapes a copy may be kept for — and no others. Exact addresses (a query only where it is part of the shape):
 *   coordinator · `/dashboard/<event>` (Home › Today) and `/dashboard/<event>/guests/checkin` (the Check-in desk)
 *   supplier    · `/vendor-dashboard/on-the-day` (Hub) and `/vendor-dashboard/on-the-day/live/<event>` (the event's
 *                 console, where the scanner lives — and the crew's day: crew see only the Hub)
 * A supplier who runs the hosts' check-in also keeps that event's Check-in desk (the same coordinator address).
 *
 * 📅 YOUR SCHEDULE (owner-approved 5 Nov, the schedule plan's "each person's day: Your schedule, saved for no signal"):
 *   coordinator · `/dashboard/<event>/schedule` (the day, as the hosts and their coordinator run it)
 *   supplier    · `/vendor-dashboard/clients/<event>?tab=schedule` (Customer › Schedule — a Host/MC's too)
 *   guest       · `/<slug>?tab=me` (Event Hub › Me — "Your schedule"; a role holder's call time is on it)
 * The guest's address names no event id: its owner is the SLUG (a guest save is kept under the slug), and a reserved
 * first segment (`/dashboard?tab=me`) is never a guest's page.
 */
export const OFFLINE_COPY_SHAPES = [
  /^\/dashboard\/([A-Za-z0-9-]{8,64})$/,
  /^\/dashboard\/([A-Za-z0-9-]{8,64})\/guests\/checkin$/,
  /^\/vendor-dashboard\/on-the-day$/,
  /^\/vendor-dashboard\/on-the-day\/live\/([A-Za-z0-9-]{8,64})$/,
  /^\/dashboard\/([A-Za-z0-9-]{8,64})\/schedule$/,
  /^\/vendor-dashboard\/clients\/([A-Za-z0-9-]{8,64})\?tab=schedule$/,
  /^\/([a-z0-9-]{3,32})\?tab=me$/,
] as const;

/**
 * `isOfflineCopyPath` / `offlineCopyEventId` / `guestMePath` live in `./offline-copy-addresses.ts`: the guest's shape
 * asks the reserved-word list (`lib/reserved-slugs.ts`), which only the server and the tests need — kept out of this
 * module so no page's client code carries it (the shared bundle has bytes, not kilobytes, of room).
 */

/** 📅 The coordinator's own day: the event's Schedule. */
export function coordinatorSchedulePath(eventId: string): string | null {
  return EVENT_ID.test(eventId) ? `/dashboard/${eventId}/schedule` : null;
}

/** 📅 The supplier's own day (a Host/MC's too): Customer › Schedule. */
export function supplierSchedulePath(eventId: string): string | null {
  return EVENT_ID.test(eventId) ? `/vendor-dashboard/clients/${eventId}?tab=schedule` : null;
}

/**
 * 🧾 THE COPY'S VERSION — what makes "a copy from before the Release" tellable from "the copy of now".
 *
 * A "Your schedule" page renders `data-sn-copy-version="<version>"` (`ScheduleSavedMark`); the worker reads it out of
 * every copy it keeps and records it beside the copy's time (`OfflineRegistry.events[e].versions`). The page asks with
 * the version IT was rendered with; a copy whose recorded version differs is stale — re-rendered on the next save
 * however fresh its clock, and never drawn as "Saved for offline" meanwhile.
 *
 * The version is a fingerprint of what the page DRAWS (the person's chapters, lines, call time, places, contacts —
 * after Release, the full day), not a clock: a Release, an edit, a deleted moment and a moved call time each change it,
 * and no phone clock that is a few minutes off can make an old copy look new.
 *
 * `OFFLINE_COPY_UNREAD` — the page could not read the schedule. The worker never keeps such a page (a copy of "we
 * couldn't read your schedule" is not a saved schedule) and the older copy stays.
 */
export const OFFLINE_COPY_UNREAD = 'unread';
export const COPY_VERSION_ATTR = 'data-sn-copy-version';
const COPY_VERSION = /^[A-Za-z0-9._-]{1,64}$/;

/** FNV-1a (32-bit) over the JSON of what the page draws → `v<base36>.<length>`. Pure; the same value on every server. */
export function copyVersionOf(value: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(value) ?? 'null';
  } catch {
    return OFFLINE_COPY_UNREAD;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `v${h.toString(36)}.${json.length.toString(36)}`;
}

/** The version a kept page's HTML carries, or null. The worker holds a COPY of this (`copyVersionIn` in sw.js). */
export function copyVersionIn(html: string): string | null {
  const m = /data-sn-copy-version="([A-Za-z0-9._-]{1,64})"/.exec(html);
  return m ? m[1]! : null;
}

export function isCopyVersion(v: unknown): v is string {
  return typeof v === 'string' && COPY_VERSION.test(v);
}

/** The coordinator's pages for one event. */
export function coordinatorOfflinePaths(eventId: string, opts: { checkin: boolean }): string[] {
  if (!EVENT_ID.test(eventId)) return [];
  const base = `/dashboard/${eventId}`;
  return opts.checkin ? [base, `${base}/guests/checkin`] : [base];
}

/**
 * The supplier's pages for one event: the Hub, the event's console, and — when they run its door — its desk.
 * F-W1-77 (walk 13 Nov 2026): the console opens only ON the booked day (before it, the page sends you back to the Hub),
 * so before the day it is not asked for — a save that can never land would fail every page's mark with it.
 */
export function supplierOfflinePaths(eventId: string, opts: { checkin: boolean; liveToday?: boolean }): string[] {
  if (!EVENT_ID.test(eventId)) return [];
  const out = ['/vendor-dashboard/on-the-day'];
  if (opts.liveToday !== false) out.push(`/vendor-dashboard/on-the-day/live/${eventId}`);
  if (opts.checkin) out.push(`/dashboard/${eventId}/guests/checkin`);
  return out;
}

/** Midnight that starts `YYYY-MM-DD` in Philippine time (the Hub's day — `HUB_OPEN_WINDOW_PLAIN`), or NaN. */
function phMidnight(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Number.NaN;
  return Date.parse(`${date}T00:00:00${PH_OFFSET}`);
}

/** When the copies of an event are erased: the end of the day AFTER the event (or after its last day), PH time. */
export function offlineCopiesUntil(eventDate: string | null, eventEndDate?: string | null): number | null {
  const last = phMidnight(eventEndDate || eventDate || '');
  if (!Number.isFinite(last)) return null;
  return last + 2 * DAY_MS;
}

/** The event is today (or one of its days), Philippine time — only then does an old copy turn amber. */
export function offlineEventDay(eventDate: string | null, now: number, eventEndDate?: string | null): boolean {
  const start = phMidnight(eventDate || '');
  const end = phMidnight(eventEndDate || eventDate || '');
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return now >= start && now < end + DAY_MS;
}

/**
 * F-W1-77 (walk 13 Nov 2026): why nothing CAN be saved yet, in words — or null when saving is open (or already over).
 * "Update now" before the window used to do nothing and keep saying "Not saved on this phone yet"; now the mark says
 * when saving starts. A dateless booking says it has no date.
 */
export function offlineNotYetWords(eventDate: string | null, now: number): string | null {
  const start = phMidnight(eventDate || '');
  if (!Number.isFinite(start)) return 'Nothing to save yet · this booking has no date';
  const opens = start - SAVE_FROM_DAYS_BEFORE * DAY_MS;
  if (now >= opens) return null;
  const day = new Date(opens).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
  return `Nothing to save yet · saving for offline starts ${day}, ${SAVE_FROM_DAYS_BEFORE} days before the event`;
}

/** True while copies of this event are kept: from T-3 days to `offlineCopiesUntil`. A dateless event keeps none. */
export function offlineSavingOpen(eventDate: string | null, now: number, eventEndDate?: string | null): boolean {
  const start = phMidnight(eventDate || '');
  const until = offlineCopiesUntil(eventDate, eventEndDate);
  if (!Number.isFinite(start) || until === null) return false;
  return now >= start - SAVE_FROM_DAYS_BEFORE * DAY_MS && now < until;
}

/** The worker's registry, as stored at `OFFLINE_REGISTRY_PATH`. */
export type OfflineRegistry = {
  v: 1;
  /** Whose copies these are (the signed-in account, or a guest pass holder `g-<guest id>`). Exactly one at a time. */
  viewer: string;
  /** `versions`: the copy version each kept page's HTML carried (only pages that carry one — `COPY_VERSION_ATTR`). */
  events: Record<string, { until: number; pages: Record<string, number>; versions?: Record<string, string> }>;
};

/** Parses a stored registry; anything malformed reads as none (never as somebody's copy). */
export function parseOfflineRegistry(json: unknown): OfflineRegistry | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as Partial<OfflineRegistry>;
  if (r.v !== 1 || typeof r.viewer !== 'string' || !r.events || typeof r.events !== 'object') return null;
  return r as OfflineRegistry;
}

/**
 * When THIS viewer's copy of THESE pages was saved — the OLDEST of them, because the mark speaks for all of them —
 * or null when any one is missing, expired, or the copies belong to somebody else.
 */
export function savedAtFor(
  reg: OfflineRegistry | null,
  viewer: string,
  eventId: string,
  paths: readonly string[],
  now: number,
): number | null {
  if (!reg || reg.viewer !== viewer || paths.length === 0) return null;
  const ev = reg.events[eventId];
  if (!ev || !(ev.until > now)) return null;
  let oldest = Infinity;
  for (const p of paths) {
    const at = ev.pages[p];
    if (typeof at !== 'number' || !Number.isFinite(at)) return null;
    oldest = Math.min(oldest, at);
  }
  return Number.isFinite(oldest) ? oldest : null;
}

/**
 * 🧾 Is THIS viewer's copy of these pages older than the version the page on screen was rendered with? True when any
 * page's recorded version differs (a copy kept before versions existed has none — it differs too). False when there is
 * no version to compare (`version` null / unread) or no copy at all (then there is nothing to call stale).
 */
export function staleFor(
  reg: OfflineRegistry | null,
  viewer: string,
  eventId: string,
  paths: readonly string[],
  version: string | null | undefined,
): boolean {
  if (!isCopyVersion(version) || version === OFFLINE_COPY_UNREAD) return false;
  if (!reg || reg.viewer !== viewer) return false;
  const ev = reg.events[eventId];
  if (!ev) return false;
  return paths.some((p) => typeof ev.pages[p] === 'number' && ev.versions?.[p] !== version);
}

/** "just now" · "5 minutes" · "9 hours" · "2 days" — the age, in words. */
export function ageWords(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'}`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.floor(h / 24);
  return `${d} days`;
}

/** 2:10 PM — the clock time a copy was saved, in Philippine time. */
export function clockWords(at: number): string {
  return new Date(at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
}

/**
 * Where the saved copy stands, as the mark draws it. Every phase but `saved` says plainly that something is NOT saved
 * or NOT current — a failed save never reads as saved, and an old copy never reads as fresh (reads are honest).
 */
export type SavedPhase =
  | 'checking' // the copy has not been read yet
  | 'unsupported' // this browser keeps no copy at all
  | 'none' // nothing saved for these pages on this phone
  | 'saving' // a save is running
  | 'saved' // a copy of every page, saved at `savedAt`
  | 'failed'; // the last save did not land (the older copy, if any, is still here)

export type SavedMark = { tone: 'ok' | 'amber' | 'muted' | 'bad'; text: string };

export function savedMark(input: {
  phase: SavedPhase;
  savedAt: number | null;
  now: number;
  online: boolean;
  /** The event is today — only then does an old copy turn amber. */
  eventDay: boolean;
  /** The page on screen IS the saved copy (`savedCopyOnScreen()`), saved at this time. */
  onCopy?: number | null;
  /** 🧾 The kept copy is from before the latest change (`staleFor`) — a Release, an edit. Never drawn as saved. */
  stale?: boolean;
}): SavedMark {
  const { phase, savedAt, now, online, eventDay, onCopy = null, stale = false } = input;
  if (onCopy !== null) {
    return online
      ? { tone: 'amber', text: `Showing the copy from ${clockWords(onCopy)} · load the latest when the signal is back` }
      : { tone: 'amber', text: `No signal · showing the copy from ${clockWords(onCopy)}` };
  }
  if (phase === 'unsupported') {
    return { tone: 'bad', text: 'This browser can’t keep a copy · use the Setnayan app or Add to Home Screen' };
  }
  if (phase === 'checking') return { tone: 'muted', text: 'Checking the copy on this phone…' };
  if (!online) {
    return savedAt !== null
      ? { tone: 'amber', text: `No signal · showing the copy from ${clockWords(savedAt)}` }
      : { tone: 'bad', text: 'No signal · nothing saved on this phone yet' };
  }
  if (phase === 'saving') return { tone: 'muted', text: 'Saving for offline…' };
  if (phase === 'failed') {
    return savedAt !== null
      ? { tone: 'bad', text: `Couldn’t update · the copy from ${clockWords(savedAt)} is still on this phone` }
      : { tone: 'bad', text: 'Couldn’t save for offline · try Update now' };
  }
  if (phase !== 'saved' || savedAt === null) return { tone: 'muted', text: 'Not saved on this phone yet' };
  // 🧾 A copy from before the latest change is not the saved day — said with the failed line's own words.
  if (stale) return { tone: 'bad', text: `Couldn’t update · the copy from ${clockWords(savedAt)} is still on this phone` };
  const age = now - savedAt;
  if (eventDay && age > STALE_AFTER_MS) {
    return { tone: 'amber', text: `Saved ${ageWords(age)} ago · update before you leave for the venue` };
  }
  return { tone: 'ok', text: `Saved for offline · updated ${age < 60_000 ? 'just now' : clockWords(savedAt)}` };
}

/**
 * 🧹 SIGN-OUT ERASES THE COPIES — an inline script for the pages a signed-out person lands on, beside the last-seen
 * wipe (`app/_components/last-seen/last-seen-wipe-script.tsx`; same doors, same cookie test). With no Supabase auth
 * cookie in the browser, the saved pages are deleted and the worker is told to forget its registry. Never throws.
 */
export const OFFLINE_COPIES_WIPE_SCRIPT =
  `try{if(!${AUTH_COOKIE}.test(document.cookie)){` +
  `if(self.caches)caches.delete(${JSON.stringify(OFFLINE_COPIES_CACHE)});` +
  `var c=navigator.serviceWorker&&navigator.serviceWorker.controller;if(c)c.postMessage({type:"OFFLINE_FORGET"})}}catch(e){}`;

/**
 * When the document on screen is the SAVED COPY the worker opened with no signal, the time it was saved; else null.
 * The worker marks the copy's <html> (`data-sn-saved-copy`) as it opens it — a page fresh from the server never has it.
 */
export function savedCopyOnScreen(): number | null {
  if (typeof document === 'undefined') return null;
  const at = Number(document.documentElement?.dataset?.snSavedCopy);
  return Number.isFinite(at) && at > 0 ? at : null;
}
