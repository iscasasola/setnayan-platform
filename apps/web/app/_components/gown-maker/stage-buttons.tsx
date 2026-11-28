'use client';

/**
 * 👗 The preview's own buttons (prototype v206 `holdTap`, the Pose, Twirl and Turn buttons on the stage). Each one taps
 * for its quick action and, held, opens its list:
 *
 * - Pose: a tap steps to the next pose (or, while she walks, stops her); held: every pose and movement.
 * - Twirl: a tap twirls in the chosen style; held: the style.
 * - Turn: a tap starts or stops the auto-turn; held: its speed and style.
 *
 * House pieces only: `ActionButton`, `Sheet`, `PickMenu`. The stage does the moving; this only says what she asked for.
 */
import { useId, useRef, useState, type ReactNode } from 'react';
import { PersonStanding, Rotate3d, RotateCw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { GOWN_HOLD_MS, GOWN_STANCES, type GownPoseName } from '@/lib/gown/motion/poses';
import { GOWN_MOVES, type GownMotionKind } from '@/lib/gown/motion/walks';
import { GOWN_TURN_SPEEDS, GOWN_TURN_STYLES, GOWN_TWIRL_STYLES, type GownTurnStyle, type GownTwirlStyle } from '@/lib/gown/motion/turn';

export type GownStageButtonsProps = {
  pose: GownPoseName;
  motion: GownMotionKind | 'stop';
  onPose: (pose: GownPoseName) => void;
  onMotion: (motion: GownMotionKind | 'stop') => void;
  twirlStyle: GownTwirlStyle;
  onTwirlStyle: (style: GownTwirlStyle) => void;
  onTwirl: () => void;
  autoTurn: { speed: number; style: GownTurnStyle };
  onAutoTurn: (t: { speed: number; style: GownTurnStyle }) => void;
};

type Open = 'pose' | 'twirl' | 'turn' | null;

/** A press held for `GOWN_HOLD_MS` opens the list; a shorter one is a tap. A hold is never also a tap. */
function HoldTap({ onTap, onHold, children }: { onTap: () => void; onHold: () => void; children: (tap: () => void) => ReactNode }) {
  const timer = useRef(0), held = useRef(false);
  const clear = () => window.clearTimeout(timer.current);
  return (
    <span
      onPointerDown={() => { held.current = false; clear(); timer.current = window.setTimeout(() => { held.current = true; onHold(); }, GOWN_HOLD_MS); }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children(() => { if (held.current) { held.current = false; return; } onTap(); })}
    </span>
  );
}

export function GownStageButtons(p: GownStageButtonsProps) {
  const [open, setOpen] = useState<Open>(null);
  const titleId = useId();
  const moving = p.motion !== 'stop';
  const nextPose = () => {
    if (moving) { p.onMotion('stop'); return; }
    const i = GOWN_STANCES.findIndex((x) => x.id === p.pose);
    p.onPose(GOWN_STANCES[(i + 1) % GOWN_STANCES.length]!.id);
  };
  const toggleTurn = () => p.onAutoTurn({ speed: p.autoTurn.speed > 0 ? 0 : GOWN_TURN_SPEEDS[1].id, style: p.autoTurn.style });
  const title = open === 'pose' ? 'Pose and motion' : open === 'twirl' ? 'Twirl styles' : 'Turn';
  return (
    <div className="flex flex-wrap gap-2" data-gown-stage-buttons>
      <HoldTap onTap={nextPose} onHold={() => setOpen('pose')}>
        {(tap) => <ActionButton tone="neutral" icon={PersonStanding} label={moving ? 'Still' : 'Pose'} onClick={tap} caret aria-expanded={open === 'pose'} data-gown-pose={p.pose} />}
      </HoldTap>
      <HoldTap onTap={p.onTwirl} onHold={() => setOpen('twirl')}>
        {(tap) => <ActionButton tone="neutral" icon={RotateCw} label="Twirl" onClick={tap} caret aria-expanded={open === 'twirl'} />}
      </HoldTap>
      <HoldTap onTap={toggleTurn} onHold={() => setOpen('turn')}>
        {(tap) => <ActionButton tone="neutral" icon={Rotate3d} label="Turn" onClick={tap} caret aria-pressed={p.autoTurn.speed > 0} aria-expanded={open === 'turn'} />}
      </HoldTap>
      <Sheet open={open !== null} onClose={() => setOpen(null)} labelledById={titleId} rise>
        <div className="grid gap-3 p-4">
          <h3 id={titleId} className="text-sn-17">{title}</h3>
          {open === 'pose' ? (
            <>
              <PickMenu label="Stance" value={p.pose} options={GOWN_STANCES.map((x) => ({ key: x.id, label: x.label }))} onPick={(v) => { p.onMotion('stop'); p.onPose(v as GownPoseName); setOpen(null); }} dataAttr="data-gown-pick-stance" className="w-full !min-h-11" />
              <PickMenu label="Movement" value={p.motion} options={GOWN_MOVES.map((x) => ({ key: x.id, label: x.label }))} onPick={(v) => { p.onMotion(v as GownMotionKind | 'stop'); setOpen(null); }} dataAttr="data-gown-pick-move" className="w-full !min-h-11" />
            </>
          ) : open === 'twirl' ? (
            <PickMenu label="Twirl style" value={p.twirlStyle} options={GOWN_TWIRL_STYLES.map((x) => ({ key: x.id, label: x.label }))} onPick={(v) => { p.onTwirlStyle(v as GownTwirlStyle); setOpen(null); p.onTwirl(); }} dataAttr="data-gown-pick-twirl" className="w-full !min-h-11" />
          ) : open === 'turn' ? (
            <>
              <PickMenu label="Turn speed" value={String(p.autoTurn.speed)} options={GOWN_TURN_SPEEDS.map((x) => ({ key: String(x.id), label: x.label }))} onPick={(v) => p.onAutoTurn({ speed: Number(v), style: p.autoTurn.style })} dataAttr="data-gown-pick-turn" className="w-full !min-h-11" />
              <PickMenu label="Turn style" value={p.autoTurn.style} options={GOWN_TURN_STYLES.map((x) => ({ key: x.id, label: x.label }))} onPick={(v) => p.onAutoTurn({ speed: p.autoTurn.speed || GOWN_TURN_SPEEDS[1].id, style: v as GownTurnStyle })} dataAttr="data-gown-pick-turn-style" className="w-full !min-h-11" />
            </>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
