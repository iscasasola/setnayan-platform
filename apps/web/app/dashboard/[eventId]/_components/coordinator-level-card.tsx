import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { eventMemberTypeOnce } from '@/lib/event-membership-once';
import { COORDINATOR_ROLE, seatAsksForLevel, type LevelSeat } from '@/lib/coordinator-access-level';
import { peopleWithAccessHref } from '@/lib/people-with-access-href';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { CoordinatorLevelAsk } from './coordinator-level-ask';

/**
 * 🔑 "<shop> JOINED AS YOUR COORDINATOR" — a line in Home's TODAY list, under the cover (owner 2026-10-29, *"The popup
 * for the access and other popups above the header can be presented better"*: it used to stack above the cover; it is
 * now the FIRST Today line, and its press opens the house Sheet — `coordinator-level-ask.tsx`). Home's one ask (owner 2026-10-29: *"Once the coordinator
 * accepts, and connected to the event. The event should show to pick what kind of access do we want to give the
 * coordinator. On the home."* · *"Since our coordinator is already booked and they connected already, that command
 * should initiate"*). Self-hiding, like `AccessRequestsDoorway` beside it: drawn ONLY for the event's owners (a
 * `couple` member — the render's one membership read, `eventMemberTypeOnce`), and only while a CONNECTED coordinator
 * seat carries no recorded answer (`seatAsksForLevel`). Limited · Full access write through the existing door
 * (`setDelegateArea`, area `access_level`); the answer stays changeable in Event details › Access.
 *
 * ⛔ A REFUSED READ IS SAID: the card then says it could not check, with the one door to where access is set — never
 * a quiet nothing that reads as "no coordinator to answer".
 */
export async function CoordinatorLevelCard({ eventId, userId }: { eventId: string; userId: string }) {
  const supabase = await createClient();
  const { data: me, error: meError } = await eventMemberTypeOnce(supabase, eventId, userId);
  // Who is looking could not be read — the card is for owners only, so it is not drawn for an unknown viewer (the
  // layout's own gate, which reads this same answer, has already let them in or not).
  if (meError) {
    logQueryError('CoordinatorLevelCard.membership', meError, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  if ((me as { member_type?: string | null } | null)?.member_type !== 'couple') return null;

  const { data, error } = await supabase
    .from('event_moderators')
    .select('moderator_id, role_subtype, user_id, accepted_at, removed_at, permissions_json, display_label')
    .eq('event_id', eventId)
    .eq('role_subtype', COORDINATOR_ROLE)
    .is('removed_at', null)
    .not('user_id', 'is', null);
  if (error) {
    logQueryError('CoordinatorLevelCard.seats', error, { event_id: eventId }, 'graceful_degrade');
    return <CoordinatorLevelAsk eventId={eventId} asks={[]} unread accessHref={peopleWithAccessHref(eventId)} />;
  }
  const seats = ((data ?? []) as Array<LevelSeat & { moderator_id: string; display_label: string | null }>).filter(
    (s) => seatAsksForLevel(s) && s.user_id !== userId,
  );
  if (seats.length === 0) return null;

  /*
    🏷 THE SHOP'S NAME — never the bare word "coordinator" (owner 2026-10-29). Tried in order, each a couple-readable
    source: the seat's own label (the promote/invite doors write the booking's name there) → the shop itself
    (`vendor_profiles`, readable once the shop is public) → the shop's own ACCESS REQUEST on this event (the seat the
    "asked for access" door upserts carries NO label — the owner's live coordinator) and that shop's BOOKING here
    (`event_vendors.vendor_name`, the couple's own row). The three reads run together, only while a coordinator waits
    on the hosts — never on an ordinary Home load. The logo rides with the shop read (a public shop's logo).
  */
  const users = [...new Set(seats.map((s) => s.user_id!))];
  const [shopsRes, asksRes, bookedRes] = await Promise.all([
    supabase.from('vendor_profiles').select('user_id, business_name, logo_url').in('user_id', users),
    supabase
      .from('event_access_requests')
      .select('requester_user_id, vendor_profile_id, record:event_vendors!event_access_requests_event_vendor_id_fkey(vendor_name)')
      .eq('event_id', eventId)
      .in('requester_user_id', users),
    supabase
      .from('event_vendors')
      .select('vendor_name, marketplace_vendor_id, linked_vendor_profile_id')
      .eq('event_id', eventId),
  ]);
  if (shopsRes.error) logQueryError('CoordinatorLevelCard.shops', shopsRes.error, { event_id: eventId }, 'graceful_degrade');
  if (asksRes.error) logQueryError('CoordinatorLevelCard.asks', asksRes.error, { event_id: eventId }, 'graceful_degrade');
  if (bookedRes.error) logQueryError('CoordinatorLevelCard.booked', bookedRes.error, { event_id: eventId }, 'graceful_degrade');

  const shopOf = new Map<string, { name: string | null; logo: string | null }>();
  for (const r of (shopsRes.data ?? []) as Array<{ user_id: string | null; business_name: string | null; logo_url: string | null }>) {
    if (r.user_id) shopOf.set(r.user_id, { name: r.business_name?.trim() || null, logo: r.logo_url ?? null });
  }
  const bookedName = new Map<string, string>();
  for (const b of (bookedRes.data ?? []) as Array<{ vendor_name: string | null; marketplace_vendor_id: string | null; linked_vendor_profile_id: string | null }>) {
    const n = b.vendor_name?.trim();
    if (!n) continue;
    for (const id of [b.marketplace_vendor_id, b.linked_vendor_profile_id]) if (id && !bookedName.has(id)) bookedName.set(id, n);
  }
  const askedName = new Map<string, string>();
  for (const r of (asksRes.data ?? []) as unknown as Array<{
    requester_user_id: string | null;
    vendor_profile_id: string | null;
    record: { vendor_name: string | null } | null;
  }>) {
    const n = r.record?.vendor_name?.trim() || (r.vendor_profile_id ? bookedName.get(r.vendor_profile_id) : undefined);
    if (r.requester_user_id && n && !askedName.has(r.requester_user_id)) askedName.set(r.requester_user_id, n);
  }

  const asks = await Promise.all(
    seats.map(async (s) => {
      const shop = shopOf.get(s.user_id!);
      return {
        moderatorId: s.moderator_id,
        shop: s.display_label?.trim() || shop?.name || askedName.get(s.user_id!) || null,
        logoUrl: shop?.logo ? await displayUrlForStoredAsset(shop.logo) : null,
      };
    }),
  );
  return <CoordinatorLevelAsk eventId={eventId} asks={asks} unread={false} accessHref={peopleWithAccessHref(eventId)} />;
}
