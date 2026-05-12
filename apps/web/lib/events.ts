import type { SupabaseClient } from '@supabase/supabase-js';

export type EventRow = {
  event_id: string;
  public_id: string;
  event_type: 'wedding' | 'birthday' | 'celebration' | 'travel' | 'corporate' | 'burial';
  display_name: string;
  event_date: string | null;
  is_primary: boolean;
  archived: boolean;
  venue_name: string | null;
  venue_address: string | null;
};

export type EventWithRole = EventRow & {
  member_type: 'couple' | 'guest' | 'vendor' | 'coordinator';
};

type MembershipQueryRow = {
  member_type: EventWithRole['member_type'];
  events: EventRow | EventRow[] | null;
};

/**
 * Fetches every event the signed-in user is a member of. Returns the rows
 * sorted with primary events first, then by event date ascending.
 *
 * RLS already filters to the current user via Pattern B + Pattern A overlap;
 * the `.eq('user_id', userId)` is a defense-in-depth narrowing.
 */
export async function fetchUserEvents(
  supabase: SupabaseClient,
  userId: string,
  memberType?: EventWithRole['member_type'],
): Promise<EventWithRole[]> {
  let query = supabase
    .from('event_members')
    .select(
      `member_type,
       events:event_id (
         event_id,
         public_id,
         event_type,
         display_name,
         event_date,
         is_primary,
         archived,
         venue_name,
         venue_address
       )`,
    )
    .eq('user_id', userId);

  if (memberType) {
    query = query.eq('member_type', memberType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as MembershipQueryRow[];

  const events: EventWithRole[] = rows
    .flatMap((row) => {
      const eventArray = Array.isArray(row.events)
        ? row.events
        : row.events
          ? [row.events]
          : [];
      return eventArray.map((e) => ({ ...e, member_type: row.member_type }));
    })
    .sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      if (a.event_date && b.event_date) return a.event_date.localeCompare(b.event_date);
      if (a.event_date) return -1;
      if (b.event_date) return 1;
      return 0;
    });

  return events;
}

export function formatEventDate(iso: string | null, locale = 'en-US'): string {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
