'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parsePhPhone } from '@/lib/ph-phone';
import { VENDOR_TIER_SETTABLE, TIER_LABEL, asVendorTier } from '@/lib/vendor-tier-caps';
import {
  VENDOR_PHOTO_CHALLENGE_SKU_CODE,
  nextPhotoChallengeExpiry,
  fetchVendorPhotoChallengePricePhp,
} from '@/lib/vendor-photo-challenge';

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
      // 🔒 Owner 2026-07-27 — an admin-STAGED vendor (no user_id yet, invited
      // but unclaimed) is by definition not ready, so it rests in `hidden`.
      // Staging previously wrote `coming_soon`, which was publicly readable —
      // meaning a vendor who had never even claimed their account had their
      // business name and contact email exposed via the anon key.
      public_visibility: 'hidden',
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
  const contactPhoneRaw = nullIfBlank(formData.get('contact_phone'));
  // Same rule as everywhere else. An admin seeding a shop is the one path that
  // could otherwise plant a number the vendor themselves would be refused for —
  // and the vendor inherits it on claim, so the bad value arrives wearing our
  // own approval.
  const parsedPhone = contactPhoneRaw ? parsePhPhone(contactPhoneRaw) : null;
  if (contactPhoneRaw && !parsedPhone?.ok) {
    throw new Error(
      'That contact number isn’t a Philippine number. Use 09XX XXX XXXX, or a landline with its area code.',
    );
  }
  const contactPhone = parsedPhone?.ok ? parsedPhone.e164 : null;
  const services = parseCsvList(formData.get('services'));
  const isPublished = formData.get('is_published') === 'on';

  const admin = createAdminClient();
  const { data: updated, error: updateErr } = await admin
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
    .is('user_id', null)
    // ── A FILTER THAT MATCHES NOTHING IS NOT AN ERROR ────────────────────────
    // `.is('user_id', null)` is deliberate — it stops an admin overwriting a
    // profile a vendor claimed mid-edit. But on a CLAIMED shop it matches zero
    // rows and PostgREST returns no error, so the admin pressed Save, saw no
    // complaint, and nothing changed. Silence that looks exactly like success.
    // Asking for the rows back is what makes the refusal visible.
    .select('vendor_profile_id');
  if (updateErr) throw new Error(updateErr.message);
  if (!updated || updated.length === 0) {
    throw new Error(
      'This shop belongs to a vendor, so it can’t be edited here. Ask them to change it in My Shop — or approve a correction request from /admin/corrections.',
    );
  }

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

// 🚨 WAS A PRIVATE FOUR-VALUE LIST that silently disagreed with the six-option
// dropdowns posting to it — picking Solo threw `Invalid tier.` as an unhandled
// error. Now the ONE list, shared with every `<select>` that posts here, so the
// offered set and the accepted set cannot drift apart again. See its docblock.
const VENDOR_TIER_VALUES = VENDOR_TIER_SETTABLE;

/**
 * Where a `setVendorTier` / `issueVendorSkuComp` form came from, for the
 * optional `return_to` field. Same shape as free-windows-actions.ts's
 * `RETURN_TARGETS` — an allowlist, not a bare passthrough, so a form field
 * can never become an open redirect. `/admin/gifts` is the only surface that
 * posts here besides each action's own default page.
 */
const GIFTS_RETURN_TARGET = '/admin/gifts';

function wantsGiftsReturn(formData: FormData): boolean {
  return String(formData.get('return_to') ?? '').trim() === GIFTS_RETURN_TARGET;
}

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

  // Required + logged (2026-09-04) — until self-serve checkout ships, every
  // non-free tier on this page IS a comp with no invoice behind it; there was
  // no record of WHY beyond whoever remembered to leave a Slack message. Same
  // 10-char minimum as revokeCompGrant's reason field, not issueCompGrant's
  // 20-char rationale — this form sets a tier in one click, not a multi-SKU
  // grant, so the friction should match.
  const reasonRaw = String(formData.get('reason') ?? '').trim();
  if (reasonRaw.length < 10) {
    throw new Error(
      'Write a short reason (at least 10 characters) for this tier change — it is logged.',
    );
  }

  // Parse optional end-date. Free tier always clears it; paid tiers use the
  // admin-supplied date or null (open-ended comp access).
  let tierExpiresAt: string | null = null;
  if (tier !== 'free') {
    const raw = String(formData.get('tier_expires_at') ?? '').trim();
    if (raw.length > 0) {
      const parsed = new Date(raw);
      if (isNaN(parsed.getTime())) throw new Error('Invalid end date.');
      if (parsed <= new Date()) throw new Error('End date must be in the future.');
      tierExpiresAt = parsed.toISOString();
    }
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at, business_name, public_id')
    .eq('vendor_profile_id', vendorId)
    .maybeSingle();
  if (!before) throw new Error('Vendor not found.');

  // tier_source='admin_comp' on every write, not just the default — this is
  // the ONLY writer of a non-free tier today (see fetchCompedVendors's
  // trip-wire docblock), so stamping it explicitly here means the day a
  // self-serve writer is added elsewhere, this one's rows are already correct
  // rather than relying on a column default nobody remembers to revisit.
  const { error } = await admin
    .from('vendor_profiles')
    .update({ tier_state: tier, tier_expires_at: tierExpiresAt, tier_source: 'admin_comp' })
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
      from_expires_at: (before as { tier_expires_at?: string | null }).tier_expires_at ?? null,
      to_expires_at: tierExpiresAt,
      reason: reasonRaw,
    },
  });
  if (auditErr) {
    console.error('[setVendorTier] audit log insert failed', auditErr.message);
  }

  // ⚠ THE SUBSCRIPTION TOKEN BUNDLE WAS REMOVED HERE 2026-08-07. Setting a
  // vendor to Pro/Enterprise used to also call grant_vendor_lifetime_tokens for
  // 5/10 tokens. It was the LAST live writer of the currency in the app — the
  // verification bonus had already been retired by migration 20270110320020 —
  // so leaving it would have kept minting a currency that buys nothing (owner
  // 2026-07-21: "token can retire, there should be nothing that needs token
  // anymore"). The RPC still exists; nothing calls it.

  revalidatePath(`/admin/vendors/${vendorId}/plan`);
  revalidatePath('/admin/vendors');

  // Optional `return_to=/admin/gifts` — a grant made FROM the gifts console
  // lands back there instead of the vendor's own /plan page. Everything else
  // (the vendor plan page itself, direct links) keeps the pre-existing
  // redirect, since /admin/vendors/:id/plan reads its own `?tier=` banner.
  if (wantsGiftsReturn(formData)) {
    revalidatePath(GIFTS_RETURN_TARGET);
    const banner = `Tier for ${before.business_name} set to ${TIER_LABEL[asVendorTier(tier)]}.`;
    redirect(`${GIFTS_RETURN_TARGET}?banner=${encodeURIComponent(banner)}`);
  }
  redirect(`/admin/vendors/${vendorId}/plan?tier=${tier}`);
}

/**
 * The vendor add-on SKUs an admin comp can grant FOR REAL. Deliberately a
 * short, explicit map rather than "any SKU string" — every vendor add-on
 * OTHER than Papic Challenges has its own resolver with no shared choke point
 * (lib/promo-free-windows.ts docblock on `vendorTierOfSku`), so comping one
 * means writing that SKU's own direct-grant branch below, not adding a string
 * to an array and hoping something reads it. An entry here is a PROMISE that
 * `issueVendorSkuComp` actually provisions it, not just records it.
 */
const VENDOR_COMPABLE_SKUS = {
  [VENDOR_PHOTO_CHALLENGE_SKU_CODE]: { label: 'Papic Challenges (28 days)' },
} as const;

type VendorCompableSku = keyof typeof VENDOR_COMPABLE_SKUS;

/**
 * Grant a vendor ONE Papic Challenges cycle for free — the SKU-level sibling
 * of `setVendorTier` (which comps the whole subscription tier, not one
 * add-on). Uses `comp_grants.vendor_profile_id`, dormant until now: its only
 * prior reader is `enforce_vendor_self_comp_quota` (BEFORE INSERT trigger,
 * migration slug `self_review_gate`), and that trigger counts a
 * `vendor_profile_id` row ONLY when `source = 'vendor_self_comp'`. This
 * action always writes `source: 'external_promo'`, so an admin-issued row can
 * never silently consume the target vendor's own quarterly self-comp
 * allowance — verified by reading the trigger body, not assumed.
 *
 * The grant is REAL, not a ledger entry that looks like one: it writes the
 * exact column the vendor's own self-serve free-cycle path writes
 * (`vendor_profiles.papic_challenge_expires_at`), which is the ONLY thing
 * `public.vendor_papic_challenge_entitled()` checks (migration
 * `one_way_to_buy_a_challenge`). No order is minted — unlike the vendor
 * self-serve free path, there is no billing history to justify; the
 * `comp_grants` row IS the audit trail here, same role `admin_audit_log`
 * plays for `setVendorTier`.
 */
export async function issueVendorSkuComp(formData: FormData): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const vendorId = String(formData.get('vendor_id') ?? '').trim();
  const sku = String(formData.get('sku') ?? '').trim();
  if (vendorId.length === 0) throw new Error('Missing vendor_id.');
  if (!Object.prototype.hasOwnProperty.call(VENDOR_COMPABLE_SKUS, sku)) {
    throw new Error('Invalid SKU.');
  }

  // Same 10-char floor as setVendorTier's reason field — a one-click grant,
  // not issueCompGrant's multi-field rationale.
  const reasonRaw = String(formData.get('reason') ?? '').trim();
  if (reasonRaw.length < 10) {
    throw new Error(
      'Write a short reason (at least 10 characters) for this comp — it is logged.',
    );
  }

  const admin = createAdminClient();
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('business_name, public_id, papic_challenge_expires_at')
    .eq('vendor_profile_id', vendorId)
    .maybeSingle();
  if (!vendor) throw new Error('Vendor not found.');

  const currentExpiry =
    (vendor as { papic_challenge_expires_at?: string | null }).papic_challenge_expires_at ??
    null;
  // Stacks from the LATER of now / the current expiry (same rule the vendor's
  // own free-activation path uses) — a comp on top of a live subscription
  // extends it rather than truncating time the vendor already has.
  const newExpiry = nextPhotoChallengeExpiry(currentExpiry, Date.now());

  const { error: grantErr } = await admin
    .from('vendor_profiles')
    .update({ papic_challenge_expires_at: newExpiry })
    .eq('vendor_profile_id', vendorId);
  if (grantErr) throw new Error(grantErr.message);

  const pricePhp = await fetchVendorPhotoChallengePricePhp(admin);

  const { error: insertErr } = await admin.from('comp_grants').insert({
    user_id: null,
    vendor_profile_id: vendorId,
    source: 'external_promo',
    scope: 'specific_skus',
    scoped_skus: [sku],
    expiry: newExpiry,
    retail_value_centavos: pricePhp * 100,
    rationale: reasonRaw,
    granted_by: adminUserId,
    approved_by: null,
  });
  if (insertErr) {
    // The entitlement write already succeeded — rolling it back would take
    // away what the admin just confirmed granting. Same "don't undo a real
    // grant over an audit-row failure" call issueCompGrant makes; log for
    // Sentry rather than throw.
    console.error('[issueVendorSkuComp] comp_grants insert failed', insertErr.message);
  }

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'vendor_sku_comp_issued',
    target_id: vendorId,
    actor_user_id: adminUserId,
    metadata: {
      business_name: vendor.business_name,
      public_id: vendor.public_id,
      sku,
      from_expires_at: currentExpiry,
      to_expires_at: newExpiry,
      retail_value_centavos: pricePhp * 100,
      reason: reasonRaw,
    },
  });
  if (auditErr) {
    console.error('[issueVendorSkuComp] audit log insert failed', auditErr.message);
  }

  revalidatePath(`/admin/vendors/${vendorId}/plan`);
  revalidatePath('/admin/vendors');

  const label = VENDOR_COMPABLE_SKUS[sku as VendorCompableSku].label;
  const banner = `${vendor.business_name} comped ${label}.`;
  if (wantsGiftsReturn(formData)) {
    revalidatePath(GIFTS_RETURN_TARGET);
    redirect(`${GIFTS_RETURN_TARGET}?banner=${encodeURIComponent(banner)}`);
  }
  redirect(`/admin/vendors/${vendorId}/plan?banner=${encodeURIComponent(banner)}`);
}

/**
 * Grant / remove the founding-supplier override (`vendor_profiles.is_founder`).
 *
 * 🚨 THIS IS THE MISSING HANDLE. The override shipped on 2026-06-09 with a
 * migration, a column comment and two live readers in
 * `app/vendor-dashboard/services/actions.ts` — and NOTHING in the app ever wrote
 * it. The only row that has ever carried it was set by a hardcoded UUID inside
 * migration 20261013000000, so no second business could ever receive the perk.
 * Same shape as `papic_face_mode` (stored nothing for seven weeks) and
 * `live_media_public` (hid the broadcast from every uninvited visitor): a
 * read-only column typechecks, has RLS, has tested readers, and simply always
 * takes the false branch. Registered in `lib/gates-have-handles.test.ts` so it
 * cannot go writer-less again.
 *
 * WHAT IT ACTUALLY GRANTS, precisely: unlimited parent-categories and unlimited
 * services-per-leaf on service creation/edit. Nothing else — the old token-gate
 * bypass in `unlock_vendor_event` was dropped at migration 20270221294989, and
 * the token currency is retired entirely. It is NOT a tier: it composes on top
 * of `tier_state`, so it neither promotes nor demotes a paying vendor, and it
 * moves no money.
 *
 * Service-role client because `vendor_profiles` has no admin write policy for
 * this column; audit-logged like every other admin mutation here.
 */
export async function setVendorFoundingSupplier(formData: FormData): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const vendorId = String(formData.get('vendor_id') ?? '').trim();
  const raw = String(formData.get('is_founder') ?? '').trim();
  if (vendorId.length === 0) throw new Error('Missing vendor_id.');
  // Explicit on/off rather than a checkbox: an unchecked box posts NOTHING, so
  // a checkbox-shaped control cannot tell "remove it" apart from "the form did
  // not include the field", and would silently remove the perk on any partial
  // submit.
  if (raw !== 'on' && raw !== 'off') throw new Error('Invalid founding-supplier value.');
  const next = raw === 'on';

  const admin = createAdminClient();
  // ⚠ Supabase RESOLVES with `{ error }` — it does not throw — so a rejected
  // read arrives as `data: null` and would read exactly like "vendor not found".
  const { data: before, error: readErr } = await admin
    .from('vendor_profiles')
    .select('is_founder, business_name, public_id')
    .eq('vendor_profile_id', vendorId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!before) throw new Error('Vendor not found.');

  const { error } = await admin
    .from('vendor_profiles')
    .update({ is_founder: next })
    .eq('vendor_profile_id', vendorId);
  if (error) throw new Error(error.message);

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: next ? 'vendor_founding_supplier_grant' : 'vendor_founding_supplier_revoke',
    target_id: vendorId,
    actor_user_id: adminUserId,
    metadata: {
      business_name: before.business_name,
      public_id: before.public_id,
      from_is_founder:
        (before as { is_founder?: boolean | null }).is_founder === true,
      to_is_founder: next,
    },
  });
  if (auditErr) {
    console.error('[setVendorFoundingSupplier] audit log insert failed', auditErr.message);
  }

  revalidatePath(`/admin/vendors/${vendorId}/plan`);
  revalidatePath('/admin/vendors');
  redirect(`/admin/vendors/${vendorId}/plan?founding=${next ? 'granted' : 'removed'}`);
}
