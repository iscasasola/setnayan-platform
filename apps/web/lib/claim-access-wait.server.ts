import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { ClaimWait, ClaimWaitsRead } from '@/lib/claim-access-wait';

/**
 * The supplier's OWN pending claim asks (`lib/claim-access-wait.ts`). Read with the service role because the event
 * is not theirs to read yet — that is the point of the wait — and scoped here to `requester_user_id = userId`, so a
 * supplier only ever sees their own asks and the event's display name, nothing else of it.
 */
export async function readClaimWaits(userId: string): Promise<ClaimWaitsRead> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_access_requests')
    .select('request_id, event_id, created_at')
    .eq('requester_user_id', userId)
    .eq('kind', 'claim')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    logQueryError('claim-access-wait.asks', error);
    return { ok: false };
  }
  const rows = (data ?? []) as Array<{ request_id: string; event_id: string; created_at: string | null }>;
  if (rows.length === 0) return { ok: true, waits: [] };
  const { data: events, error: evErr } = await admin
    .from('events')
    .select('event_id, display_name')
    .in('event_id', [...new Set(rows.map((r) => r.event_id))]);
  // A missing name is not a missing wait: the line falls back to "the couple".
  if (evErr) logQueryError('claim-access-wait.events', evErr);
  const names = new Map(
    ((events ?? []) as Array<{ event_id: string; display_name: string | null }>).map((e) => [e.event_id, e.display_name]),
  );
  const waits: ClaimWait[] = rows.map((r) => ({
    requestId: r.request_id,
    eventId: r.event_id,
    eventName: names.get(r.event_id) ?? null,
    askedAt: r.created_at,
  }));
  return { ok: true, waits };
}
