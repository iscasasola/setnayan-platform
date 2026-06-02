'use client';

/**
 * MobileActionBar — docked search + filter + add, pinned right above the
 * customer bottom nav on phones/tablets (iteration 0001, 2026-06-02).
 *
 * Owner directive: "search bar right above the bottom nav and on its
 * right is the filter and on its right is the add."
 *
 * Why it exists: on mobile the page hides the top nav, the desktop
 * FacetsSidebar is `lg:block` (so View / Groups / Tags filters were
 * unreachable), and the quick-add opener lives in the `sm:flex` header
 * (so there was no add button on a phone). This single docked bar fixes
 * all three — `[ LiveSearch .......... ][ Filter ][ + Add ]`.
 *
 * - Search reuses the LiveSearch island (writes `?q=`, debounced, no
 *   Enter). The inline desktop Toolbar search is `hidden lg:flex`, so
 *   only one LiveSearch is ever visible per breakpoint.
 * - Filter opens a bottom sheet mirroring the desktop sidebar facets
 *   (Sort / View / Groups / Tags) — all the same URL-param model the
 *   server already reads, so no new filter logic.
 * - Add dispatches the `setnayan:quick-add-open` CustomEvent the existing
 *   QuickAddSheet listens for.
 *
 * The bar + sheet are `lg:hidden`; desktop keeps the inline Toolbar +
 * sticky FacetsSidebar untouched. Sits at z-40 (above page content,
 * below the z-50 sheet); the bottom nav is z-30 and sits below it.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Plus, X } from 'lucide-react';
import { LiveSearch } from './live-search';

type Opt = { key: string; label: string };
type Group = { group_id: string; label: string; member_count?: number };

export function MobileActionBar({
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Mirror of the server FacetsSidebar's buildHref, but client-side from
  // the live URL so the sheet's active state + clearing stay in sync.
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

  // close on Escape + lock body scroll while the sheet is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const activeFilterCount =
    (currentGroupId ? 1 : activeView && activeView !== 'all' ? 1 : 0) +
    (activeTag ? 1 : 0);

  const close = () => setOpen(false);
  const openAdd = () =>
    window.dispatchEvent(new CustomEvent('setnayan:quick-add-open'));

  return (
    <>
      {/* docked bar — above the fixed bottom nav, mobile + tablet only */}
      <div
        className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 border-t border-ink/10 bg-cream/95 px-3 py-2 backdrop-blur lg:hidden"
        role="search"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <LiveSearch initialValue={q} placeholder="Search guests…" />
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Filters"
            className="relative inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-ink/15 bg-cream text-ink hover:border-ink/30"
          >
            <SlidersHorizontal className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            {activeFilterCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-cream">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={openAdd}
            aria-label="Add guest"
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-mulberry text-cream hover:bg-mulberry-600"
          >
            <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {/* filters bottom sheet */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button
            type="button"
            aria-label="Close filters"
            onClick={close}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-ink/10 bg-cream pb-[calc(16px+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-ink/10 bg-cream px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-terracotta">
                Filters
              </p>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="space-y-5 px-4 py-4">
              <Section label="Sort">
                <div className="flex flex-wrap gap-2">
                  {sorts.map((s) => (
                    <Pill
                      key={s.key}
                      href={buildHref({ sort: s.key })}
                      active={currentSort === s.key}
                      onClick={close}
                    >
                      {s.label}
                    </Pill>
                  ))}
                </div>
              </Section>

              <Section label="View">
                <div className="flex flex-wrap gap-2">
                  {views.map((v) => (
                    <Pill
                      key={v.key}
                      href={buildHref({ view: v.key === 'all' ? null : v.key })}
                      active={!currentGroupId && activeView === v.key}
                      onClick={close}
                    >
                      {v.label}
                    </Pill>
                  ))}
                </div>
              </Section>

              {groups.length > 0 ? (
                <Section label="Groups">
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => (
                      <Pill
                        key={g.group_id}
                        href={buildHref({ view: `group:${g.group_id}` })}
                        active={currentGroupId === g.group_id}
                        onClick={close}
                      >
                        {g.label}
                        {typeof g.member_count === 'number' ? (
                          <span className="ml-1 opacity-60">{g.member_count}</span>
                        ) : null}
                      </Pill>
                    ))}
                  </div>
                </Section>
              ) : null}

              {tags.length > 0 ? (
                <Section label="Custom tags">
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <Pill
                        key={t}
                        href={buildHref({ tag: activeTag === t ? null : t })}
                        active={activeTag === t}
                        onClick={close}
                      >
                        {t}
                      </Pill>
                    ))}
                  </div>
                </Section>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex items-center gap-2 border-t border-ink/10 bg-cream px-4 py-3">
              <Link
                href={buildHref({ view: null, tag: null, sort: null, rsvp: null, team: null })}
                onClick={close}
                className="flex-1 rounded-lg border border-ink/15 bg-cream py-2.5 text-center text-sm font-medium text-ink/70 hover:border-ink/30"
              >
                Clear all
              </Link>
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-lg bg-mulberry py-2.5 text-sm font-semibold text-cream hover:bg-mulberry-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </h3>
      {children}
    </section>
  );
}

function Pill({
  href,
  active,
  onClick,
  children,
}: {
  href: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-terracotta text-cream'
          : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
      }`}
    >
      {children}
    </Link>
  );
}
