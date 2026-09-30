'use client';

/**
 * guests-top-search.tsx — ON THE GUEST LIST, THE TOP BAR IS THE GUEST SEARCH.
 *
 * ⚖ Owner 2026-09-30 (DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME
 * COLUMNS; HOSTS FOLDS INTO THE GUEST LIST; THE TOP BAR SEARCHES GUESTS"):
 * *"i thought we had a build that will make the search on the top to do the
 * search? so the text box on people will only be add?"* → *"ok"*. And
 * INTERACTION_RULES § 4: "The top bar searches the place you're in … The page
 * itself only has 'Add'."
 *
 * So on `/dashboard/<id>/guests` the shared bar does not open the palette over
 * your own things — it drives the roster's `?q=` filter, the same one the page
 * has always answered server-side. The writer is `LiveSearch` VERBATIM (its
 * debounced `router.replace`, clear-at-once, URL as the source of truth), so
 * landing on `/guests?q=ana` shows "ana" in the bar.
 *
 * 🔑 THE WAY OUT TRAVELS WITH WHAT WAS TYPED. A box narrowed to one event's
 * guests is only honest if the step out keeps the words — the same escape row
 * the palette appends (`marketplaceEscapeItem`, carrying this scope, so it says
 * "You're searching guests · this looks everywhere").
 *
 * 🔑 ⌘K COMES BACK TO THE TOP BAR. It used to be claimed by the page's own
 * search box (`guests-search.tsx`, deleted with the page's search half). This
 * box claims it now, through the same registry, so the palette's listener
 * stands down on this page and the key focuses the box the person can see.
 *
 * ⚠ Mounted by `HomeCommandBar` only when `resolveSearchScope` says `guests`,
 * never on a statically rendered page — which is why reading `useSearchParams`
 * here cannot bail a static route out of prerendering. It is still wrapped in
 * a Suspense boundary, the repo's rule for that hook.
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { claimCommandKey } from '@/lib/command-key-claim';
import { marketplaceEscapeItem } from '@/app/_components/frontdoor/command-escape';
import type { SearchScope } from '@/lib/search-scope';
import { LiveSearch } from '@/app/dashboard/[eventId]/guests/_components/live-search';

function GuestsTopSearchBox({ scope }: { scope: SearchScope }) {
  const initial = useSearchParams().get('q') ?? '';
  const [typed, setTyped] = useState(initial);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // ⌘K is this box's on the Guest list — see the docblock.
  useEffect(() => claimCommandKey(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        rootRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const escape = marketplaceEscapeItem(typed, scope);

  return (
    <div
      ref={rootRef}
      role="search"
      aria-label={scope.placeholder}
      data-guests-top-search=""
      className="relative w-full"
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="sn-tile-glass flex w-full items-center gap-3 rounded-xl px-3 py-1 sm:px-[15px] sm:py-1.5">
        <Search aria-hidden className="h-[18px] w-[18px] shrink-0 text-[color:var(--sn-gold-600)]" strokeWidth={1.75} />
        <LiveSearch
          initialValue={initial}
          placeholder={scope.placeholder}
          onValueChange={setTyped}
          className="h-9 min-w-0 border-0 bg-transparent px-0 text-sm focus:ring-0"
        />
        <kbd
          aria-hidden
          className="hidden rounded-md border border-[color:var(--sn-line)] bg-white/60 px-[7px] py-[3px] font-mono text-[11px] text-[color:var(--sn-ink-400)] sm:inline-block"
        >
          ⌘K
        </kbd>
      </div>
      {focused && escape ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-ink/15 bg-white/95 p-1.5 shadow-[0_24px_48px_-24px_rgba(30,26,18,0.45)] backdrop-blur">
          <Link
            href={escape.href}
            data-guests-top-search-escape=""
            className="block rounded-lg px-3 py-2 text-left hover:bg-mulberry/5"
          >
            <span className="block truncate text-sm font-semibold text-ink">{escape.label}</span>
            <span className="block truncate text-xs text-ink/50">{escape.sublabel}</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function GuestsTopSearch({ scope }: { scope: SearchScope }) {
  return (
    <Suspense fallback={null}>
      <GuestsTopSearchBox scope={scope} />
    </Suspense>
  );
}
