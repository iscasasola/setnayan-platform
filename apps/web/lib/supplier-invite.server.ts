import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { cleanInviteSlug } from '@/lib/supplier-invite';

/**
 * 🤝 INVITE A SUPPLIER — the reads and the one sign-up write (owner 16 Nov 2026, "Invite a supplier v3 APPROVED").
 * Words and shapes are `supplier-invite.ts`.
 */

/** The shop a link belongs to: its id and name. `null` = no named shop at that address. `'unreadable'` = refused. */
export async function readInviter(
  client: SupabaseClient,
  rawSlug: unknown,
): Promise<{ vendorProfileId: string; businessName: string; slug: string; logoRef: string | null } | null | 'unreadable'> {
  const slug = cleanInviteSlug(rawSlug);
  if (!slug) return null;
  const { data, error } = await client
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug, logo_url')
    .eq('business_slug', slug)
    .maybeSingle();
  if (error) {
    logQueryError('readInviter', error, { slug }, 'graceful_degrade');
    return 'unreadable';
  }
  const row = data as { vendor_profile_id: string; business_name: string | null; business_slug: string; logo_url: string | null } | null;
  const name = row?.business_name?.trim();
  if (!row || !name) return null;
  return { vendorProfileId: row.vendor_profile_id, businessName: name, slug: row.business_slug, logoRef: row.logo_url ?? null };
}

/**
 * A NEW shop was made through a link — write the handshake and the Invites record (`supplier_invite_join`,
 * service_role only). Best-effort: a refusal is logged and never costs the new supplier their shop.
 */
export async function recordNewShopInvite(
  admin: SupabaseClient,
  rawSlug: unknown,
  newVendorProfileId: string,
): Promise<'joined' | 'already' | 'self' | 'no_shop' | 'failed'> {
  const inviter = await readInviter(admin, rawSlug);
  if (inviter === 'unreadable') return 'failed';
  if (!inviter) return 'no_shop';
  const { data, error } = await admin.rpc('supplier_invite_join', {
    p_inviter: inviter.vendorProfileId,
    p_joiner: newVendorProfileId,
    p_new_shop: true,
  });
  if (error) {
    logQueryError('recordNewShopInvite', error, { inviter: inviter.vendorProfileId, joiner: newVendorProfileId }, 'graceful_degrade');
    return 'failed';
  }
  const out = String(data ?? '');
  return out === 'joined' || out === 'already' || out === 'self' || out === 'no_shop' ? out : 'failed';
}

/**
 * The Invites count: shops CREATED through this shop's link (`brought_new_shop`), still partners, and how many of them
 * have a completed booking — the same vetted test as Completed bookings (`vendor_public_completed_events_stats`).
 * `null` = a read failed: say so, never "0".
 */
export async function readInvitesCount(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<{ counted: number; joined: number } | null> {
  const { data: rows, error } = await admin
    .from('vendor_partnerships')
    .select('recommended_vendor_id')
    .eq('recommending_vendor_id', vendorProfileId)
    .eq('origin', 'invited')
    .eq('brought_new_shop', true)
    .eq('status', 'accepted')
    .eq('is_active', true);
  if (error) {
    logQueryError('readInvitesCount.rows', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const ids = [...new Set((rows ?? []).map((r) => (r as { recommended_vendor_id: string }).recommended_vendor_id))];
  if (ids.length === 0) return { counted: 0, joined: 0 };
  const { data: stats, error: statsError } = await admin
    .from('vendor_public_completed_events_stats')
    .select('vendor_profile_id, public_completed_count')
    .in('vendor_profile_id', ids);
  if (statsError) {
    logQueryError('readInvitesCount.stats', statsError, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const counted = (stats ?? []).filter((s) => Number((s as { public_completed_count: unknown }).public_completed_count ?? 0) > 0).length;
  return { counted, joined: ids.length };
}

/**
 * How many shops joined through this shop's link (new or existing) and are still partners — "N joined through your
 * link". `null` = refused.
 */
export async function readJoinedThroughLink(client: SupabaseClient, vendorProfileId: string): Promise<number | null> {
  const { count, error } = await client
    .from('vendor_partnerships')
    .select('id', { count: 'exact', head: true })
    .eq('recommending_vendor_id', vendorProfileId)
    .eq('origin', 'invited')
    .eq('status', 'accepted')
    .eq('is_active', true);
  if (error) {
    logQueryError('readJoinedThroughLink', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  return count ?? 0;
}
