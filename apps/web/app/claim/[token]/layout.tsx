import type { ReactNode } from 'react';
import { gateClaimDoor } from './gate';

/** Decides "switched off" before `loading.tsx` streams — see `./gate.ts`. */
export default function ClaimAlagaLayout({ children }: { children: ReactNode }) {
  gateClaimDoor();
  return children;
}
