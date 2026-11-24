import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchVendorPoolsOrNull } from '@/lib/vendor-schedule';
import { outsideClientPoolOf } from '@/lib/outside-client-pool';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { memberTagOf, parseOfflineQrToken, verifyOfflineQr } from './qr';

/**
 * 🔳 THE CLIENT'S PHONE DOES THE SYNC (owner 24 Nov 2026: "if they create a QR Code for the client. and the client used
 * the QR Code, and the client has internet. it should auto update the suppliers schedule").
 *
 * Called by the SHIPPED invite claim (`app/vendor-invite/[slug]/actions.ts` · `claimVendorInviteToEvent`) when the link
 * carries an offline QR (`oq`), before the shop is added to the client's event:
 *   1 · the code is this shop's, the member tag is the code's member, and the HMAC over every field checks out with THAT
 *       code's own secret — anything edited, or signed by another code, is refused;
 *   2 · `supplier_offline_code_use` makes it ONE entry under the clash rules (a held, full or closed day is refused to
 *       the client too); the supplier's later sync of the same code only fills in the name;
 *   3 · when the supplier's phone already synced it (with its Add-a-client gift), the invite's token comes back so the
 *       claim goes on as that invite — the own-client gift the shipped path gives.
 */

export type OfflineQrClaim =
  | { status: 'applied'; inviteToken: string | null; blockId: string | null }
  | { status: 'held' | 'booked' | 'closed' | 'removed' | 'cancelled' | 'used' | 'invalid' | 'unread' };

/** The invite page's status for each refusal (`STATUS_COPY` there spreads `OFFLINE_QR_STATUS_COPY`). */
export const OFFLINE_QR_STATUS_COPY: Readonly<Record<string, string>> = {
  oc_held: 'Couldn’t save your date: someone on the team is handling it. You can still add this supplier.',
  oc_booked: 'Couldn’t save your date: it was just booked. You can still add this supplier and ask about another date.',
  oc_closed: 'Couldn’t save your date: the supplier closed it. You can still add this supplier.',
  oc_removed: 'Couldn’t save your date: the supplier removed it. You can still add this supplier.',
  oc_cancelled: 'This QR code was cancelled by the supplier. You can still add them.',
  oc_used: 'This QR code was already used for another event. You can still add this supplier.',
  oc_invalid: 'This QR code couldn’t be checked. You can still add this supplier.',
  oc_unread: 'We couldn’t check this QR code just now. Please try again.',
};

export async function claimOfflineQr(
  admin: SupabaseClient,
  input: { token: string; vendorProfileId: string; eventId: string; eventName: string | null },
): Promise<OfflineQrClaim> {
  const parsed = parseOfflineQrToken(input.token);
  if (!parsed) return { status: 'invalid' };
  const { data: code, error } = await admin
    .from('vendor_offline_codes')
    .select('code_id, member_user_id, secret')
    .eq('code_id', parsed.fields.codeId)
    .eq('vendor_profile_id', input.vendorProfileId)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] offline QR claim: code read', error.message);
    return { status: 'unread' };
  }
  const c = code as { code_id: string; member_user_id: string; secret: string } | null;
  if (!c) return { status: 'invalid' };
  if ((await memberTagOf(c.member_user_id)) !== parsed.fields.member) return { status: 'invalid' };
  if (!(await verifyOfflineQr(parsed, c.secret))) return { status: 'invalid' };

  let poolId = parsed.fields.poolId;
  if (!poolId) {
    const pools = await fetchVendorPoolsOrNull(admin, input.vendorProfileId).catch(() => null);
    if (!pools) return { status: 'unread' };
    poolId = outsideClientPoolOf(null, pools);
    if (!poolId) return { status: 'invalid' };
  }

  const { data, error: rpcErr } = await admin.rpc('supplier_offline_code_use', {
    p: {
      code_id: c.code_id,
      via: 'client',
      booked_date: parsed.fields.date,
      client_time: parsed.fields.time ?? '',
      pool_id: poolId,
      phone_time: parsed.fields.phoneTime,
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
  if (a.status === 'cancelled' || a.status === 'used') return { status: a.status };
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
