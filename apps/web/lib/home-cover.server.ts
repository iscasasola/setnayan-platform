import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { readEventCover } from '@/lib/discover-events';
import { homeCoverOf, type HomeCover } from '@/lib/home-cover';

/**
 * 🖼 The event Home header's ground (`lib/home-cover.ts`) — the event's
 * PUBLISHED columns and its LIVE hero row, read and dressed by Discover's own
 * `readEventCover` → `dressEventCover`. A refused read keeps today's colour,
 * logged there, never a broken Home.
 */
export async function homeCoverFor(eventId: string): Promise<HomeCover | null> {
  return homeCoverOf(await readEventCover(createAdminClient(), eventId));
}
