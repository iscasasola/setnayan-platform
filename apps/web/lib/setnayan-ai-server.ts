import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * setnayan-ai-server.ts — server-only resolution for the PER-USER Setnayan AI
 * subscription fan-out.
 *
 * The per-user entitlement is a single window per user
 * (`user_ai_subscription.active_until`). While it's in the future, Setnayan AI is
 * on for EVERY event the user hosts/co-hosts. That fan-out is resolved here at the
 * EVENT level: an event is entitled when ANY of its host/co-host members
 * (event_members.member_type='couple') has an active subscription window. Keying
 * on the event (not the viewer) means the resolution is identical for dashboard
 * surfaces and the public guest page — the latter has no session, so it MUST run
 * on the service-role admin client.
 *
 * The result is fed into the pure gate `isSetnayanAiActiveForUser` via
 * `subscription: { active_until }`; `userAiSubscriptionActive` does the lazy
 * expiry check (cron-free).
 *
 * The per-user FLAG resolver lives in lib/integration-config.ts
 * (`resolveSetnayanAiPerUserEnabled`), mirroring the paywall flag; callers
 * short-circuit this DB read entirely when the flag is OFF so there is zero added
 * query cost while it's off (the default).
 */

/**
 * Latest (max) `active_until` among an event's host/co-host members.
 *
 * Returns `{ active_until: null }` when the event has no hosting member with a
 * subscription window, or on ANY read error (fail-soft: no subscription → the
 * per-event behaviour, never a crash). The caller passes the result into
 * `isSetnayanAiActiveForUser({ subscription })`, where `userAiSubscriptionActive`
 * applies the future-vs-now expiry check — so a stale (past) `active_until`
 * resolves to inactive there, not here.
 *
 * MUST use the admin/service client: it both crosses RLS (couple→couple reads are
 * blocked) and works where there is no session (the public /v/[slug] page).
 */
export async function getEventHostAiSubscription(
  admin: SupabaseClient,
  eventId: string,
): Promise<{ active_until: string | null }> {
  try {
    // Host/co-host members of this event.
    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple');

    const userIds = (members ?? [])
      .map((m) => (m as { user_id?: string | null }).user_id)
      .filter((id): id is string => Boolean(id));
    if (userIds.length === 0) return { active_until: null };

    // Their subscription windows (one row per user). Take the LATEST expiry —
    // either co-host's active window covers the event (never double-charged).
    const { data: subs } = await admin
      .from('user_ai_subscription')
      .select('active_until')
      .in('user_id', userIds);

    let maxActiveUntil: string | null = null;
    let maxTime = -Infinity;
    for (const s of subs ?? []) {
      const raw = (s as { active_until?: string | null }).active_until;
      if (!raw) continue;
      const t = new Date(raw).getTime();
      if (Number.isNaN(t)) continue;
      if (t > maxTime) {
        maxTime = t;
        maxActiveUntil = raw;
      }
    }
    return { active_until: maxActiveUntil };
  } catch {
    // DB unreachable / tables absent (pre-migration) → no subscription.
    return { active_until: null };
  }
}
