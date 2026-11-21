import 'server-only';

import { eventWordsForEvent } from '@/app/[slug]/_lib/event-words';
import { inviterFirstNames } from '@/lib/claim-invite-words';
import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * 🚪 P6 — WHO THE CLAIMED WELCOME NAMES (owner 2026-11-19 drawing): "<couple>'s wedding is in Clients." Read only when
 * Today opens with `?claimed=1`: the invite this account claimed last → its booking row → the event's first names and
 * the event's own word. Admin client, scoped to the signed-in user's own claim. Any refused or empty read answers null,
 * and the welcome then names no couple — it never names the wrong one.
 */
export async function readClaimedWelcome(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ couple: string; eventWord: string } | null> {
  const { data: invite, error } = await admin
    .from('vendor_invites')
    .select('vendor_id')
    .eq('claimed_by_user_id', userId)
    .eq('status', 'claimed')
    .order('claimed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] lib/claimed-welcome.server.ts · from:vendor_invites.select', error);
    return null;
  }
  if (!invite?.vendor_id) return null;
  const { data: row, error: rowError } = await admin
    .from('event_vendors')
    .select('event_id')
    .eq('vendor_id', invite.vendor_id as string)
    .maybeSingle();
  if (rowError) {
    console.error('[supabase-error] lib/claimed-welcome.server.ts · from:event_vendors.select', rowError);
    return null;
  }
  const eventId = (row?.event_id as string | null) ?? null;
  if (!eventId) return null;
  const [{ data: ev }, words] = await Promise.all([
    admin.from('events').select('display_name,bride_name,groom_name').eq('event_id', eventId).maybeSingle(),
    eventWordsForEvent(eventId).catch(() => null),
  ]);
  const couple = ev
    ? inviterFirstNames({
        display_name: (ev.display_name as string | null) ?? null,
        bride_name: (ev.bride_name as string | null) ?? null,
        groom_name: (ev.groom_name as string | null) ?? null,
      })
    : null;
  if (!couple) return null;
  return { couple, eventWord: words?.eventWord ?? 'event' };
}
