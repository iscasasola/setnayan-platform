import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { eventMemberTypeOnce } from '@/lib/event-membership-once';
import { COORDINATOR_ROLE, levelCardTitle, seatAsksForLevel, type LevelSeat } from '@/lib/coordinator-access-level';
import { peopleWithAccessHref } from '@/lib/people-with-access-href';
import { CoordinatorLevelAsk } from './coordinator-level-ask';

/**
 * 🔑 "<shop> IS YOUR COORDINATOR — WHAT CAN THEY DO?" — Home's one card (owner 2026-10-29: *"Once the coordinator
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
  const { data: me } = await eventMemberTypeOnce(supabase, eventId, userId);
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

  // The shop's name — the seat's own label first; else the shop the coordinator owns (a public column).
  const unnamed = seats.filter((s) => !s.display_label?.trim()).map((s) => s.user_id!);
  const shopNames = new Map<string, string>();
  if (unnamed.length > 0) {
    const { data: shops, error: shopError } = await supabase
      .from('vendor_profiles')
      .select('user_id, business_name')
      .in('user_id', unnamed);
    if (shopError) logQueryError('CoordinatorLevelCard.shopNames', shopError, { event_id: eventId }, 'graceful_degrade');
    for (const r of (shops ?? []) as Array<{ user_id: string | null; business_name: string | null }>) {
      if (r.user_id && r.business_name?.trim()) shopNames.set(r.user_id, r.business_name.trim());
    }
  }
  const asks = seats.map((s) => ({
    moderatorId: s.moderator_id,
    title: levelCardTitle(s.display_label?.trim() || shopNames.get(s.user_id!) || null),
  }));
  return <CoordinatorLevelAsk eventId={eventId} asks={asks} unread={false} accessHref={peopleWithAccessHref(eventId)} />;
}
