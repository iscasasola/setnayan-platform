'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_DAYS = 90;
const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

function generateClaimToken(): string {
  // 32 bytes → base64url ≈ 43 chars. Sufficient entropy (>=256 bits) so
  // the token IS the access gate (matches the couple-side invite pattern
  // from lib/vendor-invite-actions.ts).
  return randomBytes(32).toString('base64url');
}

export type AdminInviteResult =
  | { status: 'ok'; inviteId: string; claimUrl: string }
  | { status: 'invalid_email' }
  | { status: 'duplicate_pending' }
  | { status: 'error'; message: string };

/**
 * Create an admin-initiated vendor invite (2026-05-21). The vendor receives
 * the claim URL out-of-band (Messenger, SMS, email) and lands on the
 * existing /vendor/claim/[token] flow when they tap it. On claim, the
 * existing finalize page creates a vendor_profiles row for them with the
 * business_name we stamped here — no event_vendors hook (source='admin').
 *
 * Returns the claim URL so the admin can copy + share it from the UI.
 */
export async function createAdminVendorInvite(
  formData: FormData,
): Promise<AdminInviteResult> {
  const { adminUserId } = await requireAdmin();

  const rawEmail = String(formData.get('email') ?? '').trim();
  const rawBusinessName = String(formData.get('business_name') ?? '').trim();
  const rawServiceCategory = String(formData.get('service_category') ?? '').trim();

  if (!EMAIL_REGEX.test(rawEmail)) {
    return { status: 'invalid_email' };
  }
  if (rawBusinessName.length === 0 || rawBusinessName.length > 128) {
    return { status: 'error', message: 'Business name must be 1–128 characters.' };
  }

  const admin = createAdminClient();

  // The partial unique index on (LOWER(email)) WHERE status='pending' AND
  // source='admin' enforces one-live-admin-invite-per-email at the DB
  // level. Check up-front so we can return a clean error rather than
  // surfacing a Postgres duplicate-key message.
  const { data: existing } = await admin
    .from('vendor_invites')
    .select('invite_id, claim_token')
    .ilike('email', rawEmail)
    .eq('source', 'admin')
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) {
    return { status: 'duplicate_pending' };
  }

  const claimToken = generateClaimToken();
  const sentAt = new Date();
  const expiresAt = new Date(sentAt);
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  const { data: inserted, error } = await admin
    .from('vendor_invites')
    .insert({
      vendor_id: null,
      invited_by_user_id: adminUserId,
      email: rawEmail.toLowerCase(),
      business_name: rawBusinessName,
      service_category: rawServiceCategory.length > 0 ? rawServiceCategory : null,
      claim_token: claimToken,
      status: 'pending',
      source: 'admin',
      sent_at: sentAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select('invite_id')
    .single();

  if (error || !inserted) {
    return { status: 'error', message: error?.message ?? 'Insert failed' };
  }

  revalidatePath('/admin/vendors');
  return {
    status: 'ok',
    inviteId: inserted.invite_id,
    claimUrl: `${SITE_URL}/vendor/claim/${claimToken}`,
  };
}

/**
 * Revoke a pending admin-source vendor invite (token still works but the
 * claim page renders "this invite is revoked"). Soft-delete by status flip
 * — preserves the audit trail of who invited whom.
 */
export async function revokeAdminVendorInvite(formData: FormData) {
  await requireAdmin();
  const inviteId = String(formData.get('invite_id') ?? '').trim();
  if (!inviteId) throw new Error('Invalid invite_id');

  const admin = createAdminClient();
  const { error } = await admin
    .from('vendor_invites')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('invite_id', inviteId)
    .eq('source', 'admin');
  if (error) throw new Error(error.message);

  revalidatePath('/admin/vendors');
}
