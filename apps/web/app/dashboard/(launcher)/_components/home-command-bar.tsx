'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Sparkles,
  Store,
  ShieldCheck,
  Plus,
  CalendarHeart,
  LayoutGrid,
  Users,
  UserRound,
  Bell,
  Wand2,
  Clapperboard,
} from 'lucide-react';
import { useModalA11y, anyModalOpen } from '@/lib/use-modal-a11y';

/**
 * HomeCommandBar — the launcher's DETERMINISTIC "search or jump" bar
 * (owner-approved final home design 2026-07-15).
 *
 * A glass search bar that opens a command palette (also bound to ⌘K / Ctrl-K)
 * listing the signed-in person's own events, spaces, and account destinations.
 * Pure client-side filtering over server-provided props + router.push — NO
 * network call, NO LLM (Setnayan AI Rule 1: deterministic + free, owner-locked
 * 2026-07-12). It is a navigation tool, not a chat prompt.
 *
 * Modal behavior (focus trap · Escape · body-scroll lock · focus restore) comes
 * from the repo's single shared hook, useModalA11y — never hand-rolled (the
 * 2026-06-25 checkout audit class of bug). The ⌘K listener stands down while
 * any other useModalA11y dialog (e.g. the AccountSwitcher sheet) is open.
 *
 * ⌘K collision note: the guests Living Roster owns ⌘K on
 * /dashboard/[eventId]/guests (guests-search.tsx). This component only ever
 * mounts on the launcher route, so the two listeners never coexist.
 *
 * Client island per the launcher idiom: the server page builds the serializable
 * `items` array (ids, labels, hrefs — no functions); this component owns only
 * open/filter/selection state.
 */

export type HomeCommandItem = {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  kind: 'event' | 'space' | 'action';
  /** Icon key — resolved to a Lucide glyph client-side (RSC boundary rule:
   *  never pass component functions from server to client). */
  icon:
    | 'sparkles'
    | 'store'
    | 'shield'
    | 'plus'
    | 'calendar'
    | 'grid'
    | 'users'
    | 'user'
    | 'bell'
    | 'wand'
    | 'clapperboard';
};

const ICONS = {
  sparkles: Sparkles,
  store: Store,
  shield: ShieldCheck,
  plus: Plus,
  calendar: CalendarHeart,
  grid: LayoutGrid,
  users: Users,
  user: UserRound,
  bell: Bell,
  wand: Wand2,
  clapperboard: Clapperboard,
} as const;

const KIND_LABEL: Record<HomeCommandItem['kind'], string> = {
  event: 'Event',
  space: 'Space',
  action: 'Go to',
};

export function HomeCommandBar({ items }: { items: HomeCommandItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape + body-scroll lock + focus restore — the repo's single
  // shared modal hook (also used by the AccountSwitcher in the same layout).
  useModalA11y({
    open,
    onClose: () => setOpen(false),
    containerRef: dialogRef,
    initialFocusRef: inputRef,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      `${i.label} ${i.sublabel} ${KIND_LABEL[i.kind]}`.toLowerCase().includes(q),
    );
  }, [items, query]);

  // Clamp the highlight when the filtered list shrinks.
  const safeHighlight = Math.min(highlight, Math.max(0, filtered.length - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        // Stand down while another modal (e.g. the AccountSwitcher sheet) is
        // open — never stack a second dialog underneath it.
        if (anyModalOpen()) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset the palette state each time it opens (focus comes from useModalA11y).
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
    }
  }, [open]);

  // Keep the highlighted row visible while arrowing through an overflowing
  // list — the rows never receive focus (it stays on the input), so the
  // browser performs no native scroll-into-view.
  useEffect(() => {
    if (!open || filtered.length === 0) return;
    (
      listRef.current?.children[safeHighlight] as HTMLElement | undefined
    )?.scrollIntoView({ block: 'nearest' });
  }, [open, safeHighlight, filtered.length]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[safeHighlight];
      if (pick) go(pick.href);
    }
    // Escape is handled by useModalA11y's capture-phase document listener.
  };

  return (
    <>
      {/* The glass bar — looks like an input, acts as the palette trigger
          (proto .cmd: glass recipe from .sn-tile-glass, lift on hover). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sn-tile-glass sn-lift-2 flex w-full max-w-[760px] items-center gap-3 rounded-xl px-[15px] py-2.5 text-left hover:border-mulberry/30 sm:py-3"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Search
          aria-hidden
          className="h-[18px] w-[18px] shrink-0 text-[color:var(--sn-gold-600)]"
          strokeWidth={1.75}
        />
        <span className="flex-1 truncate text-sm text-[color:var(--sn-ink-500)]">
          <span className="sm:hidden">Search events, people, vendors</span>
          <span className="hidden sm:inline">
            Search events, people, vendors — or jump to a task
          </span>
        </span>
        <kbd
          aria-hidden
          className="hidden rounded-md border border-[color:var(--sn-line)] bg-white/60 px-[7px] py-[3px] font-mono text-[11px] text-[color:var(--sn-ink-400)] sm:inline-block"
        >
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-ink/[0.32] backdrop-blur-[8px]"
          style={{ animation: 'sn-fade .3s both' }}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Search and jump"
            className="sn-pop-in mx-auto mt-[11vh] w-[min(560px,92vw)] overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-[0_60px_100px_-60px_rgba(30,26,18,0.6)] backdrop-blur-[30px] backdrop-saturate-150"
          >
            <div className="flex items-center gap-3 border-b border-ink/10 px-4 py-3.5">
              <Search
                aria-hidden
                className="h-4 w-4 shrink-0 text-mulberry"
                strokeWidth={1.75}
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Search your events, spaces & more"
                className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/40"
                aria-label="Search your events, spaces and account"
              />
              <kbd className="rounded-md border border-[color:var(--sn-line)] bg-white/60 px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--sn-ink-400)]">
                esc
              </kbd>
            </div>
            <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-ink/40">
                  Nothing matches &ldquo;{query}&rdquo;
                </p>
              ) : (
                filtered.map((item, i) => {
                  const Icon = ICONS[item.icon];
                  const active = i === safeHighlight;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => go(item.href)}
                      onMouseEnter={() => setHighlight(i)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active ? 'bg-mulberry/[0.14]' : 'hover:bg-mulberry/5'
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/70 text-[color:var(--sn-gold-700)]">
                        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {item.label}
                        </span>
                        <span className="block truncate text-xs text-ink/50">
                          {item.sublabel}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-ink/35">
                        {KIND_LABEL[item.kind]}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
