'use client';

/**
 * MobileGuestCarousel — the lower-third control surface on phones/tablets
 * for the Guests page (iteration 0001, 2026-06-02).
 *
 * Owner directive: "mobile version — the top part of the screen will be
 * just the guest list, scrollable, and the lower third is a carousel:
 * first is searching and sorting, second is adding, third is customizing
 * the list / changing details."
 *
 * Layout: the guest list scrolls in the top region; this component docks a
 * fixed, ~one-third-height carousel above the customer bottom nav. It is
 * three swipeable panels:
 *   1. Find     — LiveSearch (writes ?q=, debounced) + Sort pills
 *   2. Add      — opens the existing QuickAddSheet (rapid add + dup detect
 *                 + multi-role) + Quick-add list + Import CSV
 *   3. Customize — View / Groups / Tags filters that customize what the
 *                 list shows (the desktop FacetsSidebar facets, otherwise
 *                 lg:block-only and unreachable on a phone)
 *
 * Supersedes the single docked MobileActionBar. Tabs at the top jump
 * between panels; horizontal swipe works too. All `lg:hidden` — desktop
 * keeps the inline Toolbar + sticky FacetsSidebar untouched.
 *
 * Height comes from `--gcar-h` set on the page <section>; the component
 * renders an in-flow spacer of the same height so the guest list's last
 * rows clear the fixed carousel. Sits at z-40 (above page content); the
 * bottom nav is z-30 below it.
 */

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Plus, Upload, ListPlus, X } from 'lucide-react';
import { LiveSearch } from './live-search';

type Opt = { key: string; label: string };
type Group = { group_id: string; label: string; member_count?: number };

const PANELS = [
  { key: 'find', label: 'Search & sort' },
  { key: 'add', label: 'Add' },
  { key: 'customize', label: 'Customize' },
] as const;

export function MobileGuestCarousel({
  eventId,
  q,
  sorts,
  currentSort,
  views,
  activeView,
  groups,
  currentGroupId,
  tags,
  activeTag,
}: {
  eventId: string;
  q: string;
  sorts: Opt[];
  currentSort: string;
  views: Opt[];
  activeView: string;
  groups: Group[];
  currentGroupId: string | null;
  tags: string[];
  activeTag: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Client mirror of the server FacetsSidebar buildHref so active state +
  // clearing stay in sync with the live URL.
  const buildHref = useCallback(
    (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null) params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      return `${pathname}${qs ? `?${qs}` : ''}`;
    },
    [pathname, searchParams],
  );

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    setActive(i);
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== active) setActive(i);
  };

  const openAdd = () =>
    window.dispatchEvent(new CustomEvent('setnayan:quick-add-open'));

  const hasActiveFilter =
    Boolean(currentGroupId) ||
    (Boolean(activeView) && activeView !== 'all') ||
    Boolean(activeTag);

  return (
    <>
      {/* in-flow spacer so the guest list clears the fixed carousel */}
      <div aria-hidden className="h-[var(--gcar-h)] lg:hidden" />

      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 h-[var(--gcar-h)] border-t border-ink/10 bg-cream lg:hidden">
        {/* panel tabs (tap to jump; swipe also works) */}
        <div className="flex h-10 items-stretch gap-1 border-b border-ink/10 px-2 py-1.5">
          {PANELS.map((p, i) => (
            <button
              key={p.key}
              type="button"
              onClick={() => goTo(i)}
              aria-pressed={active === i}
              className={`flex-1 rounded-lg text-xs font-medium transition-colors ${
                active === i
                  ? 'bg-terracotta/10 text-terracotta-700'
                  : 'text-ink/55 hover:bg-ink/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* swipe track — 3 panels, scroll-snap */}
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex h-[calc(var(--gcar-h)-2.5rem)] snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* 1 — Find: search + sort */}
          <section className="w-full shrink-0 snap-center space-y-3 overflow-y-auto px-4 py-3">
            <LiveSearch initialValue={q} placeholder="Search guests…" />
            <div>
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                Sort
              </h3>
              <div className="flex flex-wrap gap-2">
                {sorts.map((s) => (
                  <Pill key={s.key} href={buildHref({ sort: s.key })} active={currentSort === s.key}>
                    {s.label}
                  </Pill>
                ))}
              </div>
            </div>
          </section>

          {/* 2 — Add */}
          <section className="flex w-full shrink-0 snap-center flex-col justify-center gap-2 overflow-y-auto px-4 py-3">
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-mulberry px-4 py-3 text-sm font-semibold text-cream hover:bg-mulberry-600"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Add a guest
            </button>
            <Link
              href={`/dashboard/${eventId}/guests/quick`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink hover:border-ink/30"
            >
              <ListPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Quick-add list
            </Link>
            <Link
              href={`/dashboard/${eventId}/guests/import`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink hover:border-ink/30"
            >
              <Upload className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Import CSV
            </Link>
          </section>

          {/* 3 — Customize: view / groups / tags */}
          <section className="w-full shrink-0 snap-center space-y-4 overflow-y-auto px-4 py-3">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                  View
                </h3>
                {hasActiveFilter ? (
                  <Link
                    href={buildHref({ view: null, tag: null })}
                    className="inline-flex items-center gap-1 text-[11px] text-ink/55 hover:text-ink"
                  >
                    <X className="h-3 w-3" strokeWidth={2} aria-hidden />
                    Clear
                  </Link>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {views.map((v) => (
                  <Pill
                    key={v.key}
                    href={buildHref({ view: v.key === 'all' ? null : v.key })}
                    active={!currentGroupId && activeView === v.key}
                  >
                    {v.label}
                  </Pill>
                ))}
              </div>
            </div>

            {groups.length > 0 ? (
              <div>
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                  Groups
                </h3>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <Pill
                      key={g.group_id}
                      href={buildHref({ view: `group:${g.group_id}` })}
                      active={currentGroupId === g.group_id}
                    >
                      {g.label}
                      {typeof g.member_count === 'number' ? (
                        <span className="ml-1 opacity-60">{g.member_count}</span>
                      ) : null}
                    </Pill>
                  ))}
                </div>
              </div>
            ) : null}

            {tags.length > 0 ? (
              <div>
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <Pill
                      key={t}
                      href={buildHref({ tag: activeTag === t ? null : t })}
                      active={activeTag === t}
                    >
                      {t}
                    </Pill>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm transition-colors ${
        active ? 'bg-terracotta text-cream' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
      }`}
    >
      {children}
    </Link>
  );
}
