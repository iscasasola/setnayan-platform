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

import { CalendarHeart } from 'lucide-react';
import { eventNoun } from '@/lib/event-noun';
import type { CloseRecord } from '@/lib/notices';
import { Notice, NOTICE_ACTION } from '@/app/_components/notices/notices';

/** A close kept by the older hand-written store on this browser — honoured, so an earlier dismissal holds. */
function legacyClosed(key: string): CloseRecord | null {
  try {
    return window.localStorage.getItem(key) ? { closedAt: Date.now(), count: 1 } : null;
  } catch {
    return null;
  }
}

type Props = {
  eventId: string;
  /** The event's kind. A birthday reads "event"; a wedding stays byte-identical. */
  eventType?: string | null;
};

/**
 * 🔔 Inventory #12 — a To-do that unlocks the invitation (one notice system, owner approved 14 Nov 2026; prototype §3
 * B): the terracotta card became a line, "Set your wedding date ⓘ · Set the date · Not now". It ranks with the
 * to-dos that block. Drawn by the event pages' top slot.
 */
export function SetDateNudge({ eventId, eventType = null }: Props) {
  const noun = eventNoun(eventType);
  return (
    <Notice
      kind="todo"
      blocking
      noticeKey={`set-date:${eventId}`}
      title={`Set your ${noun} date`}
      detail={
        noun === 'wedding'
          ? 'Lock it in to start the countdown and unlock your Save-the-Date and editorial pages.'
          : 'Lock it in to start the countdown and open the pages of your site that wait for a date.'
      }
      actions={
        <a href={`/dashboard/${eventId}/date-selection`} className={NOTICE_ACTION}>
          <CalendarHeart aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Set the date
        </a>
      }
      legacy={() => legacyClosed(`setnayan:set-date-nudge-dismissed:${eventId}`)}
    />
  );
}
