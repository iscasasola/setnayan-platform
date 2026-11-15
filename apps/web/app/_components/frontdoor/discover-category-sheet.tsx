'use client';

/**
 * The open "All categories ▾" — folders, then their categories, with a find-a-category box inside (the drawing's Map
 * card: "folders, then categories, with a find-a-category box inside the sheet"). Loaded only on the first press
 * (`discover-supplier-controls.tsx`), so neither this code nor the category list (`marketplace-category-options.ts`,
 * which is code, not a read) rides the front page's first load.
 *
 * A sheet from the bottom on a phone; a list under the button on a computer — one scrim, Esc and a tap outside close
 * it, focus is held inside while open (`useModalA11y`, the shipped hook). Portalled to `body` for the same reason as
 * the filter sheet (`discover-filter-sheet.tsx`).
 *
 * Picking goes to an address (`categoryPickHref`): the category replaces any folder or tile scope, every other
 * filter stays, and the view starts again at page 1. The press answers at once — the row shows chosen and one line
 * says the suppliers are loading.
 */
import { useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { useModalA11y } from '@/lib/use-modal-a11y';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { marketplaceCategoryFolders, TAXONOMY_OPTIONS } from '@/lib/marketplace-category-options';
import { categoryPickHref } from '@/lib/discover-suppliers';
import { pickOptionClass } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';

const FOLDERS = marketplaceCategoryFolders();

export function DiscoverCategorySheet({ current, onClose }: { current: string | null; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [find, setFind] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useModalA11y({ open: true, onClose, containerRef: panelRef });

  const currentKey = useMemo(
    () => (current ? (TAXONOMY_OPTIONS.find((o) => o.label === current)?.key ?? null) : null),
    [current],
  );
  const words = find.trim().toLowerCase();
  const groups = useMemo(
    () =>
      FOLDERS.map((g) => ({
        ...g,
        options: words ? g.options.filter((o) => o.label.toLowerCase().includes(words) || o.key.includes(words)) : g.options,
      })).filter((g) => g.options.length > 0),
    [words],
  );

  const go = (key: string | null) => {
    setPicked(key ?? '');
    start(() => router.push(categoryPickHref(window.location.search, key)));
  };
  const chosen = (key: string | null) => (picked !== null ? picked === (key ?? '') : currentKey === key);

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <OverlayBackdrop onClose={onClose} label="Close categories" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Category"
        data-discover-category-sheet=""
        className="relative mt-auto flex w-full flex-col rounded-t-2xl bg-cream shadow-xl outline-none lg:mx-auto lg:mb-auto lg:mt-[12vh] lg:w-[420px] lg:rounded-2xl"
        style={{ maxHeight: 'min(80vh, 100dvh)' }}
      >
        <header className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
          <h2 className="text-base font-semibold text-ink">Category</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close categories"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 hover:border-terracotta/40 hover:text-terracotta-700"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </header>
        <div className="border-b border-ink/10 px-4 py-3">
          <input
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Find a category"
            aria-label="Find a category"
            autoComplete="off"
            enterKeyHint="search"
            className="input-field w-full"
          />
          {pending ? (
            <p role="status" aria-live="polite" className="mt-2 text-xs text-ink/65" data-discover-loading="">
              Loading suppliers…
            </p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {words ? null : (
            <button
              type="button"
              aria-pressed={chosen(null)}
              onClick={() => go(null)}
              className={pickOptionClass(false, chosen(null))}
            >
              All categories
            </button>
          )}
          {groups.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ink/65">No category by that name.</p>
          ) : (
            groups.map((g) => (
              <section key={g.folder} aria-label={g.label} className="mt-1 border-t border-ink/10 pt-1 first:border-t-0">
                <p aria-hidden className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  {g.label}
                </p>
                {g.options.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={chosen(o.key)}
                    onClick={() => go(o.key)}
                    className={pickOptionClass(false, chosen(o.key))}
                  >
                    {o.label}
                  </button>
                ))}
              </section>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
