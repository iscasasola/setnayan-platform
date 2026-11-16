import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SHORTLIST_QR_SOURCE } from '@/lib/booking-fee-gate';
import { clientInviteTokenOf, ownLinkGiftLineOf, type ImportFacts, type OwnGiftLine } from '@/lib/own-clients';

/**
 * 🎁 OWN CLIENTS — the I/O half of `lib/own-clients.ts`. Every read binds its `error`; a failure is said as a failure,
 * never as "none" (the 20 Aug disease). The ONE write that moves stock is `own_client_gift_give` (service role).
 */

export type OwnGiftGiveResult =
  | { status: 'given' | 'already'; facts: ImportFacts }
  | { status: 'short' | 'error' };

/**
 * Give one own-client gift into the couple's event — exactly once per (shop, event), from BOUGHT stock only.
 * `admin` MUST be the service-role client: the function is granted to it alone; the caller has already decided that
 * this couple joined through this shop's own invite or link.
 */
export async function giveOwnClientGift(
  admin: SupabaseClient,
  input: {
    vendorProfileId: string;
    eventId: string;
    via: 'invite' | 'own_link';
    inviteId: string | null;
    lines: readonly OwnGiftLine[];
    /** The joining client — the door measures whether the invite created their account. */
    userId?: string | null;
  },
): Promise<OwnGiftGiveResult> {
  const { data, error } = await admin.rpc('own_client_gift_give', {
    p_vendor_profile_id: input.vendorProfileId,
    p_event_id: input.eventId,
    p_via: input.via,
    p_invite_id: input.inviteId,
    p_lines: input.lines,
    p_user_id: input.userId ?? null,
  });
  if (error) {
    console.error('[supabase-error] own-clients: own_client_gift_give', error);
    return { status: 'error' };
  }
  const d = (data ?? {}) as { status?: string; account_new?: unknown; event_new?: unknown; first_import?: unknown };
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : null);
  const facts: ImportFacts = { accountNew: bool(d.account_new), eventNew: bool(d.event_new), firstImport: d.first_import === true };
  if (d.status === 'ok') return { status: 'given', facts };
  if (d.status === 'already') return { status: 'already', facts };
  if (d.status === 'short') return { status: 'short' };
  console.error('[own-clients] own_client_gift_give refused', data);
  return { status: 'error' };
}

/** The gift set on the shop's own link. `null` = not set; `'unread'` = could not be read (said, never "not set"). */
export async function fetchOwnLinkGift(client: SupabaseClient, vendorProfileId: string): Promise<OwnGiftLine | null | 'unread'> {
  const { data, error } = await client
    .from('vendor_own_link_gifts')
    .select('service_code, title, gift_kind, credits')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] own-clients: vendor_own_link_gifts', error);
    return 'unread';
  }
  return ownLinkGiftLineOf(data as Record<string, unknown> | null);
}

/**
 * 🔗 A couple's FIRST ask through the shop's own link (`?src=own`): give the link's gift. Answers whether the couple is
 * now the shop's own client — `true` only when a gift was given now or already (v4 stock-first answer 2: with no gift
 * set, or too little stock, the link still works but the couple is not yet an own client). Fails CLOSED to "not own":
 * an error never makes a fee-free client without a gift.
 */
export async function ownLinkArrivalIsOwnClient(admin: SupabaseClient, vendorProfileId: string, eventId: string): Promise<boolean> {
  // 🪪 "UNVERIFIED SHOPS DO GET THE QR" (owner 2026-11-16): an unverified shop's link still works, but every booking pays
  // the flat 5% — never an own client. A refused read fails closed the same way.
  const { data: shopRow, error: shopErr } = await admin
    .from('vendor_profiles')
    .select('verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (shopErr) {
    console.error('[supabase-error] own-clients: own-link shop verification read', shopErr);
    return false;
  }
  if ((shopRow as { verification_state?: string } | null)?.verification_state !== 'verified') return false;
  const gift = await fetchOwnLinkGift(admin, vendorProfileId);
  if (gift === 'unread' || gift === null) {
    // A gift this event already got from this shop (an Add-a-client invite) still makes them an own client.
    const { data, error } = await admin
      .from('own_client_gifts')
      .select('own_gift_id')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) console.error('[supabase-error] own-clients: own_client_gifts', error);
    return !error && Boolean(data);
  }
  const res = await giveOwnClientGift(admin, { vendorProfileId, eventId, via: 'own_link', inviteId: null, lines: [gift] });
  // ⚠ The own link has no invite to measure "new account / new event" against, so its facts are recorded as unknown
  // and the fee logic decides from them (2026-11-16 ruling). Here it keeps the shipped own-link stamp once a gift is given.
  return res.status === 'given' || res.status === 'already';
}

export type ClientInviteRow = {
  inviteId: string;
  vendorProfileId: string;
  clientName: string;
  status: 'waiting' | 'joined' | 'void';
  lines: OwnGiftLine[];
};

/** An Add-a-client invite by its token, for the shop it belongs to. `null` = no such waiting/joined invite; `'unread'` = refused. */
export async function fetchClientInvite(
  admin: SupabaseClient,
  rawToken: unknown,
  vendorProfileId: string,
): Promise<ClientInviteRow | null | 'unread'> {
  const token = clientInviteTokenOf(rawToken);
  if (!token) return null;
  const { data, error } = await admin
    .from('vendor_client_invites')
    .select('invite_id, vendor_profile_id, client_name, status, gift_lines')
    .eq('token', token)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] own-clients: vendor_client_invites', error);
    return 'unread';
  }
  if (!data) return null;
  const r = data as { invite_id: string; vendor_profile_id: string; client_name: string; status: ClientInviteRow['status']; gift_lines: unknown };
  const lines = (Array.isArray(r.gift_lines) ? r.gift_lines : [])
    .map((l) => ownLinkGiftLineOf({ ...(l as Record<string, unknown>), gift_kind: (l as { kind?: unknown })?.kind }))
    .filter((l): l is OwnGiftLine => l !== null);
  return { inviteId: r.invite_id, vendorProfileId: r.vendor_profile_id, clientName: r.client_name, status: r.status, lines };
}

/**
 * 🎁 An Add-a-client invite whose gift was GIVEN: the row it just made is the shop's OWN client — `vendor_invite`, one of
 * `SUPPLIER_BROUGHT_SOURCES` (no booking fee). Only a row the Shortlist door made a moment ago is moved, never a save
 * from Find. A refused write leaves the row a Setnayan save — the safe direction (a fee, never a free client).
 */
export async function markOwnClientRow(admin: SupabaseClient, eventVendorId: string): Promise<boolean> {
  const { error } = await admin
    .from('event_vendors')
    .update({ source: 'vendor_invite' })
    .eq('vendor_id', eventVendorId)
    .eq('source', SHORTLIST_QR_SOURCE);
  if (error) console.error('[supabase-error] own-clients: mark own client', error);
  return !error;
}
