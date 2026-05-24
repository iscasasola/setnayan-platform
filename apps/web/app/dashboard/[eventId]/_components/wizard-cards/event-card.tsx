/**
 * Card 34 Event · Phase 5 · Post-event tier.
 *
 * The wedding day itself. This card surfaces as the active focus in two
 * scenarios:
 *   (a) Pre-event: the host is staring at the looming wedding day. Card
 *       reads "Your big day · we'll handle the rest" with a calm
 *       acknowledgment + Mark done after the wedding.
 *   (b) Post-event: the wedding has happened. The host marks the card
 *       done to advance to thank-yous / reviews / editorial.
 *
 * Per iteration 0031, the day-of guest experience auto-activates at T-1h
 * to T+8h via `events.live_mode_override` so the host doesn't manually
 * trigger anything on the wedding day. This wizard card sits separate
 * from that auto-activation · it's just the "we did it" milestone.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]] · this
 * card lands as a calm celebration moment, not a checkbox.
 */

import { Heart } from 'lucide-react';
import { EventMarkDoneRow } from './event-mark-done-row';

type Props = {
  eventId: string;
  eventDate: string | null;
};

export function EventCard({ eventId, eventDate }: Props) {
  const eventHasPassed = (() => {
    if (!eventDate) return false;
    const wedding = new Date(eventDate);
    if (Number.isNaN(wedding.getTime())) return false;
    // Treat the wedding as "past" once 24 hours have elapsed from the
    // ceremony date (gives buffer for late-night reception receptions
    // to still be considered "ongoing").
    return Date.now() > wedding.getTime() + 24 * 60 * 60 * 1000;
  })();

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-terracotta/5 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <Heart
            aria-hidden
            className="h-4 w-4 text-terracotta"
            strokeWidth={2}
            fill="currentColor"
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Day of
          </p>
        </div>
        {eventHasPassed ? (
          <p className="mt-2 text-sm leading-relaxed text-ink/85">
            Your wedding has happened. We hope the day landed exactly how you
            imagined — and the bits that didn&apos;t became the stories
            you&apos;ll tell forever.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-ink/85">
            When the wedding day arrives, your guest experience auto-activates
            an hour before the ceremony. Day-of timeline, table assignments,
            and live photo wall all light up automatically. Nothing to push.
          </p>
        )}
      </div>

      <EventMarkDoneRow eventId={eventId} eventHasPassed={eventHasPassed} />
    </div>
  );
}
