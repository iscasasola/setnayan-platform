'use client';

/**
 * capture-bar.tsx — the dual-mode ADD | FIND bar at the head of the Living
 * Roster (P2). It replaces the old "one primary Add button + a More-ways
 * disclosure + a separate search field" split with a single bar the host lives
 * in:
 *
 *   • ADD (default · owner sign-off 2026-07-11 · capture-first) — type one line
 *     and press Enter. The pure grammar in `lib/guest-parse.ts` turns
 *     "Ana Cruz +1 groom vip #Barkada" into a structured draft, `addSingleGuest`
 *     lands it, the field clears, focus stays — so a host adds many in a row.
 *     An "Adding…" shimmer marks the in-flight round-trip.
 *   • FIND — wraps the existing `live-search.tsx` VERBATIM (its debounced `?q=`
 *     writer / clear-on-empty is the search contract); ⌘K/Ctrl-K jumps here.
 *
 * The bulk-entry paths (full form, CSV import, quick-add list) move into this
 * bar's overflow — `QuickAddSheet` (the full form) stays mounted in page.tsx as
 * the fallback, and the CSV import route is untouched.
 *
 * Motion (the shimmer) is frozen by the global `prefers-reduced-motion` block.
 */

import { Suspense, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Plus, Search } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { parseGuestInput } from '@/lib/guest-parse';
import type { GuestSide } from '@/lib/guests';
import { LiveSearch } from './live-search';
import { OpenQuickAddButton } from './quick-add-sheet';
import { addSingleGuest } from '../inline-actions';

export function CaptureBar({
  eventId,
  initialQuery,
  defaultSide,
}: {
  eventId: string;
  initialQuery: string;
  /** The active Side lens — a new guest inherits it (prototype `:855`). */
  defaultSide: GuestSide;
}) {
  const [addMode, setAddMode] = useState(true);
  const [value, setValue] = useState('');
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Focus the Find field — LiveSearch owns its own input, so reach it through
  // the bar container rather than an id we don't control (reused verbatim).
  const focusFind = () =>
    requestAnimationFrame(() =>
      barRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus(),
    );

  // ⌘K / Ctrl-K jumps into Find mode and focuses (Esc/⌘K reachable per the P2
  // sign-off). Registered once; harmless on servers (guarded by mount effect).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAddMode(false);
        focusFind();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submitAdd = () => {
    const raw = value;
    if (!raw.trim() || pending) return;
    const draft = parseGuestInput(raw, { defaultSide });
    startTransition(async () => {
      const res = await addSingleGuest(eventId, draft);
      if (!res.ok) {
        // Keep the text so the host can fix it (e.g. add a last name).
        toast.error(res.error);
        return;
      }
      setValue('');
      // Keep focus to add many in a row (prototype wireCapture :945-954).
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  };

  const switchTo = (mode: 'add' | 'find') => {
    setAddMode(mode === 'add');
    if (mode === 'add') requestAnimationFrame(() => inputRef.current?.focus());
    else focusFind();
  };

  return (
    <div ref={barRef} className="relative rounded-xl border border-ink/10 bg-cream">
      <div className="flex items-center gap-2 p-2">
        {/* Mode toggle */}
        <div
          role="group"
          aria-label="Capture bar mode"
          className="inline-flex shrink-0 rounded-lg border border-ink/10 bg-paper p-0.5"
        >
          <button
            type="button"
            onClick={() => switchTo('add')}
            aria-pressed={addMode}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              addMode ? 'bg-terracotta text-cream' : 'text-ink/60 hover:text-ink'
            }`}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => switchTo('find')}
            aria-pressed={!addMode}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              !addMode ? 'bg-terracotta text-cream' : 'text-ink/60 hover:text-ink'
            }`}
          >
            Find
          </button>
        </div>

        {/* Leading glyph */}
        <span aria-hidden className="shrink-0 text-ink/35">
          {addMode ? (
            <Plus className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Search className="h-4 w-4" strokeWidth={2} />
          )}
        </span>

        {/* Input area */}
        <div className="min-w-0 flex-1">
          {addMode ? (
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitAdd();
                } else if (e.key === 'Escape') {
                  setValue('');
                }
              }}
              placeholder="Type a name…  e.g. “Ana Cruz +1 groom vip #Barkada”  → Enter"
              aria-label="Add a guest"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="input-field w-full"
            />
          ) : (
            <Suspense fallback={null}>
              <LiveSearch
                key="find"
                initialValue={initialQuery}
                placeholder="Search names, roles, groups, RSVP…"
              />
            </Suspense>
          )}
        </div>

        {/* Hint / shimmer */}
        <span className="hidden shrink-0 items-center sm:inline-flex">
          {addMode && pending ? (
            <span className="gl-adding font-mono text-[11px] text-terracotta-700">
              Adding…
            </span>
          ) : (
            <span className="rounded-md border border-ink/10 px-1.5 py-0.5 font-mono text-[11px] text-ink/45">
              {addMode ? '↵ add & keep going' : '⌘K'}
            </span>
          )}
        </span>

        {/* Overflow — the bulk-entry paths that used to be the header's "More
            ways" disclosure. QuickAddSheet (full form) + CSV import stay wired. */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOverflowOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            aria-label="More ways to add"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          {overflowOpen ? (
            <>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOverflowOpen(false)}
                className="fixed inset-0 z-30 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 z-40 mt-1 flex w-48 flex-col gap-0.5 rounded-lg border border-ink/10 bg-cream p-1 shadow-lg"
              >
                <div className="px-1 py-0.5" onClick={() => setOverflowOpen(false)}>
                  <OpenQuickAddButton label="Full add form" />
                </div>
                <Link
                  href={`/dashboard/${eventId}/guests/import`}
                  className="rounded-md px-3 py-2 text-sm text-ink/80 hover:bg-terracotta/10 hover:text-terracotta-700"
                >
                  Import CSV
                </Link>
                <Link
                  href={`/dashboard/${eventId}/guests/quick`}
                  className="rounded-md px-3 py-2 text-sm text-ink/80 hover:bg-terracotta/10 hover:text-terracotta-700"
                >
                  Quick add list
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
