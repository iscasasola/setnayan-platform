import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { readEventCover, readEventCoverAndHero } from '@/lib/discover-events';
import { homeCoverOf, type HomeCover } from '@/lib/home-cover';
import { hubProLookWords, type HubProLookWords } from '@/lib/hub-pro-look-words';

/**
 * 🖼 The event Home header's ground (`lib/home-cover.ts`) — the event's
 * PUBLISHED columns and its LIVE hero row, read and dressed by Discover's own
 * `readEventCover` → `dressEventCover`. A refused read keeps today's colour,
 * logged there, never a broken Home.
 */
export async function homeCoverFor(eventId: string): Promise<HomeCover | null> {
  return homeCoverOf(await readEventCover(createAdminClient(), eventId));
}

/**
 * ✅ The header's ground AND what Event Hub Pro has unlocked (owner 2026-10-14,
 * the services rows) — from the SAME two reads, so the Pro row's "Vintage theme ·
 * video background" costs Home nothing. A refused read keeps today's colour and
 * leaves the look unsaid (null), never guessed.
 */
export async function homeCoverAndHubLookFor(eventId: string): Promise<{ cover: HomeCover | null; look: HubProLookWords }> {
  const read = await readEventCoverAndHero(createAdminClient(), eventId);
  if (!read) return { cover: null, look: { theme: null, background: null } };
  return { cover: homeCoverOf(read.cover), look: hubProLookWords({ theme: read.cover.theme, heroConfig: read.heroConfig }) };
}
