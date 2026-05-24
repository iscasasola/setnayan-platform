'use server';

/**
 * Setnayan Concierge — couple-side server actions.
 *
 * Canonical spec: iteration 0016 § 0 + iteration 0025 § 3.7 + HANDOFF_2026-05-17 § 3.
 *
 * Wedding-anchored expiry formula (locked 2026-05-17):
 *
 *   expires = LEAST(GREATEST(wedding_date + 30d, activated_at + 12mo), activated_at + 24mo)
 *
 * Tested cases (see lib/concierge.ts computeConciergeExpiry):
 *   - wedding=NULL              → activated_at + 12mo (12-month floor)
 *   - wedding=activated + 3mo   → activated_at + 12mo (floor wins)
 *   - wedding=activated + 12mo  → wedding + 30d (≈ activated_at + 12.5mo)
 *   - wedding=activated + 24mo  → wedding + 30d clamped to activated_at + 24mo (cap wins)
 *   - wedding=activated + 36mo  → activated_at + 24mo (cap wins → long-engagement advisory fires)
 *
 * Anti-abuse: V1 only catches the deterministic phone-match signal. Fuzzy
 * similarity (venue / couple-name / wedding-date) is deferred to V1.1 per
 * iteration 0016 § 0 anti-abuse subsection.
 */

// Every `revalidatePath()` below uses `'layout'` mode (not default 'page')
// so the dashboard layout invalidates too. Concierge state writes
// (trial start · cancel · upgrade · downgrade) change fields the
// OuterDashboardHeader chrome reads via `primaryEvent.*`; without
// 'layout' the chrome stays stale until a manual reload. Same canonical
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
 * Activate Setnayan Concierge on a paid order. Single SKU as of 2026-05-17.
 * Computes wedding-anchored expiry; fires long-engagement advisory once if
 * the wedding is > 24mo from activation.
 *
 * Refuses on `users.concierge_enforcement_level = 'full_banned'`.
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
      title: 'Setnayan Concierge — long-engagement advisory',
      body: `Your wedding is more than 24 months away. Setnayan Concierge covers up to 24 months from your purchase date — you'll lose access ~${monthsBetween(expiresAt, weddingDate!)} months before your wedding day. We recommend renewing closer to your wedding for full coverage.`,
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
    title: 'Setnayan Concierge active',
    body: 'Your Setnayan Concierge is now active. The full 9-step roadmap, daily nudges, and priority vendor matching are unlocked.',
    relatedUrl: `/dashboard/${eventId}`,
  });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath('/dashboard/profile/concierge', 'layout');
  return { status: 'activated', expiresAt: expiresAt.toISOString() };
}

/**
 * Cancel Concierge — V1 implementation (per HANDOFF_2026-05-17 § 3
 * simplification): surface "cancellation requested" client-side only. The
 * status remains 'active' until natural expiry per the lazy sweep. The
 * couple keeps the access they paid for.
 *
 * No schema column exists for `cancellation_requested_at` (skipped per spec
 * V1 simplification). The Settings page reads a query param to confirm the
 * cancellation request landed.
 */
export async function cancelConcierge(formData: FormData): Promise<void> {
  const { eventId } = await requireCoupleMembership(formData.get('event_id'));
  // V1 SIMPLIFICATION: no structural state change — the couple keeps their
  // paid access until the natural `concierge_expires_at`. Pro-rated refund
  // requests are admin-handled per 0025 § 3.7.6.
  revalidatePath(`/dashboard/${eventId}`, 'layout');
  redirect(`/dashboard/profile/concierge?cancelled=1&event=${encodeURIComponent(eventId)}`);
}

/**
 * Start the 3-day card-less trial. Blocks on:
 *  (a) `users.concierge_trial_used_at IS NOT NULL` → account already used trial
 *  (b) `users.concierge_enforcement_level IN ('trial_banned', 'full_banned')`
 *  (c) Deterministic abuse signal (phone match against trial-used accounts)
 *
 * On (c): inserts `concierge_abuse_flags(status='pending_review')` and
 * returns `under_review` WITHOUT consuming the trial slot — a falsely-
 * flagged user later cleared by admin can still trial.
 *
 * Idempotent: re-running on an event already in `'trial'` returns
 * `already_active` (no double-stamp).
 */
export async function startConciergeTrial(input: { eventId: string }): Promise<{
  status:
    | 'started'
    | 'already_used'
    | 'already_used_on_event'
    | 'enforcement_blocked'
    | 'under_review'
    | 'already_active';
}> {
  const { userId, eventId } = await requireCoupleMembership(input.eventId);
  const admin = createAdminClient();

  // Check event status first — idempotent retry on an existing trial.
  // Also reads the new (2026-05-20 dual-scope lock) per-event trial-used
  // column so we can short-circuit when another host on this event has
  // already consumed the event-level trial slot.
  const { data: eventRow } = await admin
    .from('events')
    .select(
      'concierge_status, concierge_expires_at, concierge_trial_used_at, concierge_trial_started_by_user_id',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventRow?.concierge_status === 'trial') {
    return { status: 'already_active' };
  }

  // Per-event lock (locked 2026-05-20) — even if THIS user's account trial
  // is still fresh, the event itself may have already consumed its single
  // trial slot via a different moderator (V1.2 multi-moderator events
  // from iteration 0048 are the primary motivator; for V1 single-host
  // events this branch only fires on the bookkeeping edge case where
  // events.concierge_status was reverted/cleaned without resetting
  // concierge_trial_used_at).
  if (
    (eventRow as { concierge_trial_used_at?: string | null } | null)?.concierge_trial_used_at
  ) {
    return { status: 'already_used_on_event' };
  }

  const { data: userRow } = await admin
    .from('users')
    .select('phone, concierge_trial_used_at, concierge_enforcement_level')
    .eq('user_id', userId)
    .maybeSingle();
  if (!userRow) throw new Error('User not found');

  if ((userRow as { concierge_trial_used_at?: string }).concierge_trial_used_at) {
    return { status: 'already_used' };
  }

  const lvl = (userRow as { concierge_enforcement_level?: string }).concierge_enforcement_level;
  if (lvl === 'trial_banned' || lvl === 'full_banned') {
    return { status: 'enforcement_blocked' };
  }

  // Deterministic anti-abuse check — V1 catches phone matches only.
  const abuse = await detectConciergeAbuseSignals(admin, {
    userId,
    userPhone: (userRow as { phone?: string | null }).phone ?? null,
  });
  if (abuse) {
    try {
      await admin.from('concierge_abuse_flags').insert({
        flagged_user_id: userId,
        matched_user_ids: abuse.matchedUserIds,
        similarity_score: abuse.similarityScore,
        signals: abuse.signals,
      });
    } catch (e) {
      console.error('[concierge] abuse-flag insert failed:', e);
    }
    void emitNotification({
      userId,
      type: 'chat_message',
      title: 'Setnayan Concierge — trial under review',
      body: 'Your account is under review. Contact support if you believe this is in error.',
      relatedUrl: `/help#concierge`,
    });
    return { status: 'under_review' };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRIAL_DURATION_DAYS * MS_PER_DAY);

  const { error: eventErr } = await admin
    .from('events')
    .update({
      concierge_status: 'trial' satisfies ConciergeStatus,
      concierge_tier: 'complete',
      concierge_activated_at: now.toISOString(),
      concierge_expires_at: expiresAt.toISOString(),
      // Dual-scope lock (2026-05-20) — stamp the per-event trial slot so
      // no other moderator on this event can fire their own per-account
      // trial against it.
      concierge_trial_used_at: now.toISOString(),
      concierge_trial_started_by_user_id: userId,
    })
    .eq('event_id', eventId);
  if (eventErr) throw new Error(eventErr.message);

  const { error: userErr } = await admin
    .from('users')
    .update({ concierge_trial_used_at: now.toISOString() })
    .eq('user_id', userId);
  if (userErr) throw new Error(userErr.message);

  void emitNotification({
    userId,
    type: 'chat_message',
    title: 'Setnayan Concierge — trial started',
    body: `You have 3 days of Setnayan Concierge. Trial ends ${expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
    relatedUrl: `/dashboard/${eventId}`,
  });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath('/dashboard/profile/concierge', 'layout');
  return { status: 'started' };
}

/**
 * Recompute `concierge_expires_at` from the current wedding_date.
 * EXTEND-ONLY — never shrinks an existing expiry (couples keep the runway
 * they paid for even if they move the wedding earlier). Fires the
 * long-engagement advisory the first time `wedding_date > activated + 24mo`.
 *
 * Idempotent; safe to call on every wedding-date update.
 */
export async function recomputeConciergeExpiry(input: {
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
      title: 'Setnayan Concierge — long-engagement advisory',
      body: `Your wedding is more than 24 months away. Setnayan Concierge covers up to 24 months from your purchase date — you'll lose access ~${monthsBetween(newExpires, weddingDate!)} months before your wedding day. We recommend renewing closer to your wedding for full coverage.`,
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

/**
 * FormData wrapper for the Settings → Concierge trial button.
 */
export async function startConciergeTrialFromForm(formData: FormData): Promise<void> {
  const rawEventId = formData.get('event_id');
  if (typeof rawEventId !== 'string') {
    redirect('/dashboard/profile/concierge?error=missing_event');
  }
  const result = await startConciergeTrial({ eventId: rawEventId });
  redirect(
    `/dashboard/profile/concierge?event=${encodeURIComponent(rawEventId)}&trial=${result.status}`,
  );
}

function monthsBetween(later: Date, earlier: Date): number {
  return Math.max(
    0,
    Math.round((later.getTime() - earlier.getTime()) / (30 * 86_400_000)),
  );
}
