import { unstable_cache } from 'next/cache';
import type { GlobalSettingsTag } from './global-settings-tags';

/**
 * global-settings-cache.ts — THE PLATFORM'S OWN SETTINGS ARE READ ONCE A
 * MINUTE, NOT ONCE PER PAGE (2026-10-13, guest-load fix).
 *
 * 🧯 WHY. A signed-in guest opening an invitation sent ~100 database requests
 * (production log, 2026-10-13 03:46 UTC) and several of them were the SAME
 * five rows of platform configuration, asked again by every render of the
 * visit — the page, its siblings, each refresh:
 *
 *     bundle_components     · which products a bundle includes
 *     promo_free_windows    · which products are free right now
 *     data_privacy_controls · which privacy-sensitive features are switched on
 *     reveal_studio_config  · the house look of the opening reveal
 *     event_type_profiles   · the words and surfaces of each event type
 *
 * None of them is about the person looking or about one event. The free
 * database stalls for 2–5 s about 33 times a day, and every request a render
 * makes is one more chance to be standing in one when it does. So these rows
 * are remembered across requests (Next's data cache, `unstable_cache`) for a
 * short while, and the admin screen that edits each one clears it at once
 * (`revalidateTag(GLOBAL_SETTINGS_TAGS.…)`), so an edit is seen on the next
 * page, not a minute later.
 *
 * ─── THE RULES ───────────────────────────────────────────────────────────────
 * 🔒 ROWS, NEVER AN ANSWER ABOUT SOMEBODY. What is remembered is a table's rows
 *    that are the same for every reader (public-read or read with the service
 *    client). Never anything read through a session, never a per-event fact.
 *    Inside `unstable_cache` Next refuses `cookies()`; a loader handed here
 *    must not reach for one.
 * ⛔ A REFUSED READ IS NEVER REMEMBERED. The loader THROWS when the database
 *    did not answer; nothing is stored, the caller falls to its own existing
 *    fallback for this page, and the next page asks again.
 * 📦 JSON ONLY. The data cache stores `JSON.stringify(value)`: a loader returns
 *    plain arrays and objects (never a Set or a Map — build those outside).
 * 🧪 OUTSIDE NEXT (a unit test, a script) there is no data cache: the loader
 *    simply runs, every call, exactly as before this file existed.
 *
 * Held by `lib/global-settings-cache.test.ts` (a refusal is not remembered; a
 * remembered read sends no request; every tag is cleared by its writer).
 */

export { GLOBAL_SETTINGS_TAGS, type GlobalSettingsTag } from './global-settings-tags';

/** How long a remembered row may be shown before it is read again (seconds). */
export const GLOBAL_SETTINGS_SECONDS = 60;

/**
 * Read `load` through the data cache under `key`.
 *
 * `key` names the read and every argument that changes its rows (bump its
 * `-vN` suffix when the SHAPE of what `load` returns changes). `load` is a
 * closure over the caller's client: the rows are the same whoever reads them,
 * which is the rule this file exists under.
 *
 * 🔑 ONLY `load`'s OWN FAILURE IS THROWN. If the data cache itself cannot run —
 * plain node (no data cache at all), or anything else in Next's machinery —
 * the read is simply asked directly, exactly as before this file existed. A
 * failure of the cache must never turn into a caller's fallback (for the
 * bundle list that would be the code's const, for the privacy controls every
 * control OFF) while the database was answering fine.
 */
export async function rememberedGlobalRead<T>(
  key: string,
  tag: GlobalSettingsTag,
  load: () => Promise<T>,
  seconds: number = GLOBAL_SETTINGS_SECONDS,
): Promise<T> {
  let loadFailed = false;
  // One function source for every key: the data cache tells entries apart by
  // `key` alone (its fixed key is this function's text + the key parts).
  const remembered = unstable_cache(
    async () => {
      try {
        return await load();
      } catch (error) {
        loadFailed = true;
        throw error;
      }
    },
    ['global-settings', key],
    { tags: [tag], revalidate: seconds },
  );
  try {
    return await remembered();
  } catch (error) {
    if (loadFailed) throw error;
    return load();
  }
}
