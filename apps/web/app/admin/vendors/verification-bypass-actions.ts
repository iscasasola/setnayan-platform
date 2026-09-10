'use server';

/**
 * verification-bypass-actions.ts — vouch for a supplier, with the paperwork owed.
 *
 * ── WHY (owner, 2026-09-07) ─────────────────────────────────────────────────
 * Real verification is four documents, a two-channel VALIDATE token and a
 * 15-minute Meet. Measured that day: `vendor_verifications` held **zero rows** —
 * nobody had ever finished it — and the marketplace had never carried a single
 * inquiry as a result. An admin may now vouch for a supplier they know.
 *
 * ⚠ Two owner rulings this file implements without softening:
 *   • **Same badge** — a couple sees no difference. Nothing here writes a
 *     public-facing marker of any kind.
 *   • **No cap** — there is deliberately no ceiling on concurrent bypasses.
 *
 * 🔑 So the DEADLINE is the only thing holding the badge honest, and it expires
 * on read rather than on anyone remembering — the cron-free pattern owner-locked
 * 2026-05-14 and already used by Live Studio and Papic sessions.
 *
 * ── THIS IS ALSO THE WRITE PATH `public_visibility` NEVER HAD ───────────────
 * Measured 2026-09-07: three admin surfaces READ `public_visibility` and not one
 * could write it — `/admin/vendors/[id]/edit` literally selects the column and
 * its save action omits it. A shop that reached `verified` + `hidden` had no
 * exit through the product; the platform's only published shop needed a
 * hand-written SQL UPDATE to move. A grant here is that missing write, with a
 * reason and an audit row attached, which a bare toggle would not have.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { bypassExpiryFrom, mustWithdraw } from '@/lib/verification-bypass';
import { verificationEvidenceSnapshot } from '@/lib/verification-checks-server';

/**
 * The same gate every other admin vendor action uses, copied rather than
 * imported because `app/admin/vendors/actions.ts` declares it locally too.
 * Reads through the CALLER's client so the admin check is made against their
 * own session, never the service role.
 */
async function requireAdmin() {
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

function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Vouch for a shop: list it now, documents due in six months.
 *
 * Writes `verification_state` AND `public_visibility` together — a shop that is
 * verified but hidden is exactly the dead end this feature exists to close, and
 * setting one without the other would recreate it.
 */
export async function grantVerificationBypass(formData: FormData): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const vendorId = str(formData, 'vendor_profile_id');
  const reason = str(formData, 'reason');
  if (!vendorId) throw new Error('Missing vendor_profile_id.');
  // A bypass with no stated reason is indistinguishable from a mistake six
  // months later, when whoever granted it is not in the room.
  if (reason.length < 8) {
    throw new Error('Say why you are vouching for this shop — at least a sentence.');
  }

  const admin = createAdminClient();
  const { data: before, error: readErr } = await admin
    .from('vendor_profiles')
    .select('business_name, public_id, verification_state, public_visibility')
    .eq('vendor_profile_id', vendorId)
    .maybeSingle();
  // ⚠ Supabase RESOLVES with `{ error }` — a refused read arrives as data:null
  // and would otherwise read exactly like "vendor not found".
  if (readErr) throw new Error(readErr.message);
  if (!before) throw new Error('Vendor not found.');

  const grantedAt = new Date();
  const expiresAt = bypassExpiryFrom(grantedAt);

  // The listing state lives on the profile; the vouch lives in its own table.
  // Both, or neither — a shop that is verified but hidden is precisely the dead
  // end this feature exists to close.
  const { error } = await admin
    .from('vendor_profiles')
    .update({ verification_state: 'verified', public_visibility: 'verified' })
    .eq('vendor_profile_id', vendorId);
  if (error) throw new Error(error.message);

  const { error: bypassErr } = await admin.from('vendor_verification_bypasses').upsert(
    {
      vendor_profile_id: vendorId,
      granted_at: grantedAt.toISOString(),
      expires_at: expiresAt,
      reason: reason.slice(0, 2000),
      granted_by: adminUserId,
      // A re-grant is a SECOND chance, not a continuation.
      expired_at: null,
      updated_at: grantedAt.toISOString(),
    },
    { onConflict: 'vendor_profile_id' },
  );
  if (bypassErr) throw new Error(bypassErr.message);

  // The SAME evidence snapshot the other two grant doors record. All three ways
  // to hand out this badge now say what the checks found at press time, so a
  // reader six months later cannot tell them apart by accountability — only by
  // which door was used, which is the honest difference.
  const evidence = await verificationEvidenceSnapshot(vendorId);

  await admin.from('admin_audit_log').insert({
    action: 'vendor_verification_bypass_grant',
    target_id: vendorId,
    actor_user_id: adminUserId,
    metadata: {
      business_name: before.business_name,
      public_id: before.public_id,
      from_verification_state: before.verification_state,
      from_public_visibility: before.public_visibility,
      expires_at: expiresAt,
      reason: reason.slice(0, 2000),
      evidence_at_grant: evidence,
    },
  });

  revalidatePath('/admin/accounts');
  revalidatePath('/admin/verify');
  revalidatePath('/explore');
}

/** Withdraw a vouched listing by hand, before its deadline. */
export async function revokeVerificationBypass(formData: FormData): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const vendorId = str(formData, 'vendor_profile_id');
  if (!vendorId) throw new Error('Missing vendor_profile_id.');

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from('vendor_profiles')
    .update({ public_visibility: 'hidden' })
    .eq('vendor_profile_id', vendorId);
  if (error) throw new Error(error.message);
  await admin
    .from('vendor_verification_bypasses')
    .update({ expires_at: null, expired_at: nowIso, updated_at: nowIso })
    .eq('vendor_profile_id', vendorId);

  await admin.from('admin_audit_log').insert({
    action: 'vendor_verification_bypass_revoke',
    target_id: vendorId,
    actor_user_id: adminUserId,
    metadata: { revoked_early: true },
  });
  revalidatePath('/admin/accounts');
  revalidatePath('/explore');
}

/**
 * THE SWEEP — expiry enforced by live traffic, never by a scheduler.
 *
 * Fired from `after()` on admin and marketplace surfaces. Reads only rows whose
 * deadline has already passed (the partial index covers exactly this), then asks
 * `mustWithdraw` — the same pure rule the vendor's own countdown reads, so the
 * screen and the sweep can never disagree.
 *
 * 🔑 A shop whose DOCUMENTS LANDED during the window is never withdrawn, even
 * with a stale deadline on the row: the bypass was a bridge and they crossed it.
 */
export async function sweepExpiredVerificationBypasses(): Promise<number> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from('vendor_verification_bypasses')
    .select('vendor_profile_id, expires_at')
    .not('expires_at', 'is', null)
    .lt('expires_at', nowIso)
    .limit(50);
  if (error || !due?.length) return 0;

  let withdrawn = 0;
  for (const row of due) {
    const { count } = await admin
      .from('vendor_verification_applications')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_profile_id', row.vendor_profile_id)
      .eq('status', 'approved');

    const documentsApproved = (count ?? 0) > 0;
    if (
      !mustWithdraw({
        expiresAt: row.expires_at as string | null,
        documentsApproved,
      })
    ) {
      // Documents landed — clear the deadline rather than withdraw them.
      if (documentsApproved) {
        await admin
          .from('vendor_verification_bypasses')
          .update({ expires_at: null, updated_at: nowIso })
          .eq('vendor_profile_id', row.vendor_profile_id);
      }
      continue;
    }

    await admin
      .from('vendor_profiles')
      .update({ public_visibility: 'hidden' })
      .eq('vendor_profile_id', row.vendor_profile_id);
    await admin
      .from('vendor_verification_bypasses')
      .update({ expires_at: null, expired_at: nowIso, updated_at: nowIso })
      .eq('vendor_profile_id', row.vendor_profile_id);

    await admin.from('admin_audit_log').insert({
      action: 'vendor_verification_bypass_expired',
      target_id: row.vendor_profile_id,
      actor_user_id: null,
      metadata: { deadline: row.expires_at },
    });
    withdrawn += 1;
  }
  return withdrawn;
}
