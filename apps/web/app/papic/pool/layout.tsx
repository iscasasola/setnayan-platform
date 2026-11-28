import type { ReactNode } from 'react';
import { gatePapicPool } from './gate';

/** Decides the pool's 404s before `loading.tsx` streams — see `./gate.ts`. */
export default async function PapicPoolLayout({ children }: { children: ReactNode }) {
  await gatePapicPool();
  return children;
}
