import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPayableByReference } from '@/lib/payable-by-reference';
import { mintedQrImage } from '@/lib/qr-image.server';
import { openAccounts, type ChannelSettings } from '@/lib/payment-channels';
import { PROOF_STAGE, stageHref } from '@/lib/pay-stages';
import type { SettlePay } from '@/app/_components/payment/settle-pay-by';

/**
 * 💸 WHERE TO PAY ONE BOOKING-FEE BILL, READ THE WAY /pay READS IT (owner 13 Nov, "one paying style").
 *
 * The figure is `fetchPayableByReference(...).amountPhp` — /pay's own read, so the code in the settle sheet and the
 * code on /pay carry the same digits (never a second money rule). Every OPEN receiving account, in the admin's order
 * (`openAccounts`), gets its amount-carrying code painted HERE on the server (`mintedQrImage`), exactly as /pay and
 * the Papic order page do. Null when the bill cannot be read — the caller then keeps its shipped door to the pay page,
 * never a sheet with nothing in it.
 */
export async function readSettlePay(
  supabase: SupabaseClient,
  settings: ChannelSettings,
  referenceCode: string | null | undefined,
  viewerUserId: string,
): Promise<SettlePay | null> {
  if (!referenceCode) return null;
  const payable = await fetchPayableByReference(supabase, referenceCode, viewerUserId).catch(() => null);
  if (!payable) return null;
  const open = openAccounts(settings);
  const images = await Promise.all(open.map((a) => mintedQrImage(a.qrPayload, payable.amountPhp)));
  return {
    referenceCode: payable.reference,
    amountPhp: payable.amountPhp,
    rails: open.map((a, i) => ({
      id: a.id,
      label: a.label,
      kind: a.kind,
      name: a.accountName,
      number: a.number,
      staticUrl: a.qrUrl,
      mintedUrl: images[i]?.dataUrl ?? null,
    })),
    receiptHref: stageHref(payable.reference, PROOF_STAGE),
  };
}
