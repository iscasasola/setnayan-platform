import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchMyAreaGrants } from '@/lib/my-area-grants.server';
import { isBookedCoordinator } from '@/lib/coordinator-trade';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { readTheirEvent } from '@/lib/their-event.server';
import { askForMoreHref, ASK_FOR_MORE, THEIR_EVENT_PART_NAME, type TheirEventPart } from '@/lib/their-event';
import { TheirEventLine } from '../../_components/their-event-line';
import { GuestsPart, NumbersPart } from '../../_components/their-event-parts';

/**
 * 🚪 ONE PART, ALONE — opened from the "Their event" list (owner 2026-11-21; drawing `their_event_door_2026-11-21`
 * frames "2 · Tap Guests · one group only" and "3 · Tap Schedule"). The line on top says whose event and closes back to
 * the chat; there is no tab bar. Seats and Mood Board open their shipped pages (`/seat-plan`, `/mood-board`) with the
 * same line; this route draws the parts that had no page of their own: Schedule (the whole day, view), Numbers
 * (headcount and packs), Guests (ONE group — the booking's own) and Hub.
 *
 * 🔒 THE SERVER DECIDES, EVERY PART: the brief RPC admits the supplier (else back to Clients), the stage must be BOOKED,
 * the booked coordinator has the dashboard instead (→ there), and a part that is not on THIS supplier's list says so
 * and offers "Ask for access to more" — never the content. Guests come from `supplier_booking_group`, which hands only
 * the booking's group; a refused read is said, never drawn as an empty group.
 */
type Brief = {
  stage: 'booked' | 'inquiry' | 'requested';
  event: { display_name: string | null; event_date: string | null; venue_name: string | null };
  pax: { invited: number; attending: number; maybe: number; pending: number; declined: number };
  monogram: { custom_svg: string | null };
  timeline: { label: string; block_type: string; start_at: string | null; end_at: string | null; location: string | null }[];
  seat_plan: { table_count: number };
};

const PARTS: readonly TheirEventPart[] = ['schedule', 'numbers', 'guests', 'hub'];

export default async function TheirEventPartPage({ params }: { params: Promise<{ eventId: string; part: string }> }) {
  const { eventId, part: rawPart } = await params;
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const clientHref = `/vendor-dashboard/clients/${eventId}`;
  const part = (PARTS as readonly string[]).includes(rawPart) ? (rawPart as TheirEventPart) : null;
  if (!part) redirect(clientHref);

  const { data, error } = await supabase.rpc('get_vendor_event_brief', { p_event_id: eventId });
  if (error || !data) redirect('/vendor-dashboard/customers');
  const brief = data as Brief;
  if (brief.stage !== 'booked') redirect(clientHref);
  const services = (profile as { services?: string[] | null }).services ?? null;
  // The booked coordinator has the hosts' own dashboard — never a list of links.
  if (isBookedCoordinator({ booked: true, services })) redirect(`/dashboard/${eventId}`);

  const grants = await fetchMyAreaGrants(eventId);
  const { rows, group } = await readTheirEvent(supabase, {
    eventId,
    vendorProfileId: profile.vendor_profile_id,
    services,
    grants,
    monogramSvg: brief.monogram?.custom_svg ?? null,
    tables: brief.seat_plan?.table_count ?? null,
  });
  const name = brief.event.display_name;
  const open = rows.some((r) => r.part === part);

  let body: React.ReactNode;
  if (!open) {
    body = (
      <div className="space-y-3 p-4" data-their-event-shut="">
        <p className="text-sm text-ink/70">{THEIR_EVENT_PART_NAME[part]} is not open to you. The hosts decide what each supplier sees.</p>
        <Link href={askForMoreHref(eventId)} className="inline-flex min-h-11 items-center text-[15px] font-medium text-sn-accent">
          {ASK_FOR_MORE}
        </Link>
      </div>
    );
  } else if (part === 'schedule') {
    body = (
      <div className="p-4" data-their-event-schedule="">
        <h1 className="text-lg font-semibold text-ink">Schedule</h1>
        <p className="mt-1 text-[13px] text-ink/60">The whole day. Your own items are changed from your Schedule.</p>
        {brief.timeline.length === 0 ? (
          <p className="mt-3 text-sm text-ink/70">The hosts have not set the day yet.</p>
        ) : (
          <ul className="mt-2">
            {brief.timeline.map((b, i) => (
              <li key={`${b.start_at}-${i}`} className="flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 py-2 first:border-t-0">
                <span className="min-w-0">
                  <span className="block text-[15px] text-ink">
                    {b.start_at ? `${formatWallClock(b.start_at)} · ` : ''}
                    {b.label}
                  </span>
                  {b.location ? <span className="block truncate text-[13px] text-ink/60">{b.location}</span> : null}
                </span>
                <span className="shrink-0 text-[13px] text-ink/55">View</span>
              </li>
            ))}
          </ul>
        )}
        <Link href={`${clientHref}?tab=schedule`} className="mt-3 inline-flex min-h-11 items-center text-[15px] font-medium text-sn-accent">
          Edit your items
        </Link>
      </div>
    );
  } else if (part === 'numbers') {
    body = <NumbersPart pax={brief.pax} group={group} />;
  } else if (part === 'guests') {
    body = <GuestsPart group={group} />;
  } else {
    // Hub — what the guests see: the event's public page.
    const { data: ev } = await createAdminClient().from('events').select('slug').eq('event_id', eventId).maybeSingle();
    const slug = (ev as { slug: string | null } | null)?.slug ?? null;
    body = (
      <div className="space-y-2 p-4" data-their-event-hub="">
        <h1 className="text-lg font-semibold text-ink">Hub</h1>
        {slug ? (
          <Link href={`/${slug}`} target="_blank" className="inline-flex min-h-11 items-center text-[15px] font-medium text-sn-accent">
            Open what the guests see
          </Link>
        ) : (
          <p className="text-sm text-ink/70">The hosts have not published their Hub yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl" data-their-event-part={part}>
      <TheirEventLine eventId={eventId} eventName={name} />
      {body}
    </div>
  );
}
