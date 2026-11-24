import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchVendorPoolsOrNull } from '@/lib/vendor-schedule';
import { outsideClientPoolOf } from '@/lib/outside-client-pool';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { memberTagOf, parseOfflineQrToken, type OfflineQrFields } from './qr';
import { verifyOfflineQrSignature } from './qr.server';

/**
 * 🔳 THE CLIENT'S PHONE DOES THE SYNC (owner 24 Nov 2026: "if they create a QR Code for the client. and the client used
 * the QR Code, and the client has internet. it should auto update the suppliers schedule"; no stock — DECISION_LOG
 * 7d618cb3).
 *
 * `checkOfflineQr` is THE check, for both arrivals (the client's scan here, the supplier's own sync in
 * `engine.server.ts`): the QR names THIS shop; its phone is one of this shop's, ACTIVE (not stopped); the member tag is
 * that phone's member; and the ECDSA signature over every field checks out against that phone's public key
 * (node:crypto, `qr.server.ts`). Anything edited, signed by another phone or shop, or from a stopped phone is refused.
 *
 * `claimOfflineQr` (called by the SHIPPED invite claim, `app/vendor-invite/[slug]/actions.ts`, before the shop is added
 * to the client's event) then lets `supplier_offline_code_use` take the code id once and make ONE entry under the clash
 * rules; the supplier's later sync of the same code only fills in the name. When the supplier's phone already synced
 * its Add-a-client invite for this code, the invite's token comes back so the claim goes on as that invite.
 */

export type OfflineQrCheck =
  | { status: 'ok'; fields: OfflineQrFields; memberUserId: string }
  | { status: 'invalid' | 'stopped' | 'unread' };

export async function checkOfflineQr(admin: SupabaseClient, token: unknown, vendorProfileId: string): Promise<OfflineQrCheck> {
  const parsed = parseOfflineQrToken(token);
  if (!parsed) return { status: 'invalid' };
  // A phone of another shop can never sign for this shop.
  if (parsed.fields.shop !== vendorProfileId) return { status: 'invalid' };
  const { data, error } = await admin
    .from('vendor_offline_devices')
    .select('vendor_profile_id, member_user_id, public_key, status')
    .eq('device_id', parsed.fields.deviceId)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] offline QR: device read', error.message);
    return { status: 'unread' };
  }
  const device = data as { vendor_profile_id: string; member_user_id: string; public_key: unknown; status: string } | null;
  if (!device || device.vendor_profile_id !== vendorProfileId) return { status: 'invalid' };
  if (device.status !== 'active') return { status: 'stopped' };
  if ((await memberTagOf(device.member_user_id)) !== parsed.fields.member) return { status: 'invalid' };
  if (!verifyOfflineQrSignature(parsed, device.public_key)) return { status: 'invalid' };
  return { status: 'ok', fields: parsed.fields, memberUserId: device.member_user_id };
}

export type OfflineQrClaim =
  | { status: 'applied'; inviteToken: string | null; blockId: string | null }
  | { status: 'held' | 'booked' | 'closed' | 'removed' | 'stopped' | 'used' | 'invalid' | 'unread' };

/** The invite page's status for each refusal (`STATUS_COPY` there spreads `OFFLINE_QR_STATUS_COPY`). */
export const OFFLINE_QR_STATUS_COPY: Readonly<Record<string, string>> = {
  oc_held: 'Couldn’t save your date: someone on the team is handling it. You can still add this supplier.',
  oc_booked: 'Couldn’t save your date: it was just booked. You can still add this supplier and ask about another date.',
  oc_closed: 'Couldn’t save your date: the supplier closed it. You can still add this supplier.',
  oc_removed: 'Couldn’t save your date: the supplier removed it. You can still add this supplier.',
  oc_stopped: 'This QR code was stopped by the supplier. You can still add them, or ask them for a new one.',
  oc_used: 'This QR code was already used for another event. You can still add this supplier.',
  oc_invalid: 'This QR code couldn’t be checked. You can still add this supplier.',
  oc_unread: 'We couldn’t check this QR code just now. Please try again.',
};

export async function claimOfflineQr(
  admin: SupabaseClient,
  input: { token: string; vendorProfileId: string; eventId: string; eventName: string | null },
): Promise<OfflineQrClaim> {
  const qr = await checkOfflineQr(admin, input.token, input.vendorProfileId);
  if (qr.status !== 'ok') return { status: qr.status };
  const f = qr.fields;

  let poolId = f.poolId;
  if (!poolId) {
    const pools = await fetchVendorPoolsOrNull(admin, input.vendorProfileId).catch(() => null);
    if (!pools) return { status: 'unread' };
    poolId = outsideClientPoolOf(null, pools);
    if (!poolId) return { status: 'invalid' };
  }

  const { data, error: rpcErr } = await admin.rpc('supplier_offline_code_use', {
    p: {
      code_id: f.codeId,
      device_id: f.deviceId,
      via: 'client',
      booked_date: f.date,
      client_time: f.time ?? '',
      pool_id: poolId,
      amount_php: f.amountPhp ?? '',
      phone_time: f.phoneTime,
      event_id: input.eventId,
      label: input.eventName ?? '',
    },
  });
  if (rpcErr) {
    console.error('[supabase-error] offline QR claim: supplier_offline_code_use', rpcErr.message);
    return { status: 'unread' };
  }
  const a = (data ?? {}) as { status?: string; why?: string; block_id?: string | null; invite_id?: string | null };
  if (a.status === 'clash') {
    const why = a.why === 'held' || a.why === 'booked' || a.why === 'closed' || a.why === 'removed' ? a.why : 'booked';
    return { status: why };
  }
  if (a.status === 'stopped' || a.status === 'used') return { status: a.status };
  if (a.status !== 'applied') return { status: 'invalid' };
  revalidateShopPage(input.vendorProfileId);

  // The supplier's phone synced first, with its Add-a-client invite: the claim goes on as THAT invite.
  let inviteToken: string | null = null;
  if (a.invite_id) {
    const { data: inv, error: invErr } = await admin.from('vendor_client_invites').select('token').eq('invite_id', a.invite_id).maybeSingle();
    if (invErr) console.error('[supabase-error] offline QR claim: invite token', invErr.message);
    inviteToken = (inv as { token?: string } | null)?.token ?? null;
  }
  return { status: 'applied', inviteToken, blockId: a.block_id ?? null };
}
