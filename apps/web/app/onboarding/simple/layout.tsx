import type { ReactNode } from 'react';
import { gateSimpleOnboarding } from './gate';

/** Decides sign-in / "type not live" before `loading.tsx` streams — see `./gate.ts`. */
export default async function SimpleOnboardingLayout({ children }: { children: ReactNode }) {
  await gateSimpleOnboarding();
  return children;
}
