import 'server-only';

import { DEFAULT_EVENT_TZ } from '@/lib/schedule';
import type { PoolItem, ResolvedArrangement, RunOfShowMoment } from '@/lib/story-arrangement';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { loadArrangementForHost } from './load-arrangement';

/**
 * WHAT "MAKE IT YOURS" IS HANDED (step 4) — the host's arrangement from step 3's one read,
 * turned into what a browser can draw.
 *
 * 🔑 NO SECOND READ. Everything here comes out of `loadArrangementForHost`, the same read the
 * public page uses, asked as the host — so the consent veto (S14) has already taken a guest's
 * photograph off the host's pages and out of the tray before this function sees it.
 *
 * 🔒 THE STORAGE KEYS STAY ON THE SERVER. The browser gets a short-lived signed address to draw
 * and nothing it could keep: every `stillKey` / `playKey` is emptied before the pool leaves
 * here. The editor only ever needs the capture's id (`ref`) to arrange it.
 */

export type MakeItYoursMedia = {
  /** A signed address for the still. Null when it could not be signed — drawn as a blank frame. */
  url: string | null;
  /** The capture's clock time at the venue, e.g. "2:38 PM". Empty when unknown. */
  time: string;
};

export type MakeItYoursInput = {
  version: number;
  initial: ResolvedArrangement;
  runOfShow: RunOfShowMoment[];
  pool: PoolItem[];
  media: Record<string, MakeItYoursMedia>;
  /** Each run-of-show moment's start at the venue, keyed by moment id. */
  momentTimes: Record<string, string>;
  /**
   * What could not be read, in the host's words. NON-EMPTY MEANS THE EDITOR MUST NOT SAVE: an
   * unreadable pool looks exactly like a day with no photos, and saving it would take every
   * photograph off every page.
   */
  unreadable: string[];
  poolTruncated: boolean;
};

const WHAT: Record<string, string> = {
  arrangement: 'what you arranged',
  run_of_show: 'your run of show',
  pool: 'the photos from the day',
};

/**
 * A clock time the SAME way on the server and in every browser. `toLocaleTimeString` is not:
 * ICU builds disagree about the space before "PM" (a narrow no-break space in some), and a
 * string that differs between the server render and the browser is a hydration error.
 */
export function clockAt(ms: number | null, tz: string = DEFAULT_EVENT_TZ): string {
  if (ms === null || !Number.isFinite(ms)) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(new Date(ms));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const h = get('hour');
    const m = get('minute');
    const period = get('dayPeriod').toUpperCase();
    return h && m ? `${h}:${m}${period ? ` ${period}` : ''}` : '';
  } catch {
    return '';
  }
}

const withoutKeys = (p: PoolItem): PoolItem => ({ ...p, stillKey: null, playKey: null });

/**
 * `null` — not a host of this celebration (the editor then renders nothing).
 */
export async function loadMakeItYours(eventId: string): Promise<MakeItYoursInput | null> {
  const loaded = await loadArrangementForHost(eventId);
  if (!loaded) return null;

  // The pool is every capture this host may see: those on a page, and those in the tray.
  const pool: PoolItem[] = [];
  const seen = new Set<string>();
  const add = (p: PoolItem) => {
    if (seen.has(p.ref)) return;
    seen.add(p.ref);
    pool.push(p);
  };
  for (const m of loaded.moments) {
    for (const o of m.objects) {
      if (o.kind === 'photo') {
        add({
          ref: o.ref,
          media: o.media,
          capturedAtMs: o.capturedAtMs,
          stillKey: o.stillKey,
          playKey: o.playKey,
        });
      }
    }
  }
  for (const p of loaded.unplaced) add(p);
  pool.sort((a, b) => {
    const at = a.capturedAtMs ?? Number.POSITIVE_INFINITY;
    const bt = b.capturedAtMs ?? Number.POSITIVE_INFINITY;
    return at !== bt ? at - bt : a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
  });

  const media: Record<string, MakeItYoursMedia> = {};
  await Promise.all(
    pool.map(async (p) => {
      let url: string | null = null;
      try {
        url = p.stillKey ? await displayUrlForStoredAsset(p.stillKey) : null;
      } catch {
        url = null;
      }
      media[p.ref] = { url, time: clockAt(p.capturedAtMs) };
    }),
  );

  const momentTimes: Record<string, string> = {};
  for (const b of loaded.runOfShow) momentTimes[b.id] = clockAt(b.startMs);

  const initial: ResolvedArrangement = {
    mode: loaded.mode,
    handTouched: loaded.handTouched,
    hasRunOfShow: loaded.hasRunOfShow,
    withheld: loaded.withheld,
    sets: loaded.sets,
    unplaced: loaded.unplaced.map(withoutKeys),
    moments: loaded.moments.map((m) => ({
      ...m,
      objects: m.objects.map((o) =>
        o.kind === 'photo' ? { ...o, stillKey: null, playKey: null } : o,
      ),
    })),
  };

  return {
    version: loaded.version,
    initial,
    runOfShow: loaded.runOfShow,
    pool: pool.map(withoutKeys),
    media,
    momentTimes,
    unreadable: loaded.unreadable.map((s) => WHAT[s] ?? s),
    poolTruncated: loaded.poolTruncated,
  };
}
