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

import { MapPin, PartyPopper } from 'lucide-react';
import { useEventWords, WORDS_AS_SHIPPED } from './event-words-provider';

type Props = {
  /** The resolved table label (group label preferred), e.g. "Table 5". */
  tableLabel: string;
};

export function ArrivalGreeting({ tableLabel }: Props) {
  const w = useEventWords() ?? WORDS_AS_SHIPPED;
  // 🕊 A WAKE NEVER CELEBRATES (audit 2026-09-30). The hub's own seat chip
  // already keeps the quiet map pin at a wake; this is the same register on the
  // seat pass — no party-popper, no champagne halo, no bloom, no "So glad".
  if (w.solemn) {
    return (
      <div className="relative flex flex-col items-center">
        <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 text-ink/70 ring-1 ring-ink/10">
          <MapPin aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <p className="relative mt-3 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
          You&rsquo;re checked in
        </p>
        <h2 className="relative mt-1.5 font-serif text-2xl italic leading-tight tracking-tight text-ink sm:text-3xl">
          Thank you for being here.
        </h2>
        <p className="relative mt-1.5 text-sm text-ink/70">
          You&rsquo;re at <span className="font-semibold text-ink">{tableLabel}</span>.
        </p>
      </div>
    );
  }
  // 🎩 No "Welcome, <first name>" — no casual greetings on a guest's screen
  // (owner, DECISION_LOG 2026-09-30). The warmth is in the words, not a first name.
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
      <h2 className="relative mt-1.5 font-serif text-2xl italic leading-tight tracking-tight text-ink sm:text-3xl">
        So glad you made it.
      </h2>
      <p className="relative mt-1.5 text-sm text-ink/70">
        You&rsquo;re checked in &mdash; you&rsquo;re at{' '}
        <span className="font-semibold text-terracotta">{tableLabel}</span>.
      </p>
    </div>
  );
}
