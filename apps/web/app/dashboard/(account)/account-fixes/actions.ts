'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { coerceFixValue, lookupFixField } from '@/lib/account-fix';

// Admin account-access model — Phase 2 CORE (consent-to-fix), COUPLE SIDE.
// Admin_Account_Access_Model_2026-06-22.md §1 (tier 2), §3, §8 (the approval
// row IS the RA 10173 lawful-basis record), §9 (trust promise).
//
// These are the only two actions that turn a 'pending' account_fix_requests row
// into a real change. The admin can only PROPOSE (app/admin/users/actions.ts →
// requestAccountFix); the change lands here, and ONLY when the couple approves.
//
// The actual field write uses the COUPLE'S OWN RLS-gated client (createClient,
// the approving user's session) — so the write is still fenced by the couple's
// normal row-level security on users (user_owns_row) / events
// (couple_can_update_event). The service-role client is used ONLY to flip the
// fix row's status (the couple's UPDATE policy admits that too, but we keep the
// status flip on the admin client so a partial RLS denial can't leave the field
// changed but the row stuck 'pending').

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, userId: user.id };
}

/**
 * Approve a pending fix → APPLY the change, then mark the row 'applied'.
 *
 * Flow:
 *   1. Read the fix via the couple's OWN client (RLS only returns rows the
 *      couple may see — their own, or event-scoped to an event they're a couple
 *      member of). A missing/non-pending row is rejected.
 *   2. Re-validate the field against the allowlist + re-coerce the value (never
 *      trust the stored row blindly).
 *   3. Write the single column via the couple's own client (RLS-fenced).
 *   4. Flip the row to 'applied' + stamp consent_at via the service-role client.
 */
export async function applyAccountFix(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const fixId = formData.get('fix_id');
  if (typeof fixId !== 'string' || fixId.length === 0) {
    throw new Error('Missing fix request.');
  }

  // RLS-gated read: the couple can only ever see their own fix rows.
  const { data: fix, error: readErr } = await supabase
    .from('account_fix_requests')
    .select(
      'id, target_user_id, event_id, target_table, field_key, proposed_value, status',
    )
    .eq('id', fixId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!fix) {
    redirect('/dashboard/account-fixes?error=Request+not+found+or+no+longer+available');
  }
  if (fix.status !== 'pending') {
    redirect(`/dashboard/account-fixes?error=This+request+is+already+${encodeURIComponent(fix.status)}`);
  }

  const field = lookupFixField(fix.target_table, fix.field_key);
  if (!field) {
    redirect('/dashboard/account-fixes?error=This+field+is+no+longer+editable');
  }
  // Re-coerce/validate the stored proposed value (defence in depth — the value
  // was validated at propose time, but the allowlist/coercion is the contract).
  const value = coerceFixValue(field, fix.proposed_value);

  // Apply the change through the couple's OWN client (RLS-fenced).
  if (field.scope === 'event') {
    if (!fix.event_id) {
      redirect('/dashboard/account-fixes?error=Missing+event+for+this+request');
    }
    const { error: writeErr } = await supabase
      .from('events')
      .update({ [field.column]: value, updated_at: new Date().toISOString() })
      .eq('event_id', fix.event_id);
    if (writeErr) throw new Error(`Could not apply the change: ${writeErr.message}`);
  } else {
    // user-scoped: write our own users row.
    const { error: writeErr } = await supabase
      .from('users')
      .update({ [field.column]: value, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (writeErr) throw new Error(`Could not apply the change: ${writeErr.message}`);
  }

  // Flip the fix row to 'applied' + record consent. Service-role to guarantee
  // the status flip lands even if the row's couple-UPDATE policy is ever
  // narrowed. The .eq('status','pending') keeps it idempotent against a double
  // submit.
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error: statusErr } = await admin
    .from('account_fix_requests')
    .update({ status: 'applied', consent_at: now, resolved_at: now })
    .eq('id', fixId)
    .eq('status', 'pending');
  if (statusErr) {
    console.error('[applyAccountFix] status flip failed', statusErr.message);
  }

  // Audit the user's CONSENT + apply as a first-class admin_audit_log row — the
  // approval is the RA 10173 lawful-basis record (§8). actor is the user here.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'account_fix_applied',
    target_table: 'account_fix_requests',
    target_id: fixId,
    actor_user_id: userId,
    reason: 'user_consent',
    metadata: {
      target_user_id: fix.target_user_id,
      field_table: field.table,
      field_key: field.key,
      event_id: fix.event_id,
      applied_value: value,
    },
  });
  if (auditErr) {
    console.error('[applyAccountFix] audit log insert failed', auditErr.message);
  }

  revalidatePath('/dashboard/account-fixes');
  redirect('/dashboard/account-fixes?applied=1');
}

/**
 * Decline a pending fix → nothing changes; the row goes terminal 'declined'.
 */
export async function declineAccountFix(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const fixId = formData.get('fix_id');
  if (typeof fixId !== 'string' || fixId.length === 0) {
    throw new Error('Missing fix request.');
  }

  // RLS-gated read confirms the couple owns this row before we touch it.
  const { data: fix, error: readErr } = await supabase
    .from('account_fix_requests')
    .select('id, target_user_id, target_table, field_key, status')
    .eq('id', fixId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!fix) {
    redirect('/dashboard/account-fixes?error=Request+not+found+or+no+longer+available');
  }
  if (fix.status !== 'pending') {
    redirect(`/dashboard/account-fixes?error=This+request+is+already+${encodeURIComponent(fix.status)}`);
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error: statusErr } = await admin
    .from('account_fix_requests')
    .update({ status: 'declined', resolved_at: now })
    .eq('id', fixId)
    .eq('status', 'pending');
  if (statusErr) throw new Error(`Could not decline: ${statusErr.message}`);

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'account_fix_declined',
    target_table: 'account_fix_requests',
    target_id: fixId,
    actor_user_id: userId,
    reason: 'user_declined',
    metadata: {
      target_user_id: fix.target_user_id,
      field_table: fix.target_table,
      field_key: fix.field_key,
    },
  });
  if (auditErr) {
    console.error('[declineAccountFix] audit log insert failed', auditErr.message);
  }

  revalidatePath('/dashboard/account-fixes');
  redirect('/dashboard/account-fixes?declined=1');
}
