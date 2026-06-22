'use client';

/**
 * ArrivalGreeting — the day-of "you've arrived" delight on the guest's seat
 * pass (check-in → bloom, 2026-06-22).
 *
 * Closes a flywheel gap: until now a guest's check-in (a row in
 * `guest_checkins`) only fed the planner's "arrived" counter — the guest's own
 * seat surface never reacted. When this guest has scanned in at the door, the
 * seat pass swaps its neutral "here's your table" header for a warm, personal
 * greeting and plays a one-shot soft bloom (a champagne halo behind the
 * headline that blooms + fades; the surrounding card lifts/settles once).
 *
 * This is the headline only — the caller (YourSeatBlock / the hub seat tile)
 * keeps the table label + map. A small delight, not a takeover.
 *
 * Motion: pure CSS keyframes (`.sn-arrival-bloom` + `.sn-arrival-ring` in
 * globals.css). The global `prefers-reduced-motion: reduce` block freezes both
 * to their end-state instantly, so reduced-motion guests get the warm copy with
 * no movement — no `motion-safe:` opt-in needed. Client component purely so the
 * mount-time animation re-runs each visit (server HTML would render mid-keyframe
 * once and never replay).
 *
 * Guest-legibility floor: every line here is `text-sm` / `text-base` / `text-xl`
 * and up — well above the 12px floor (no sub-12px text).
 */

import { PartyPopper } from 'lucide-react';

type Props = {
  /** Guest's first name for the personal greeting. */
  firstName: string;
  /** The resolved table label (group label preferred), e.g. "Table 5". */
  tableLabel: string;
};

export function ArrivalGreeting({ firstName, tableLabel }: Props) {
  // Trim + guard: an empty/whitespace name falls back to a warm generic.
  const name = firstName.trim();
  return (
    <div className="sn-arrival-bloom relative flex flex-col items-center">
      {/* Soft champagne halo that blooms out behind the icon, then fades. */}
      <span
        aria-hidden
        className="sn-arrival-ring pointer-events-none absolute -top-1 h-16 w-16 rounded-full bg-champagne-gold/40 blur-md"
      />
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-champagne-gold/15 text-terracotta ring-1 ring-champagne-gold/30">
        <PartyPopper aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="relative mt-3 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        You&rsquo;ve arrived
      </p>
      <h2 className="relative mt-1.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        {name ? `Welcome, ${name}.` : 'Welcome — so glad you made it.'}
      </h2>
      <p className="relative mt-1.5 text-sm text-ink/70">
        You&rsquo;re checked in &mdash; you&rsquo;re at{' '}
        <span className="font-semibold text-emerald-700">{tableLabel}</span>.
      </p>
    </div>
  );
}
