import type { ReactNode } from 'react';
import { gateProgramOutput } from './gate';

/** Decides sign-in / "no such event" / membership before `loading.tsx` streams — see `./gate.ts`. */
export default async function ProgramOutputLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  await gateProgramOutput((await params).eventId);
  return children;
}
