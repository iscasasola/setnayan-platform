import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { readEventSubjects } from '@/lib/event-subjects';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import type { ForTag } from '@/lib/for-tag';

/**
 * lib/event-for-tag.server.ts — "FOR <NAME>", READY TO DRAW (owner 22 Oct 2026).
 *
 * The ONE reader both surfaces use — the Events board's Planning posters and the event
 * Home's cover band — so the two can never name an event's subject two ways.
 *
 * The decision of WHO lives in `readEventSubjects` (lib/event-subjects.ts: the id is
 * re-read under `owner_user_id = viewer`); this file only signs the shop's logo, which needs
 * the server-only R2 signer, so it is split from the pure half (server-only forces guards to
 * grep — the pure half stays importable by a test).
 *
 * ⚠ A LOGO THAT WILL NOT SIGN IS INITIALS, NOT A MISSING TAG. The name is already known; only
 * the picture degrades.
 */
export async function readForTags(
  client: SupabaseClient,
  userId: string,
  eventIds: readonly string[],
): Promise<Map<string, ForTag>> {
  const out = new Map<string, ForTag>();
  const subjects = await readEventSubjects(client, { userId, eventIds }).catch(
    () => new Map<string, never>(),
  );
  await Promise.all(
    [...subjects.entries()].map(async ([eventId, s]) => {
      const markUrl = s.logoRef ? await displayUrlForStoredAsset(s.logoRef).catch(() => null) : null;
      out.set(eventId, { name: s.name, markUrl });
    }),
  );
  return out;
}
