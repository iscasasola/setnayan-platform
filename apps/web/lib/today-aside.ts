/**
 * lib/today-aside.ts — "GOT IT" AND "NOT NOW" ON TODAY v2 (pure).
 *
 * The drawing (`Today, one task` v2, part 7): a lapsed ask clears with **Got it** (there is nothing to answer, and the
 * note clears itself on the desk in a few days); a credit or gift row clears with **Not now** — for today only.
 *
 * 🔑 NO TABLE AND NO SERVER ACTION (Rule 0 rule 3 + the route budget): both are what THIS supplier has seen on THIS
 * device, not a fact about the booking, so they live in one small first-party cookie the Today page reads. A "Not now"
 * is dated and lapses at Manila midnight; a "Got it" is kept until its row leaves the desk on its own, and counts
 * toward "Done today" on the day it was pressed. Nothing a couple sees changes.
 */
export const TODAY_ASIDE_COOKIE = 'sn_today_aside';

export type TodayAside = {
  /** `YYYY-MM-DD` (Manila) the "Not now" list belongs to. */
  d: string;
  notNow: string[];
  /** Row key → the Manila day it was cleared. */
  gotIt: Record<string, string>;
};

const EMPTY = (d: string): TodayAside => ({ d, notNow: [], gotIt: {} });
const ID = /^[A-Za-z0-9_-]{1,80}$/;

/** The cookie's value → today's set-asides. Total: anything unreadable is an empty list, never a throw. */
export function readTodayAside(raw: string | null | undefined, todayIso: string): TodayAside {
  if (!raw) return EMPTY(todayIso);
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<TodayAside>;
    const notNow = v.d === todayIso && Array.isArray(v.notNow) ? v.notNow.filter((x) => typeof x === 'string' && ID.test(x)).slice(0, 40) : [];
    const gotIt: Record<string, string> = {};
    if (v.gotIt && typeof v.gotIt === 'object') {
      for (const [k, day] of Object.entries(v.gotIt).slice(0, 60)) {
        if (ID.test(k) && typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)) gotIt[k] = day;
      }
    }
    return { d: todayIso, notNow, gotIt };
  } catch {
    return EMPTY(todayIso);
  }
}

/** Every row key set aside right now (both kinds). */
export function asideKeys(a: TodayAside): Set<string> {
  return new Set([...a.notNow, ...Object.keys(a.gotIt)]);
}

/** How many "Got it" presses were today — they count as finished today. */
export function gotItToday(a: TodayAside, visibleKeys: ReadonlySet<string>): number {
  return Object.entries(a.gotIt).filter(([k, day]) => day === a.d && visibleKeys.has(k)).length;
}

/** The next cookie value after a press, keeping only "Got it" rows still on the desk (so it never grows). */
export function setAside(a: TodayAside, key: string, how: 'notNow' | 'gotIt', onDesk: readonly string[]): string {
  const live = new Set(onDesk);
  const gotIt = Object.fromEntries(Object.entries(a.gotIt).filter(([k]) => live.has(k)));
  const next: TodayAside = how === 'gotIt' ? { ...a, gotIt: { ...gotIt, [key]: a.d } } : { ...a, gotIt, notNow: [...new Set([...a.notNow, key])] };
  return encodeURIComponent(JSON.stringify(next));
}
