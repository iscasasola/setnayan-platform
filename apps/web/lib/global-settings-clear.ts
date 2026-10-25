import { revalidateTag } from 'next/cache';
import type { GlobalSettingsTag } from '@/lib/global-settings-tags';

/**
 * Forget a remembered platform setting (`lib/global-settings-cache.ts`) from a
 * module that is not itself a server action — the shared write cores in `lib/`
 * (`lib/event-types-mutations.ts`) that the admin actions call.
 *
 * The same shape as `clearHomeShelf` (`lib/home-shelf-clear.ts`), for the same
 * two reasons:
 * ⚠ NO `import 'server-only'`, so a unit test can load the write core in node.
 *   Outside a request Next refuses `revalidateTag`; that is caught below.
 * ⚠ IT NEVER FAILS THE WRITE. The row is already written when this runs; a
 *   clear that could not be made is logged, and the remembered copy catches up
 *   within `GLOBAL_SETTINGS_SECONDS`.
 *
 * Server actions call `revalidateTag(GLOBAL_SETTINGS_TAGS.…)` directly — both
 * spellings are what `lib/global-settings-cache.test.ts` §4 accepts.
 */
export function clearGlobalSettings(...tags: GlobalSettingsTag[]): void {
  for (const tag of tags) {
    try {
      revalidateTag(tag);
    } catch (error) {
      console.error(`[global-settings] could not clear "${tag}" — readers catch up within the remembered window`, error);
    }
  }
}
