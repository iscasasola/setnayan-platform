import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ROLE_SUBTYPE_LABEL, type RoleSubtype } from '@/lib/event-moderators';

// V1 pilot Home v2 — owner directive 2026-05-22.
// Activity-feed enhancement: when an activity row came from a host action,
// show WHO did it ("Tita Lita confirmed catering with La Maison") so the
// host community feels visible to each other.
//
// The four existing activity sources (guests / event_vendors / orders /
// event_schedule_blocks) don't carry an actor column yet — schema audit
// 2026-05-22. The canonical "who did what" stream lives in
// `event_action_log` (migration 20260518500000) but the V1 app code
// doesn't write to it yet. So in V1 the attribution lane is a parallel
// feed: when the table has rows for this event, we render the rich
// "[host] did X" line; when it doesn't, the existing source-feed rows
// render unchanged.
//
// As the V1.x build wires event_action_log into the write paths (vendor
// status updates, payment confirms, etc.) this lane will progressively
// take over from the source feeds without any UI rewrite — the rows
// just start carrying attribution.

export type AttributedActivity = {
  id: string;
  at: string;
  description: string;
  href: string;
  /** Display name on the actor (from event_moderators.display_label
   *  when set, else the user's profile display name, else "Someone"). */
  actorLabel: string | null;
  /** Role suffix ("· Parent of the bride") for the actor. NULL when
   *  the actor isn't a moderator on this event OR isn't resolvable. */
  actorRoleLabel: string | null;
  /** TRUE when the actor is the current viewer — flips to "You ..." in
   *  the renderer. */
  isSelf: boolean;
};

type ActionLogRow = {
  id: string;
  action_type: string;
  action_target_table: string | null;
  action_target_id: string | null;
  performed_by_user_id: string;
  performed_by_role: 'couple' | 'coordinator' | 'planner' | 'system';
  notes: string | null;
  payload_json: Record<string, unknown> | null;
  performed_at: string;
};

type ModeratorRow = {
  user_id: string;
  role_subtype: RoleSubtype;
  display_label: string | null;
};

type UserMini = {
  user_id: string;
  display_name: string | null;
};

/**
 * Read up to `limit` recent action-log entries for this event, joined
 * against event_moderators + users so each row carries actor metadata.
 * Returns [] silently on any error — the home page renders the existing
 * source-feed activity even when the attribution lane fails.
 */
export async function fetchAttributedActivity(
  admin: SupabaseClient,
  eventId: string,
  currentUserId: string,
  limit: number,
): Promise<AttributedActivity[]> {
  const { data: actionRows, error: actionErr } = await admin
    .from('event_action_log')
    .select(
      'id, action_type, action_target_table, action_target_id, performed_by_user_id, performed_by_role, notes, payload_json, performed_at',
    )
    .eq('event_id', eventId)
    .order('performed_at', { ascending: false })
    .limit(limit);
  if (actionErr || !actionRows || actionRows.length === 0) return [];

  const rows = actionRows as ActionLogRow[];
  const actorIds = Array.from(new Set(rows.map((r) => r.performed_by_user_id)));

  const [modsRes, usersRes] = await Promise.all([
    admin
      .from('event_moderators')
      .select('user_id, role_subtype, display_label')
      .eq('event_id', eventId)
      .not('user_id', 'is', null)
      .in('user_id', actorIds),
    admin
      .from('users')
      .select('user_id, display_name')
      .in('user_id', actorIds),
  ]);

  const modByUser = new Map<string, ModeratorRow>();
  for (const m of (modsRes.data ?? []) as ModeratorRow[]) {
    if (m.user_id) modByUser.set(m.user_id, m);
  }
  const userByUser = new Map<string, UserMini>();
  for (const u of (usersRes.data ?? []) as UserMini[]) {
    userByUser.set(u.user_id, u);
  }

  return rows.map((row) => {
    const mod = modByUser.get(row.performed_by_user_id);
    const user = userByUser.get(row.performed_by_user_id);
    const isSelf = row.performed_by_user_id === currentUserId;

    const actorLabel = isSelf
      ? 'You'
      : (mod?.display_label?.trim() ?? user?.display_name?.trim() ?? 'A host');

    const actorRoleLabel =
      mod && !isSelf
        ? (ROLE_SUBTYPE_LABEL[mod.role_subtype] ?? null)
        : null;

    return {
      id: `action-${row.id}`,
      at: row.performed_at,
      description: describeAction(row),
      href: routeForAction(row, eventId),
      actorLabel,
      actorRoleLabel,
      isSelf,
    };
  });
}

function describeAction(row: ActionLogRow): string {
  const target = readStringFromPayload(row.payload_json, 'target_name');
  switch (row.action_type) {
    case 'payment_confirmed':
      return target ? `confirmed payment for ${target}` : 'confirmed a payment';
    case 'meeting_scheduled':
      return target ? `scheduled a meeting with ${target}` : 'scheduled a meeting';
    case 'meeting_rescheduled':
      return target ? `rescheduled a meeting with ${target}` : 'rescheduled a meeting';
    case 'vendor_replied':
      return target ? `replied to ${target}` : 'replied to a vendor';
    case 'artifact_shared':
      return target ? `shared ${target}` : 'shared an artifact';
    case 'action_marked_done':
      return target ? `finished ${target}` : 'finished a task';
    case 'booking_proposed':
      return target ? `proposed booking ${target}` : 'proposed a booking';
    case 'booking_confirmed':
      return target ? `confirmed booking with ${target}` : 'confirmed a booking';
    case 'note_added':
      return target ? `added a note on ${target}` : 'added a note';
    case 'vendor_quote_requested':
      return target ? `requested a quote from ${target}` : 'requested a quote';
    default:
      return row.notes?.trim().slice(0, 120) ?? row.action_type.replace(/_/g, ' ');
  }
}

function routeForAction(row: ActionLogRow, eventId: string): string {
  switch (row.action_target_table) {
    case 'payment_milestones':
      return `/dashboard/${eventId}/budget`;
    case 'vendor_meetings':
      return `/dashboard/${eventId}/schedule`;
    case 'chat_threads':
    case 'chat_messages':
      return `/dashboard/${eventId}/messages`;
    case 'event_vendors':
      return `/dashboard/${eventId}/vendors`;
    case 'orders':
      return `/dashboard/${eventId}/orders`;
    default:
      return `/dashboard/${eventId}/activity`;
  }
}

function readStringFromPayload(
  payload: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!payload) return null;
  const v = payload[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}
