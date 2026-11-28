/**
 * /receipts/order/[orderId] — the order slip while the server answers. Sign-in, "not found" and "this order has a
 * receipt now" are decided by `./layout.tsx` before this streams, so a 307 / 404 is never sent as a 200 + skeleton.
 * The back link is always "Billing & receipts" here (ReceiptPage's default), so it shows at once.
 */
import { ReceiptSlipSkeleton } from '../../_components/receipt-loading';

export default function OrderSlipLoading() {
  return <ReceiptSlipSkeleton back="Billing & receipts" />;
}
