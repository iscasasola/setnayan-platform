import type { ReactNode } from 'react';
import { gateVendorFit } from './gate';

/** Decides "no such shop" before `loading.tsx` streams — see `./gate.ts`. */
export default async function VendorFitLayout({ children, params }: { children: ReactNode; params: Promise<{ ref: string }> }) {
  await gateVendorFit((await params).ref);
  return children;
}
