'use client';

/**
 * "Set your wedding date" nudge (client component).
 *
 * Date-as-output philosophy [[project_setnayan_date_as_output_philosophy]]:
 * onboarding intentionally commits `events.event_date = NULL` — the date is an
 * OUTPUT of vendor discovery, not a required first step. That's correct and we
 * don't change it. BUT the couple still needs a clear, low-friction way to SET
 * their date later, because several surfaces stay locked until it exists — most
 * notably the date-gated public website lifecycle (`getLifecyclePhase` in
 * lib/invitation-widgets returns 'rsvp' for a null date and can never reach the
 * Save-the-Date / Event / Editorial phases). Until the date is set, the
 * editorial showcase can never launch.
 *
 * This is the gentle, additive prompt on event home. It renders ONLY when the
 * parent already determined `event_date IS NULL` (the parent gates rendering;
 * this component never reads the date itself). It links to the existing
 * governed date-set surface at /dashboard/[eventId]/date-selection — no new
 * date-write path is introduced here.
 *
 * Dismissible: the host can close it; we remember that per-event in
 * localStorage so it stays out of the way. It naturally stops rendering for
 * good once a date is set (the parent no longer mounts it), so there's no TTL —
 * a permanent per-event dismiss is the right behaviour for a one-time setup
 * nudge. localStorage failures (private mode, sandboxed iframe) degrade to
 * "just show the nudge", matching the day-of banner convention.
 */

import { useEffect, useState } from 'react';
import { CalendarHeart, ChevronRight, X } from 'lucide-react';

type Props = {
  eventId: string;
};

const DISMISS_KEY = (eventId: string) => `setnayan:set-date-nudge-dismissed:${eventId}`;

export function SetDateNudge({ eventId }: Props) {
  const [dismissed, setDismissed] = useState(false);

  // Hydrate dismiss state from localStorage on mount.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY(eventId))) {
        setDismissed(true);
      }
    } catch {
      // localStorage unavailable (private mode); just render the nudge.
    }
  }, [eventId]);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY(eventId), '1');
    } catch {
      // swallow — UI still hides via state below
    }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className="mt-4 flex items-start gap-3 rounded-2xl border border-terracotta/35 bg-terracotta/[0.07] px-4 py-3.5 sm:items-center sm:px-5"
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta text-cream sm:mt-0"
      >
        <CalendarHeart className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta-700">
          One more thing
        </p>
        <p className="text-base font-semibold text-ink">Set your wedding date</p>
        <p className="text-sm text-ink/65">
          Lock it in to start the countdown and unlock your Save-the-Date and editorial pages.
        </p>
        <a
          href={`/dashboard/${eventId}/date-selection`}
          className="group mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:underline"
        >
          Set your date
          <ChevronRight
            aria-hidden
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </a>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss set-your-date reminder"
        className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-terracotta/15 hover:text-ink"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
