import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Users } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';
import { countGuestsByEvent } from '@/lib/guests';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { PageMasthead } from '@/app/_components/page-masthead';
import type { ModeratorPermissions } from '@/lib/delegate-areas';
import {
  buildPeopleGroups,
  groupCountLabel,
  rosterHeadline,
  PEOPLE_GROUP_COPY,
  type PeopleGroupKey,
  type PeopleViewer,
} from '@/lib/event-people-roster';

export const metadata = { title: 'Who is here' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * "Who is in my event?" — ONE screen above five, never instead of them.
 *
 * The five routes that hold the answer today (`/hosts`, `/guests`, `/vendors`,
 * `/manpower`, `/studio/papic/crew`) are untouched and keep every control and
 * every gate they already have. This page adds only the view none of them can
 * give: all of it at once, with a way into each.
 *
 * ⛔ NO BROADCAST HERE — and ⚠ NOT because it is undecided, which is what this
 * comment used to say. The day-of announcement ships: composed on the couple's
 * day-of screen, read by guests on the Event Hub, and writable only by the
 * couple or a `schedule: 'edit'` delegate. This page adds no compose box
 * because that composer already has a home, not because the rule is open.
 *
 * ── WHY EVERY COUNT IS READ HERE RATHER THAN REUSED ────────────────────────
 * `getConfirmedVendorCount` already counts suppliers — and returns **0** on a
 * failed read. That is correct enough for a badge and wrong for a roster, where
 * 0 says "you have booked nobody". This page needs `null` to survive, so it
 * counts the same rows with the same status set and keeps the refusal.
 * `countGuestsByEvent` already returns `number | null` and IS reused.
 */
export default async function EventPeoplePage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Who is asking. The same pair the event layout runs to decide whether this
  // event opens at all — the caller's OWN rows, so every policy permits them.
  const [memberRes, delegateRes] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('event_moderators')
      .select('permissions_json')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);
  // ⚠ WHO THE VIEWER IS. Refused, they read as neither couple nor delegate and
  // ⚠ the page lists nothing — the safe direction here, because every row is a
  // ⚠ door into somebody else's list.
  if (memberRes.error) {
    logQueryError('EventPeoplePage.member', memberRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  if (delegateRes.error) {
    logQueryError('EventPeoplePage.delegate', delegateRes.error, { event_id: eventId }, 'graceful_degrade');
  }

  const viewer: PeopleViewer = {
    isCouple: (memberRes.data as { member_type?: string } | null)?.member_type === 'couple',
    delegatePermissions:
      (delegateRes.data?.permissions_json as ModeratorPermissions | undefined) ?? null,
  };

  // Only count what this viewer is allowed to open. A count they may not see is
  // still a disclosure, so the gate decides the QUERIES, not just the markup.
  const shown = new Set(buildPeopleGroups(eventId, viewer, {}).map((g) => g.key));

  const counts: Partial<Record<PeopleGroupKey, number | null>> = {};

  const jobs: Array<Promise<void>> = [];

  if (shown.has('hosts')) {
    jobs.push(
      (async () => {
        // The couple + accepted co-hosts and delegates, counted as one group
        // because that is how the /hosts page presents them.
        const [members, mods] = await Promise.all([
          supabase
            .from('event_members')
            .select('user_id', { count: 'exact', head: true })
            .eq('event_id', eventId),
          supabase
            .from('event_moderators')
            .select('moderator_id', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .not('accepted_at', 'is', null)
            .is('removed_at', null),
        ]);
        // ⚠ EITHER refusal makes the total short, and a short total is not a
        // ⚠ smaller truth — it is a wrong one. Both must answer or neither counts.
        if (members.error || mods.error) {
          logQueryError(
            'EventPeoplePage.hosts',
            members.error ?? mods.error!,
            { event_id: eventId },
            'graceful_degrade',
          );
          counts.hosts = null;
          return;
        }
        // A delegate has a row in BOTH tables since migration 20271161203067
        // ("every accepted delegate IS a member"), so adding the two counts
        // would double-count every helper. The member count already carries
        // them; the moderator read is what proves the pair is readable.
        counts.hosts = members.count ?? 0;
      })(),
    );
  }

  if (shown.has('guests')) {
    jobs.push(
      (async () => {
        counts.guests = await countGuestsByEvent(supabase, eventId);
      })(),
    );
  }

  if (shown.has('suppliers')) {
    jobs.push(
      (async () => {
        const { count, error } = await supabase
          .from('event_vendors')
          .select('vendor_id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
        if (error) {
          logQueryError('EventPeoplePage.suppliers', error, { event_id: eventId }, 'graceful_degrade');
          counts.suppliers = null;
          return;
        }
        counts.suppliers = count ?? 0;
      })(),
    );
  }

  if (shown.has('helpers')) {
    jobs.push(
      (async () => {
        const { count, error } = await supabase
          .from('manpower_gigs')
          .select('gig_id', { count: 'exact', head: true })
          .eq('event_id', eventId);
        if (error) {
          logQueryError('EventPeoplePage.helpers', error, { event_id: eventId }, 'graceful_degrade');
          counts.helpers = null;
          return;
        }
        counts.helpers = count ?? 0;
      })(),
    );
  }

  if (shown.has('photo_crew')) {
    jobs.push(
      (async () => {
        // Seats somebody is actually holding — an unclaimed seat is a QR nobody
        // has scanned, not a person at the event.
        const { count, error } = await supabase
          .from('paparazzi_seats')
          .select('seat_id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .not('claimer_user_id', 'is', null)
          .is('revoked_at', null);
        if (error) {
          logQueryError('EventPeoplePage.photoCrew', error, { event_id: eventId }, 'graceful_degrade');
          counts.photo_crew = null;
          return;
        }
        counts.photo_crew = count ?? 0;
      })(),
    );
  }

  await Promise.all(jobs);

  const groups = buildPeopleGroups(eventId, viewer, counts);
  const headline = rosterHeadline(groups);

  return (
    <section className="sn-col space-y-6">
      <PageMasthead title="Who is here" />

      <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-ink/60">{headline}</p>

      {groups.length === 0 ? (
        // Not a Denied frame and not an Empty one: nothing about this event is
        // shared with them, and the honest thing is to say so and point at the
        // person who can change it — never a create-CTA for somebody else's list.
        <div className="sn-tile p-5">
          <p className="text-sm text-ink/70">
            None of this event&rsquo;s lists are shared with you. Ask the couple if you
            need to see who is coming.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => {
            const copy = PEOPLE_GROUP_COPY[g.key];
            return (
              <li key={g.key}>
                {/* Every row opens the route that already owns this group — the
                    page adds a view, never a second editor. */}
                <Link
                  href={g.href}
                  className="sn-tile sn-press flex items-center gap-4 p-4 text-left"
                >
                  <Users aria-hidden className="h-5 w-5 shrink-0 text-ink/45" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{g.label}</span>
                    <span className="mt-0.5 block text-[12.5px] text-ink/55">{g.blurb}</span>
                    <span
                      className={
                        g.count === null
                          ? 'mt-1.5 block font-mono text-[12px] text-ink/45'
                          : 'mt-1.5 block font-mono text-[13px] font-bold text-ink'
                      }
                    >
                      {groupCountLabel(g.count, copy.noun, copy.pluralNoun)}
                    </span>
                  </span>
                  <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={1.75} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
