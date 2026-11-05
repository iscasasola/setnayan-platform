/**
 * 🕘 THE PICKER'S "RECENTLY USED" (owner 2026-10-17, on the colour sheet opened from Mood Board › Attire:
 * *"maybe there is a better way to arrange this scroll free. so color code box can be viewed easily. Just
 * have the Moodboard and Recently Used 5 colors."*).
 *
 * The colours this person last picked IN THE ONE PICKER (`colour-picker-sheet.tsx`), on this event —
 * newest first, each once, never one of the Mood Board's own five (those already have their row), and
 * never more than five on screen.
 *
 * 🔒 A CONVENIENCE, NOT A RECORD. It lives in this browser only (`localStorage`), keyed by the signed-in
 * account AND the event (`useLastSeenScope`, handed down by the event layout), so a second person on the
 * same phone, or the same person on another event, never sees these. Every read and write is wrapped:
 * storage that throws (a private window, blocked site data) or holds junk gives an empty shelf — the
 * picker works exactly as before, with no Recently used row. Nothing here is ever sent anywhere.
 */

/** How many the shelf shows — one row of five. */
export const RECENT_SHOWN = 5;
/** How many are kept, so the shelf still has five after the Mood Board's own are left out. */
export const RECENT_KEPT = 12;

/** Bumped if the stored shape ever changes; an older list is simply not read. */
const VERSION = 'v1';

export function recentColourKey(userId: string, eventId: string): string {
  return `sn:colour-recent:${VERSION}:${userId}:${eventId}`;
}

/** A colour as upper-case `#RRGGBB` ("c9a86a", "#C9A86A"), or null. Self-contained: `mood-board-studio.ts` imports this file. */
function cleanHexInput(raw: string): string | null {
  const v = raw.trim().replace(/^#?/, '#').toUpperCase();
  return /^#[0-9A-F]{6}$/.test(v) ? v : null;
}

/** Upper-case `#RRGGBB`, each once, in the order given. */
function cleanList(list: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const v of list) {
    const hex = typeof v === 'string' ? cleanHexInput(v.slice(0, 7)) : null;
    if (hex && !out.includes(hex)) out.push(hex);
  }
  return out;
}

/** The stored list, or empty for anything that is not one (nothing stored, junk, another shape). */
export function parseRecentColours(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? cleanList(v).slice(0, RECENT_KEPT) : [];
  } catch {
    return [];
  }
}

/** `hex` picked just now: it leads, any earlier copy of it goes, the list is capped. Not a colour → unchanged. */
export function withRecentColour(list: readonly string[], hex: string): string[] {
  const now = cleanHexInput(hex.slice(0, 7));
  const kept = cleanList(list);
  if (!now) return kept.slice(0, RECENT_KEPT);
  return [now, ...kept.filter((c) => c !== now)].slice(0, RECENT_KEPT);
}

/** What the shelf draws: newest first, none of the Mood Board's five, at most five. */
export function recentColoursToShow(list: readonly string[], palette: readonly string[]): string[] {
  const board = new Set(cleanList(palette));
  return cleanList(list)
    .filter((c) => !board.has(c))
    .slice(0, RECENT_SHOWN);
}

/** The minimal storage this needs — `window.localStorage`, or a stand-in in a test. */
export type RecentStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readRecentColours(storage: RecentStorage | null, key: string | null): string[] {
  if (!storage || !key) return [];
  try {
    return parseRecentColours(storage.getItem(key));
  } catch {
    return [];
  }
}

/** Remember `hex` as picked just now. Returns the new list (the old one when storage refuses). */
export function rememberRecentColour(storage: RecentStorage | null, key: string | null, hex: string): string[] {
  const before = readRecentColours(storage, key);
  if (!storage || !key) return before;
  const next = withRecentColour(before, hex);
  try {
    storage.setItem(key, JSON.stringify(next));
    return next;
  } catch {
    return before;
  }
}

/** `window.localStorage`, or null where reaching it throws (or there is no window). */
export function browserStorage(): RecentStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
