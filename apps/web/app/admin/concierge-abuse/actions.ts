'use server';

/**
 * Admin actions for the Concierge Abuse review queue (iteration 0023 § 3.11).
 *
 * Single-admin authority per 0023 § 4.3 — these decisions are reversible
 * (admin can lift enforcement via the appeal flow), so no two-admin gate.
 *
 * Strike-counter ladder (auto-bump on confirm):
 *   strike 1 → 'warning'
 *   strike 2 → 'trial_banned'
 *   strike 3+ → 'full_banned'
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enforcementLevelForStrikes } from '@/lib/concierge';
import { emitNotification } from '@/lib/notification-emit';

async function requireAdmin(): Promise<{ adminUserId: string }> {
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
  return { adminUserId: user.id };
}

function trimmed(raw: FormDataEntryValue | null, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, max);
}

/**
 * Clear a flag as a false positive. No strike incremented.
 * Requires admin_notes ≥ 10 chars (0023 § 3.11.3).
 */
export async function adminClearConciergeFlag(formData: FormData): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const flagId = trimmed(formData.get('flag_id'), 64);
  const notes = trimmed(formData.get('admin_notes'), 4000);
  if (!flagId) throw new Error('Missing flag_id');
  if (notes.length < 10) {
    redirect(
      `/admin/concierge-abuse?error=${encodeURIComponent('Notes required (≥10 chars) for a false-positive clear.')}`,
    );
  }

  const admin = createAdminClient();
  const { data: flagRow } = await admin
    .from('concierge_abuse_flags')
    .select('flag_id, flagged_user_id, status')
    .eq('flag_id', flagId)
    .maybeSingle();
  if (!flagRow) throw new Error('Flag not found');
  if ((flagRow as { status: string }).status !== 'pending_review') {
    redirect(
      `/admin/concierge-abuse?error=${encodeURIComponent('Flag already decided.')}`,
    );
  }

  const { error } = await admin
    .from('concierge_abuse_flags')
    .update({
      status: 'cleared',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      admin_notes: notes,
    })
    .eq('flag_id', flagId);
  if (error) throw new Error(error.message);

  void emitNotification({
    userId: (flagRow as { flagged_user_id: string }).flagged_user_id,
    type: 'chat_message',
    title: 'Setnayan Concierge — flag cleared',
    body: 'Your account was flagged for review and cleared. Your 3-day Setnayan Concierge trial is available.',
    relatedUrl: '/dashboard/profile/concierge',
  });

  revalidatePath('/admin/concierge-abuse');
  redirect('/admin/concierge-abuse?cleared=1');
}

/**
 * Confirm abuse — increments strike count + auto-bumps enforcement level.
 * Auto-clears all other pending flags for the same flagged_user_id
 * (single-flag-per-strike per 0023 § 3.11.3) so a bulk-flag burst doesn't
 * double-count.
 *
 * Requires admin_notes ≥ 20 chars.
 */
export async function adminConfirmConciergeAbuse(formData: FormData): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const flagId = trimmed(formData.get('flag_id'), 64);
  const notes = trimmed(formData.get('admin_notes'), 4000);
  if (!flagId) throw new Error('Missing flag_id');
  if (notes.length < 20) {
    redirect(
      `/admin/concierge-abuse?error=${encodeURIComponent('Notes required (≥20 chars) to confirm abuse.')}`,
    );
  }

  const admin = createAdminClient();
  const { data: flagRow } = await admin
    .from('concierge_abuse_flags')
    .select('flag_id, flagged_user_id, status')
    .eq('flag_id', flagId)
    .maybeSingle();
  if (!flagRow) throw new Error('Flag not found');
  if ((flagRow as { status: string }).status !== 'pending_review') {
    redirect(
      `/admin/concierge-abuse?error=${encodeURIComponent('Flag already decided.')}`,
    );
  }

  const flaggedUserId = (flagRow as { flagged_user_id: string }).flagged_user_id;

  // Stamp the flag.
  const { error: flagErr } = await admin
    .from('concierge_abuse_flags')
    .update({
      status: 'confirmed_abuse',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      admin_notes: notes,
    })
    .eq('flag_id', flagId);
  if (flagErr) throw new Error(flagErr.message);

  // Auto-clear sibling pending flags (single-flag-per-strike).
  await admin
    .from('concierge_abuse_flags')
    .update({
      status: 'cleared',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      admin_notes:
        'Auto-cleared because a sibling flag for this user was confirmed (single-flag-per-strike rule per 0023 § 3.11.3).',
    })
    .eq('flagged_user_id', flaggedUserId)
    .eq('status', 'pending_review')
    .neq('flag_id', flagId);

  // Bump strike count + enforcement level. Read current count, increment,
  // recompute level — RLS bypassed via admin client.
  const { data: userRow } = await admin
    .from('users')
    .select('concierge_abuse_strike_count')
    .eq('user_id', flaggedUserId)
    .maybeSingle();
  const currentStrikes = (userRow as { concierge_abuse_strike_count?: number } | null)
    ?.concierge_abuse_strike_count ?? 0;
  const newStrikes = currentStrikes + 1;
  const newLevel = enforcementLevelForStrikes(newStrikes);

  const { error: userErr } = await admin
    .from('users')
    .update({
      concierge_abuse_strike_count: newStrikes,
      concierge_enforcement_level: newLevel,
      concierge_enforcement_at: new Date().toISOString(),
      concierge_enforcement_by: adminUserId,
      concierge_enforcement_reason: notes,
    })
    .eq('user_id', flaggedUserId);
  if (userErr) throw new Error(userErr.message);

  void emitNotification({
    userId: flaggedUserId,
    type: 'chat_message',
    title: `Setnayan Concierge — account flagged (${newLevel})`,
    body:
      newLevel === 'warning'
        ? 'Your account was flagged once for review and cleared with a warning. Your 3-day trial remains available; further flags may limit access.'
        : newLevel === 'trial_banned'
          ? 'The 3-day Setnayan Concierge trial is no longer available on this account. You can still purchase Setnayan Concierge anytime. Open the help center to appeal.'
          : 'Setnayan Concierge has been disabled on this account. Contact support if you believe this is in error.',
    relatedUrl: '/help#concierge',
  });

  revalidatePath('/admin/concierge-abuse');
  redirect(`/admin/concierge-abuse?confirmed=${encodeURIComponent(newLevel)}`);
}

/**
 * Appeal-driven enforcement reversal (0023 § 3.11.4). Decrements strike count
 * + recomputes enforcement level. Historical confirmed_abuse rows are NOT
 * deleted — audit trail preserved.
 */
export async function adminLiftConciergeEnforcement(formData: FormData): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const userId = trimmed(formData.get('user_id'), 64);
  const notes = trimmed(formData.get('admin_notes'), 4000);
  if (!userId) throw new Error('Missing user_id');
  if (notes.length < 10) {
    redirect(
      `/admin/concierge-abuse?tab=enforcement&error=${encodeURIComponent('Notes required (≥10 chars) for enforcement reversal.')}`,
    );
  }

  const admin = createAdminClient();
  const { data: userRow } = await admin
    .from('users')
    .select('concierge_abuse_strike_count')
    .eq('user_id', userId)
    .maybeSingle();
  const currentStrikes = (userRow as { concierge_abuse_strike_count?: number } | null)
    ?.concierge_abuse_strike_count ?? 0;
  const newStrikes = Math.max(0, currentStrikes - 1);
  const newLevel = enforcementLevelForStrikes(newStrikes);

  const { error } = await admin
    .from('users')
    .update({
      concierge_abuse_strike_count: newStrikes,
      concierge_enforcement_level: newLevel,
      concierge_enforcement_at: new Date().toISOString(),
      concierge_enforcement_by: adminUserId,
      concierge_enforcement_reason: `Appeal lift: ${notes}`,
    })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  void emitNotification({
    userId,
    type: 'chat_message',
    title: 'Setnayan Concierge — access restored',
    body: `Your appeal was reviewed and your Setnayan Concierge access has been restored. Reason: ${notes}`,
    relatedUrl: '/dashboard/profile/concierge',
  });

  revalidatePath('/admin/concierge-abuse');
  redirect(`/admin/concierge-abuse?tab=enforcement&lifted=${encodeURIComponent(newLevel)}`);
}
