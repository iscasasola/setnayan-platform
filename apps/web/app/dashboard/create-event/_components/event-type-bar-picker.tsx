'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EventTypeRow } from './event-types';

/**
 * Minimal event-type "bar picker" — owner directive 2026-06-04: the event
 * picker should be "nothing but the choice of events." A row of bars, one per
 * event type; tap a bar to pick → jump straight into that event's onboarding.
 *
 * Replaces the hero-photo carousel (event-type-carousel.tsx) on the full-page
 * /dashboard/create-event surface ONLY. The carousel stays in use by the
 * in-chrome add-event sheet (event-switcher.tsx) — untouched.
 *
 * Interaction (mirrors the approved /tmp prototype):
 *   - The focused bar is gold (terracotta=Champagne Gold) + taller, with a
 *     gentle equalizer falloff on its neighbours. The rest are warm-grey.
 *   - ‹ › chevrons / ← → arrow keys / swipe BROWSE the focus (no commit).
 *   - Tapping a bar PICKS it → fires onSelect for enabled types. Coming-soon
 *     bars only focus + show a "Coming soon" caption, never commit (same
 *     contract as the carousel's disabled tiles).
 *   - The focused type's emoji + name + caption render below the strip so the
 *     unlabeled bars stay legible.
 *
 * Roving tabindex (only the focused bar is in the tab order; arrows move focus)
 * keeps keyboard nav clean across the 9 bars.
 */

type Props = {
  types: readonly EventTypeRow[];
  /** Fired only for enabled types (coming-soon bars are inert). */
  onSelect: (type: EventTypeRow) => void;
  /** Index that starts focused (default 0 — Wedding). */
  initialIndex?: number;
  className?: string;
};

export function EventTypeBarPicker({ types, onSelect, initialIndex = 0, className }: Props) {
  const [focus, setFocus] = useState(initialIndex);
  const n = types.length;
  const barRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Move the focused bar AND its DOM focus together (keeps roving tabindex +
  // the gold highlight in sync for chevrons and arrow keys alike).
  const focusIdx = useCallback(
    (i: number) => {
      const j = Math.min(n - 1, Math.max(0, i));
      setFocus(j);
      barRefs.current[j]?.focus();
    },
    [n],
  );

  const pick = useCallback(
    (i: number) => {
      setFocus(i);
      const t = types[i];
      if (t?.enabled) onSelect(t);
    },
    [types, onSelect],
  );

  const onBarKey = useCallback(
    (e: ReactKeyboardEvent, i: number) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        focusIdx(i + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusIdx(i - 1);
      }
      // Enter / Space fire the native button click → pick().
    },
    [focusIdx],
  );

  // Swipe to browse on touch.
  const sx = useRef<number | null>(null);

  const active = types[focus];

  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => focusIdx(focus - 1)}
          disabled={focus === 0}
          aria-label="Previous event type"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/60 transition-colors hover:border-terracotta/50 hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-ink/15 disabled:hover:text-ink/60"
        >
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2.2} />
        </button>

        <div
          role="listbox"
          aria-label="Event type"
          className="flex h-[120px] flex-1 items-center justify-center gap-[9px] [touch-action:pan-y]"
          onTouchStart={(e) => {
            sx.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (sx.current == null) return;
            const dx = (e.changedTouches[0]?.clientX ?? 0) - sx.current;
            if (Math.abs(dx) > 34) focusIdx(focus + (dx < 0 ? 1 : -1));
            sx.current = null;
          }}
        >
          {types.map((t, i) => {
            const isFocus = i === focus;
            const dist = Math.abs(i - focus);
            const h = isFocus ? 96 : Math.max(46, 70 - dist * 6);
            return (
              <button
                key={t.key}
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                type="button"
                role="option"
                aria-selected={isFocus}
                aria-label={t.enabled ? t.label : `${t.label} — coming soon`}
                title={t.label}
                tabIndex={isFocus ? 0 : -1}
                onClick={() => pick(i)}
                onFocus={() => setFocus(i)}
                onKeyDown={(e) => onBarKey(e, i)}
                style={{ height: h, width: isFocus ? 16 : 10 }}
                className={`shrink-0 rounded-full outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
                  isFocus
                    ? 'bg-terracotta shadow-[0_6px_18px_rgba(197,160,89,0.34)]'
                    : 'bg-ink/15 hover:bg-ink/25'
                }`}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => focusIdx(focus + 1)}
          disabled={focus === n - 1}
          aria-label="Next event type"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/60 transition-colors hover:border-terracotta/50 hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-ink/15 disabled:hover:text-ink/60"
        >
          <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </div>

      <div className="mt-7 text-center" aria-live="polite">
        <div aria-hidden className="text-3xl leading-none">
          {active?.emoji}
        </div>
        <div className="mt-3 font-serif text-2xl font-semibold italic tracking-tight text-ink">
          {active?.label}
        </div>
        <p className="mt-1.5 text-sm text-ink/55">
          {active?.enabled ? (
            'Tap to begin'
          ) : (
            <span className="font-medium text-mulberry">Coming soon</span>
          )}
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-ink/35">
        Tap a bar to start · ‹ › or arrow keys to browse
      </p>
    </div>
  );
}
