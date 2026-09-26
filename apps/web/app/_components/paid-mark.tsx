import { Gem, Lock } from 'lucide-react';
import type { PaidMarkState } from '@/lib/paid-mark';

/**
 * PaidMark — the ONE mark a paid-to-unlock control wears.
 *
 * Owner, verbatim (2026-09-25): *"for all parts that are Paid to unlock, let us
 * use the padlock icon. and a diamond icon when unlocked"*.
 *
 *   state="locked"    → padlock  (not owned yet)
 *   state="unlocked"  → diamond  (paid / owned)
 *
 * It replaces the scattered "Pro" pills, gold chips and bare lock glyphs that
 * each paid surface used to draw its own way. A text label may sit beside it
 * (`text="Event Hub Pro"`) where the copy needs one — the mark is the signal,
 * the word is optional.
 *
 * 🔑 WHICH STATE IS NEVER DECIDED HERE. Callers ask `paidMarkState()` in
 * `lib/paid-mark.ts`, which reads the caller's measured entitlement and applies
 * the app-store shell rule (a locked door is absent in the shell; an owned
 * diamond may show). This file only draws the answer.
 *
 * ICONS come from `lucide-react`, the app's sanctioned icon set (see
 * `scripts/lint-nav-icon-source.mjs` — registry for nav chrome, lucide
 * everywhere else). `Gem` is lucide's faceted diamond; `Diamond` there is a
 * plain rhombus that reads as a shape, not a jewel.
 *
 * COLOUR follows the house tokens, which flip for the dark theme on their own:
 *   • locked   → `text-ink/60` — a neutral door, not a prize (≥3:1 non-text
 *                contrast on the white page and on the dark #17160F page).
 *   • unlocked → `text-terracotta-700` — the Atelier gold at its text-safe
 *                depth (#8C6932 · 5.02:1 on white; #A88340 on the dark page).
 *   • tone="current" inherits the surrounding text colour instead — for a mark
 *     sitting on an inverted surface (a selected `bg-ink text-cream` row).
 *
 * SIZE is a fixed ladder so a mark never grows past the line it sits in:
 * xs 12px · sm 14px · md 16px · lg 20px. It is `shrink-0` and never wraps, so it
 * cannot overlap or squeeze the text beside it on a 375px phone.
 */

export type PaidMarkSize = 'xs' | 'sm' | 'md' | 'lg';

const GLYPH: Record<PaidMarkSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

const TEXT: Record<PaidMarkSize, string> = {
  xs: 'text-xs',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
};

const TONE: Record<PaidMarkState, string> = {
  locked: 'text-ink/60',
  unlocked: 'text-terracotta-700',
};

export function PaidMark({
  state,
  label,
  text,
  size = 'sm',
  tone = 'auto',
  className = '',
}: {
  state: PaidMarkState;
  /** The accessible name — what a screen reader hears ("Locked — part of Event Hub Pro"). */
  label: string;
  /** Optional visible word beside the mark ("Event Hub Pro"). */
  text?: string;
  size?: PaidMarkSize;
  /** `current` inherits the surrounding colour (for inverted surfaces). */
  tone?: 'auto' | 'current';
  className?: string;
}) {
  const Icon = state === 'locked' ? Lock : Gem;
  const colour = tone === 'current' ? '' : TONE[state];
  const glyph = (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 items-center justify-center"
    >
      <Icon aria-hidden className={GLYPH[size]} strokeWidth={2.25} />
    </span>
  );
  if (!text) {
    return (
      <span
        data-paid-mark={state}
        className={`inline-flex shrink-0 items-center ${colour} ${className}`.trim()}
      >
        {glyph}
      </span>
    );
  }
  return (
    <span
      data-paid-mark={state}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-semibold ${TEXT[size]} ${colour} ${className}`.trim()}
    >
      {glyph}
      <span>{text}</span>
    </span>
  );
}
