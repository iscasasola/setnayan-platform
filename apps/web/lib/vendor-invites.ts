import 'server-only';
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VendorInviteStatus =
  | 'pending'
  | 'claimed'
  | 'expired'
  | 'revoked'
  | 'declined';

/** 2026-05-21 — admin-initiated invites have no parent event_vendors row
 *  (`vendor_id` is NULL). The claim flow branches on this field to skip
 *  applyClaimAutoLink for admin-source rows.
 *
 *  2026-05-22 — `auto_share_link` is the third source. Created by
 *  finalizeVendor when a host locks a manual vendor (one with
 *  `event_vendors.manual_vendor_id IS NOT NULL` and no marketplace link).
 *  No target email at insert time — the host shares the URL via whatever
 *  channel (Viber, Messenger, SMS); the vendor's email is captured at
 *  signup. Behaves like 'couple' on the claim page (auto-link via
 *  applyClaimAutoLink fires when the vendor finishes signup). */
export type VendorInviteSource = 'couple' | 'admin' | 'auto_share_link';

export type VendorInviteRow = {
  invite_id: string;
  public_id: string;
  vendor_id: string | null;
  invited_by_user_id: string;
  /** Nullable as of 2026-05-22 (auto_share_link source). NOT NULL for
   *  couple + admin sources — enforced by vendor_invites_source_vendor_consistency. */
  email: string | null;
  business_name: string;
  service_category: string | null;
  claim_token: string;
  status: VendorInviteStatus;
  source: VendorInviteSource;
  sent_at: string;
  expires_at: string;
  claimed_by_user_id: string | null;
  claimed_vendor_profile_id: string | null;
  claimed_at: string | null;
  declined_at: string | null;
  revoked_at: string | null;
};

/** The pill variant rendered on the couple-side vendor row. */
export type VendorPillVariant =
  | 'on_platform' // marketplace_vendor_id is set (joined / connected / picked from marketplace)
  | 'invite_sent'
  | 'invite_declined'
  | 'invite_expired'
  | 'invite_revoked'
  | 'manual_entry'; // off-platform, no invite ever sent

export const INVITE_PILL_COPY: Record<VendorPillVariant, string> = {
  on_platform: 'Joined Setnayan',
  invite_sent: 'Invite sent',
  invite_declined: 'Declined invite',
  invite_expired: 'Invite expired',
  invite_revoked: 'Invite revoked',
  manual_entry: 'Manual entry',
};

export const INVITE_PILL_TONE: Record<VendorPillVariant, string> = {
  on_platform: 'bg-emerald-100 text-emerald-800',
  invite_sent: 'bg-amber-100 text-amber-900',
  invite_declined: 'bg-rose-100 text-rose-800',
  invite_expired: 'bg-ink/5 text-ink/55',
  invite_revoked: 'bg-ink/5 text-ink/55',
  manual_entry: 'bg-ink/5 text-ink/55 ring-1 ring-inset ring-dashed ring-ink/15',
};

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

/**
 * URL-safe ~32-char nonce. The token IS the access gate for the
 * `/vendor/claim/[token]` page — anyone with the link can claim or decline,
 * which is exactly what we want for an emailed invite. Entropy: 24 bytes
 * = 192 bits of randomness; brute-force enumeration is computationally
 * infeasible.
 */
export function generateClaimToken(): string {
  return randomBytes(24).toString('base64url');
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch the LATEST invite for each vendor_id in one query. Used by the
 * vendors-page render to compute the status pill alongside each row.
 * Returns a map keyed by vendor_id so the page render is O(1) per row.
 */
export async function fetchLatestInvitesByVendorIds(
  supabase: SupabaseClient,
  vendorIds: string[],
): Promise<Map<string, VendorInviteRow>> {
  if (vendorIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('vendor_invites')
    .select(
      'invite_id,public_id,vendor_id,invited_by_user_id,email,business_name,service_category,claim_token,status,source,sent_at,expires_at,claimed_by_user_id,claimed_vendor_profile_id,claimed_at,declined_at,revoked_at',
    )
    .in('vendor_id', vendorIds)
    .order('sent_at', { ascending: false });
  if (error) throw new Error(`fetchLatestInvitesByVendorIds failed: ${error.message}`);
  const out = new Map<string, VendorInviteRow>();
  for (const row of (data ?? []) as VendorInviteRow[]) {
    // Skip admin-source rows (no vendor_id) — this helper is for the
    // couple-side vendor tracker that keys by event_vendors.vendor_id.
    if (row.vendor_id && !out.has(row.vendor_id)) out.set(row.vendor_id, row);
  }
  return out;
}

/**
 * Decide the pill state for a given event_vendor row + its latest invite.
 * Pure function — caller resolves the inputs from query results.
 */
export function pillVariantFor(
  marketplaceVendorId: string | null,
  latestInvite: VendorInviteRow | null,
): VendorPillVariant {
  if (marketplaceVendorId) return 'on_platform';
  if (!latestInvite) return 'manual_entry';
  switch (latestInvite.status) {
    case 'pending':
      return 'invite_sent';
    case 'claimed':
      // Defensive: claimed status without marketplace_vendor_id shouldn't
      // happen, but fall back gracefully.
      return 'on_platform';
    case 'declined':
      return 'invite_declined';
    case 'expired':
      return 'invite_expired';
    case 'revoked':
      return 'invite_revoked';
  }
}

/**
 * Format the "days left" countdown shown next to the Invite-sent pill.
 * Returns null when the invite isn't pending or is already past expiry.
 */
export function daysLeftFor(invite: VendorInviteRow): number | null {
  if (invite.status !== 'pending') return null;
  const ms = new Date(invite.expires_at).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Claim-page query (admin client — token IS the access gate)
// ---------------------------------------------------------------------------

export type ClaimLandingData = {
  invite: VendorInviteRow;
  /** Couple-source invites only. NULL for admin-source rows. */
  parentVendor: {
    vendor_id: string;
    event_id: string;
    vendor_name: string;
    contact_email: string | null;
    contact_phone: string | null;
    category: string;
  } | null;
  /** Couple-source invites only. NULL for admin-source rows. */
  event: {
    event_id: string;
    event_date: string | null;
    couple_display_name: string;
  } | null;
  /** When the invited email already runs a Setnayan vendor account. */
  existingVendor: { vendor_profile_id: string; business_name: string } | null;
};

/**
 * Resolves everything the claim page needs in one shot. Uses the admin
 * client (RLS-bypassing) since the token itself is the access gate — the
 * page is published at a public URL, and we want the page to render even
 * before the visitor signs in.
 *
 * Also performs the lazy expiration sweep: if the token's invite is
 * `pending` but past `expires_at`, flips it to `expired` before returning
 * (so the page renders the read-only "expired" surface, not the active
 * claim surface). Matches the no-cron rule from the spec.
 */
export async function fetchClaimLandingByToken(
  admin: SupabaseClient,
  token: string,
): Promise<ClaimLandingData | null> {
  // 1. Find the invite by token.
  const { data: invite, error: invErr } = await admin
    .from('vendor_invites')
    .select(
      'invite_id,public_id,vendor_id,invited_by_user_id,email,business_name,service_category,claim_token,status,source,sent_at,expires_at,claimed_by_user_id,claimed_vendor_profile_id,claimed_at,declined_at,revoked_at',
    )
    .eq('claim_token', token)
    .maybeSingle();
  if (invErr) throw new Error(`fetchClaimLandingByToken: ${invErr.message}`);
  if (!invite) return null;
  const inviteRow = invite as VendorInviteRow;

  // 2. Lazy expiration sweep — flip pending→expired if past TTL.
  let resolvedInvite = inviteRow;
  if (
    inviteRow.status === 'pending' &&
    new Date(inviteRow.expires_at).getTime() <= Date.now()
  ) {
    await admin
      .from('vendor_invites')
      .update({ status: 'expired' })
      .eq('invite_id', inviteRow.invite_id);
    resolvedInvite = { ...inviteRow, status: 'expired' };
  }

  // 2026-05-21 — admin-source invites skip the parent + event lookups
  // entirely. They were never tied to an event_vendors row; the claim page
  // renders a simpler "Setnayan invited you" surface.
  let parent: NonNullable<ClaimLandingData['parentVendor']> | null = null;
  let event: NonNullable<ClaimLandingData['event']> | null = null;
  if (resolvedInvite.source === 'couple' && resolvedInvite.vendor_id) {
    // 3. Parent event_vendors row.
    const { data: parentRow, error: parentErr } = await admin
      .from('event_vendors')
      .select('vendor_id,event_id,vendor_name,contact_email,contact_phone,category')
      .eq('vendor_id', resolvedInvite.vendor_id)
      .maybeSingle();
    if (parentErr) throw new Error(`fetchClaimLandingByToken parent: ${parentErr.message}`);
    if (!parentRow) return null;
    parent = parentRow as NonNullable<ClaimLandingData['parentVendor']>;

    // 4. Event + display name (couple's chosen public-facing event name).
    const { data: ev, error: evErr } = await admin
      .from('events')
      .select('event_id,event_date,display_name')
      .eq('event_id', parent.event_id)
      .maybeSingle();
    if (evErr) throw new Error(`fetchClaimLandingByToken event: ${evErr.message}`);
    const evRow = ev ?? { event_id: parent.event_id, event_date: null, display_name: '' };
    event = {
      event_id: evRow.event_id as string,
      event_date: (evRow.event_date as string | null) ?? null,
      couple_display_name:
        ((evRow.display_name as string | null) ?? '').trim() || 'A Setnayan couple',
    };
  }

  // 5. Already-on-Setnayan detection — does this email already own a vendor?
  // Skipped for auto_share_link source (no email captured at invite time);
  // existingVendor stays null and the claim flow falls through to its
  // own branch in the claim page.
  let existingVendor: { vendor_profile_id: string; business_name: string } | null = null;
  if (resolvedInvite.email) {
    const { data: row } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id,business_name,contact_email')
      .ilike('contact_email', resolvedInvite.email)
      .limit(1)
      .maybeSingle();
    if (row) {
      existingVendor = {
        vendor_profile_id: row.vendor_profile_id as string,
        business_name: row.business_name as string,
      };
    }
  }

  return {
    invite: resolvedInvite,
    parentVendor: parent,
    event,
    existingVendor,
  };
}

// ---------------------------------------------------------------------------
// Auto-share-link invites (2026-05-22) — idempotent ensure + fetch helpers
//
// Called from finalizeVendor (apps/web/app/dashboard/[eventId]/vendors/actions.ts)
// when a host locks a manual vendor that has no Setnayan account. Returns
// an existing pending token if one exists for this event_vendors row, or
// creates a fresh row + token. Workspace page calls fetchActiveAutoShareInvite
// to render the claim-URL CTA.
// ---------------------------------------------------------------------------

const AUTO_SHARE_INVITE_TTL_DAYS = 90;

function computeAutoShareExpiresAt(): string {
  return new Date(Date.now() + AUTO_SHARE_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Idempotently ensures an `auto_share_link` invite exists for an
 * event_vendors row. Returns the invite (existing or freshly-created)
 * so the caller can build the claim URL. The partial unique index
 * `vendor_invites_auto_share_live_unique` guarantees at most one pending
 * row per event_vendors id, so this is safe to call repeatedly.
 *
 * Schema gating: caller MUST verify the parent event_vendors row has
 * `manual_vendor_id IS NOT NULL` AND `marketplace_vendor_id IS NULL`
 * before calling. The DB doesn't enforce that linkage — `vendor_id` on
 * vendor_invites is just an FK to event_vendors.vendor_id, and a
 * marketplace-linked row already has chat unlocked + a vendor_profile
 * for the vendor to log into, so an invite would be a no-op.
 *
 * Failure mode: if the insert fails (RLS denial, network), returns null
 * and lets the caller decide whether to surface the error. The lock
 * itself has already succeeded by the time this is called, so silent
 * fallback is the right shape (per the auto-cascade pattern in
 * finalizeVendor's existing trailing operations).
 */
export async function ensureAutoShareInvite(
  supabase: SupabaseClient,
  args: {
    eventVendorId: string;
    invitedByUserId: string;
    businessName: string;
    serviceCategory: string | null;
  },
): Promise<VendorInviteRow | null> {
  // 1. Look for an existing pending auto_share_link invite for this row.
  const { data: existing, error: readErr } = await supabase
    .from('vendor_invites')
    .select(
      'invite_id,public_id,vendor_id,invited_by_user_id,email,business_name,service_category,claim_token,status,source,sent_at,expires_at,claimed_by_user_id,claimed_vendor_profile_id,claimed_at,declined_at,revoked_at',
    )
    .eq('vendor_id', args.eventVendorId)
    .eq('source', 'auto_share_link')
    .eq('status', 'pending')
    .maybeSingle();
  if (readErr) {
    // RLS or transient error — don't try to insert blindly. Caller can
    // re-run on the next finalize hit.
    return null;
  }
  if (existing) {
    return existing as VendorInviteRow;
  }

  // 2. Create a new pending row. Email stays NULL (host shares manually);
  //    business_name + service_category are denormalized snapshots so the
  //    claim page renders stable identity even if the host later edits
  //    the event_vendors row.
  const claimToken = generateClaimToken();
  const { data: inserted, error: insertErr } = await supabase
    .from('vendor_invites')
    .insert({
      vendor_id: args.eventVendorId,
      invited_by_user_id: args.invitedByUserId,
      email: null,
      business_name: args.businessName,
      service_category: args.serviceCategory,
      claim_token: claimToken,
      status: 'pending',
      source: 'auto_share_link',
      expires_at: computeAutoShareExpiresAt(),
    })
    .select(
      'invite_id,public_id,vendor_id,invited_by_user_id,email,business_name,service_category,claim_token,status,source,sent_at,expires_at,claimed_by_user_id,claimed_vendor_profile_id,claimed_at,declined_at,revoked_at',
    )
    .single();

  if (insertErr) {
    // 23505 = unique_violation. Another concurrent finalize call may have
    // just inserted the row — re-read and return that one.
    if (insertErr.code === '23505') {
      const { data: raced } = await supabase
        .from('vendor_invites')
        .select(
          'invite_id,public_id,vendor_id,invited_by_user_id,email,business_name,service_category,claim_token,status,source,sent_at,expires_at,claimed_by_user_id,claimed_vendor_profile_id,claimed_at,declined_at,revoked_at',
        )
        .eq('vendor_id', args.eventVendorId)
        .eq('source', 'auto_share_link')
        .eq('status', 'pending')
        .maybeSingle();
      return (raced as VendorInviteRow | null) ?? null;
    }
    return null;
  }
  return inserted as VendorInviteRow;
}

/**
 * Returns the most recent auto_share_link invite for an event_vendors row,
 * regardless of status. Used by the workspace page to render either:
 *   - The active claim URL CTA when status='pending'
 *   - The "Linked on {claimed_at}" status when status='claimed'
 *   - The "Invite expired/revoked" hint when status='expired'/'revoked'
 *
 * Returns null when no invite has ever been auto-created (e.g. host hasn't
 * locked this manual vendor yet, or it was created before this feature
 * landed).
 */
export async function fetchActiveAutoShareInvite(
  supabase: SupabaseClient,
  eventVendorId: string,
): Promise<VendorInviteRow | null> {
  const { data } = await supabase
    .from('vendor_invites')
    .select(
      'invite_id,public_id,vendor_id,invited_by_user_id,email,business_name,service_category,claim_token,status,source,sent_at,expires_at,claimed_by_user_id,claimed_vendor_profile_id,claimed_at,declined_at,revoked_at',
    )
    .eq('vendor_id', eventVendorId)
    .eq('source', 'auto_share_link')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as VendorInviteRow | null) ?? null;
}

/**
 * Build the public-facing claim URL for a token. Centralized so the host
 * UI + email + future SMS share-helpers all produce the same shape.
 */
export function buildClaimUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com';
  return `${appUrl.replace(/\/$/, '')}/vendor/claim/${token}`;
}

// ---------------------------------------------------------------------------
// Email lookup — does an email already run a Setnayan vendor account?
// ---------------------------------------------------------------------------

export async function lookupExistingVendorByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ vendor_profile_id: string; business_name: string } | null> {
  const { data } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id,business_name,contact_email')
    .ilike('contact_email', email.trim())
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    vendor_profile_id: data.vendor_profile_id as string,
    business_name: data.business_name as string,
  };
}
