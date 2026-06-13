'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export type TaxonomyOption = {
  /** The canonical_service key — written verbatim into `?category=` on select. */
  key: string;
  /** Human display label (derived server-side from the key). */
  label: string;
  /** Short mega-column hint shown as secondary text in each row. */
  column: string;
};

type Props = {
  initialQuery: string;
  options: ReadonlyArray<TaxonomyOption>;
  /**
   * Visual variant. `'bar'` (default) is the compact 44pt pill used inside the
   * StickyMarketplaceHeader + FocusedModeSearchForm — unchanged. `'hero'` is
   * the big centered field used by the Explore search-first hero (2026-06-13):
   * taller, rounded-full, Clean-Editorial `--m-*` marketing tokens, soft
   * shadow. The autocomplete behaviour (suggestion-pick → ?category= push,
   * free-text Enter → surrounding form GET) is identical across both.
   */
  variant?: 'bar' | 'hero';
  /** Other filter values, preserved verbatim when a suggestion is selected. */
  preserve: {
    city: string;
    sort: string;
    verifiedOnly: boolean;
    matchEvent: boolean;
    eventType: string | null;
    /** Folder scope (Task #47) — when the host arrived from a planning
     *  card with `?folder=…`, keep it on the URL when the autocomplete
     *  push fires so the marketplace stays scoped. Null = no folder set
     *  (universal Browse). */
    folder?: string | null;
    /** Focused-mode flag (owner directive 2026-05-22). When set to
     *  `'plan'`, the host arrived from a dashboard planning card; the
     *  marketplace chrome stays hidden after the autocomplete push.
     *  Null = direct visit (full chrome). */
    from?: 'plan' | null;
  };
};

const MAX_SUGGESTIONS = 8;
const MIN_QUERY_LEN = 2;

/**
 * Marketplace search input with taxonomy autocomplete.
 *
 * Two interaction paths sharing the same field:
 *
 *   1. Pick a suggestion (click / Enter on highlighted row) → router-push to
 *      `/vendors?category=<canonical_service>` so the marketplace filters
 *      to vendors who list that service. Bypasses form submission.
 *
 *   2. Type free text + click "Apply filters" (or hit Enter outside the
 *      suggestion list) → the surrounding form submits normally and the
 *      `q` value runs an ilike against business_name. Same behavior as
 *      the previous plain input.
 *
 * The 192-item taxonomy lives in `@/lib/taxonomy`. Suggestions are
 * scored: prefix match > substring > snake_case-key contains. Cap is 8
 * rows so the dropdown doesn't dwarf the form.
 */
export function TaxonomySearch({
  initialQuery,
  options,
  preserve,
  variant = 'bar',
}: Props) {
  const router = useRouter();
  const isHero = variant === 'hero';
  const containerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  // Click-outside + ESC close.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const suggestions = useMemo(() => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length < MIN_QUERY_LEN) return [];
    const snakeQuery = trimmed.replace(/\s+/g, '_');
    type Scored = TaxonomyOption & { score: number };
    const matches: Scored[] = [];
    for (const opt of options) {
      const labelLc = opt.label.toLowerCase();
      const keyLc = opt.key.toLowerCase();
      let score = 0;
      if (labelLc.startsWith(trimmed)) score = 3;
      else if (labelLc.includes(trimmed)) score = 2;
      else if (keyLc.includes(snakeQuery)) score = 1;
      if (score > 0) matches.push({ ...opt, score });
    }
    matches.sort(
      (a, b) => b.score - a.score || a.label.localeCompare(b.label),
    );
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [value, options]);

  function selectOption(opt: TaxonomyOption) {
    const params = new URLSearchParams();
    params.set('category', opt.key);
    if (preserve.city) params.set('city', preserve.city);
    if (preserve.sort && preserve.sort !== 'most_reviews') {
      params.set('sort', preserve.sort);
    }
    if (preserve.verifiedOnly) params.set('verified', '1');
    if (preserve.matchEvent) params.set('match', '1');
    if (preserve.eventType) params.set('event_type', preserve.eventType);
    if (preserve.folder) params.set('folder', preserve.folder);
    // Owner directive 2026-05-22 — keep focused-mode chrome stripped
    // when the host picks a suggestion from a planning-card-launched
    // marketplace visit. Null on direct visits → no `from` param → full
    // chrome on the landed page.
    if (preserve.from === 'plan') params.set('from', 'plan');
    setOpen(false);
    router.push('/vendors?' + params.toString());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(
        (i) => (i - 1 + suggestions.length) % suggestions.length,
      );
    } else if (e.key === 'Enter') {
      // Only intercept Enter when the user is actively on a suggestion —
      // otherwise let the surrounding form submit (free-text search).
      const target = suggestions[activeIdx];
      if (target) {
        e.preventDefault();
        selectOption(target);
      }
    }
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <Search
        aria-hidden
        className={
          isHero
            ? 'pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--m-slate-3)]'
            : 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40'
        }
        strokeWidth={1.75}
      />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActiveIdx(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={
          isHero
            ? 'Search photographers, caterers, livestream…'
            : 'Search vendors, services, or places…'
        }
        className={
          isHero
            ? 'h-14 w-full rounded-full border border-[color:var(--m-line)] bg-[color:var(--m-paper)] pl-12 pr-4 text-base text-[color:var(--m-ink)] placeholder:text-[color:var(--m-slate-3)] shadow-[var(--m-shadow-md)] transition-colors focus:border-[color:var(--m-orange)] focus:outline-none focus:ring-2 focus:ring-[color:var(--m-orange)]/25'
            : 'input-field w-full pl-9'
        }
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="taxonomy-suggestions"
        aria-expanded={showDropdown}
      />
      {showDropdown ? (
        <div
          id="taxonomy-suggestions"
          role="listbox"
          // 2026-05-30 mobile pattern lock — owner directive *"any choices
          // when clicking on mobile mode should show as a pop up crawling
          // up."* When the search bar lives at the BOTTOM of the viewport
          // on mobile (per StickyMarketplaceHeader's `fixed bottom-0`
          // mobile variant), suggestions can't drop down — they'd clip
          // off-screen. Instead they rise UP above the input: `bottom-full
          // mb-2` on mobile → panel sits flush above the input with an 8px
          // gap. The `animate-in fade-in slide-in-from-bottom-2 duration-200`
          // utilities (from `tailwindcss-animate`) give the "crawls up"
          // feel — panel slides up 8px while fading in over 200ms. On
          // desktop (≥ sm) the bar stays pinned to the TOP so suggestions
          // drop DOWN as before: `sm:bottom-auto sm:top-full sm:mt-1
          // sm:mb-0` overrides the mobile up-position. The `sm:slide-in-
          // from-top-2` flips the slide direction so desktop animates
          // top-down (drops in 8px from above), matching the visual flow
          // of a normal dropdown. `rounded-t-2xl` on mobile gives the
          // panel a bottom-sheet-like cap; `sm:rounded-xl` returns it to
          // a regular dropdown radius on desktop.
          //
          // 2026-06-13 — the `'hero'` variant always drops DOWN (the Explore
          // search-first hero sits near the top of the viewport, so there's
          // room below + no bottom-pinned bar to dodge). It also picks up the
          // `--m-*` marketing surface (paper panel + soft shadow + rounded-2xl)
          // so the dropdown reads as part of the premium hero, not the
          // compact marketplace chrome.
          className={
            isHero
              ? 'absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[color:var(--m-line)] bg-[color:var(--m-paper)] shadow-[var(--m-shadow-lg)] animate-in fade-in slide-in-from-top-2 duration-200'
              : 'absolute left-0 right-0 z-30 max-h-72 overflow-y-auto border border-ink/15 bg-cream shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 bottom-full mb-2 rounded-t-2xl sm:bottom-auto sm:top-full sm:mt-1 sm:mb-0 sm:rounded-xl sm:slide-in-from-top-2'
          }
        >
          <p className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
            Categories ({suggestions.length})
          </p>
          {suggestions.map((opt, idx) => {
            const active = idx === activeIdx;
            return (
              <button
                key={opt.key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={
                  'flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm ' +
                  (active
                    ? 'bg-terracotta/10 text-ink'
                    : 'text-ink/85 hover:bg-terracotta/5')
                }
              >
                <span className="font-medium">{opt.label}</span>
                <span className="shrink-0 text-xs text-ink/45">{opt.column}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
