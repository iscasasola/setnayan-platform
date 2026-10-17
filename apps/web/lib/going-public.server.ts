import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readHubDraft, updateHubDraft } from '@/lib/hub-draft-store';
import { draftAskToJoinOnGoingPublic } from '@/lib/going-public';

type Client = Parameters<typeof readHubDraft>[0];

/**
 * Carry "Ask to join" into the event's Maker draft after the live column moved
 * (see lib/going-public.ts for why). Called by the host's explicit visibility
 * switch (`updateLandingPageVisibility`), only when that switch turned requests
 * on. NOT by the Save-the-Date launch — owner 2026-09-29: "no".
 *
 * A failure here does NOT undo the visibility save — the live page is already
 * right. It is logged, loudly, because the one thing it risks is a later Apply
 * switching requests back off.
 */
export async function carryAskToJoinIntoDraft(client: Client | SupabaseClient, eventId: string): Promise<void> {
  try {
    // 👥 Built on the draft as it is when the write lands (`updateHubDraft`) — a host's save made meanwhile is kept.
    await updateHubDraft(client as Client, eventId, (draft) => {
      const next = draftAskToJoinOnGoingPublic(draft);
      return next ? { next } : null;
    });
  } catch (e) {
    console.error(
      '[going-public] the Maker draft still holds the old "Who can RSVP?" — Apply would switch requests off:',
      e instanceof Error ? e.message : e,
    );
  }
}
