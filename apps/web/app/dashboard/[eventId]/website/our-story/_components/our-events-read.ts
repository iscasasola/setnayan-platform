import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readMomentMedia } from '@/lib/love-story-moments';
import { isHostMemberType } from '@/app/[slug]/_lib/host-scope';
import { newestFirst, sharedEvents, type MembershipRow } from './our-events-rule';

/**
 * THE EVENTS BOTH PARTNERS WERE AT — one read for the page that OFFERS their
 * photos and the action that ACCEPTS a pick (`loveStoryMomentAction` intent
 * `pick`), so the two can never disagree about which refs are theirs.
 *
 * ⚠ RLS IS A FLOOR, NOT A SCOPE — read through the ADMIN client on purpose, with
 * every scope applied HERE. The pattern is `resolveMutualStoryDays`
 * (`lib/person-life-stories.ts`). Why the session cannot do this job:
 * `member_reads_membership` lets a person read their OWN memberships and every
 * membership of events they are the couple of — so the signed-in partner can
 * never see the other partner's memberships at an event where they were only a
 * guest, and the intersection would come back short without a word.
 *
 * The scope, in order:
 *   1. `userId` must be a `couple` member of `eventId` — else null (refused).
 *   2. The pair = that event's `couple` members, nobody else.
 *   3. Only events where EVERY one of the pair is a live member (`sharedEvents`)
 *      — so all this can tell the signed-in partner is that the other partner
 *      was at an event they were at themselves.
 *   4. Photo refs only from events the pair HOSTS, and only the public ones the
 *      Event Hub already shows (hero + "Photos you add").
 *
 * FAILS CLOSED. Any read error returns null: the page says it could not look,
 * and the action accepts no ref at all.
 *
 * `adminClient` is injectable so a test can drive the real control flow.
 */
export type OurEvent = {
  eventId: string;
  name: string;
  date: string | null;
  /** Either partner is a host there (couple or coordinator). */
  hosted: boolean;
  /** Public-bucket refs this event already shows guests — empty unless hosted. */
  refs: string[];
};

type Admin = ReturnType<typeof createAdminClient>;

export async function readOurEvents(input: {
  userId: string;
  eventId: string;
  adminClient?: Admin;
}): Promise<OurEvent[] | null> {
  const { userId, eventId } = input;
  if (!userId || !eventId) return null;
  let admin: Admin;
  try {
    admin = input.adminClient ?? createAdminClient();
  } catch (e) {
    logQueryError('OurEvents.client', { message: e instanceof Error ? e.message : String(e) }, { event_id: eventId }, 'graceful_degrade');
    return null;
  }

  // 1 + 2 · the pair — this event's couple members, the signed-in one among them.
  const { data: couple, error: coupleError } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('member_type', 'couple');
  if (coupleError || !couple) {
    logQueryError('OurEvents.couple', coupleError ?? { message: 'no rows' }, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const pair = [...new Set((couple as { user_id: string | null }[]).map((r) => r.user_id).filter((u): u is string => !!u))];
  if (!pair.includes(userId)) return null;

  // 3 · every membership of the pair, then the events they share.
  const { data: rows, error: rowsError } = await admin
    .from('event_members')
    .select('event_id, user_id, member_type, hidden_at')
    .in('user_id', pair)
    .limit(2000);
  if (rowsError || !rows) {
    logQueryError('OurEvents.memberships', rowsError ?? { message: 'no rows' }, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  // "Hosts" is the ONE shared definition — never a literal re-typed here.
  const memberships: MembershipRow[] = (
    rows as { event_id: string; user_id: string; member_type: string | null; hidden_at: string | null }[]
  ).map((r) => ({
    event_id: r.event_id,
    user_id: r.user_id,
    host: isHostMemberType(r.member_type),
    hidden_at: r.hidden_at,
  }));
  const shared = sharedEvents(memberships, pair, eventId);
  if (shared.length === 0) return [];

  const { data: events, error: eventsError } = await admin
    .from('events')
    .select('event_id, display_name, event_date, our_photos, landing_page_hero_image_url')
    .in(
      'event_id',
      shared.map((s) => s.eventId),
    );
  if (eventsError || !events) {
    logQueryError('OurEvents.events', eventsError ?? { message: 'no rows' }, { event_id: eventId }, 'graceful_degrade');
    return null;
  }

  const hosted = new Map(shared.map((s) => [s.eventId, s.hosted]));
  return newestFirst(
    (
      events as {
        event_id: string;
        display_name: string | null;
        event_date: string | null;
        our_photos: unknown;
        landing_page_hero_image_url: string | null;
      }[]
    ).map((e) => {
      const isHosted = hosted.get(e.event_id) === true;
      // 4 · one ref at a time — `readMomentMedia` caps a LIST at a moment's four.
      const all: unknown[] = isHosted
        ? [e.landing_page_hero_image_url, ...(Array.isArray(e.our_photos) ? e.our_photos : [])]
        : [];
      return {
        eventId: e.event_id,
        name: e.display_name ?? 'Our event',
        date: e.event_date ?? null,
        hosted: isHosted,
        refs: [...new Set(all.flatMap((v) => readMomentMedia([v])))],
      };
    }),
  );
}

/** Every public ref the pair may pick — the action's allow-list. Empty on any refusal. */
export async function ourEventPhotoRefs(userId: string, eventId: string): Promise<Set<string>> {
  const events = await readOurEvents({ userId, eventId });
  return new Set((events ?? []).flatMap((e) => e.refs));
}
