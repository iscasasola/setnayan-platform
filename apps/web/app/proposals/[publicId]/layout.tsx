import type { ReactNode } from 'react';
import { ProposalUnreadable, gateProposal } from './gate';

/** Decides sign-in / "not yours" before `loading.tsx` streams — see `./gate.tsx`. */
export default async function ProposalLayout({ children, params }: { children: ReactNode; params: Promise<{ publicId: string }> }) {
  const gate = await gateProposal((await params).publicId);
  if (gate.refused) return <ProposalUnreadable />;
  return children;
}
