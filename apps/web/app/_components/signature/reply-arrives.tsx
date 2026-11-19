'use client';

import type { ReactNode } from 'react';
import { formatCount } from '@/lib/format-number';
import { deviceStore, replyArrives } from '@/lib/signature-moments';
import { useMoment } from './use-moment';

/**
 * ④ REPLY ARRIVES (motion standard § 9; prototype Part I "Reply arrives") — an envelope opens and the Going count ticks
 * up, when new "coming" replies came in since the couple last looked. ONCE PER VISIT, however many came. Reduced
 * motion: the count changes at once; the envelope stays shut.
 *
 * It wraps the Guests card's own figure (`children`, the shipped `Count`): with no news it renders exactly that and
 * nothing else.
 */
export function ReplyArrives({ eventId, coming, children }: { eventId: string; coming: number; children: ReactNode }) {
  const news = useMoment(() => replyArrives(deviceStore('local'), deviceStore('session'), eventId, coming));
  if (!news) return <>{children}</>;
  return <ReplyStage play from={news.from} to={coming} />;
}

export function ReplyStage({ play, from, to }: { play: boolean; from: number; to: number }) {
  return (
    <span className="sn-sig sn-sig-reply" data-sig="reply" data-sig-play={play ? '' : undefined}>
      <span className="sn-sig-reply-env" aria-hidden>
        <i className="sn-sig-reply-note" />
        <i className="sn-sig-reply-flap" />
      </span>
      <span className="sn-sig-reply-tick">
        <span className="sn-sig-reply-old" aria-hidden>{formatCount(from)}</span>
        <span className="sn-sig-reply-new">{formatCount(to)}</span>
      </span>
    </span>
  );
}
