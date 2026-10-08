'use client';

import type { ReactNode } from 'react';
import { motionArrow, motionDirName, withMotionFx, type MotionDir, type MotionFx } from '@/lib/motion-effects';
import { SP_DIR, SP_PANE, SP_ROW, SP_ROW_LABEL } from '@/lib/maker-stage-room';
import type { PickOption } from '../../../website/editor/_components/pick-menu-types';
import { About, Dd, Dir, PanelSwitch, Phases } from './kit';
import { useAnimatePhase, type AnimatePhase } from './store';

/**
 * ✨ ANIMATE — the prototype's ONE column (`S.tool === 'animate'`, owner 2026-10-06
 * "Animate — ONE column: full-width phases, then a switch per effect"):
 *
 *   [ Build in | Action | Build out ]
 *   ◆ HOW IT MOVES  Auto ▾                         the scene's preset (a part: its own, or the scene's)
 *   Build in   Fade ⬤ · Blur ⬤ · Move ⬤ ← → ↓ ↑ · Size ⬤ Grow | Shrink
 *              ROWS  All at once ▾                 a scene of rows (owner 2026-10-07 "put it in build in")
 *              SPEED ▾ · DELAY ▾                   a part's (shipped)
 *   Action     DOES  Still ▾ · TIMING  Plays once ▾
 *   Build out  the four switches again, the way it leaves
 *   ◆ INTO THE NEXT SCENE  Scroll ▾                a scene's
 *
 * Every switch writes the SHIPPED four-effect vocabulary (`lib/motion-effects.ts`
 * `withMotionFx` — a part's `motion.in/out`, a scene's `inFx/outFx`), through the
 * shipped saves the caller hands in. "Does" offers the SHIPPED words only (a part:
 * Still · Drift; a scene: Still · Slow lift) — the prototype's Float / Pulse /
 * Shimmer do not exist and are never invented.
 */

export type AnimateDd = { value: string; options: readonly PickOption[]; onPick: (k: string) => void; buttonText?: string; note?: string } | null;
/** A time row (prototype `sl('dur'|'delay')`): 0–2 s, step 0.1 — it settles on the shipped value nearest the thumb. */
export type AnimateTime = { value: number; steps: readonly number[]; onPick: (seconds: number) => void } | null;

function TimeRow({ label, t, data }: { label: string; t: NonNullable<AnimateTime>; data: string }) {
  const near = (v: number) => t.steps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), t.steps[0]!);
  return (
    <div className={SP_ROW} data-stage-time={data}>
      <span className={SP_ROW_LABEL}>{label}</span>
      <span className="relative flex h-11 min-w-0 flex-1 items-center px-1">
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={t.value}
          aria-label={label}
          aria-valuetext={`${t.value.toFixed(1)} s`}
          onChange={(e) => {
            const v = near(Number(e.target.value));
            if (v !== t.value) t.onPick(v);
          }}
          className="sp-range h-11 w-full cursor-pointer appearance-none bg-transparent"
          style={{ ['--p' as string]: `${(t.value / 2) * 100}%` }}
        />
      </span>
      <span className="flex h-[38px] min-w-[58px] shrink-0 items-center justify-center rounded-full border border-[var(--sp-line)] bg-white text-[13.5px] font-medium">
        {t.value.toFixed(1)} s
      </span>
    </div>
  );
}

/** The arrow is the way the part TRAVELS: Build in ← comes from the right; Build out ↑ leaves to the top (prototype `DIRS`). */
const DIRS: Record<'in' | 'out', readonly MotionDir[]> = {
  in: ['right', 'left', 'above', 'below'],
  out: ['above', 'left', 'right', 'below'],
};
/** Move switched on with no way chosen: the prototype's default (Build in ↑ from the bottom · Build out ↑ to the top). */
const FIRST_DIR: Record<'in' | 'out', MotionDir> = { in: 'below', out: 'above' };

function EffectRows({ end, fx, onChange }: { end: 'in' | 'out'; fx: MotionFx | null; onChange: (next: MotionFx | null) => void }) {
  const set = (part: keyof MotionFx, value: string | boolean | null) => onChange(withMotionFx(fx, part, value));
  const verb = end === 'in' ? 'in' : 'out';
  const note = (words: string) => <em className="not-italic text-[var(--sp-mute)]">{words}</em>;
  const right = 'flex min-w-0 flex-1 items-center justify-end text-[12px] text-[var(--sp-ink2)]';
  return (
    <>
      <div className={SP_ROW} data-stage-effect={`${end}-fade`}>
        <span className={SP_ROW_LABEL}>Fade</span>
        <PanelSwitch on={Boolean(fx?.fade)} label={`Fade ${verb}`} data={`${end}-fade`} onChange={(on) => set('fade', on)} />
        <span className={right}>{fx?.fade ? note(end === 'in' ? 'Fades in' : 'Fades out') : note('Off')}</span>
      </div>
      <div className={SP_ROW} data-stage-effect={`${end}-blur`}>
        <span className={SP_ROW_LABEL}>Blur</span>
        <PanelSwitch on={Boolean(fx?.blur)} label={`Blur ${verb}`} data={`${end}-blur`} onChange={(on) => set('blur', on)} />
        <span className={right}>{fx?.blur ? note(end === 'in' ? 'Soft focus to sharp' : 'Soft focus as it leaves') : note('Off')}</span>
      </div>
      <div className={SP_ROW} data-stage-effect={`${end}-move`}>
        <span className={SP_ROW_LABEL}>Move</span>
        <PanelSwitch on={Boolean(fx?.move)} label={`Move ${verb}`} data={`${end}-move`} onChange={(on) => set('move', on ? (fx?.move ?? FIRST_DIR[end]) : null)} />
        <span className={`${right} gap-1`}>
          {fx?.move
            ? DIRS[end].map((d) => <Dir key={d} on={fx.move === d} glyph={motionArrow(d, end)} label={motionDirName(d, end)} onPick={() => set('move', d)} />)
            : note('Stays in place')}
        </span>
      </div>
      <div className={SP_ROW} data-stage-effect={`${end}-size`}>
        <span className={SP_ROW_LABEL}>Size</span>
        <PanelSwitch on={Boolean(fx?.size)} label={`Size ${verb}`} data={`${end}-size`} onChange={(on) => set('size', on ? (fx?.size ?? 'grow') : null)} />
        <span className={`${right} gap-1`}>
          {fx?.size
            ? (['grow', 'shrink'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={fx.size === s} data-stage-size={s} onClick={() => set('size', s)} className={SP_DIR + ' !w-auto'}>
                  <span
                    className={`inline-flex h-[38px] items-center rounded-md border px-2.5 text-[12.5px] font-semibold ${
                      fx.size === s ? 'border-[var(--sp-ink)] bg-[var(--sp-ink)] text-white' : 'border-[var(--sp-line)] bg-white text-[var(--sp-ink2)]'
                    }`}
                  >
                    {s === 'grow' ? 'Grow' : 'Shrink'}
                  </span>
                </button>
              ))
            : note('Same size')}
        </span>
      </div>
    </>
  );
}

export function StageAnimate({
  how,
  howWords = 'How it moves',
  inFx,
  outFx,
  onIn,
  onOut,
  rows = null,
  duration = null,
  delay = null,
  does,
  timing,
  next = null,
  pro = null,
  pending = false,
  error = null,
}: {
  how: AnimateDd;
  howWords?: string;
  inFx: MotionFx | null;
  outFx: MotionFx | null;
  onIn: (fx: MotionFx | null) => void;
  onOut: (fx: MotionFx | null) => void;
  /** 🧾 A scene of rows (a schedule, the march, the story …): Rows ▾ — the shipped `sequence`. */
  rows?: AnimateDd;
  /** Build in's Duration and Delay — the prototype's two sliders, on the shipped steps. */
  duration?: AnimateTime;
  delay?: AnimateTime;
  does: AnimateDd;
  timing: AnimateDd;
  /** A scene's move into the next one (null on the stage's last scene, or a part). */
  next?: AnimateDd;
  /** 💎 Event Hub Pro, said behind ⓘ once (the ◆ marks on How it moves say it on the row). */
  pro?: ReactNode;
  pending?: boolean;
  error?: string | null;
}) {
  const [phase, setPhase] = useAnimatePhase();
  return (
    <div className={SP_PANE} data-stage-animate={phase} aria-busy={pending}>
      <Phases<AnimatePhase>
        label="Animate"
        value={phase}
        options={[
          ['in', 'Build in'],
          ['act', 'Action'],
          ['out', 'Build out'],
        ]}
        onPick={setPhase}
        data="animate"
      />
      {how ? (
        <div className="flex h-11 shrink-0 items-center gap-1.5">
          <Dd small={`◆ ${howWords}`} label={howWords} data="how" tone="how" value={how.value} options={how.options} onPick={how.onPick} buttonText={how.buttonText} />
          {pro ? <About label="Animate">{pro}</About> : null}
        </div>
      ) : null}
      {phase === 'in' ? (
        <>
          <EffectRows end="in" fx={inFx} onChange={onIn} />
          {rows ? (
            <div className="flex h-11 shrink-0" data-stage-rows="">
              <Dd small="Rows" label="How its rows arrive" data="rows" value={rows.value} options={rows.options} onPick={rows.onPick} />
            </div>
          ) : null}
          {duration ? <TimeRow label="Duration" t={duration} data="duration" /> : null}
          {delay ? <TimeRow label="Delay" t={delay} data="delay" /> : null}
        </>
      ) : phase === 'act' ? (
        <>
          {does ? (
            <div className="flex h-11 shrink-0">
              <Dd small="Does" label="While on screen" data="does" value={does.value} options={does.options} onPick={does.onPick} />
            </div>
          ) : null}
          {does?.note ? (
            /* The prototype's one line under Does ▾ (`DOES_SUB`) — what the choice does, never a box. */
            <p className="shrink-0 px-1.5 text-[12px] leading-snug text-[var(--sp-mute)]" data-stage-does-note="">
              {does.note}
            </p>
          ) : null}
          {timing ? (
            <div className="flex h-11 shrink-0">
              <Dd small="Timing" label="When it plays" data="timing" value={timing.value} options={timing.options} onPick={timing.onPick} />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <EffectRows end="out" fx={outFx} onChange={onOut} />
        </>
      )}
      {next ? (
        <div className="flex h-11 shrink-0">
          <Dd small="◆ Into the next scene" label="Into the next scene" data="next" value={next.value} options={next.options} onPick={next.onPick} />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="shrink-0 py-1 text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
