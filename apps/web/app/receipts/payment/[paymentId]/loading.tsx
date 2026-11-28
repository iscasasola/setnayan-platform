/**
 * /receipts/payment/[paymentId] — the supplier-payment receipt while the server answers. Sign-in and every "not found"
 * are decided by `./layout.tsx` before this streams. The back link names the shop, which is not known here, so grey.
 */
import { ReceiptSlipSkeleton } from '../../_components/receipt-loading';
import { PAYMENT_RECEIPT_KIND } from '@/lib/payment-receipt-slip';

export default function PaymentReceiptLoading() {
  return <ReceiptSlipSkeleton kind={PAYMENT_RECEIPT_KIND} />;
}
