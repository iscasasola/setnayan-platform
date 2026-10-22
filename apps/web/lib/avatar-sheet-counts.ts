/**
 * "• N new" ON THE AVATAR SHEET'S ROWS (Direction 2, owner 2026-10-22 — Facebook's switcher, "each row with its
 * • N new").
 *
 * ONE read, the bell's own: this login's unread notifications (`user_id`, `read_at is null` — what
 * `readUnreadNotificationCount` counts). Each one already says where it leads (`related_url`), so the rows split that
 * one set by place: `/admin…` is Setnayan HQ's, `/vendor-dashboard…` is the shop's, the rest is Your events. The
 * three numbers add up to the bell — they are the bell's count, told per row.
 *
 * 🔒 A FAILED READ DRAWS NOTHING, NEVER 0. `readSheetUnread` answers `null` when the read is refused, throws, or
 * returns fewer rows than the server counted (a split of half the set is not the set). `null` → no row draws a
 * count. A "0" is never drawn either way: zero new is no badge, the same as the bell.
 *
 * 🔒 A COUNT THAT CANNOT BE ATTRIBUTED IS NOT DRAWN. A notification names `/vendor-dashboard/…`, never which shop —
 * so when the sheet lists more than one shop, no shop row draws a count (`shop: null`). It still is not counted
 * as Your events: it belongs to a shop, just not to one we can name.
 *
 * Read on OPEN, in the browser, once per opening — the sheet renders on every page, and a count nobody opened the
 * sheet to see should cost nothing.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type SheetUnread = {
  /** Your events — every unread that is not the shop's or HQ's. */
  events: number;
  /** The shop row's count — null when the sheet lists more than one shop (cannot be attributed). */
  shop: number | null;
  /** Setnayan HQ's count (admin tray). */
  admin: number;
};

/** The ceiling on one read. Past it the split is not attempted (answer unknown), never truncated. */
export const SHEET_UNREAD_CEILING = 1000;

function placeOf(url: string | null | undefined): 'admin' | 'shop' | 'events' {
  const path = (url ?? '').trim();
  if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/admin?')) return 'admin';
  if (path === '/vendor-dashboard' || path.startsWith('/vendor-dashboard/') || path.startsWith('/vendor-dashboard?'))
    return 'shop';
  return 'events';
}

/** Split the unread set by place. `shopRows` = how many shop rows the sheet draws. */
export function splitSheetUnread(urls: readonly (string | null)[], shopRows: number): SheetUnread {
  let events = 0;
  let shop = 0;
  let admin = 0;
  for (const u of urls) {
    const p = placeOf(u);
    if (p === 'admin') admin += 1;
    else if (p === 'shop') shop += 1;
    else events += 1;
  }
  return { events, shop: shopRows === 1 ? shop : null, admin };
}

/** This login's unread notifications' destinations — null when they could not ALL be read. */
export async function readSheetUnreadUrls(
  supabase: SupabaseClient,
  userId: string,
): Promise<(string | null)[] | null> {
  try {
    const { data, error, count } = await supabase
      .from('notifications')
      .select('related_url', { count: 'exact' })
      .eq('user_id', userId)
      .is('read_at', null)
      .range(0, SHEET_UNREAD_CEILING - 1);
    if (error || !Array.isArray(data)) return null;
    if (typeof count !== 'number' || count !== data.length) return null;
    return data.map((r) => ((r as { related_url?: string | null }).related_url ?? null));
  } catch {
    return null;
  }
}

/** What a row draws: the words "N new" for a real positive number, else nothing at all. */
export function newLabel(n: number | null | undefined): string | null {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? `${n} new` : null;
}
