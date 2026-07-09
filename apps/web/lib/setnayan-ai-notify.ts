import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { renderBrandedEmail } from '@/lib/email-template';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  resolveSetnayanAiPaywallEnabled,
  resolveSetnayanAiPerUserEnabled,
  resolveSetnayanAiPerEventPricingEnabled,
} from '@/lib/integration-config';
import { getEventHostAiSubscription } from '@/lib/setnayan-ai-server';
import { isSetnayanAiActiveForUser } from '@/lib/setnayan-ai';
import { buildPlanningSnapshot } from '@/lib/setnayan-ai-snapshot';
import { runTriggers } from '@/lib/setnayan-ai-triggers';
import { resolveProfile } from '@/lib/event-type-profile';
import { WEDDING_TERMINOLOGY } from '@/lib/setnayan-ai-templates';
import {
  planGuardNotifications,
  planPaymentDueReminder,
  GUARD_NOTIFY_COOLDOWN_DAYS,
  GUARD_SWEEP_MIN_INTERVAL_HOURS,
  GUARD_SWEEP_THROTTLE_KEY,
} from '@/lib/setnayan-ai-guard-plan';

/**
 * setnayan-ai-notify.ts — the DELIVERY layer that makes the guards notify
 * (Setnayan_AI_Realtime_Notifications_2026-07-02 spec; owner-greenlit
 * 2026-07-09). Before this, the trigger engine's only consumer was the
 * pull-only account digest — it could never tap a shoulder.
 *
 * INVOCATION (cron-free — the house lazy-sweep pattern, same as
 * sweepExpiredConcierge / runLoginGhostingCheck): `sweepGuardNotifications` is
 * fired post-response via Next's after() from the event dashboard layout on
 * every event-scoped page render. The '__sweep__' throttle row in
 * setnayan_ai_guard_log bounds real work to once per event per
 * GUARD_SWEEP_MIN_INTERVAL_HOURS; every other render exits after ONE cheap
 * query. Time-based coverage between visits comes from the spec's Resend
 * `scheduledAt` sends (the GRD-01 day-before email), stamped when the sweep
 * first sees the payment window — no cron anywhere.
 *
 * GATING: guard notifications go ONLY to events where Setnayan AI is active —
 * the Overview's exact resolution (isSetnayanAiActiveForUser with the DB-first
 * paywall + per-user flags + host-subscription fan-out), PLUS the per-event
 * pricing flag threaded in (this path resolves it properly — see the
 * 2026-07-09 eventOwnsSetnayanAi fix). No AI → no guard notifications, ever.
 *
 * Everything is fail-soft: this runs behind after() on the couple's own page
 * loads, so no error may ever surface — swallowed + logged via logQueryError.
 */

type GuardLogRow = { dedupe_key: string };

/**
 * Claim the per-event sweep slot. Returns true when THIS call owns the sweep
 * (first ever, or the previous one is older than the min interval); false when
 * a recent sweep already ran, another concurrent render claimed it, or the
 * guard-log table isn't available yet (pre-migration → quietly do nothing).
 */
async function claimSweepSlot(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  now: Date,
): Promise<boolean> {
  const nowIso = now.toISOString();
  const { data: inserted, error: insertError } = await admin
    .from('setnayan_ai_guard_log')
    .upsert(
      {
        event_id: eventId,
        dedupe_key: GUARD_SWEEP_THROTTLE_KEY,
        template_id: GUARD_SWEEP_THROTTLE_KEY,
        notified_at: nowIso,
      },
      { onConflict: 'event_id,dedupe_key', ignoreDuplicates: true },
    )
    .select('id');
  if (insertError) {
    // Table absent (code-before-SQL deploy window) or transient failure —
    // never notify without the dedup ledger; that would risk repeats.
    logQueryError('sweepGuardNotifications (claim)', insertError, { event_id: eventId }, 'graceful_degrade');
    return false;
  }
  if (inserted && inserted.length > 0) return true; // first sweep for this event

  // Row exists → advance it only when stale. The conditional UPDATE is the
  // race guard: of two concurrent renders, only one matches the .lt() filter.
  const staleCutoffIso = new Date(
    now.getTime() - GUARD_SWEEP_MIN_INTERVAL_HOURS * 3_600_000,
  ).toISOString();
  const { data: updated, error: updateError } = await admin
    .from('setnayan_ai_guard_log')
    .update({ notified_at: nowIso })
    .eq('event_id', eventId)
    .eq('dedupe_key', GUARD_SWEEP_THROTTLE_KEY)
    .lt('notified_at', staleCutoffIso)
    .select('id');
  if (updateError) {
    logQueryError('sweepGuardNotifications (throttle)', updateError, { event_id: eventId }, 'graceful_degrade');
    return false;
  }
  return Boolean(updated && updated.length > 0);
}

/**
 * The guard-notification sweep for one event. Fire-and-forget from the event
 * dashboard layout: `after(() => sweepGuardNotifications(eventId))`.
 */
export async function sweepGuardNotifications(eventId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date();

    // 1. Throttle FIRST — the common case (recent sweep exists) costs 2 cheap
    //    indexed queries and no flag resolution.
    if (!(await claimSweepSlot(admin, eventId, now))) return;

    // 2. The entitlement gate — the Overview's exact resolution, with the
    //    per-event pricing flag properly threaded (paid feature boundary:
    //    proactive outreach is for entitled events only).
    const { data: eventRow } = await admin
      .from('events')
      .select('planning_mode, setnayan_ai_active, setnayan_ai_active_until, event_type')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!eventRow) return;

    const [paywallEnabled, perUserEnabled, perEventPricingEnabled] = await Promise.all([
      resolveSetnayanAiPaywallEnabled(),
      resolveSetnayanAiPerUserEnabled(),
      resolveSetnayanAiPerEventPricingEnabled(),
    ]);
    const subscription = perUserEnabled
      ? await getEventHostAiSubscription(admin, eventId)
      : null;
    const aiActive = isSetnayanAiActiveForUser(
      eventRow as {
        planning_mode?: string | null;
        setnayan_ai_active?: boolean | null;
        setnayan_ai_active_until?: string | null;
      },
      { paywallEnabled, perUserEnabled, perEventPricingEnabled, subscription, now },
    );
    if (!aiActive) return; // No AI → no guard notifications. The locked boundary.

    // 3. Snapshot → triggers → restraint (with the persisted cooldown state).
    const eventType = (eventRow as { event_type?: string | null }).event_type ?? 'wedding';
    const cooldownCutoffIso = new Date(
      now.getTime() - GUARD_NOTIFY_COOLDOWN_DAYS * 86_400_000,
    ).toISOString();
    const [snapshot, { data: cooldownRows }] = await Promise.all([
      buildPlanningSnapshot(admin, eventId, eventType),
      admin
        .from('setnayan_ai_guard_log')
        .select('dedupe_key')
        .eq('event_id', eventId)
        .gt('notified_at', cooldownCutoffIso),
    ]);
    const cooldown = new Set(((cooldownRows ?? []) as GuardLogRow[]).map((r) => r.dedupe_key));

    const interventions = runTriggers(snapshot, now);

    // Terminology from the event-type profile (fail-soft → wedding wording).
    let terminology: Parameters<typeof planGuardNotifications>[1]['terminology'] =
      WEDDING_TERMINOLOGY;
    try {
      const profile = await resolveProfile(eventType);
      terminology = {
        organizerNoun: profile.terminology.organizerNoun,
        eventWord: profile.terminology.eventWord,
      };
    } catch {
      // profile read unavailable outside a React render context → wedding default
    }

    const plan = planGuardNotifications(interventions, { eventId, cooldown, terminology });
    if (plan.length === 0) return;

    // 4. Recipients — the event's hosts/co-hosts. Notifications are per-user
    //    rows; every host hears about the same guard together.
    const { data: memberRows } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple');
    const hostIds = ((memberRows ?? []) as { user_id: string | null }[])
      .map((m) => m.user_id)
      .filter((id): id is string => Boolean(id));
    if (hostIds.length === 0) return;

    for (const n of plan) {
      // Stamp the dedupe key BEFORE emitting (the shipped chat-webhook pattern:
      // concurrent firings hit the guard, a crash mid-emit costs a missed
      // notification — never a duplicate).
      const { error: stampError } = await admin.from('setnayan_ai_guard_log').upsert(
        {
          event_id: eventId,
          dedupe_key: n.dedupeKey,
          template_id: n.templateId,
          notified_at: now.toISOString(),
        },
        { onConflict: 'event_id,dedupe_key' },
      );
      if (stampError) {
        logQueryError(
          'sweepGuardNotifications (stamp)',
          stampError,
          { event_id: eventId, dedupe_key: n.dedupeKey },
          'graceful_degrade',
        );
        continue; // no ledger row → don't emit (repeat-risk beats missed-once)
      }
      // emitNotification handles the in-app row + the email/push allowlists
      // ('ai_payment_due' emails; 'ai_guard_alert' stays in-app) and is itself
      // fail-soft per recipient.
      await Promise.all(
        hostIds.map((userId) =>
          emitNotification({
            userId,
            type: n.type,
            title: n.title,
            body: n.body,
            relatedUrl: n.relatedUrl,
          }),
        ),
      );
    }

    // 5. GRD-01 scheduled day-before emails (Resend `scheduledAt` — the spec's
    //    cron-free answer for time-based coverage between app visits). Claimed
    //    via a '<dedupeKey>#d1' guard-log row so each due date schedules ONCE.
    if (await isEmailConfigured()) {
      const emittedKeys = new Set(plan.map((n) => n.dedupeKey));
      const grd01 = interventions.filter(
        (iv) => iv.templateId === 'GRD-01' && emittedKeys.has(iv.dedupeKey),
      );
      if (grd01.length > 0) {
        const { data: hostRows } = await admin
          .from('users')
          .select('email')
          .in('user_id', hostIds);
        const emails = ((hostRows ?? []) as { email: string | null }[])
          .map((r) => r.email)
          .filter((e): e is string => Boolean(e) && !isPlaceholderEmail(e as string));
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
        for (const iv of grd01) {
          const reminder = planPaymentDueReminder(iv, now);
          if (!reminder || emails.length === 0) continue;
          const { data: claimed, error: claimError } = await admin
            .from('setnayan_ai_guard_log')
            .upsert(
              {
                event_id: eventId,
                dedupe_key: reminder.dedupeKey,
                template_id: 'GRD-01',
                notified_at: now.toISOString(),
              },
              { onConflict: 'event_id,dedupe_key', ignoreDuplicates: true },
            )
            .select('id');
          if (claimError || !claimed || claimed.length === 0) continue; // already scheduled
          const link = `${appUrl}/dashboard/${eventId}/budget`;
          const html = renderBrandedEmail({
            heading: reminder.subject,
            paragraphs: reminder.bodyText.split('\n').filter(Boolean),
            ctaLabel: 'Open your budget',
            ctaHref: link,
            footnote:
              "You're receiving this because Setnayan AI watches payment deadlines on your event.",
          });
          await Promise.all(
            emails.map((to) =>
              sendEmail({
                to,
                subject: reminder.subject,
                text: `${reminder.bodyText}\n\nOpen your budget: ${link}\n\n—\nYou're receiving this because Setnayan AI watches payment deadlines on your event.\nManage notifications: ${appUrl}/dashboard/profile`,
                html,
                scheduledAt: reminder.scheduledAtIso,
              }),
            ),
          );
        }
      }
    }
  } catch (e) {
    // after()-hosted: never let the sweep surface an error to any render path.
    console.error('[setnayan-ai] guard sweep failed:', e);
  }
}
