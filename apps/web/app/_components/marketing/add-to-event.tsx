'use client';
/**
 * add-to-event.tsx — the button on a service page, and the dialog it opens.
 *
 * Owner picked the DIALOG over an inline panel and a bottom sheet (2026-08-21):
 * adding a service to a celebration should feel like a decision, so it
 * interrupts rather than unfolding quietly beside the thing you were reading.
 *
 * DRAWS ONLY. Every gate — yours to organise, not finished, compatible — was
 * decided on the server in `add-to-event-data.ts`, so this component cannot
 * disagree with it and a stranger's browser never receives the list.
 *
 * ─── THE THREE THINGS A LONG LIST NEEDS ──────────────────────────────────
 *  1. ORDER — soonest first, undated last. Done server-side.
 *  2. SEARCH — past `SEARCH_FROM` rows. Below that it is clutter.
 *  3. A PINNED CREATE ROW — and this is the one that bit. As the last child of
 *     a thirteen-row list, "Start a new celebration" is invisible to exactly
 *     the person most likely to want it. It sits OUTSIDE the scroll area.
 *
 * 🔑 FOCUS IS `useModalA11y`'s JOB, NOT THIS FILE'S. The first cut hand-rolled a
 * Tab trap and an Escape handler here — and `modal-a11y-adoption.test.ts`
 * rejected it, correctly. That hook already does the trap, the Escape, the
 * body-scroll lock and the focus restore, AND keeps a stack so a dialog opened
 * over another peels one layer at a time. A second implementation would have
 * been a second set of bugs. The guard exists because an audit found overlays
 * across this app claiming `aria-modal` while leaving focus behind the backdrop.
 *
 * 🔴 `min-height: 0` ON EVERY ANCESTOR OF THE SCROLL AREA IS LOAD-BEARING.
 * A flex item defaults to `min-height: auto`, which refuses to shrink below its
 * content — so the panel grew past its own `max-height` and the pinned row was
 * clipped away entirely. It was in the DOM the whole time, which is why
 * checking the DOM did not catch it. Measured: with `min-height:auto` the row's
 * bottom edge landed 558px below the panel and failed a hit test.
 */
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { useModalA11y } from '@/lib/use-modal-a11y';

import type { AddToEventOption } from './add-to-event-data';

/** Below this a search box is clutter; above it, relief. */
const SEARCH_FROM = 6;

const PRIMARY_CTA =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full ' +
  'bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)] ' +
  'transition-opacity hover:opacity-90';

function humanDate(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mi = Number(m) - 1;
  if (!y || !d || mi < 0 || mi > 11) return null;
  return `${Number(d)} ${months[mi]} ${y}`;
}

export function AddToEvent({
  serviceName,
  options,
  emptyReason,
  createHref,
  createLabel,
}: {
  serviceName: string;
  options: readonly AddToEventOption[];
  emptyReason: string | null;
  /** where "Start a new celebration" goes — the page's own signed-out CTA, so
   *  there is exactly one route into creating a celebration from this page */
  createHref: string;
  createLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) =>
        o.title.toLowerCase().includes(needle) ||
        o.kindWord.toLowerCase().includes(needle),
    );
  }, [options, q]);

  // The shared hook: traps Tab, closes on Escape, locks body scroll, and hands
  // focus back to the button on close. `containerRef` goes on the element that
  // carries role="dialog", which is what the adoption guard checks for.
  useModalA11y({ open, onClose: close, containerRef: panelRef });

  const createRow = (
    <Link
      href={createHref}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--m-ink)]/[0.04]"
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-[var(--m-orange)]/40 bg-[var(--m-orange-4)] text-lg font-semibold text-[var(--m-orange-2)]"
      >
        +
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--m-orange-2)]">
          Start a new celebration
        </span>
        <span className="block text-xs text-[var(--m-slate-2)]">{createLabel}</span>
      </span>
    </Link>
  );

  return (
    <>
      <button
        type="button"
        className={PRIMARY_CTA}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Add to an event
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-[var(--m-ink)]/30"
            onClick={close}
          />
          {/* min-h-0 on this and every wrapper down to the scroll area — see
              the docblock. Without it the pinned row is clipped away. */}
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex max-h-[min(560px,85vh)] w-full max-w-[420px] min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--m-line)] bg-[var(--m-paper)] p-5 text-left shadow-[var(--m-shadow-lg)]"
          >
            <p
              id={titleId}
              className="flex-none font-serif text-lg text-[var(--m-ink)]"
            >
              Add {serviceName} to…
            </p>

            {emptyReason ? (
              <>
                <p className="mt-3 flex-none rounded-xl border border-dashed border-[var(--m-line)] px-4 py-5 text-center text-sm text-[var(--m-slate-2)]">
                  {emptyReason}
                </p>
                <div className="mt-3 flex-none border-t border-[var(--m-line)] pt-2">
                  {createRow}
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 flex-none text-xs text-[var(--m-slate-2)]">
                  Only celebrations you organise that haven’t happened yet.
                </p>

                {options.length >= SEARCH_FROM ? (
                  <>
                    <label className="mt-3 flex flex-none items-center gap-2 rounded-full border border-[var(--m-line)] px-4">
                      <span className="sr-only">Find a celebration</span>
                      <input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Find a celebration"
                        className="min-h-[38px] w-full bg-transparent text-sm text-[var(--m-ink)] outline-none placeholder:text-[var(--m-slate-2)]"
                      />
                    </label>
                    <p className="mt-2 flex-none text-xs text-[var(--m-slate-2)]">
                      {q.trim()
                        ? `${shown.length} of ${options.length} match`
                        : `${options.length} celebrations can take ${serviceName}`}
                    </p>
                  </>
                ) : null}

                <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                  {shown.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-[var(--m-slate-2)]">
                      Nothing matches “{q.trim()}”.
                    </p>
                  ) : (
                    shown.map((o) => (
                      <Link
                        key={o.eventId}
                        href={o.href}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--m-ink)]/[0.04]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--m-ink)]">
                            {o.title}
                          </span>
                          <span className="block text-xs text-[var(--m-slate-2)]">
                            <span className="capitalize">{o.kindWord}</span>
                            {humanDate(o.dateISO)
                              ? ` · ${humanDate(o.dateISO)}`
                              : ' · No date yet'}
                          </span>
                        </span>
                        {/* `text-link` (--color-link, 8.22:1 on cream), NOT a
                            hand-written var: there is no `--m-link` token, and
                            an undefined custom property renders as an inherited
                            or transparent colour rather than failing loudly. */}
                        <span
                          aria-hidden="true"
                          className="flex-none text-xs font-semibold text-link"
                        >
                          Add →
                        </span>
                      </Link>
                    ))
                  )}
                </div>

                <div className="mt-2 flex-none border-t border-[var(--m-line)] pt-2">
                  {createRow}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
