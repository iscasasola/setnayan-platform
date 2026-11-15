/**
 * # The schedule pin's body (SCHEDULES HAND-IN-HAND part (b), rule 3 — owner 2026-11-12): "Answer ›" on the supplier's
 * "Ceremony is now 30 min later than you planned" pin opens its Seen, in place. Loaded only when such a pin stands.
 */
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import type { PinFact } from '@/lib/chat-pins';

const ScheduleSeenBody = dynamic(() => import('./cards/schedule-seen-body').then((m) => m.ScheduleSeenBody));

export function schedulePinBodies(facts: readonly PinFact[], threadId: string): Record<string, ReactNode> {
  const out: Record<string, ReactNode> = {};
  for (const f of facts) {
    if (f.kind !== 'schedule_change') continue;
    out[f.key] = <ScheduleSeenBody threadId={threadId} postedAtMs={f.sinceMs} />;
  }
  return out;
}
