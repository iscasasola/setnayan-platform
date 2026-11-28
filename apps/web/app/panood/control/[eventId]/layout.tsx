import type { ReactNode } from 'react';
import { ControlRoomUnreadable, gateControlRoom } from './gate';

/** Decides the flag / sign-in / "not your event" / host / app-ownership answers before `loading.tsx` streams — see `./gate.tsx`. */
export default async function ControlRoomLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  const gate = await gateControlRoom((await params).eventId);
  if (gate.refused) return <ControlRoomUnreadable />;
  return children;
}
