'use client';

/**
 * The account's thumb rows — Events and Discover (owner 2026-10-22, "One thumb
 * row", "Yes to all"). The top bar's 🔍 is gone on every shell (wordmark · ✉ ·
 * 🔔 · avatar), so the search moved DOWN into the row of the place you stand in
 * (ruling 2026-09-23):
 *
 *   Events    "Search events"                     ＋ Create event
 *   Discover  "Search events, people, suppliers"   (no tools beside it)
 *
 * 🔑 ON EVENTS, ENTER GOES WHERE THE PALETTE'S STEP-OUT ROW GOES — `marketplaceEscapeItem`,
 * with this place's scope. One destination for one search, so the row cannot
 * disagree with the shell's own results page (#6782 moves that destination into
 * the shell; this row follows it by construction, never by a second literal).
 * ON DISCOVER, ENTER STAYS ON DISCOVER (owner 2026-10-24) — see `DiscoverThumbRow`.
 */
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { ThumbDock } from '@/components/thumb-dock';
import { marketplaceEscapeItem } from './command-escape';
import { SEARCH_SCOPES, type SearchScopeKey } from '@/lib/search-scope';
import { stayOnPageSearchHref } from '@/lib/shell-search';

export function searchRowHref(q: string, scope: SearchScopeKey): string | null {
  return marketplaceEscapeItem(q, SEARCH_SCOPES[scope])?.href ?? null;
}

function useEnterSearches(scope: SearchScopeKey) {
  const router = useRouter();
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const href = searchRowHref(e.currentTarget.value, scope);
    if (href) router.push(href);
  };
}

export function EventsThumbRow({ createHref = '/dashboard/create-event' }: { createHref?: string }) {
  const onKeyDown = useEnterSearches('events');
  return (
    <ThumbDock>
      <ThumbRow
        name="events"
        field={{ placeholder: 'Search events', input: { enterKeyHint: 'search', onKeyDown } }}
        action={{ icon: Plus, label: 'Create event', href: createHref }}
      />
    </ThumbDock>
  );
}

/**
 * 🔎 DISCOVER SEARCHES IN PLACE (owner 2026-10-24: *"we will show the result on the page itself. not a new screen"*;
 * on the old hop to the shell's results page: *"it went to a different page?"*). Enter puts the words in this page's own
 * `?q=` (`stayOnPageSearchHref`) and the page draws its results where its sections were, under this same row; ✕ — or
 * emptying the box — takes them away and the sections come back. The row never leaves the page it stands on.
 */
export function DiscoverThumbRow({ q = '' }: { q?: string }) {
  const router = useRouter();
  const go = (words: string) => router.push(stayOnPageSearchHref(window.location.href, words), { scroll: true });
  return (
    <ThumbDock>
      <ThumbRow
        name="discover"
        field={{
          placeholder: 'Search events, people, suppliers',
          input: {
            enterKeyHint: 'search',
            defaultValue: q,
            onKeyDown: (e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (e.currentTarget.value.trim()) go(e.currentTarget.value);
            },
            // The field's ✕ (or the last letter deleted) while results show: Discover comes back.
            onInput: (e) => {
              if (q && e.currentTarget.value === '') go('');
            },
          },
        }}
      />
    </ThumbDock>
  );
}
