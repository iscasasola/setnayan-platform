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
 *   2. ONLY THEIR OWN EVENT VIEWS. A copy is a page the viewer's own session just rendered, at one of four addresses
 *      (`OFFLINE_COPY_SHAPES`), for the event named in the save — never a page the worker composes, never another
 *      event's address, never a redirect (a refused or signed-out render is never kept).
 *   3. ERASED AFTER THE EVENT. Every copy carries its event's `until` (the end of the day after the event, Philippine
 *      time); past it the worker deletes it. Sign-out deletes them all (`OFFLINE_COPIES_WIPE_SCRIPT`).
 *   4. SMALL. Four pages per event at most; no photos or albums are kept by this cache.
 *
 * `public/sw.js` cannot import this file, so it holds a COPY of `isOfflineCopyPath` / `offlineCopyEventId`;
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
 * The four page shapes a copy may be kept for — and no others. Query-less, exact paths:
 *   coordinator · `/dashboard/<event>` (Home › Today) and `/dashboard/<event>/guests/checkin` (the Check-in desk)
 *   supplier    · `/vendor-dashboard/on-the-day` (Hub) and `/vendor-dashboard/on-the-day/live/<event>` (the event's
 *                 console, where the scanner lives)
 * A supplier who runs the hosts' check-in also keeps that event's Check-in desk (the same coordinator address).
 */
export const OFFLINE_COPY_SHAPES = [
  /^\/dashboard\/([A-Za-z0-9-]{8,64})$/,
  /^\/dashboard\/([A-Za-z0-9-]{8,64})\/guests\/checkin$/,
  /^\/vendor-dashboard\/on-the-day$/,
  /^\/vendor-dashboard\/on-the-day\/live\/([A-Za-z0-9-]{8,64})$/,
] as const;

/** True when `path` (a pathname, no query) is one of the four shapes. */
export function isOfflineCopyPath(path: string): boolean {
  return OFFLINE_COPY_SHAPES.some((re) => re.test(path));
}

/**
 * The event a path belongs to — its event segment — or `null` for the supplier Hub, which is the supplier's own page
 * (it names no event, and it is kept under whichever event saved it). `undefined` = not a copy path at all.
 */
export function offlineCopyEventId(path: string): string | null | undefined {
  for (const re of OFFLINE_COPY_SHAPES) {
    const m = re.exec(path);
    if (m) return m[1] ?? null;
  }
  return undefined;
}

/** The coordinator's pages for one event. */
export function coordinatorOfflinePaths(eventId: string, opts: { checkin: boolean }): string[] {
  if (!EVENT_ID.test(eventId)) return [];
  const base = `/dashboard/${eventId}`;
  return opts.checkin ? [base, `${base}/guests/checkin`] : [base];
}

/** The supplier's pages for one event: the Hub, the event's console, and — when they run its door — its desk. */
export function supplierOfflinePaths(eventId: string, opts: { checkin: boolean }): string[] {
  if (!EVENT_ID.test(eventId)) return [];
  const out = ['/vendor-dashboard/on-the-day', `/vendor-dashboard/on-the-day/live/${eventId}`];
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
  /** Whose copies these are (the signed-in account). Exactly one at a time. */
  viewer: string;
  events: Record<string, { until: number; pages: Record<string, number> }>;
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
}): SavedMark {
  const { phase, savedAt, now, online, eventDay } = input;
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
