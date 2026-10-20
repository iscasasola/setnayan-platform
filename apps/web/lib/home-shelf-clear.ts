import { revalidatePath, revalidateTag } from 'next/cache';
import { HOME_SHELF_TAGS, type HomeShelfSubject } from '@/lib/home-shelf-tags';

/**
 * Forget what the home page remembers about a subject, so the next view reads
 * it again. Called by the writes that take something DOWN from the public page
 * — see `HOME_SHELF_DEPENDS` (`lib/home-shelf-tags.ts`) for which columns.
 *
 * ⚠ NO `import 'server-only'` HERE, ON PURPOSE. The writers that call this are
 * plain modules that unit tests load in node (`lib/vendor-verification-state.ts`),
 * where `server-only` cannot be resolved. Outside a request `revalidateTag`
 * throws, which is caught below — so in a test this does nothing, loudly.
 *
 * ⚠ IT NEVER FAILS THE WRITE. The write has already happened when this runs; a
 * clear that could not be made (called from a job with no request behind it,
 * where Next refuses `revalidateTag`) is logged and the hard age remains the
 * bound — 300 s, never longer.
 */
export function clearHomeShelf(...subjects: HomeShelfSubject[]): void {
  for (const subject of subjects) {
    try {
      revalidateTag(HOME_SHELF_TAGS[subject]);
    } catch (error) {
      console.error(`[home-shelf] could not clear "${subject}" — the page catches up within the hard age`, error);
    }
  }
  if (subjects.some((s) => JOURNAL_SUBJECTS.has(s))) {
    try {
      revalidatePath(JOURNAL_ARTICLE_ROUTE, 'page');
    } catch (error) {
      console.error('[home-shelf] could not revalidate the Journal articles — they catch up within their own revalidate', error);
    }
  }
}

/**
 * 📰 THE JOURNAL RIDES THE SAME CLEARS (2026-10-20, fewer-reads). A Journal article
 * (`app/blog/[slug]/page.tsx`, ISR for a day) embeds storyteller chapters and credits
 * shops. The writes that take a chapter, a storyteller or a shop DOWN are exactly the
 * `clears` writes of these three subjects — every one already calls this function
 * (`lib/home-shelf-writes-clear.test.ts`) — so they revalidate every article too, and
 * an unpublished chapter or a hidden shop leaves the Journal at once instead of a day later.
 */
const JOURNAL_SUBJECTS: ReadonlySet<HomeShelfSubject> = new Set<HomeShelfSubject>(['stories', 'people', 'shops']);
export const JOURNAL_ARTICLE_ROUTE = '/blog/[slug]';
