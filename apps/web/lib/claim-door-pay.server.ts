import 'server-only';

import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchClaimLandingByToken, isCoupleMadeInvite } from '@/lib/vendor-invites';
import { readStoredPayWays } from '@/lib/self-added-pay-ways';
import { budgetPaymentProofPolicy, parseClientRef, vendorPaymentQrPolicy } from '@/lib/r2-client-ref';
import { r2Copy } from '@/lib/r2';

/**
 * 🏦 THE COUPLE'S QR OF A SUPPLIER, MADE THE SUPPLIER'S OWN (claim door, owner 2026-11-13). The couple filed the
 * supplier's QR in the EVENT's private payment folder (`payment-proof/events/<event>/…`); a supplier's own payment QR
 * lives in THEIR folder (`vendor-payment-qr/<shop>/…`, `vendorPaymentQrPolicy`), the only place the shipped
 * `addPaymentMethod` accepts one from. So the picture is COPIED there (same private bucket), and the shipped action —
 * with its own server-side decode and its own moderation gate — takes it from there.
 *
 * The ref is re-read from the couple's record by the claim TOKEN (the access gate) and the way's index; nothing in the
 * post names a file. Returns the new `r2://` ref, or null (no such way, a ref outside the event's own folder, a copy
 * that failed) — the caller then simply saves no QR.
 */
export async function claimPaymentQrToShop(
  token: string,
  index: number,
  vendorProfileId: string,
): Promise<string | null> {
  try {
    // The service role, built HERE (as lib/claim-door.server.ts does): the landing read carries the shop's
    // contact_email/contact_phone, which a session client is refused — see lib/security/shop-contact-is-not-session-readable.test.ts.
    const admin = createAdminClient();
    const landing = await fetchClaimLandingByToken(admin, token);
    const parent = landing?.parentVendor;
    if (!landing || !parent || !isCoupleMadeInvite(landing.invite.source)) return null;
    const { data: row } = await admin.from('event_vendors').select('manual_vendor_id').eq('vendor_id', parent.vendor_id).maybeSingle();
    const card = (row as { manual_vendor_id?: string | null } | null)?.manual_vendor_id;
    if (!card) return null;
    const { data: wayRow, error } = await admin
      .from('event_manual_vendors')
      .select('pay_ways')
      .eq('manual_vendor_id', card)
      .eq('event_id', parent.event_id)
      .maybeSingle();
    if (error) {
      console.warn('[claim-door] the couple\'s pay-ways could not be read, so no QR is copied:', error.message);
      return null;
    }
    const qr = readStoredPayWays((wayRow as { pay_ways?: unknown } | null)?.pay_ways)[index]?.qr ?? null;
    const from = qr ? parseClientRef(qr, budgetPaymentProofPolicy(parent.event_id)) : null;
    if (!from) return null;
    const ext = (from.key.match(/\.(png|jpe?g|webp)$/i)?.[1] ?? 'png').toLowerCase();
    const policy = vendorPaymentQrPolicy(vendorProfileId);
    const toKey = `${policy.prefixes[0]}claimed-${randomUUID()}.${ext}`;
    await r2Copy({ bucket: from.bucket, fromKey: from.key, toKey });
    const ref = `r2://${from.bucket}/${toKey}`;
    return parseClientRef(ref, policy) ? ref : null;
  } catch (e) {
    console.warn('[claim-door] the QR was not copied to the shop:', e instanceof Error ? e.message : String(e));
    return null;
  }
}
