'use client';

/**
 * capture-bar.tsx — the ADD doorway at the head of the Living Roster.
 *
 * Capture-first (owner sign-off 2026-07-11): type one line and press Enter. The
 * pure grammar in `lib/guest-parse.ts` turns "Ana Cruz +1 groom vip #Barkada"
 * into a structured draft, `addSingleGuest` lands it, the field clears, focus
 * stays — so a host adds many in a row. An "Adding…" shimmer marks the in-flight
 * round-trip. The bulk-entry paths (full form · CSV import · quick-add list)
 * live in the overflow menu.
 *
 * FIND MOVED OUT (Living Roster search consolidation · owner sign-off
 * 2026-07-13): the old dual-mode [Add | Find] toggle is retired. Search is no
 * longer a mode-peer of Add — it now lives ALWAYS-VISIBLE in the SummaryFacetBar
 * query row (`guests-search.tsx`), which also owns the ⌘K shortcut. This bar is
 * Add-only, so on landing the cursor lands on the parser and search is still one
 * glance away in the facet bar. (This supersedes the 2026-07-11 "single doorway
 * for both Add and Find" P2 sign-off — the duplicate search box the owner
 * spotted was that model's failure tell.)
 *
 * Motion (the shimmer) is frozen by the global `prefers-reduced-motion` block.
 */

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { parseGuestInput } from '@/lib/guest-parse';
import type { GuestSide } from '@/lib/guests';
import { OpenQuickAddButton } from './quick-add-sheet';
import { addSingleGuest } from '../inline-actions';

export function CaptureBar({
  eventId,
  defaultSide,
}: {
  eventId: string;
  /** The active Side lens — a new guest inherits it (prototype `:855`). */
  defaultSide: GuestSide;
}) {
  const [value, setValue] = useState('');
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

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

  return (
    <div
      className="relative rounded-xl border"
      style={{
        background: 'var(--sn-glass-bg)',
        borderColor: 'var(--sn-glass-line)',
        backdropFilter: 'var(--sn-glass-blur)',
        WebkitBackdropFilter: 'var(--sn-glass-blur)',
        boxShadow: 'var(--sn-sh-tile)',
      }}
    >
      <div className="flex items-center gap-2 p-2">
        {/* Leading glyph */}
        <span aria-hidden className="shrink-0 pl-1 text-ink/35">
          <Plus className="h-4 w-4" strokeWidth={2} />
        </span>

        {/* Add input — the capture-first guest parser. */}
        <div className="min-w-0 flex-1">
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
        </div>

        {/* Hint / shimmer */}
        <span className="hidden shrink-0 items-center sm:inline-flex">
          {pending ? (
            <span className="gl-adding font-mono text-[11px] text-terracotta-700">
              Adding…
            </span>
          ) : (
            <span className="rounded-md border border-ink/10 px-1.5 py-0.5 font-mono text-[11px] text-ink/45">
              {'↵ add & keep going'}
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
