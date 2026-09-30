import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { logQueryError } from '@/lib/supabase/error-detect';
import {
  delegateActivityLine,
  type DelegateActivityLine,
  type DelegateActivityRow,
} from './delegate-activity';

/**
 * The delegate activity stream for one event, newest first — the read the
 * Hosts page did inline, moved so the Overview feed asks the same source.
 *
 * Admin client on purpose, exactly as the Hosts page read it: `event_action_log`
 * and the actors' names in `users` are not the couple's own rows. The CALLER
 * decides who may see the result (the couple only — "your coordinator did X"
 * was couple-visible on Hosts and stays so).
 *
 * ⚠ `measured` IS CARRIED, NEVER COLLAPSED TO `[]`. An empty feed and a refused
 * one are opposite sentences: one says nobody touched the plan, the other that
 * we could not look. A refused name read keeps the lines and names nobody.
 */
export async function fetchDelegateActivity(
  admin: SupabaseClient,
  eventId: string,
  limit: number,
  /** One person's lines only — their guest card (F2). Absent: everyone's (Overview). */
  actorUserId?: string,
): Promise<{ measured: boolean; lines: DelegateActivityLine[] }> {
  let query = admin
    .from('event_action_log')
    .select('id, performed_by_user_id, action_type, action_target_table, notes, payload_json, performed_at')
    .eq('event_id', eventId)
    .like('action_type', 'delegate_%');
  if (actorUserId) query = query.eq('performed_by_user_id', actorUserId);
  const { data, error } = await query.order('performed_at', { ascending: false }).limit(limit);
  if (error) {
    logQueryError('fetchDelegateActivity.log', error, { event_id: eventId }, 'graceful_degrade');
    return { measured: false, lines: [] };
  }
  const rows = (data ?? []) as DelegateActivityRow[];
  const actorIds = [...new Set(rows.map((r) => r.performed_by_user_id).filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: users, error: usersError } = await admin
      .from('users')
      .select('user_id, display_name, email')
      .in('user_id', actorIds);
    // ⚠ the helpers' names. Refused, the lines stay and say "A helper".
    if (usersError) {
      logQueryError('fetchDelegateActivity.users', usersError, { event_id: eventId }, 'graceful_degrade');
    }
    for (const u of (users ?? []) as { user_id: string; display_name: string | null; email: string | null }[]) {
      const name = u.display_name?.trim() || u.email;
      if (name) names.set(u.user_id, name);
    }
  }
  return {
    measured: true,
    lines: rows.map((r) => delegateActivityLine(r, r.performed_by_user_id ? names.get(r.performed_by_user_id) : null)),
  };
}
