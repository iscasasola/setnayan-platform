import type { ReactNode } from 'react';
import { gateGenericOnboarding } from './gate';

/** Decides the flag / type / vendor-free hand-off before `loading.tsx` streams — see `./gate.ts`. */
export default async function GenericOnboardingLayout({ children, params }: { children: ReactNode; params: Promise<{ type: string }> }) {
  await gateGenericOnboarding((await params).type);
  return children;
}
