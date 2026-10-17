import { unstable_cache } from 'next/cache';

/**
 * live-day-cache.ts — ON THE DAY, ONE ANSWER PER EVENT EVERY FEW SECONDS, HOWEVER MANY PHONES ASK
 * (2026-10-18, live-day polling · owner: "make sure app will not collapse when a lot of users are … connecting to the
 * event").
 *
 * 🧯 WHY. Every open guest phone asks the server the same questions on a timer while the event is live — the photo
 * wall's freshness feed, the watch link, the coordinator's announcement, "has anything changed?". The ANSWER is the same
 * for every guest of one event, but each ask used to be its own set of database reads, so 200 phones were 200 × the
 * reads of one. Here the answer is remembered for a few seconds (Next's data cache, `unstable_cache`, shared by every
 * server instance) under a key that names the EVENT, so the database is asked once per event per window, whatever the
 * number of guests watching.
 *
 * This is `lib/global-settings-cache.ts`'s pattern (`rememberedGlobalRead`) applied to one event's live answers, with
 * the same three rules:
 *
 * 🔒 THE SAME FOR EVERY READER. What is remembered is an answer that does not depend on who asks: read with the service
 *    client, never through a session, never `cookies()` (Next refuses it inside `unstable_cache`). A caller that needs a
 *    per-viewer gate asks it OUTSIDE, around the remembered answer.
 * ⛔ A REFUSED OR UNMEASURED ANSWER IS NEVER REMEMBERED. A loader that THROWS stores nothing (the next ask reads again).
 *    A loader whose answer is honest but must not be handed to everyone for the next few seconds — "status unreadable",
 *    "closed because a read failed" — wraps it in `notRemembered(value)`: this caller gets the value, nobody else does.
 *    One guest's blip must never become every guest's answer.
 * 📦 JSON ONLY (the data cache stores `JSON.stringify(value)`).
 * 🧪 OUTSIDE NEXT (a unit test, a script) there is no data cache: the loader simply runs, every call.
 *
 * Held by `lib/live-day-answers-are-shared.test.ts`.
 */

/**
 * THE EDGE HALF. A shared answer may also be held by Vercel's CDN for a few seconds, so most polls never reach a
 * function. The policy goes in `Vercel-CDN-Cache-Control` (consumed by Vercel, never forwarded), and the browser is
 * told `max-age=0, must-revalidate` — a phone must never show itself a stale copy from its own cache. And the phones
 * ask with no request cache directive (plain `fetch`): `cache: 'no-store'` sends `Cache-Control: no-cache`, which
 * `next dev` treats as "skip the data cache" (measured: 78 reads for 77 polls in the lab) and which a CDN may honour.
 */
export function liveEdgeHeaders(cdnSeconds: number, staleSeconds = 0): Record<string, string> {
  return {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Vercel-CDN-Cache-Control': staleSeconds > 0 ? `max-age=${cdnSeconds}, stale-while-revalidate=${staleSeconds}` : `max-age=${cdnSeconds}`,
  };
}

/** Never held anywhere — a refusal, an unmeasured answer, a closed event's private answer. */
export const NOT_HELD: Record<string, string> = { 'Cache-Control': 'private, no-store' };

/** How long one event's live answer may be handed out before it is read again (seconds). */
export const LIVE_DAY_SECONDS = 10;

/** The data-cache tag for one event's live answers — a writer that must be seen AT ONCE clears it. */
export function liveDayTag(eventKey: string): string {
  return `live-day:${eventKey}`;
}

const NOT_REMEMBERED = Symbol('live-day-not-remembered');
type NotRemembered<T> = { [NOT_REMEMBERED]: true; value: T };

/** An honest answer for THIS caller that must not be stored for the others. See the docblock. */
export function notRemembered<T>(value: T): never {
  throw { [NOT_REMEMBERED]: true, value } satisfies NotRemembered<T>;
}

function isNotRemembered<T>(e: unknown): e is NotRemembered<T> {
  return typeof e === 'object' && e !== null && NOT_REMEMBERED in e;
}

/**
 * Read `load` through the data cache under `key`, tagged for `eventKey`.
 *
 * `key` names the answer and everything that changes it (bump its `-vN` suffix when the SHAPE changes). `load` throws
 * to refuse (nothing stored, the error reaches the caller) or calls `notRemembered(value)` to answer this caller only.
 * If the data cache itself cannot run, the read is asked directly — a broken cache must never become an outage.
 */
export async function rememberedLiveRead<T>(
  key: string,
  eventKey: string,
  load: () => Promise<T>,
  seconds: number = LIVE_DAY_SECONDS,
): Promise<T> {
  // A holder, not two `let`s: the loader runs inside the cache's closure, and a narrowed `let` would read as still
  // 'no' to the compiler at the checks below.
  const outcome: { settled: 'no' | 'threw' | 'not-remembered'; error: unknown } = { settled: 'no', error: undefined };
  const remembered = unstable_cache(
    async () => {
      try {
        return await load();
      } catch (error) {
        outcome.settled = isNotRemembered(error) ? 'not-remembered' : 'threw';
        outcome.error = error;
        throw error;
      }
    },
    ['live-day', key],
    { tags: [liveDayTag(eventKey)], revalidate: seconds },
  );
  try {
    return await remembered();
  } catch (error) {
    if (outcome.settled === 'not-remembered') return (outcome.error as NotRemembered<T>).value;
    if (outcome.settled === 'threw') throw outcome.error;
    // The cache machinery failed (or no data cache — plain node): ask directly, once.
    try {
      return await load();
    } catch (direct) {
      if (isNotRemembered<T>(direct)) return direct.value;
      throw direct;
    }
  }
}
