'use client';

import type { ReactNode } from 'react';
import { formatCount } from '@/lib/format-number';
import { dayTurns, deviceStore } from '@/lib/signature-moments';
import { useMoment } from './use-moment';

/**
 * ⑤ DAY TURNS (motion standard § 9; prototype Part I "Day turns") — the countdown number turns over like a desk
 * calendar, the first time the couple opens their event on a new day. ONCE A DAY AT MOST. Reduced motion: the number
 * changes at once.
 *
 * It wraps the event card's own countdown figure (`children`, the shipped `Count`): on any other open it renders
 * exactly that and nothing else.
 */
export function DayTurns({ eventId, days, children }: { eventId: string; days: number | null; children: ReactNode }) {
  const turn = useMoment(() => dayTurns(deviceStore('local'), eventId, days, new Date()));
  if (!turn || days === null) return <>{children}</>;
  return <DayStage play from={turn.from} to={days} />;
}

export function DayStage({ play, from, to }: { play: boolean; from: number; to: number }) {
  return (
    <span className="sn-sig sn-sig-day" data-sig="day" data-sig-play={play ? '' : undefined}>
      <span className="sn-sig-day-old" aria-hidden>{formatCount(from)}</span>
      <span className="sn-sig-day-new">{formatCount(to)}</span>
    </span>
  );
}
