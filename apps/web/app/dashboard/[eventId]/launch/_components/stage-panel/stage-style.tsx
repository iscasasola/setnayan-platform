'use client';

import type { ReactNode } from 'react';
import { SP_PANE } from '@/lib/maker-stage-room';
import { Phases, QuietBar } from './kit';
import { useStylePhase, type StylePhase } from './store';

/**
 * 🖌 STYLE — the prototype's `stagePanel()` for `S.tool === 'style'`:
 *
 *   [ Look | Background | Arrange ]           one segmented control, full width
 *   Look        the ONE quiet bar ("Edit in Studio › Info · or tap the words ›",
 *               "Edit the E-Gifts · Studio ›", "Change the date in Suppliers ›"),
 *               then the layouts as a carousel of REAL miniatures (`StyleCarousel`)
 *   Background  Background ▾ · the five colours · Gallery ▸ · Upload ◆ (`StageBackground`)
 *   Arrange     On this stage ▾ · Order ‹ › · Alignment ▾ (`StageArrange`)
 *
 * The three bodies are the work area's — built where the scene's canvas and its one
 * draft door live (`editor-shell.tsx`); this only lays them out as the prototype
 * does. A segment with nothing to set is not drawn (a fixed part has no background
 * of its own). The segment is remembered from part to part.
 */
export function StageStyle({ look, background, arrange }: { look: ReactNode; background: ReactNode; arrange: ReactNode }) {
  const [asked, setPhase] = useStylePhase();
  const options = ([
    ['look', 'Look'],
    background ? ['bg', 'Background'] : null,
    arrange ? ['arrange', 'Arrange'] : null,
  ] as const).filter((o): o is Exclude<typeof o, null> => o !== null) as ReadonlyArray<readonly [StylePhase, string]>;
  const phase: StylePhase = options.some(([k]) => k === asked) ? asked : 'look';
  return (
    <div className={SP_PANE} data-stage-style={phase}>
      {/* A part whose Style is its Look alone (a fixed part — no background or arrangement of its own) draws no
          one-segment control: a lone "Look" would say nothing. */}
      {options.length > 1 ? <Phases label="Style" value={phase} options={options} onPick={setPhase} data="style" /> : null}
      {phase === 'look' ? (
        <>
          <QuietBar />
          {look}
        </>
      ) : phase === 'bg' ? (
        background
      ) : (
        arrange
      )}
    </div>
  );
}
