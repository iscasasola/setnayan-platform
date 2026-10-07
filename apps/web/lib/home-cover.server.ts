import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { COVER_COLUMNS, dressEventCover, type CoverRow } from '@/lib/discover-events';
import { homeCoverOf, type HomeCover } from '@/lib/home-cover';

/**
 * 🖼 The event Home header's ground (`lib/home-cover.ts`) — the event's
 * PUBLISHED columns and its LIVE hero row, dressed by Discover's own
 * `dressEventCover`. A refused read costs only the picture: the header keeps
 * today's colour, logged, never a broken Home.
 */
export async function homeCoverFor(eventId: string): Promise<HomeCover | null> {
  const admin = createAdminClient();
  const [ev, hero] = await Promise.all([
    admin.from('events').select(COVER_COLUMNS).eq('event_id', eventId).maybeSingle(),
    admin.from('invitation_widgets').select('config_json').eq('event_id', eventId).eq('widget_type', 'hero').maybeSingle(),
  ]);
  if (ev.error || !ev.data) {
    if (ev.error) logQueryError('home-cover.event', ev.error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  if (hero.error) logQueryError('home-cover.hero', hero.error, { event_id: eventId }, 'graceful_degrade');
  const heroConfig = (hero.data as { config_json: unknown } | null)?.config_json ?? null;
  return homeCoverOf(await dressEventCover(ev.data as unknown as CoverRow, heroConfig));
}
