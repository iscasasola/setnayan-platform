/**
 * 💾 LAST-SEEN DATA — THE STORE (owner 2026-10-02, DECISION_LOG "LAST-SEEN DATA
 * SHOWS INSTANTLY, THEN REFRESHES — FOR A HOST'S MAIN PAGES (NEVER MONEY)").
 *
 * A small per-device store of what a host last SAW on five pages — Home, the
 * Guest list, Suppliers, Schedule and Event Details — keyed by account + event
 * + page. On the next visit the page's loading screen paints that snapshot at
 * once under a quiet "Updating…" mark, and the fresh server render replaces it
 * (`app/_components/last-seen/last-seen.tsx`).
 *
 * Lazy-loaded through `./client.ts` (`import()`), never in a page's first load.
 *
 * ── THE RULES THIS FILE ENFORCES (each held by `last-seen.test.ts`) ──────────
 *  1. NEVER MONEY. A snapshot carrying a peso figure or a `data-money` element
 *     is never written and never read back — budgets, payments, prices, owed
 *     and paid always load fresh. The DOM step (`./snapshot-dom.ts`) removes
 *     them; `guardSnapshotHtml` here is the last gate, on BOTH write and read,
 *     so a sanitiser slip fails closed (no snapshot) instead of open.
 *  2. ONE ACCOUNT AT A TIME. The store records whose data it holds. A save or
 *     a read by any other account wipes everything first — a different person
 *     on the same phone never sees the previous person's guests.
 *  3. SIGN-OUT EMPTIES IT (`./wipe.ts`).
 *  4. ONLY WHAT THE PAGE SHOWED. The snapshot is the page's own rendered
 *     output for that signed-in host, with links, form targets, hidden inputs,
 *     hidden elements and inline handlers stripped — nothing the page did not
 *     already put in front of them.
 *  5. SMALL. One entry per page per event, a size cap per entry, and the
 *     oldest entries evicted past a count cap.
 */

import { LAST_SEEN_PREFIX, wipeLastSeen, type LastSeenStorage } from './wipe';

export { wipeLastSeen, LAST_SEEN_PREFIX } from './wipe';
export type { LastSeenStorage } from './wipe';

/** The five host pages that keep a last-seen snapshot — and no others. */
export const LAST_SEEN_PAGES = ['home', 'guests', 'suppliers', 'schedule', 'details'] as const;
export type LastSeenPage = (typeof LAST_SEEN_PAGES)[number];

const VERSION = 'v1';
const OWNER_KEY = `${LAST_SEEN_PREFIX}${VERSION}:owner`;
/**
 * Largest snapshot kept, in UTF-16 code units (what localStorage counts). A
 * 200-name guest list must fit — that is the page this exists for.
 */
export const MAX_ENTRY_CHARS = 1_000_000;
/** All snapshots together stay well inside the ~5M-unit localStorage quota. */
export const MAX_TOTAL_CHARS = 2_500_000;
/** Most snapshots kept on one device; the oldest go first. */
export const MAX_ENTRIES = 10;
/** A snapshot older than this is not shown — it is too old to be "last seen". */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type LastSeenEntry = {
  /** The path the snapshot was taken on — it is only ever shown on that path. */
  url: string;
  html: string;
  savedAt: number;
};

export function lastSeenKey(userId: string, eventId: string, page: LastSeenPage): string {
  return `${LAST_SEEN_PREFIX}${VERSION}:${userId}:${eventId}:${page}`;
}

// ── 1. NEVER MONEY ──────────────────────────────────────────────────────────

/** A peso figure, however it was formatted: ₱12,500 · ₱1.2M · PHP 499 · ₱ 837.50 */
const MONEY_FIGURE = /(?:₱|\bPHP\b|\bPhp\b)\s?-?\d[\d,]*(?:\.\d+)?\s?[KMB]?/g;
const PESO_SIGN = /₱|&#8369;|&#x20b1;/i;
const PHP_AMOUNT = /\bPHP\s?\d/i;
const MONEY_ELEMENT = /\sdata-money(?:[\s=>/])/;

/**
 * The last gate. Returns the html to keep, or `null` when it must not be kept.
 * Masks any stray peso figure, then REFUSES the snapshot if a peso sign, a PHP
 * amount or a `data-money` element is still in it — fail closed.
 */
export function guardSnapshotHtml(html: string): string | null {
  if (typeof html !== 'string' || html.length === 0) return null;
  // React's text separators (`₱<!-- -->12,500`) would split a figure in two.
  let out = html.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(MONEY_FIGURE, '—');
  if (PESO_SIGN.test(out) || PHP_AMOUNT.test(out) || MONEY_ELEMENT.test(out)) return null;
  // Belt over the DOM step's braces: nothing executable survives either.
  if (/<script[\s>]/i.test(out) || /<iframe[\s>]/i.test(out)) return null;
  out = out.replace(/\s(on[a-z]+|href|action|formaction|srcdoc|ping)="[^"]*"/gi, '');
  if (/javascript:/i.test(out)) return null;
  return out;
}

// ── 2. ONE ACCOUNT AT A TIME ────────────────────────────────────────────────

/**
 * Makes `userId` the owner of the store. If anyone else's snapshots are here,
 * they are wiped first. Returns false if the storage refused.
 */
function claimFor(storage: LastSeenStorage, userId: string): boolean {
  const owner = storage.getItem(OWNER_KEY);
  if (owner === userId) return true;
  wipeLastSeen(storage);
  storage.setItem(OWNER_KEY, userId);
  return true;
}

function entryKeys(storage: LastSeenStorage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(`${LAST_SEEN_PREFIX}${VERSION}:`) && k !== OWNER_KEY) keys.push(k);
  }
  return keys;
}

function parseEntry(raw: string | null): LastSeenEntry | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LastSeenEntry>;
    if (typeof v.url !== 'string' || typeof v.html !== 'string' || typeof v.savedAt !== 'number') {
      return null;
    }
    return { url: v.url, html: v.html, savedAt: v.savedAt };
  } catch {
    return null;
  }
}

/**
 * Makes room for a new entry of `incoming` units under `keep`: at most `room`
 * other entries, and all of them together within `MAX_TOTAL_CHARS`. Oldest
 * out first.
 */
function evictOldest(storage: LastSeenStorage, keep: string, room: number, incoming: number): void {
  const others = entryKeys(storage)
    .filter((k) => k !== keep)
    .map((k) => {
      const raw = storage.getItem(k) ?? '';
      return { k, at: parseEntry(raw)?.savedAt ?? 0, size: raw.length };
    })
    .sort((a, b) => a.at - b.at);
  let total = others.reduce((n, o) => n + o.size, 0);
  while (others.length > room || (others.length > 0 && total + incoming > MAX_TOTAL_CHARS)) {
    const victim = others.shift();
    if (!victim) break;
    storage.removeItem(victim.k);
    total -= victim.size;
  }
}

export type SaveInput = {
  userId: string;
  eventId: string;
  page: LastSeenPage;
  url: string;
  html: string;
  now?: number;
};

/** Writes a snapshot. Returns true if it was kept. Never throws. */
export function saveLastSeen(storage: LastSeenStorage | null | undefined, input: SaveInput): boolean {
  if (!storage || !input.userId || !input.eventId) return false;
  if (!(LAST_SEEN_PAGES as readonly string[]).includes(input.page)) return false;
  const html = guardSnapshotHtml(input.html);
  if (html === null || html.length > MAX_ENTRY_CHARS) return false;
  const key = lastSeenKey(input.userId, input.eventId, input.page);
  const value = JSON.stringify({ url: input.url, html, savedAt: input.now ?? Date.now() });
  try {
    claimFor(storage, input.userId);
    evictOldest(storage, key, MAX_ENTRIES - 1, value.length);
    try {
      storage.setItem(key, value);
    } catch {
      // Quota: make room by dropping every other snapshot, then try once more.
      evictOldest(storage, key, 0, value.length);
      storage.setItem(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

export type ReadInput = {
  userId: string;
  eventId: string;
  page: LastSeenPage;
  url: string;
  now?: number;
};

/**
 * Reads the snapshot for this account + event + page, if one may be shown.
 * Another account's data is never returned: if the store belongs to someone
 * else, it is wiped and nothing comes back.
 */
export function readLastSeen(
  storage: LastSeenStorage | null | undefined,
  input: ReadInput,
): LastSeenEntry | null {
  if (!storage || !input.userId || !input.eventId) return null;
  try {
    const owner = storage.getItem(OWNER_KEY);
    if (owner !== input.userId) {
      // Nobody's, or someone else's — either way it is not this person's.
      wipeLastSeen(storage);
      return null;
    }
    const entry = parseEntry(storage.getItem(lastSeenKey(input.userId, input.eventId, input.page)));
    if (!entry || entry.url !== input.url) return null;
    if ((input.now ?? Date.now()) - entry.savedAt > MAX_AGE_MS) return null;
    const html = guardSnapshotHtml(entry.html);
    return html === null ? null : { ...entry, html };
  } catch {
    return null;
  }
}

/** The browser's store, or null when storage is blocked (private mode, a locked WebView). */
export function deviceStorage(): LastSeenStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
