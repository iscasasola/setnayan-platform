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

export type VendorInviteRow = {
  invite_id: string;
  public_id: string;
  vendor_id: string;
  invited_by_user_id: string;
  email: string;
  business_name: string;
  service_category: string | null;
  claim_token: string;
  status: VendorInviteStatus;
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
      'invite_id,public_id,vendor_id,invited_by_user_id,email,business_name,service_category,claim_token,status,sent_at,expires_at,claimed_by_user_id,claimed_vendor_profile_id,claimed_at,declined_at,revoked_at',
    )
    .in('vendor_id', vendorIds)
    .order('sent_at', { ascending: false });
  if (error) throw new Error(`fetchLatestInvitesByVendorIds failed: ${error.message}`);
  const out = new Map<string, VendorInviteRow>();
  for (const row of (data ?? []) as VendorInviteRow[]) {
    if (!out.has(row.vendor_id)) out.set(row.vendor_id, row);
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
  parentVendor: {
    vendor_id: string;
    event_id: string;
    vendor_name: string;
    contact_email: string | null;
    contact_phone: string | null;
    category: string;
  };
  event: {
    event_id: string;
    event_date: string | null;
    couple_display_name: string;
  };
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
      'invite_id,public_id,vendor_id,invited_by_user_id,email,business_name,service_category,claim_token,status,sent_at,expires_at,claimed_by_user_id,claimed_vendor_profile_id,claimed_at,declined_at,revoked_at',
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

  // 3. Parent event_vendors row.
  const { data: parent, error: parentErr } = await admin
    .from('event_vendors')
    .select('vendor_id,event_id,vendor_name,contact_email,contact_phone,category')
    .eq('vendor_id', resolvedInvite.vendor_id)
    .maybeSingle();
  if (parentErr) throw new Error(`fetchClaimLandingByToken parent: ${parentErr.message}`);
  if (!parent) return null;

  // 4. Event + display name (couple's chosen public-facing event name).
  const { data: ev, error: evErr } = await admin
    .from('events')
    .select('event_id,event_date,display_name')
    .eq('event_id', parent.event_id)
    .maybeSingle();
  if (evErr) throw new Error(`fetchClaimLandingByToken event: ${evErr.message}`);
  const event = ev ?? { event_id: parent.event_id, event_date: null, display_name: '' };

  // 5. Already-on-Setnayan detection — does this email already own a vendor?
  const { data: existingVendor } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id,business_name,contact_email')
    .ilike('contact_email', resolvedInvite.email)
    .limit(1)
    .maybeSingle();

  return {
    invite: resolvedInvite,
    parentVendor: parent as ClaimLandingData['parentVendor'],
    event: {
      event_id: event.event_id as string,
      event_date: (event.event_date as string | null) ?? null,
      couple_display_name:
        ((event.display_name as string | null) ?? '').trim() || 'A Setnayan couple',
    },
    existingVendor: existingVendor
      ? {
          vendor_profile_id: existingVendor.vendor_profile_id as string,
          business_name: existingVendor.business_name as string,
        }
      : null,
  };
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
