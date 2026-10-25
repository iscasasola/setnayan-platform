'use client';

/**
 * The /help · /features search row, signed in — the Discover thumb row's
 * behaviour on these two pages (owner 2026-10-25: *"also the HELP and Features
 * where we can mazimize the app to be searchable"*).
 *
 * Enter puts the words in THIS page's `?q=` (`stayOnPageSearchHref`) and the
 * page draws its results in place, under its head; ✕ — or emptying the box —
 * takes them away and the page comes back. The row never leaves the page it
 * stands on. Page-local: mounted by /help and /features only, never by a
 * shared layout, so the shared first-load JS gains nothing.
 */
import { useRouter } from 'next/navigation';
import { ThumbRow } from '@/components/thumb-row';
import { ThumbDock } from '@/components/thumb-dock';
import { stayOnPageSearchHref } from '@/lib/shell-search';
import { HOW_SEARCH_PLACEHOLDER } from '@/lib/how-search-words';

export function HowSearchRow({ q = '' }: { q?: string }) {
  const router = useRouter();
  const go = (words: string) => router.push(stayOnPageSearchHref(window.location.href, words), { scroll: true });
  return (
    <ThumbDock>
      <ThumbRow
        name="search"
        field={{
          placeholder: HOW_SEARCH_PLACEHOLDER,
          input: {
            enterKeyHint: 'search',
            defaultValue: q,
            onKeyDown: (e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (e.currentTarget.value.trim()) go(e.currentTarget.value);
            },
            // The field's ✕ (or the last letter deleted) while results show: the page comes back.
            onInput: (e) => {
              if (q && e.currentTarget.value === '') go('');
            },
          },
        }}
      />
    </ThumbDock>
  );
}
