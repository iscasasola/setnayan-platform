'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';

async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { userId: user.id };
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * § 3.9 action — admin override-publishes a blocked review. The trigger
 * bypass GUC is set inside a single transaction so the `block_related_
 * account_review` trigger skips checks 1–4. Owner-self (check 0) is never
 * bypassable — that's the only signal where override-publish is refused
 * by the trigger itself.
 *
 * Records `override_admin_id` + `override_reason` on the inserted
 * vendor_reviews row, then closes the appeal with decision='override_
 * published'. Single-admin authority per § 3.9 + § 9.1.
 */
export async function overridePublishReview(formData: FormData) {
  const { userId } = await requireAdmin();

  const appealId = formData.get('appeal_id');
  const reasonRaw = formData.get('reason');
  if (typeof appealId !== 'string') {
    throw new Error('Invalid appeal_id');
  }
  const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';
  if (reason.length === 0 || reason.length > 4000) {
    throw new Error('Override reason is required (1–4000 chars).');
  }

  const admin = createAdminClient();

  // Pull the appeal row with the original payload + identifying joins.
  const { data: appeal, error: appealErr } = await admin
    .from('vendor_review_appeals')
    .select(
      'appeal_id, vendor_profile_id, reviewer_user_id, event_id, event_vendor_id, matched_signal, review_payload, decided_at',
    )
    .eq('appeal_id', appealId)
    .maybeSingle();
  if (appealErr) throw new Error(appealErr.message);
  if (!appeal) throw new Error('Appeal not found.');
  if (appeal.decided_at) throw new Error('Appeal already decided.');
  if (appeal.matched_signal === 'owner_self' || appeal.matched_signal === 'team_member') {
    // The trigger refuses these even with bypass — short-circuit so the
    // admin sees a clear error instead of a DB exception.
    throw new Error(
      'Override-publish is not allowed for owner_self or team_member signals.',
    );
  }

  // Carry the would-be ratings forward from the appeal payload — fall back
  // to defaults for any axis the reviewer didn't fill out, since the
  // vendor_reviews schema requires all 5.
  const payload = (appeal.review_payload as Record<string, unknown>) ?? {};
  const ratingOverall = Number(payload['rating_overall']);
  if (!Number.isInteger(ratingOverall) || ratingOverall < 1 || ratingOverall > 5) {
    throw new Error(
      'Appeal payload is missing rating_overall — admin cannot override without a rating.',
    );
  }
  const ratingFor = (key: string): number => {
    const v = payload[key];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5) return v;
    return ratingOverall;
  };
  const body =
    typeof payload['body'] === 'string'
      ? (payload['body'] as string).slice(0, 4000)
      : null;

  // The bypass GUC is set inside a single transaction; supabase-js routes
  // every statement through PostgREST so we use the rpc-shaped helper that
  // wraps a SET LOCAL + INSERT + appeal close in one call.
  const { data: insertedReviewId, error: rpcErr } = await admin.rpc(
    'admin_override_publish_review',
    {
      p_appeal_id: appealId,
      p_admin_id: userId,
      p_reason: reason,
      p_rating_overall: ratingOverall,
      p_rating_communication: ratingFor('rating_communication'),
      p_rating_quality: ratingFor('rating_quality'),
      p_rating_value: ratingFor('rating_value'),
      p_rating_on_time: ratingFor('rating_on_time'),
      p_body: body,
    },
  );

  if (rpcErr) {
    // The RPC is intentionally a thin wrapper — if it's not yet installed
    // in the DB, surface a clear message so the owner can run the migration.
    throw new Error(`Override-publish failed: ${rpcErr.message}`);
  }
  if (!insertedReviewId) {
    throw new Error('Override-publish produced no review_id — check DB function.');
  }

  revalidatePath('/admin/reviews');
  redirect('/admin/reviews?override=1');
}

export async function rejectAppeal(formData: FormData) {
  const { userId } = await requireAdmin();
  const appealId = formData.get('appeal_id');
  const reason = nullIfBlank(formData.get('reason'));
  if (typeof appealId !== 'string') throw new Error('Invalid appeal_id');
  if (!reason) throw new Error('Rejection reason is required.');

  const admin = createAdminClient();

  // Read the appeal first so we can capture before-state for the audit row
  // and look up the reviewer's email for the brand-voice notification.
  const { data: appeal } = await admin
    .from('vendor_review_appeals')
    .select('appeal_id, reviewer_user_id, vendor_profile_id, matched_signal, decision, decided_at')
    .eq('appeal_id', appealId)
    .maybeSingle();

  const { error } = await admin
    .from('vendor_review_appeals')
    .update({
      decided_at: new Date().toISOString(),
      decided_by_admin: userId,
      decision: 'rejected',
      decision_reason: reason,
    })
    .eq('appeal_id', appealId);
  if (error) throw new Error(error.message);

  // Per CLAUDE.md 2026-05-12 § 9.1 admin discipline + System_Wiring_Map_2026-05-28
  // RED #3. Every admin mutation logs to admin_audit_log so the owner can
  // reconstruct who-did-what during pilot. Best-effort: audit failure logs to
  // console but does NOT roll back the appeal close.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'review_appeal_reject',
    target_id: appealId,
    actor_user_id: userId,
    metadata: {
      appeal_id: appealId,
      reviewer_user_id: appeal?.reviewer_user_id ?? null,
      vendor_profile_id: appeal?.vendor_profile_id ?? null,
      matched_signal: appeal?.matched_signal ?? null,
      before_decision: appeal?.decision ?? null,
      after_decision: 'rejected',
      decision_reason: reason.slice(0, 500),
    },
  });
  if (auditErr) {
    console.error('[rejectAppeal] audit log insert failed', auditErr.message);
  }

  // Notify the reviewer (the party who filed the appeal) of the decision.
  // The original review never went live (it was blocked by the related-account
  // trigger before this appeal was filed), so the copy says "will not be
  // published" — not "stays published" — to match reality. Best-effort: a
  // failed send logs to console and does not throw.
  if (appeal?.reviewer_user_id) {
    const { data: reviewer } = await admin
      .from('users')
      .select('email, display_name')
      .eq('user_id', appeal.reviewer_user_id)
      .maybeSingle();
    if (reviewer?.email) {
      const greeting = reviewer.display_name
        ? `Hi ${reviewer.display_name},`
        : 'Hi,';
      const sendResult = await sendEmail({
        to: reviewer.email,
        subject: 'Your Setnayan review appeal was reviewed',
        text: [
          greeting,
          '',
          "Your review appeal was reviewed. The original review will not be published.",
          '',
          "Reach out to support if you'd like to discuss.",
          '',
          '—',
          "Set na 'yan.",
        ].join('\n'),
      });
      if (!sendResult.ok) {
        console.error('[rejectAppeal] reviewer notification failed', sendResult);
      }
    }
  }

  revalidatePath('/admin/reviews');
  redirect('/admin/reviews?rejected=1');
}

export async function escalateAppeal(formData: FormData) {
  const { userId } = await requireAdmin();
  const appealId = formData.get('appeal_id');
  const reason = nullIfBlank(formData.get('reason'));
  if (typeof appealId !== 'string') throw new Error('Invalid appeal_id');
  if (!reason) throw new Error('Escalation reason is required.');

  const admin = createAdminClient();

  // Read the appeal first so the audit row captures before-state. Escalate
  // is an internal admin-to-admin action — no customer notification (V1.x
  // adds escalated-appeal reviewer notification once the escalation surface
  // ships its own SLA copy).
  const { data: appeal } = await admin
    .from('vendor_review_appeals')
    .select('appeal_id, reviewer_user_id, vendor_profile_id, matched_signal, decision')
    .eq('appeal_id', appealId)
    .maybeSingle();

  const { error } = await admin
    .from('vendor_review_appeals')
    .update({
      decided_at: new Date().toISOString(),
      decided_by_admin: userId,
      decision: 'escalated',
      decision_reason: reason,
    })
    .eq('appeal_id', appealId);
  if (error) throw new Error(error.message);

  // Per CLAUDE.md 2026-05-12 § 9.1 admin discipline + System_Wiring_Map_2026-05-28
  // RED #3. Every admin mutation logs to admin_audit_log so the owner can
  // reconstruct who-did-what during pilot. Best-effort: audit failure logs to
  // console but does NOT roll back the escalation flag.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'review_appeal_escalate',
    target_id: appealId,
    actor_user_id: userId,
    metadata: {
      appeal_id: appealId,
      reviewer_user_id: appeal?.reviewer_user_id ?? null,
      vendor_profile_id: appeal?.vendor_profile_id ?? null,
      matched_signal: appeal?.matched_signal ?? null,
      before_decision: appeal?.decision ?? null,
      after_decision: 'escalated',
      decision_reason: reason.slice(0, 500),
    },
  });
  if (auditErr) {
    console.error('[escalateAppeal] audit log insert failed', auditErr.message);
  }

  revalidatePath('/admin/reviews');
  redirect('/admin/reviews?escalated=1');
}
