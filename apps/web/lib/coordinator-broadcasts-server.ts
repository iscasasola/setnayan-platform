import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveAreaLevel,
  type ModeratorPermissions,
} from '@/lib/event-moderators';
import type {
  BroadcastSenderRole,
  CoordinatorBroadcastItem,
} from '@/lib/coordinator-broadcasts';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';

/**
 * Coordinator P3 — server half of lib/coordinator-broadcasts.ts (which stays
 * pure for unit tests). Reads run through the CALLER's supabase client so the
 * migration's RLS decides scope; everything is best-effort so the day-of grid
 * never crashes when the table hasn't been pushed to prod yet (same graceful
 * pre-migration posture as schedule-ros.ts' fetchBlockRosMeta).
 */

/**
 * Activation gate for the P3 surfaces (broadcast composer + feed, call-time
 * email button). Reads the admin-approved `coordinator_day_of_broadcast`
 * Data Privacy control (default inactive = today's pre-P3 stub). Server-only —
 * lives here, not in the pure client-imported coordinator-broadcasts.ts.
 */
export async function isCoordinatorP3Enabled(): Promise<boolean> {
  return isDataPrivacyControlActive('coordinator_day_of_broadcast');
}

/**
 * Latest broadcasts for the day-of card, newest first. Best-effort: any error
 * (including "relation does not exist" before migration 20270825364600 is
 * pushed) returns [] — the card just shows its "No broadcast yet" state.
 */
export async function fetchLatestBroadcasts(
  supabase: SupabaseClient,
  eventId: string,
  limit = 3,
): Promise<CoordinatorBroadcastItem[]> {
  try {
    const { data, error } = await supabase
      .from('coordinator_broadcasts')
      .select('broadcast_id, body, sender_role, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (
      data as Array<{
        broadcast_id: string;
        body: string;
        sender_role: string;
        created_at: string;
      }>
    ).map((row) => ({
      broadcastId: row.broadcast_id,
      body: row.body,
      senderRole: (row.sender_role === 'couple' ? 'couple' : 'coordinator') as BroadcastSenderRole,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export type BroadcastAuthority =
  | { canSend: true; role: BroadcastSenderRole }
  | { canSend: false; role: null };

/**
 * Who may compose a broadcast (and under which display attribution): a couple
 * member of the event, or an accepted, not-removed event delegate holding the
 * schedule-'edit' grant — the SAME pair the migration's INSERT policies
 * enforce (couple_insert / moderator_insert). This probe only decides whether
 * the composer renders; the RLS re-checks authority on the actual write.
 */
export async function resolveBroadcastAuthority(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<BroadcastAuthority> {
  try {
    const { data: coupleRow } = await supabase
      .from('event_members')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('member_type', 'couple')
      .limit(1)
      .maybeSingle();
    if (coupleRow) return { canSend: true, role: 'couple' };

    // Self-row visibility (event_moderators_select_own_events) lets the
    // delegate read their own grant. TS mirror resolveAreaLevel() keeps parity
    // with the SQL moderator_area_level() the INSERT policy evaluates.
    const { data: modRow } = await supabase
      .from('event_moderators')
      .select('permissions_json')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .limit(1)
      .maybeSingle();
    if (modRow) {
      const perms = (modRow as { permissions_json: ModeratorPermissions | null })
        .permissions_json;
      if (resolveAreaLevel(perms, 'schedule') === 'edit') {
        return { canSend: true, role: 'coordinator' };
      }
    }
    return { canSend: false, role: null };
  } catch {
    return { canSend: false, role: null };
  }
}
