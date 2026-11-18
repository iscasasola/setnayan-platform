/**
 * # The schedule pins' bodies.
 *   · 🗓 SCHEDULES HAND-IN-HAND part (b), rule 3 — owner 2026-11-12: "Answer ›" on the supplier's "Ceremony is now 30
 *     min later than you planned" pin opens its Seen, in place. Loaded only when such a pin stands.
 *   · 🕕 Owner ruling A, 2026-11-16: "Answer ›" on the supplier's "DUE NOW · Set your call time" pin OPENS THAT CONTROL —
 *     their Schedule tab, at the call time (`#own-times`), settable before the hosts build their day. Before this the
 *     pin had no body, so its Answer › did nothing. It clears on the next read once a time is kept (`callTimeIsSet`).
 */
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import type { PinFact } from '@/lib/chat-pins';
import { CALL_TIME_ANCHOR } from '@/lib/supplier-own-times';

const ScheduleSeenBody = dynamic(() => import('./cards/schedule-seen-body').then((m) => m.ScheduleSeenBody));

/** Where the supplier sets their call time: their Schedule tab, at the control. */
export function callTimeHref(eventId: string): string {
  return `/vendor-dashboard/clients/${eventId}?tab=schedule#${CALL_TIME_ANCHOR}`;
}

export function schedulePinBodies(facts: readonly PinFact[], threadId: string, eventId: string | null = null): Record<string, ReactNode> {
  const out: Record<string, ReactNode> = {};
  for (const f of facts) {
    if (f.kind === 'schedule_change') {
      out[f.key] = <ScheduleSeenBody threadId={threadId} postedAtMs={f.sinceMs} />;
      continue;
    }
    if (f.kind === 'call_time' && f.answerer === 'you' && eventId) {
      out[f.key] = (
        <div className="grid gap-2" data-call-time-pin="">
          <p className="text-[14px] text-ink/65">You can set it now, on your Schedule tab — even before they build their day.</p>
          <ActionButton tone="brand" main icon={<CalendarDays aria-hidden strokeWidth={1.9} />} label="Set your call time" href={callTimeHref(eventId)} />
        </div>
      );
    }
  }
  return out;
}
