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

  // ──────────────────────────────────────────────────────────────────
  // 2026-05-21 admin-owned-unclaimed model: pre-create the
  // vendor_profiles row NOW (user_id=NULL, created_by_admin set) so
  // the admin can edit it from /admin/vendors/[id]/edit before the
  // vendor claims. On claim, the finalize page UPDATEs user_id to
  // the claimant — no new row created.
  //
  // RLS is bypassed here because we hold the service-role admin
  // client, but the column constraints (CHECK constraints + the
  // partial-unique index on (LOWER(email)) for admin invites in
  // 20260527000000) still apply.
  // ──────────────────────────────────────────────────────────────────
  const services =
    rawServiceCategory.length > 0 ? [rawServiceCategory] : [];

  const { data: stagedProfile, error: profileErr } = await admin
    .from('vendor_profiles')
    .insert({
      user_id: null,
      created_by_admin_user_id: adminUserId,
      business_name: rawBusinessName,
      contact_email: rawEmail.toLowerCase(),
      services,
      is_published: false,
      public_visibility: 'coming_soon',
    })
    .select('vendor_profile_id')
    .single();
  if (profileErr || !stagedProfile) {
    return {
      status: 'error',
      message: profileErr?.message ?? 'Could not stage vendor profile.',
    };
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
      // Pre-link the invite to the staged profile so the finalize page
      // knows which profile to transfer ownership of on claim.
      claimed_vendor_profile_id: stagedProfile.vendor_profile_id,
    })
    .select('invite_id')
    .single();

  if (error || !inserted) {
    // Roll back the staged profile so we don't leave an orphan.
    await admin
      .from('vendor_profiles')
      .delete()
      .eq('vendor_profile_id', stagedProfile.vendor_profile_id);
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
 * Revoke a pending admin-source vendor invite. The linked vendor_profiles
 * row gets deleted along with it — admins create both atomically in
 * `createAdminVendorInvite`, so revoke should clean up both. Preserves
 * the invite row for audit (status='revoked', revoked_at set).
 *
 * Skipped if the invite has already been claimed — a claimed row is
 * tied to a real vendor account that should not be touched here.
 */
export async function revokeAdminVendorInvite(formData: FormData) {
  await requireAdmin();
  const inviteId = String(formData.get('invite_id') ?? '').trim();
  if (!inviteId) throw new Error('Invalid invite_id');

  const admin = createAdminClient();

  // Load the invite first so we know which staged profile to clean up.
  const { data: invite } = await admin
    .from('vendor_invites')
    .select('invite_id, status, claimed_vendor_profile_id')
    .eq('invite_id', inviteId)
    .eq('source', 'admin')
    .maybeSingle();
  if (!invite) throw new Error('Invite not found');
  if (invite.status !== 'pending') {
    // Already claimed / declined / expired / revoked — nothing to do.
    return;
  }

  if (invite.claimed_vendor_profile_id) {
    // Delete the staged unclaimed vendor_profiles row. Only delete if
    // user_id is still NULL (unclaimed) — defensive guard against a
    // race where the vendor claims between read and write.
    await admin
      .from('vendor_profiles')
      .delete()
      .eq('vendor_profile_id', invite.claimed_vendor_profile_id)
      .is('user_id', null);
  }

  const { error } = await admin
    .from('vendor_invites')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('invite_id', inviteId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/vendors');
}

/**
 * Admin-side save for an unclaimed vendor_profiles row. Updates only the
 * "bare essentials" the admin form exposes; portfolio, compat tags, and
 * other vendor-side niceties stay for the vendor to fill in post-claim.
 *
 * Geocoding fires the same way it does on the vendor side: if hq_address
 * (or location_city as fallback) is present, we round-trip Nominatim and
 * stamp hq_latitude/longitude.
 *
 * RLS protects this from non-admins; we also re-check user_id IS NULL
 * server-side so a race between admin save + vendor claim doesn't let an
 * admin overwrite a freshly-claimed profile.
 */
export async function saveUnclaimedVendorProfile(formData: FormData) {
  await requireAdmin();
  const vendorProfileId = String(formData.get('vendor_profile_id') ?? '').trim();
  if (!vendorProfileId) throw new Error('Invalid vendor_profile_id');

  const businessName = String(formData.get('business_name') ?? '').trim();
  if (businessName.length === 0 || businessName.length > 128) {
    throw new Error('Business name must be 1–128 characters.');
  }
  const tagline = nullIfBlank(formData.get('tagline'));
  const locationCity = nullIfBlank(formData.get('location_city'));
  const hqAddress = nullIfBlank(formData.get('hq_address'));
  const contactEmail = nullIfBlank(formData.get('contact_email'));
  const contactPhone = nullIfBlank(formData.get('contact_phone'));
  const services = parseCsvList(formData.get('services'));
  const isPublished = formData.get('is_published') === 'on';

  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from('vendor_profiles')
    .update({
      business_name: businessName,
      tagline,
      location_city: locationCity,
      hq_address: hqAddress,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      services,
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_profile_id', vendorProfileId)
    .is('user_id', null);
  if (updateErr) throw new Error(updateErr.message);

  // Best-effort geocode on save. Failures are silent; admin re-saves to
  // retry or sets coords manually via a future tool.
  const geocodeQuery = hqAddress ?? locationCity;
  if (geocodeQuery) {
    const { geocodeNominatim } = await import('@/lib/geo');
    const geo = await geocodeNominatim(geocodeQuery);
    if (geo) {
      await admin
        .from('vendor_profiles')
        .update({
          hq_latitude: geo.latitude,
          hq_longitude: geo.longitude,
        })
        .eq('vendor_profile_id', vendorProfileId)
        .is('user_id', null);
    }
  }

  revalidatePath(`/admin/vendors/${vendorProfileId}/edit`);
  revalidatePath('/admin/vendors');
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseCsvList(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 64)
    .slice(0, 30);
}

/**
 * Admin direct token grant · credits a vendor's wallet with N expiring
 * tokens via the canonical helper grant_admin_direct_tokens (migration
 * 20260703500000 PART 2).
 *
 * WHY · Owner brief 2026-05-29: admin needs a way to manually drop tokens
 *       into a specific vendor's wallet without minting a voucher code.
 *       Use cases: rewarding referral leads, comping a verification snafu,
 *       seeding pilot family vendors beyond the auto-100 founder bonus.
 *
 * The helper function is idempotent via UNIQUE token_grants_log.idempotency_key
 * so admin double-clicking the button is a no-op (returns the existing
 * voucher_id). We synthesize a deterministic key per submit including the
 * admin_id + vendor_id + token_count + ttl_days + a 1-second timestamp
 * bucket — same logical click within the same second collapses, but the
 * SAME admin granting the SAME tokens a minute later mints a new grant
 * (the admin meant to grant twice).
 *
 * Form fields:
 *   • vendor_id      — vendor_profiles.vendor_profile_id (UUID)
 *   • token_count    — int 1-10000
 *   • ttl_days       — int 1-365 (default 45 to match founder convention)
 *   • grant_reason   — TEXT (optional, max 500 chars)
 *
 * Returns void; redirects back to the same /admin/vendors/[id]/tokens page
 * with ?granted= success param so the UI flashes the toast + the recent-grants
 * table re-renders the new row at the top.
 */
export async function grantTokensToVendor(formData: FormData): Promise<void> {
  const { adminUserId } = await requireAdmin();

  const vendorId = String(formData.get('vendor_id') ?? '').trim();
  if (vendorId.length === 0) {
    throw new Error('Missing vendor_id.');
  }

  const rawCount = formData.get('token_count');
  if (typeof rawCount !== 'string' || rawCount.trim().length === 0) {
    throw new Error('Enter the number of tokens (1-10,000).');
  }
  const tokenCount = Number.parseInt(rawCount.trim(), 10);
  if (!Number.isFinite(tokenCount) || tokenCount < 1 || tokenCount > 10000) {
    throw new Error('Token count must be a whole number between 1 and 10,000.');
  }

  const rawTtl = formData.get('ttl_days');
  let ttlDays = 45;
  if (typeof rawTtl === 'string' && rawTtl.trim().length > 0) {
    ttlDays = Number.parseInt(rawTtl.trim(), 10);
    if (!Number.isFinite(ttlDays) || ttlDays < 1 || ttlDays > 365) {
      throw new Error('Available-for days must be 1-365.');
    }
  }

  const rawReason = formData.get('grant_reason');
  let reason: string | null = null;
  if (typeof rawReason === 'string' && rawReason.trim().length > 0) {
    reason = rawReason.trim().slice(0, 500);
  }

  // Deterministic idempotency key. The 1-second bucket collapses
  // accidental double-clicks but lets the SAME admin re-grant the SAME
  // tokens a minute later (different bucket → different key → fresh grant).
  const secondBucket = Math.floor(Date.now() / 1000);
  const idempotencyKey = `admin_grant:${adminUserId}:${vendorId}:${tokenCount}:${ttlDays}:${secondBucket}`;

  const admin = createAdminClient();

  // Snapshot vendor for audit metadata.
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('business_name, public_id')
    .eq('vendor_profile_id', vendorId)
    .maybeSingle();
  if (!vendor) {
    throw new Error('Vendor not found.');
  }

  // Call the helper. Returns the voucher_id (or NULL on key collision).
  const { data: voucherId, error: rpcErr } = await admin.rpc(
    'grant_admin_direct_tokens',
    {
      p_vendor_id: vendorId,
      p_token_count: tokenCount,
      p_ttl_days: ttlDays,
      p_grant_source: 'admin_grant',
      p_granted_by_admin_id: adminUserId,
      p_rationale: reason ?? `Admin direct grant · ${tokenCount} tokens`,
      p_idempotency_key: idempotencyKey,
    },
  );
  if (rpcErr) {
    throw new Error(`Could not grant tokens: ${rpcErr.message}`);
  }

  // Audit-log canonical pattern matches issueCompGrant.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'vendor_token_grant',
    target_id: vendorId,
    actor_user_id: adminUserId,
    metadata: {
      business_name: vendor.business_name,
      public_id: vendor.public_id,
      token_count: tokenCount,
      ttl_days: ttlDays,
      grant_reason: reason,
      voucher_id: voucherId,
      idempotency_key: idempotencyKey,
    },
  });
  if (auditErr) {
    console.error('[grantTokensToVendor] audit log insert failed', auditErr.message);
  }

  revalidatePath(`/admin/vendors/${vendorId}/tokens`);
  revalidatePath('/admin/vendors');
  redirect(`/admin/vendors/${vendorId}/tokens?granted=${tokenCount}`);
}

const VENDOR_TIER_VALUES = ['free', 'verified', 'pro', 'enterprise'] as const;

/**
 * Set a vendor's subscription tier (`vendor_profiles.tier_state`). Until the
 * self-serve subscription checkout lands (Phase D), this is the ONLY way to
 * reach Pro/Enterprise — every paid-tier capability gate is inert without it.
 * Canonical tiers: Vendor_Tier_Capability_Matrix_2026-06-07.md.
 *
 * The verified→tier backfill set tier_state='verified' for verified vendors;
 * this lets an admin promote a vendor to pro/enterprise (e.g. after confirming
 * an off-platform subscription payment) or correct a tier. Audit-logged.
 */
export async function setVendorTier(formData: FormData): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const vendorId = String(formData.get('vendor_id') ?? '').trim();
  const tier = String(formData.get('tier_state') ?? '').trim();
  if (vendorId.length === 0) throw new Error('Missing vendor_id.');
  if (!(VENDOR_TIER_VALUES as readonly string[]).includes(tier)) {
    throw new Error('Invalid tier.');
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from('vendor_profiles')
    .select('tier_state, business_name, public_id')
    .eq('vendor_profile_id', vendorId)
    .maybeSingle();
  if (!before) throw new Error('Vendor not found.');

  const { error } = await admin
    .from('vendor_profiles')
    .update({ tier_state: tier })
    .eq('vendor_profile_id', vendorId);
  if (error) throw new Error(error.message);

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'vendor_tier_set',
    target_id: vendorId,
    actor_user_id: adminUserId,
    metadata: {
      business_name: before.business_name,
      public_id: before.public_id,
      from_tier: before.tier_state ?? null,
      to_tier: tier,
    },
  });
  if (auditErr) {
    console.error('[setVendorTier] audit log insert failed', auditErr.message);
  }

  revalidatePath(`/admin/vendors/${vendorId}/tokens`);
  revalidatePath('/admin/vendors');
  redirect(`/admin/vendors/${vendorId}/tokens?tier=${tier}`);
}
