import Link from 'next/link';
import { ArrowRight, Inbox, QrCode } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { fetchRunOfShowBlocks } from '@/app/_actions/run-of-show';
import { eventSeatingPublished } from '@/lib/seat-pass';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import {
  FLOOR_REQUESTABLE_AREAS,
  buildFloorCommand,
  type PanelReason,
} from '@/lib/floor-command';
import type { DelegateArea } from '@/lib/event-moderators';
import { ConsoleRule } from '../../../../_components/pahina-console';
import type { SpecializationSurfaceProps } from '../specialization-registry';
import { fetchMyAreaGrants, fetchMyPendingAsk } from './access-actions';
import { decideRequestsPanel } from '@/lib/day-requests';
import { getDayRequestsView } from '../../../actions';
import { RequestsInbox } from '../../../_components/requests-inbox';
import { AskAccess } from './ask-access';
import { ScheduleUpdater } from './schedule-updater';
import { SeatScanner } from './seat-scanner';
import { StageNoteCompose } from '../stage-note-compose';

/**
 * FLOOR COMMAND — the day-of specialization for the coordinator.
 *
 * WHAT IT BUILDS, AND WHAT IT REFUSES TO REBUILD. `FloorClock` (countdown) and
 * `RunOfShowHeader` (live now/next + drift) already render ABOVE this on the
 * same page, so neither is repeated here — a second clock that can disagree
 * with the first is worse than no second clock. What the console has never had
 * is the ability to ACT: `page.tsx` mounts RunOfShowHeader WITHOUT
 * `canAdvance`, so until now the coordinator could watch the running order and
 * not touch it. Acting is the delta, and it is the first panel.
 *
 * ⚠ BEING BOOKED GRANTS NOTHING (owner, 2026-07-27). Every panel here is
 * AND-gated on the host having SHARED that area through the delegate mechanism
 * that already ships (`event_moderators.permissions_json.areas` →
 * `moderator_area_level`). A coordinator with a booking and no grant gets the
 * "ask the host" card and no tools. Revoking an area closes the panel the same
 * minute, with no deploy.
 *
 * ITS OWN DATA BOUNDARY. The frame mounts this only for an entitled, booked,
 * authenticated vendor on the day — but that is not authorisation for these
 * reads (registry doc; 2026-07-26 security review). The run-of-show read goes
 * through the caller's own RLS; the seat lookup is a SECURITY DEFINER RPC with
 * its own five gates. Hiding a panel is presentation, never a boundary.
 */
export async function FloorCommand({ eventId, coupleName }: SpecializationSurfaceProps) {
  const supabase = await createClient();

  const [blocksRaw, grants, pendingAsk, seatingPublished, requestsActive, requests] =
    await Promise.all([
      fetchRunOfShowBlocks(eventId),
      fetchMyAreaGrants(eventId),
      fetchMyPendingAsk(eventId),
      eventSeatingPublished(supabase, eventId),
      isDataPrivacyControlActive('coordinator_requests_inbox'),
      // DAY-6 · in the same round-trip as everything else this panel needs.
      // `.catch` rather than a throw: the running order and the seat finder must
      // not disappear because the requests table was unreachable — and an
      // unreadable view says so on screen rather than rendering an empty list.
      getDayRequestsView(eventId).catch(() => ({
        active: true,
        side: null,
        rows: [],
        unreadable: true,
      })),
    ]);

  const panel = decideRequestsPanel(requests);
  const model = buildFloorCommand({
    blocks: blocksRaw ?? [],
    grants: { seatPlan: grants.seat_plan ?? null, schedule: grants.schedule ?? null },
    seatingPublished,
    requestsActive,
  });

  // Only offer what the host has not already shared.
  const askable = FLOOR_REQUESTABLE_AREAS.filter((a) => !grants[a]) as DelegateArea[];

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink/65">
        Running {coupleName}’s floor. Call each part of the day, find a guest’s seat, and work
        the requests coming in.
      </p>

      {model.needsHostAccess ? (
        <AskAccess eventId={eventId} askable={askable} pendingAreas={pendingAsk?.requestedAreas ?? null} />
      ) : null}

      {model.schedule.state === 'ready' ? (
        <>
          <ConsoleRule />
          <ScheduleUpdater
            eventId={eventId}
            action={model.schedule.action}
            remaining={model.schedule.remaining}
            driftMinutes={model.schedule.driftMinutes}
          />
        </>
      ) : (
        <Closed title="The running order" reason={model.schedule.reason} />
      )}

      {/* A line to the host, without opening the event to them. The note is
          ADDRESSED to one supplier — granting the emcee event-member access was
          rejected, because a member can read the couple's private schedule
          notes. Renders only when this event actually has a host booked. */}
      <StageNoteCompose eventId={eventId} />

      <ConsoleRule />

      {model.seatFinder.state === 'ready' ? (
        <SeatScanner eventId={eventId} />
      ) : (
        <Closed title="Find a guest’s seat" reason={model.seatFinder.reason} />
      )}

      <ConsoleRule />

      {model.qrKit.state === 'ready' ? (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <QrCode aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.75} />
            The event QR kit
          </h4>
          <p className="text-xs text-ink/60">
            The printed table signs and place cards for tonight — the same pack the couple
            published. Open it if you need to reprint a card at the door.
          </p>
          <Link
            href={`/vendor-dashboard/clients/${eventId}/seat-plan`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink/80 transition hover:border-terracotta"
          >
            Open the seat plan
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </section>
      ) : (
        <Closed title="The event QR kit" reason={model.qrKit.reason} />
      )}

      <ConsoleRule />

      {/* DAY-6 · THE INBOX OPENS WHERE THE COORDINATOR ALREADY IS.
          This section existed and its only affordance was a link to
          /vendor-dashboard/on-the-day — so reading "everything raised today"
          meant LEAVING the live console mid-wedding and finding the way back.
          The component was never missing; it was mounted on one surface and
          linked to from the other.

          Fed from the server here rather than fetched on mount, so the first
          paint carries the rows: a coordinator who glances at this panel must
          never be shown an empty list that is really a list still loading.

          🔑 THE LINK SURVIVES, DEMOTED. The full desk holds more than the inbox,
          and this panel is not a replacement for it — it is the answer to "is
          there anything I have to deal with", in place. */}
      {model.requests.state === 'ready' ? (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <Inbox aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.75} />
            Requests inbox
          </h4>
          {panel === 'unreadable' ? (
            /* 🔴 AN UNREADABLE LIST IS NOT AN EMPTY ONE, AND ON THIS SCREEN THE
               DIFFERENCE IS A WEDDING. Rendering the inbox here with zero rows
               would tell a coordinator, mid-celebration, that nothing has been
               raised — the exact shape of failure this console exists to end.
               So the panel says what it does not know and keeps the way in. */
            <>
              <p className="text-xs text-ink/60">
                We couldn&rsquo;t load today&rsquo;s requests just now, so this list may be
                incomplete. Nothing has been lost — open the desk to try again.
              </p>
              <Link
                href="/vendor-dashboard/on-the-day"
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink/80 transition hover:border-terracotta"
              >
                Open the inbox
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </>
          ) : panel === 'inbox' && requests.side ? (
            <>
              <RequestsInbox
                eventId={eventId}
                initialRows={requests.rows}
                side={requests.side}
              />
              <Link
                href="/vendor-dashboard/on-the-day"
                className="inline-flex items-center gap-1.5 text-xs text-ink/55 transition hover:text-ink"
              >
                Open the full desk
                <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Link>
            </>
          ) : (
            <p className="text-xs text-ink/60">
              Everything raised today — by the couple, the hosts, or your suppliers — in one
              list, once this event is on your books.
            </p>
          )}
        </section>
      ) : (
        <Closed title="Requests inbox" reason={model.requests.reason} />
      )}
    </div>
  );
}

/**
 * A closed panel always says WHY, and the reason points at the person who can
 * change it. An empty div would leave the coordinator guessing on the one night
 * they have no time to guess.
 */
function Closed({ title, reason }: { title: string; reason: PanelReason | null }) {
  const copy: Record<PanelReason, string> = {
    not_shared: 'The host hasn’t shared this with you yet — ask them above.',
    not_published: 'The couple hasn’t published their seating plan yet.',
    no_schedule: 'The couple hasn’t built a run-of-show yet.',
    control_off: 'Not switched on for this event yet.',
  };
  return (
    <section className="space-y-1">
      <h4 className="text-sm font-medium text-ink/45">{title}</h4>
      <p className="text-xs text-ink/50">{reason ? copy[reason] : 'Not available.'}</p>
    </section>
  );
}
