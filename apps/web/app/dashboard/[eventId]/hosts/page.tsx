import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ReadRefusedNotice } from '@/app/dashboard/[eventId]/_components/read-refused-notice';
import { PageMasthead } from '@/app/_components/page-masthead';
import { eventNoun } from '@/lib/event-noun';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { seatAccessWord } from '@/lib/guest-access';
import { ROLE_SUBTYPE_LABEL, isRoleSubtype } from '@/lib/event-moderators';
import { COLOUR_DOMAIN_LABEL, isColourDomain, type ColourDomain } from '@/lib/colour-access';
import { CoordinatorGrantChips } from '../_components/coordinator-seat-controls';

/**
 * /hosts — REDIRECT-ONLY, except for one viewer (the Hosts fold, owner
 * 2026-09-30, DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME COLUMNS…" and
 * "HOSTS FOLD — THREE OWNER ANSWERS").
 *
 * Hosts left the event menu and lives inside the Guest list: who holds access is
 * the Access column, one guest at a time. This page's pieces MOVED, none was
 * redrawn:
 *   · Promote your booked coordinator (RA 10173 consent step), the planner's
 *     grants, Remove and colour domains → the planner's supplier workspace
 *     (`vendors/[vendorId]/workspace/_components/promote-coordinator-card.tsx`);
 *   · "your coordinator did X" → a short feed on the Overview's Hosts card
 *     (`lib/delegate-activity.server.ts`);
 *   · a limited helper's grants and colour domains → their guest card (build
 *     F2, after the card redesign; the parts row is cut then too).
 *
 * So an old link, a bookmark or the Guest list's Hosts part (`?gview=hosts`,
 * which renders this page) lands on the Guest list for anybody who can see it.
 *
 * 🔑 ONE VIEWER STAYS: a helper the couple never shared the guest list with
 * (`isDelegateWithoutArea(viewer, 'guest_list')`). The guest list would only
 * tell them it isn't theirs to see, so they get what this page can still
 * honestly show them — their OWN access, read-only — never a 404 and never a
 * bounce into a refusal.
 */

export const metadata = { title: 'Your access' };

type Props = {
  params: Promise<{ eventId: string }>;
  // Carried by the Guest list's Hosts part (`?gview=hosts`), which renders this
  // page whole; nothing here reads them any more.
  searchParams: Promise<{
    invite_sent?: string;
    invite_error?: string;
    invite_revoked?: string;
    grant_updated?: string;
    host_removed?: string;
    token?: string;
    gview?: string;
  }>;
};

export default async function EventHostsPage({ params }: Props) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  // Neither the couple nor a delegate inside their access window.
  if (!viewer.isCouple && viewer.delegatePermissions === null) redirect('/dashboard');
  // The couple, and every helper who holds the guest list: Hosts IS the guest list now.
  if (!isDelegateWithoutArea(viewer, 'guest_list')) redirect(`/dashboard/${eventId}/guests`);

  // ── a helper without the guest list: their own access, read-only ──────────
  const admin = createAdminClient();
  const [{ data: eventRow, error: eventRowError }, { data: seat, error: seatError }, { data: colourRows, error: colourError }] =
    await Promise.all([
      admin
        .from('events')
        .select('display_name, event_type, event_date, event_end_date, cleared_at, timezone')
        .eq('event_id', eventId)
        .maybeSingle(),
      supabase
        .from('event_moderators')
        .select('role_subtype, display_label')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .is('removed_at', null)
        .maybeSingle(),
      admin
        .from('event_colour_grants_coordinator')
        .select('domain')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .eq('is_active', true),
    ]);
  if (eventRowError) logQueryError('HostsPage.eventRow', eventRowError, { eventId }, 'graceful_degrade');
  if (seatError) logQueryError('HostsPage.ownSeat', seatError, { eventId }, 'graceful_degrade');
  if (colourError) logQueryError('HostsPage.ownColour', colourError, { eventId }, 'graceful_degrade');
  // A refused read here drops a line of what they MAY do, and the page cannot
  // look incomplete on its own — so it says so.
  const hostsPartlyRefused = Boolean(eventRowError) || Boolean(seatError) || Boolean(colourError);

  const ev = eventRow as {
    display_name: string | null;
    event_type: string | null;
    event_date: string | null;
    event_end_date: string | null;
    cleared_at: string | null;
    timezone: string | null;
  } | null;
  const eventName = ev?.display_name ?? 'Your event';
  const eventType = ev?.event_type ?? null;
  const eventNounWord = eventNoun(eventType);
  // ONE resolver, the same one the Overview, the rail and the guest list ask.
  const eventHasHappened =
    getMenuLifecyclePhase(
      ev?.event_date ?? null,
      ev?.cleared_at ?? null,
      ev?.timezone ?? undefined,
      undefined,
      ev?.event_end_date ?? null,
    ) === 'after';

  const s = seat as { role_subtype: string; display_label: string | null } | null;
  // The guest list's word for the seat (Limited helper); the hired planner keeps its label.
  const accessWord = s
    ? (seatAccessWord(s.role_subtype) ?? (isRoleSubtype(s.role_subtype) ? ROLE_SUBTYPE_LABEL[s.role_subtype] : 'Helper'))
    : 'Helper';
  const colours = ((colourRows ?? []) as { domain: string }[])
    .map((r) => r.domain)
    .filter((d): d is ColourDomain => isColourDomain(d));

  return (
    <section className="sn-col space-y-6">
      <Link
        href={`/dashboard/${eventId}`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to {eventName}
      </Link>

      {hostsPartlyRefused ? (
        <ReadRefusedNotice partial what="what you can do on this event" />
      ) : null}

      <PageMasthead
        titleNode={
          <>
            {eventHasHappened
              ? `What you could do on this ${eventNounWord}`
              : `What you can do on this ${eventNounWord}`}
          </>
        }
        actions={
          <Link href={`/dashboard/${eventId}/people`} className="button-secondary inline-flex items-center gap-2">
            <Users aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Everyone in this event
          </Link>
        }
      />

      <section className="sn-tile space-y-3 p-5" data-own-access>
        <p className="sn-eye">
          {accessWord}
          {s?.display_label ? ` · ${s.display_label}` : ''}
        </p>
        <CoordinatorGrantChips permissions={viewer.delegatePermissions} />
        <p className="text-xs text-ink/55">
          {colours.length > 0
            ? `Colours you can adjust: ${colours.map((d) => COLOUR_DOMAIN_LABEL[d]).join(' · ')}.`
            : 'No colour access.'}
        </p>
        <p className="text-sm text-ink/65">
          The couple sets what you can do. Ask them if you need something that isn&apos;t here.
        </p>
      </section>
    </section>
  );
}
