'use client';

import { deviceStore, goLiveKind, type GoLiveKind } from '@/lib/signature-moments';
import { useMoment } from './use-moment';

/**
 * ③ GO LIVE (motion standard § 9; prototype Part I "Go live") — the Event Hub's lights come on when it is published:
 * the preview lifts, a warm glow rises, a "Live" chip lands. ON FIRST PUBLISH (once per event on this device); a
 * re-publish shows only the chip. Reduced motion: the chip appears; no lift, no glow.
 *
 * Mount it when Apply has answered "live" — it plays as it mounts, so key it on the answer.
 */
export function GoLive({ eventId, name, line }: { eventId: string; name: string; line?: string | null }) {
  const kind = useMoment<GoLiveKind>(() => goLiveKind(deviceStore('local'), eventId));
  return <GoLiveStage kind={kind ?? 'chip'} play={kind !== null} name={name} line={line} />;
}

export function GoLiveStage({ kind, play, name, line }: { kind: GoLiveKind; play: boolean; name: string; line?: string | null }) {
  return (
    <div className="sn-sig sn-sig-stage sn-sig-live" data-sig="live" data-sig-kind={kind} data-sig-play={play ? '' : undefined} role="status" aria-label={`${name} is live`}>
      <div className="sn-sig-live-card" aria-hidden>
        <i className="sn-sig-live-glow" />
        <span>
          {name}
          {line ? <small>{line}</small> : null}
        </span>
        <i className="sn-sig-live-dim" />
      </div>
      <span className="sn-sig-live-chip" aria-hidden>● Live</span>
    </div>
  );
}
