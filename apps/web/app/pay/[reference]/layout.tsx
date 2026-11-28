import type { ReactNode } from 'react';
import { gatePayPage } from './gate';

/** Decides sign-in / sign-up / "not yours" / the store shell's refusal before `loading.tsx` streams — see `./gate.ts`. */
export default async function PayLayout({ children, params }: { children: ReactNode; params: Promise<{ reference: string }> }) {
  await gatePayPage((await params).reference);
  return children;
}
