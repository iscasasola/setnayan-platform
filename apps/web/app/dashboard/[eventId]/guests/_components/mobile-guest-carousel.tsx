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
 * four swipeable panels (owner directive 2026-06-02 — the top is now JUST
 * the guest list, so the RSVP counts that used to sit in the page's top
 * StatsStrip move into the Summary panel here):
 *   1. Summary  — [Total][Attending][Pending][Declined] as boxed,
 *                 animated count-up boxes; each box is also an RSVP filter
 *                 link, so mobile keeps RSVP filtering (Total clears it)
 *   2. Find     — LiveSearch (writes ?q=, debounced) + Sort pills
 *   3. Add      — opens the existing QuickAddSheet (rapid add + dup detect
 *                 + multi-role) + Quick-add list + Import CSV
 *   4. Customize — View / Groups / Tags filters that customize what the
 *                 list shows (the desktop FacetsSidebar facets, otherwise
 *                 lg:block-only and unreachable on a phone)
 *
 * Supersedes the single docked MobileActionBar. Tabs at the top jump
 * between panels; horizontal swipe works too. All `lg:hidden` — desktop
 * keeps the inline Toolbar + sticky FacetsSidebar + StatsStrip untouched.
 *
 * Height comes from `--gcar-h` set on the page <section>; the component
 * renders an in-flow spacer of the same height so the guest list's last
 * rows clear the fixed carousel. Sits at z-40 (above page content); the
 * bottom nav is z-30 below it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { LiveSearch } from './live-search';
import { quickAddGuest } from '../quick-add-actions';

type Opt = { key: string; label: string };
type Group = { group_id: string; label: string; member_count?: number };

const PANELS = [
  { key: 'summary', label: 'Summary' },
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
  total,
  attending,
  pending,
  declined,
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
  total: number;
  attending: number;
  pending: number;
  declined: number;
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

  const hasActiveFilter =
    Boolean(currentGroupId) ||
    (Boolean(activeView) && activeView !== 'all') ||
    Boolean(activeTag);

  const currentRsvp = searchParams.get('rsvp') ?? '';

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

        {/* swipe track — 4 panels, scroll-snap */}
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex h-[calc(var(--gcar-h)-2.5rem)] snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* 1 — Summary: animated RSVP counts (also filter links) */}
          <section className="w-full shrink-0 snap-center overflow-y-auto px-4 py-3">
            <div className="grid h-full grid-cols-2 content-center gap-2.5">
              <StatBox
                label="Total"
                value={total}
                tint="text-ink"
                href={buildHref({ rsvp: null })}
                active={!currentRsvp}
              />
              <StatBox
                label="Attending"
                value={attending}
                tint="text-emerald-700"
                href={buildHref({ rsvp: 'attending' })}
                active={currentRsvp === 'attending'}
              />
              <StatBox
                label="Pending"
                value={pending}
                tint="text-amber-700"
                href={buildHref({ rsvp: 'pending' })}
                active={currentRsvp === 'pending'}
              />
              <StatBox
                label="Declined"
                value={declined}
                tint="text-rose-700"
                href={buildHref({ rsvp: 'declined' })}
                active={currentRsvp === 'declined'}
              />
            </div>
          </section>

          {/* 2 — Find: search + sort */}
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

          {/* 3 — Add: inline quick-entry form */}
          <section className="flex w-full shrink-0 snap-center flex-col justify-center px-4 py-3">
            <QuickAddInlineForm eventId={eventId} />
          </section>

          {/* 4 — Customize: view / groups / tags */}
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

function StatBox({
  label,
  value,
  tint,
  href,
  active,
}: {
  label: string;
  value: number;
  tint: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col justify-center rounded-xl border px-3.5 py-2 transition-colors ${
        active ? 'border-terracotta bg-terracotta/5' : 'border-ink/10 hover:border-ink/25'
      }`}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/50">
        {label}
      </span>
      <span className={`mt-0.5 text-[26px] font-semibold leading-tight tabular-nums ${tint}`}>
        <AnimatedCount value={value} />
      </span>
    </Link>
  );
}

function AnimatedCount({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (value <= 0) {
      setN(0);
      return;
    }
    let raf = 0;
    const dur = 700;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n.toLocaleString('en-US')}</>;
}

/**
 * Inline quick-entry form for the Add carousel panel.
 *
 * Flow:
 *   Enter on first name  → moves focus to last name (or ends if field is empty)
 *   Enter on last name   → adds the guest, clears both fields, loops to first name
 *   Enter on empty first name field after adding ≥ 1 guest → "double Enter" → done
 */
function QuickAddInlineForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);

  const addGuest = async () => {
    if (!first.trim() || busy) return;
    setBusy(true);
    try {
      await quickAddGuest(eventId, {
        first_name: first.trim(),
        last_name: last.trim(),
        side: 'both',
        role: 'guest',
      });
      setCount((n) => n + 1);
      setFirst('');
      setLast('');
      router.refresh();
      firstRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const handleFirstKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!first.trim()) {
      // Empty first name + Enter = "double Enter" = finish session
      if (count > 0) setDone(true);
      return;
    }
    lastRef.current?.focus();
  };

  const handleLastKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void addGuest();
  };

  const inputCls =
    'w-full rounded-xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none disabled:opacity-50';

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <span className="text-3xl">✓</span>
        <p className="text-sm font-medium text-ink">
          {count} {count === 1 ? 'guest' : 'guests'} added
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setCount(0);
            setTimeout(() => firstRef.current?.focus(), 50);
          }}
          className="rounded-lg border border-ink/15 px-4 py-2 text-sm text-ink/70 hover:bg-ink/5"
        >
          Add more
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="space-y-2">
        <input
          ref={firstRef}
          type="text"
          inputMode="text"
          autoCapitalize="words"
          placeholder="First name"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          onKeyDown={handleFirstKeyDown}
          disabled={busy}
          className={inputCls}
        />
        <input
          ref={lastRef}
          type="text"
          inputMode="text"
          autoCapitalize="words"
          placeholder="Last name"
          value={last}
          onChange={(e) => setLast(e.target.value)}
          onKeyDown={handleLastKeyDown}
          disabled={busy}
          className={inputCls}
        />
      </div>

      <p className="text-center text-[11px] leading-snug text-ink/40">
        Enter after first name moves to last name · Enter after last name adds &amp; loops back ·
        Double Enter on empty first name to finish
      </p>

      {count > 0 && (
        <p className="text-center text-xs text-ink/50">
          {count} {count === 1 ? 'guest' : 'guests'} added this session
        </p>
      )}
    </div>
  );
}
