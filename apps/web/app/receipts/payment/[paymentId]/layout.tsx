import type { ReactNode } from 'react';
import { gatePaymentReceipt } from './gate';

/** Decides sign-in / not found before `loading.tsx` streams — see `./gate.ts`. */
export default async function PaymentReceiptLayout({ children, params }: { children: ReactNode; params: Promise<{ paymentId: string }> }) {
  await gatePaymentReceipt((await params).paymentId);
  return children;
}
