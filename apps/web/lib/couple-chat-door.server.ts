import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { coupleChatHref } from '@/lib/couple-chat-door';
import { isRelationshipWorkspaceEnabled } from '@/lib/relationship-workspace-flag';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The couple's door for one conversation, as their Messages list resolves it (`app/dashboard/[eventId]/messages/
 * page.tsx`): the event's row for this shop — the anchor or a plain row, not archived, newest first — opens the picked
 * supplier on Chat. One indexed read, run with the caller's client (a notice is sent with the admin client). A refused
 * read keeps the shipped full-screen thread: a notice must still open SOMETHING that shows the message.
 */
export async function readCoupleChatHref(
  client: SupabaseClient,
  args: { eventId: string; vendorProfileId: string | null | undefined; threadId: string },
): Promise<string> {
  return coupleChatHref(args.eventId, await readCoupleWorkspaceRowId(client, args), args.threadId);
}

/**
 * The `event_vendors.vendor_id` the couple's door opens (null = no row, the flag off, or a refused read → the shipped
 * full-screen thread). Notice senders pass it straight to `coupleChatHref(eventId, row, threadId)` so every notice
 * link is written as that one helper — which the notice guards read.
 */
export async function readCoupleWorkspaceRowId(
  client: SupabaseClient,
  args: { eventId: string; vendorProfileId: string | null | undefined; threadId: string },
): Promise<string | null> {
  if (!isRelationshipWorkspaceEnabled() || !args.vendorProfileId) return null;
  const { data, error } = await client
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', args.eventId)
    .eq('marketplace_vendor_id', args.vendorProfileId)
    .or('package_role.is.null,package_role.eq.anchor')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logQueryError('readCoupleWorkspaceRowId', error, { event_id: args.eventId, thread_id: args.threadId }, 'graceful_degrade');
    return null;
  }
  return (data as { vendor_id: string } | null)?.vendor_id ?? null;
}
