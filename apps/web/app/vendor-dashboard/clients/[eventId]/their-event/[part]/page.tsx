import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchMyAreaGrants } from '@/lib/my-area-grants.server';
import { isBookedCoordinator } from '@/lib/coordinator-trade';
import { readTheirEvent } from '@/lib/their-event.server';
import { type TheirEventPart } from '@/lib/their-event';
import { TheirEventLine } from '../../_components/their-event-line';
import { PART_BODY_PARTS, TheirEventPartBody } from '../../_components/their-event-part-body';

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


export default async function TheirEventPartPage({ params }: { params: Promise<{ eventId: string; part: string }> }) {
  const { eventId, part: rawPart } = await params;
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const clientHref = `/vendor-dashboard/clients/${eventId}`;
  const part = (PART_BODY_PARTS as readonly string[]).includes(rawPart) ? (rawPart as TheirEventPart) : null;
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

  // Hub — the event's public address, read only when the Hub is the part opened.
  let hubSlug: string | null = null;
  if (open && part === 'hub') {
    const { data: ev } = await createAdminClient().from('events').select('slug').eq('event_id', eventId).maybeSingle();
    hubSlug = (ev as { slug: string | null } | null)?.slug ?? null;
  }
  const body = <TheirEventPartBody eventId={eventId} part={part} open={open} brief={brief} group={group} hubSlug={hubSlug} />;

  return (
    <div className="mx-auto w-full max-w-2xl" data-their-event-part={part}>
      <TheirEventLine eventId={eventId} eventName={name} />
      {body}
    </div>
  );
}
