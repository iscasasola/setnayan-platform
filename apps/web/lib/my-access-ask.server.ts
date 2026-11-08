import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { DELEGATE_AREAS, type DelegateArea } from '@/lib/delegate-areas';
import type { LastAccessAnswer } from '@/lib/access-ask-words';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The supplier's LAST ANSWERED area ask on this event — what they asked and what the host or the coordinator said,
 * line by line (owner 8 Nov 2026: the supplier "sees what they asked for and what they got"). Their own row only
 * (`event_access_requests_own_read`). One round trip. A refused read is logged and draws no answer line — never an
 * invented "declined".
 */
export async function readMyLastAccessAnswer(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<LastAccessAnswer | null> {
  const { data, error } = await supabase
    .from('event_access_requests')
    .select('requested_areas, decisions')
    .eq('event_id', eventId)
    .eq('requester_user_id', userId)
    .eq('kind', 'areas')
    .eq('status', 'answered')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logQueryError('readMyLastAccessAnswer', error, { eventId }, 'graceful_degrade');
    return null;
  }
  if (!data) return null;
  const row = data as { requested_areas: string[] | null; decisions: Record<string, unknown> | null };
  const requestedAreas = (row.requested_areas ?? []).filter((a): a is DelegateArea =>
    (DELEGATE_AREAS as readonly string[]).includes(a),
  );
  const decisions: LastAccessAnswer['decisions'] = {};
  for (const [k, v] of Object.entries(row.decisions ?? {})) {
    if (v === 'granted' || v === 'declined') decisions[k] = v;
  }
  return { requestedAreas, decisions };
}
