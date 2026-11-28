import type { ReactNode } from 'react';
import { PapicOrderUnreadable, gatePapicOrder } from './gate';

/** Decides the order link's 404s before `loading.tsx` streams — see `./gate.tsx`. */
export default async function PapicOrderLayout({ children, params }: { children: ReactNode; params: Promise<{ token: string }> }) {
  const gate = await gatePapicOrder((await params).token);
  if (gate.refused) return <PapicOrderUnreadable />;
  return children;
}
