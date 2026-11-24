import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { cleanInviteSlug } from '@/lib/supplier-invite';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { fetchShopTrust, TRUSTED_BY_UNREADABLE } from '@/lib/vendor-trusted-by';

/**
 * 🤝 INVITE A SUPPLIER — the reads and the one sign-up write (owner 16 Nov 2026, "Invite a supplier v3 APPROVED").
 * Words and shapes are `supplier-invite.ts`.
 */

/** The shop a link belongs to: its id and name. `null` = no named shop at that address. `'unreadable'` = refused. */
export async function readInviter(
  client: SupabaseClient,
  rawSlug: unknown,
): Promise<{ vendorProfileId: string; businessName: string; slug: string; logoRef: string | null; mainService: string | null } | null | 'unreadable'> {
  const slug = cleanInviteSlug(rawSlug);
  if (!slug) return null;
  const { data, error } = await client
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug, logo_url, services')
    .eq('business_slug', slug)
    .maybeSingle();
  if (error) {
    logQueryError('readInviter', error, { slug }, 'graceful_degrade');
    return 'unreadable';
  }
  const row = data as { vendor_profile_id: string; business_name: string | null; business_slug: string; logo_url: string | null; services: string[] | null } | null;
  const name = row?.business_name?.trim();
  if (!row || !name) return null;
  // PC7 (owner 20 Nov): the door names the inviter's main service ("Lia Events · Coordination") — the first of `services`.
  const mainService = (row.services ?? []).find((s) => typeof s === 'string' && s.trim()) ?? null;
  return { vendorProfileId: row.vendor_profile_id, businessName: name, slug: row.business_slug, logoRef: row.logo_url ?? null, mainService };
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
  if (out === 'joined') revalidateShopPage(inviter.vendorProfileId, inviter.slug);
  return out === 'joined' || out === 'already' || out === 'self' || out === 'no_shop' ? out : 'failed';
}

/**
 * The Invites count: shops CREATED through this shop's link (`brought_new_shop`), still partners, and how many of them
 * COUNT — from the ONE trust reader (`fetchShopTrust`, owner 21 Nov 2026: "Their counts must use the same qualified-trust
 * reader, so a badge, Trusted by and search never disagree"): a new shop counts once it is verified and has its first
 * completed, paid booking through Setnayan. `null` = a read failed: say so, never "0".
 */
export async function readInvitesCount(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<{ counted: number; joined: number } | null> {
  const ties = await fetchShopTrust(admin, [vendorProfileId]);
  if (ties === TRUSTED_BY_UNREADABLE) return null;
  const brought = ties.filter((t) => t.vendorProfileId === vendorProfileId && t.broughtNewShop);
  return { counted: brought.filter((t) => t.counts).length, joined: brought.length };
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
