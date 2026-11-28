import type { ReactNode } from 'react';
import { gateGroupChat } from './gate';

/** Decides sign-in / "no such group" before `loading.tsx` streams — see `./gate.ts`. */
export default async function GroupChatLayout({ children, params }: { children: ReactNode; params: Promise<{ threadId: string }> }) {
  await gateGroupChat((await params).threadId);
  return children;
}
