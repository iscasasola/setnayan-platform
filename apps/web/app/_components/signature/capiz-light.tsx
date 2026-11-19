'use client';

import type { CSSProperties } from 'react';
import { capizPlays, deviceStore } from '@/lib/signature-moments';
import { useMoment } from './use-moment';

/** Twelve panes, six by two; the light reaches each one step after the pane to its left (the prototype's own order). */
const PANES = [0, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 6] as const;

/**
 * ⑥ CAPIZ LIGHT (motion standard § 9; prototype Part I "Capiz light") — light crosses a capiz-shell window when a plan
 * unlocks (Plus, Pro or Ultra; couple or supplier). ONCE, when this device first sees the plan on; it draws nothing on
 * every other open. Reduced motion: a still window, no light.
 *
 * `subject` names whose plan it is (`event:<id>` · `shop:<id>`); `plan` is the paid plan now on, or null for none —
 * pass null too, so the unlock that follows is news. `justNow` = the page itself was just told the plan went on.
 */
export function CapizLight({ subject, plan, word, justNow = false }: { subject: string; plan: string | null; word: string; justNow?: boolean }) {
  const play = useMoment(() => (capizPlays(deviceStore('local'), subject, plan, justNow) ? true : null));
  if (!play) return null;
  return <CapizStage play word={word} />;
}

export function CapizStage({ play, word }: { play: boolean; word: string }) {
  return (
    <div className="sn-sig sn-sig-stage sn-sig-capiz" data-sig="capiz" data-sig-play={play ? '' : undefined} role="status" aria-label={word}>
      <div className="sn-sig-capiz-window" aria-hidden>
        {PANES.map((step, i) => (
          <i key={i} className="sn-sig-capiz-pane" style={{ '--sn-sig-i': step } as CSSProperties} />
        ))}
      </div>
      <span className="sn-sig-capiz-word" aria-hidden>{word}</span>
    </div>
  );
}
