import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readHubDraft, writeHubDraft } from '@/lib/hub-draft-store';
import { draftAskToJoinOnGoingPublic } from '@/lib/going-public';

type Client = Parameters<typeof readHubDraft>[0];

/**
 * Carry "Ask to join" into the event's Maker draft after the live column moved
 * (see lib/going-public.ts for why). Called by every writer that switches an
 * event INTO public, only when that switch turned requests on.
 *
 * A failure here does NOT undo the visibility save — the live page is already
 * right. It is logged, loudly, because the one thing it risks is a later Apply
 * switching requests back off.
 */
export async function carryAskToJoinIntoDraft(client: Client | SupabaseClient, eventId: string): Promise<void> {
  try {
    const draft = await readHubDraft(client as Client, eventId);
    const next = draftAskToJoinOnGoingPublic(draft);
    if (next) await writeHubDraft(client as Client, eventId, next);
  } catch (e) {
    console.error(
      '[going-public] the Maker draft still holds the old "Who can RSVP?" — Apply would switch requests off:',
      e instanceof Error ? e.message : e,
    );
  }
}
