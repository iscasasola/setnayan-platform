import type { ReactNode } from 'react';
import { gateOrderSlip } from './gate';

/** Decides sign-in / not found / "go to the receipt" before `loading.tsx` streams — see `./gate.ts`. */
export default async function OrderSlipLayout({ children, params }: { children: ReactNode; params: Promise<{ orderId: string }> }) {
  await gateOrderSlip((await params).orderId);
  return children;
}
