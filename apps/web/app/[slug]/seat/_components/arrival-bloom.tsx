'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AnimatedMonogramHero } from '@/app/_components/animated-monogram-hero';
import { EventMonogram } from '@/app/_components/event-monogram';

/**
 * apps/web/app/[slug]/seat/_components/arrival-bloom.tsx
 *
 * The arrival-bloom island for the personal Seat Pass (seat-finding PR 4/6).
 * A one-shot client welcome flourish that plays when the pass loads (or on the
 * explicit "Show my seat" tap). It is a CLIENT animation — NOT DB state — so it
 * needs no migration. The arrival signal (`arrived`) is read once on the server
 * from guest_checkins.checked_in_at and passed in; it only swaps the copy.
 *
 * RICHNESS LADDER (graceful-degrade, all optional):
 *   • hasAnimatedMonogram (event owns ANIMATED_MONOGRAM) → AnimatedMonogramHero
 *     forced to motion="bloom" — the arrival bloom regardless of the couple's
 *     saved landing-hero signature (events.monogram_motion_key), since THIS is
 *     the arrival moment, not the landing choice.
 *   • else → static EventMonogram + a plain welcome line.
 *   • hasPakanta is ALWAYS false this PR (eventOwnsPakanta stub · Pakanta is
 *     not_built). The branch + placeholder exist so the wiring is ready when
 *     the SKU ships; it autoplays nothing today.
 *
 * Reduced motion: AnimatedMonogramHero already collapses to the static painted
 * monogram under prefers-reduced-motion (WCAG 2.2 § 2.3.3); the surrounding CSS
 * bloom here is gated behind the same media query so it never animates either.
 */

type Props = {
  firstName: string;
  tableLabel: string;
  monogramText: string;
  monogramColor: string;
  fontFamily?: string;
  fontStyle?: 'italic' | 'normal';
  hasAnimatedMonogram: boolean;
  hasPakanta: boolean;
  /** Read once on the server from guest_checkins.checked_in_at. Toggles copy. */
  arrived: boolean;
  /**
   * PR5: when provided, the bloom subscribes to `seating-changes:{eventId}` and
   * pulses the seat card gently when the couple updates this guest's assignment.
   * Separate from the full router.refresh() the SeatingChangesListener does —
   * this is an in-component micro-signal specifically on the monogram bloom so
   * the guest gets immediate visual feedback that their seat info refreshed.
   */
  eventId?: string;
};

export function ArrivalBloom({
  firstName,
  tableLabel,
  monogramText,
  monogramColor,
  fontFamily,
  fontStyle,
  hasAnimatedMonogram,
  hasPakanta,
  arrived,
  eventId,
}: Props) {
  // `play` keys the bloom: it fires on mount and re-fires when the guest taps
  // "Show my seat". Re-mounting the hero via a changing key restarts its
  // mount-driven SVG animation; the wrapper CSS bloom is keyed off `play` too.
  const [play, setPlay] = useState(0);
  // PR5: gentle pulse state — true for ~1.2s when a live seat-change arrives.
  const [liveUpdated, setLiveUpdated] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // One-shot bloom on first paint.
    setPlay((n) => n + 1);
  }, []);

  // PR5: subscribe to seating-changes when eventId is provided. On receiving
  // assignment_updated the bloom does NOT re-key (that would restart the full
  // monogram animation — too heavy). Instead it triggers a brief CSS pulse on
  // the seat-info text so the guest notices their info refreshed.
  useEffect(() => {
    if (!eventId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`seating-changes:${eventId}`)
      .on('broadcast', { event: 'assignment_updated' }, () => {
        // Clear any in-flight timer before starting a new pulse.
        if (pulseTimer.current) clearTimeout(pulseTimer.current);
        setLiveUpdated(true);
        pulseTimer.current = setTimeout(() => setLiveUpdated(false), 1200);
      })
      .subscribe();
    return () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [eventId]);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {/* prefers-reduced-motion-safe wrapper bloom: a gentle scale/opacity
          settle behind the monogram. Collapses to no animation when the guest
          asks for reduced motion. */}
      <style>{`
        @keyframes seatpass-bloom-in {
          0% { opacity: 0; transform: scale(0.92); }
          60% { opacity: 1; }
          100% { opacity: 1; transform: scale(1); }
        }
        .seatpass-bloom { animation: seatpass-bloom-in 1.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes seatpass-live-pulse {
          0%   { opacity: 1; }
          30%  { opacity: 0.5; }
          60%  { opacity: 1; }
          80%  { opacity: 0.7; }
          100% { opacity: 1; }
        }
        .seatpass-live-pulse { animation: seatpass-live-pulse 1.2s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .seatpass-bloom { animation: none; }
          .seatpass-live-pulse { animation: none; }
        }
      `}</style>

      <div key={play} className="seatpass-bloom">
        {hasAnimatedMonogram ? (
          <AnimatedMonogramHero
            text={monogramText}
            color={monogramColor}
            motion="bloom"
            size="lg"
            fontFamily={fontFamily}
            fontStyle={fontStyle}
          />
        ) : (
          <EventMonogram
            event={{
              display_name: firstName,
              monogram_text: monogramText,
              monogram_color: monogramColor,
            }}
            size="lg"
          />
        )}
      </div>

      <div className={`space-y-1${liveUpdated ? ' seatpass-live-pulse' : ''}`}>
        <p className="font-serif text-xl italic text-terracotta sm:text-2xl">
          {arrived
            ? `Welcome, ${firstName} — so glad you made it!`
            : `Welcome, ${firstName}`}
        </p>
        <p className="text-sm text-ink/65">
          {arrived
            ? `You're checked in. Your seat is at ${tableLabel} — find it below.`
            : `You're at ${tableLabel}. Find your seat below.`}
        </p>
      </div>

      {hasPakanta ? (
        <>
          {/* PR-future: autoplay the couple's saved Pakanta song here as the
              arrival soundtrack. Inert today — eventOwnsPakanta() is a stub
              that always returns false (Pakanta is not_built). */}
        </>
      ) : null}

      {/* Explicit replay affordance — re-fires the one-shot bloom. */}
      <button
        type="button"
        onClick={() => setPlay((n) => n + 1)}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        Show my seat
      </button>
    </div>
  );
}
