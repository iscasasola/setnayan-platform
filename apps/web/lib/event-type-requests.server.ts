import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { emitNotification } from '@/lib/notification-emit';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { EventTypeAsk } from '@/lib/event-type-requests';

/**
 * event-type-requests.server.ts — the admin half of "Can't find yours? Ask us to add it" (owner 2026-10-28,
 * DECISION_LOG "EVENT TYPES MUST BE SPECIFIC"). Every function takes the SERVICE client, called only after
 * requireAdmin(). Rules in `lib/event-type-requests.ts`; table in migration 20271294233183.
 */

/** The asks still waiting on the admin (pending) or on the picker (linked), newest first. `failed` = the read was refused. */
export async function loadEventTypeAsks(admin: SupabaseClient): Promise<{ asks: EventTypeAsk[]; failed: boolean }> {
  const { data, error } = await admin
    .from('event_type_requests')
    .select('request_id, requested_by, label, status, event_type, created_at')
    .in('status', ['pending', 'linked'])
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    logQueryError('loadEventTypeAsks', error, {}, 'graceful_degrade');
    return { asks: [], failed: true };
  }
  const rows = (data ?? []) as Array<{
    request_id: string;
    requested_by: string;
    label: string;
    status: 'pending' | 'linked';
    event_type: string | null;
    created_at: string;
  }>;
  const ids = [...new Set(rows.map((r) => r.requested_by))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: people, error: peopleError } = await admin.from('users').select('user_id, display_name').in('user_id', ids);
    if (peopleError) logQueryError('loadEventTypeAsks.names', peopleError, {}, 'graceful_degrade');
    for (const p of (people ?? []) as Array<{ user_id: string; display_name: string | null }>) {
      if (p.display_name?.trim()) names.set(p.user_id, p.display_name.trim());
    }
  }
  return {
    failed: false,
    asks: rows.map((r) => ({
      requestId: r.request_id,
      label: r.label,
      status: r.status,
      eventType: r.event_type,
      createdAt: r.created_at,
      askedBy: names.get(r.requested_by) ?? 'A host',
    })),
  };
}

/** Where the notice takes them: the newest event they made AFTER asking (the "closest type" one), else the picker. */
async function whereToSwitch(admin: SupabaseClient, userId: string, since: string): Promise<string> {
  const { data: mine, error } = await admin
    .from('event_members')
    .select('event_id')
    .eq('user_id', userId)
    .eq('member_type', 'couple');
  if (error || !mine || mine.length === 0) return '/dashboard/create-event';
  const { data: ev, error: evError } = await admin
    .from('events')
    .select('event_id')
    .in(
      'event_id',
      mine.map((m) => (m as { event_id: string }).event_id),
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (evError || !ev) return '/dashboard/create-event';
  return `/dashboard/${(ev as { event_id: string }).event_id}/details`;
}

/**
 * The type is IN THE PICKER: every ask linked to it becomes `added` and its asker is told, in the app only
 * (`event_type_added` — not on the email allowlist). The status flip is the claim (`.eq('status', 'linked')` +
 * `.select()`), so a second press tells nobody twice. Returns how many were told.
 */
export async function tellAsksTheTypeIsReady(
  admin: SupabaseClient,
  eventType: string,
  typeLabel: string,
  adminUserId: string,
): Promise<number> {
  const { data: claimed, error } = await admin
    .from('event_type_requests')
    .update({ status: 'added', resolved_at: new Date().toISOString(), resolved_by: adminUserId })
    .eq('event_type', eventType)
    .eq('status', 'linked')
    .select('request_id, requested_by, label, created_at');
  if (error) {
    logQueryError('tellAsksTheTypeIsReady', error, { event_type: eventType }, 'graceful_degrade');
    return 0;
  }
  const rows = (claimed ?? []) as Array<{ request_id: string; requested_by: string; label: string; created_at: string }>;
  for (const r of rows) {
    await emitNotification({
      userId: r.requested_by,
      type: 'event_type_added',
      title: `${typeLabel} is ready`,
      body: `You asked for “${r.label}”. Pick ${typeLabel} for a new event, or switch the event you started in its Event settings.`,
      relatedUrl: await whereToSwitch(admin, r.requested_by, r.created_at),
    });
  }
  return rows.length;
}
