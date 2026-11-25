'use server';

/**
 * Setnayan AI — couple-side server actions.
 *
 * RETIRED 2026-05-28 V2 cutover.
 * The V1 Concierge ₱2,499 SKU + 3-day card-less free trial + wedding-
 * anchored 12-mo floor / 24-mo cap expiry framework + tiered abuse
 * enforcement are all retired per CLAUDE.md 2026-05-28 V1→V2 cutover
 * row 3 lock + PR #560 marketing rewrite. V2 replaces them with a
 * single TODAYS_FOCUS line item in platform_retail_catalog_v2 — one
 * purchase per event, no trial mechanic.
 *
 * These exports are retained during the cutover so existing imports
 * (e.g. the stress-test script) keep compiling. Visible notification
 * strings have been rewritten to V2 brand voice; the underlying
 * trial / wedding-anchored expiry machinery still operates against
 * the V1 columns (`events.concierge_*`, `users.concierge_*`) which
 * the Phase A schema migration retires alongside.
 *
 * Function names kept (activateConcierge / recomputeConciergeExpiry). L6 (R1, 25 Nov): the trial and cancel
 * handlers that redirected to the retired /dashboard/profile/concierge page are deleted. The names are kept
 * to avoid cross-iteration import churn during cutover. Engineering
 * rename to activate/cancel TodaysFocus is V2.x scope.
 *
 * Wedding-anchored expiry formula (legacy, still operative during cutover):
 *   expires = LEAST(GREATEST(wedding_date + 30d, activated_at + 12mo), activated_at + 24mo)
 *
 * See lib/concierge.ts computeConciergeExpiry for the canonical formula
 * implementation.
 */

// Every `revalidatePath()` below uses `'layout'` mode (not default 'page')
// so the dashboard layout invalidates too. Concierge state writes
// (trial start · cancel · upgrade · downgrade) change fields the account
// sidebar chrome reads from the layout's events + switcher fetch (the
// AccountSwitcher event list); without 'layout' the chrome stays stale until
// a manual reload. Same canonical
// fix as wizard-actions.ts (PR #514) — see CLAUDE.md 2026-05-24
// "Fix: chrome monogram (+ layout-cached fields) stay stale after wizard save".
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  computeConciergeExpiry,
  detectConciergeAbuseSignals,
  isLongEngagement,
  TRIAL_DURATION_DAYS,
  type ConciergeStatus,
} from '@/lib/concierge';
import { emitNotification } from '@/lib/notification-emit';

const MS_PER_DAY = 86_400_000;

type ActionContext = {
  userId: string;
  eventId: string;
};

async function requireCoupleMembership(
  rawEventId: FormDataEntryValue | string | null,
): Promise<ActionContext> {
  const eventId = typeof rawEventId === 'string' ? rawEventId.trim() : '';
  if (!eventId) {
    throw new Error('Missing event_id');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    throw new Error('Forbidden — couple-only action');
  }

  return { userId: user.id, eventId };
}

/**
 * Activate Setnayan AI on a paid order.
 *
 * RETIRED 2026-05-28 V2 cutover.
 * V1 framing was a single Concierge ₱2,499 SKU; V2 replaces with the
 * TODAYS_FOCUS line item in platform_retail_catalog_v2 at a different
 * price. Function name kept to avoid cross-iteration import churn.
 * Computes wedding-anchored expiry against the legacy V1 columns;
 * fires long-engagement advisory once if the wedding is > 24mo from
 * activation. The 'full_banned' refusal gate is V1-only and retires
 * alongside the Phase A schema migration.
 */
export async function activateConcierge(input: {
  eventId: string;
  orderId?: string | null;
}): Promise<{ status: 'activated' | 'enforcement_blocked'; expiresAt?: string }> {
  const { userId, eventId } = await requireCoupleMembership(input.eventId);
  void input.orderId; // V1: order linkage logged in service_orders, not stamped on events

  const admin = createAdminClient();

  // Enforcement gate — full_banned blocks purchase + activation.
  const { data: userRow } = await admin
    .from('users')
    .select('concierge_enforcement_level')
    .eq('user_id', userId)
    .maybeSingle();
  if (
    (userRow as { concierge_enforcement_level?: string } | null)?.concierge_enforcement_level ===
    'full_banned'
  ) {
    return { status: 'enforcement_blocked' };
  }

  const { data: eventRow } = await admin
    .from('events')
    .select('event_date, concierge_activated_at, concierge_long_engagement_advised_at')
    .eq('event_id', eventId)
    .maybeSingle();

  const now = new Date();
  const weddingDate = eventRow?.event_date ? new Date(eventRow.event_date) : null;

  // First activation stamps NOW; subsequent extends keep the original anchor.
  const activatedAt = eventRow?.concierge_activated_at
    ? new Date(eventRow.concierge_activated_at)
    : now;
  const expiresAt = computeConciergeExpiry(activatedAt, weddingDate);

  const updatePayload: Record<string, unknown> = {
    concierge_status: 'active' satisfies ConciergeStatus,
    concierge_tier: 'complete',
    concierge_activated_at: eventRow?.concierge_activated_at ?? now.toISOString(),
    concierge_expires_at: expiresAt.toISOString(),
  };

  // Long-engagement advisory — one-shot stamp on first detection.
  if (
    isLongEngagement(activatedAt, weddingDate) &&
    !eventRow?.concierge_long_engagement_advised_at
  ) {
    updatePayload['concierge_long_engagement_advised_at'] = now.toISOString();
    void emitNotification({
      userId,
      type: 'chat_message',
      title: "Setnayan AI — long-engagement advisory",
      body: `Your wedding is more than 24 months away. Setnayan AI runs for up to 24 months from your purchase date — you'll have ~${monthsBetween(expiresAt, weddingDate!)} months between expiry and your wedding day. Re-purchase closer to the date to keep the daily planner running through to the wedding.`,
      relatedUrl: `/dashboard/${eventId}`,
    });
  }

  const { error } = await admin
    .from('events')
    .update(updatePayload)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  void emitNotification({
    userId,
    type: 'order_paid',
    title: "Setnayan AI active",
    body: "Setnayan AI is now active on your event. Open your dashboard to see today's recommended step.",
    relatedUrl: `/dashboard/${eventId}`,
  });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath('/dashboard/profile/concierge', 'layout');
  return { status: 'activated', expiresAt: expiresAt.toISOString() };
}

/**
 * Recompute `concierge_expires_at` from the current wedding_date.
 *
 * RETIRED 2026-05-28 V2 cutover.
 * EXTEND-ONLY semantics — never shrinks an existing expiry (hosts keep
 * the runway they paid for even if they move the wedding earlier).
 * Fires the long-engagement advisory the first time
 * `wedding_date > activated + 24mo`.
 *
 * V1 column names (`concierge_*`) retained during cutover. Phase A
 * schema migration renames + simplifies. Idempotent; safe to call on
 * every wedding-date update.
 */
async function recomputeConciergeExpiry(input: {
  eventId: string;
}): Promise<{ status: 'extended' | 'unchanged' | 'inactive' }> {
  const { userId, eventId } = await requireCoupleMembership(input.eventId);
  const admin = createAdminClient();

  const { data: eventRow } = await admin
    .from('events')
    .select(
      'concierge_status, concierge_activated_at, concierge_expires_at, event_date, concierge_long_engagement_advised_at',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!eventRow) return { status: 'inactive' };

  const status = (eventRow as { concierge_status?: string }).concierge_status;
  if (status !== 'active' && status !== 'trial') {
    return { status: 'inactive' };
  }
  const activatedRaw = (eventRow as { concierge_activated_at?: string | null }).concierge_activated_at;
  if (!activatedRaw) return { status: 'inactive' };

  const activatedAt = new Date(activatedRaw);
  const weddingDate = (eventRow as { event_date?: string | null }).event_date
    ? new Date((eventRow as { event_date: string }).event_date)
    : null;
  const newExpires = computeConciergeExpiry(activatedAt, weddingDate);

  const currentExpires = (eventRow as { concierge_expires_at?: string | null }).concierge_expires_at
    ? new Date((eventRow as { concierge_expires_at: string }).concierge_expires_at)
    : null;

  const updatePayload: Record<string, unknown> = {};
  let extended = false;
  // Extend-only.
  if (!currentExpires || newExpires.getTime() > currentExpires.getTime()) {
    updatePayload['concierge_expires_at'] = newExpires.toISOString();
    extended = true;
  }

  if (
    isLongEngagement(activatedAt, weddingDate) &&
    !(eventRow as { concierge_long_engagement_advised_at?: string | null })
      .concierge_long_engagement_advised_at
  ) {
    updatePayload['concierge_long_engagement_advised_at'] = new Date().toISOString();
    void emitNotification({
      userId,
      type: 'chat_message',
      title: "Setnayan AI — long-engagement advisory",
      body: `Your wedding is more than 24 months away. Setnayan AI runs for up to 24 months from your purchase date — you'll have ~${monthsBetween(newExpires, weddingDate!)} months between expiry and your wedding day. Re-purchase closer to the date to keep the daily planner running through to the wedding.`,
      relatedUrl: `/dashboard/${eventId}`,
    });
  }

  if (Object.keys(updatePayload).length === 0) {
    return { status: 'unchanged' };
  }

  const { error } = await admin
    .from('events')
    .update(updatePayload)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath('/dashboard/profile/concierge', 'layout');
  return { status: extended ? 'extended' : 'unchanged' };
}

function monthsBetween(later: Date, earlier: Date): number {
  return Math.max(
    0,
    Math.round((later.getTime() - earlier.getTime()) / (30 * 86_400_000)),
  );
}
