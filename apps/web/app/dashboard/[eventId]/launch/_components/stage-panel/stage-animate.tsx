'use client';

import { Chips } from '@/app/_components/chips';
import { PillSelector } from '@/app/_components/pill-selector';
import { MOTION_SIZE_LABEL, motionArrow, motionDirLabel, motionDirName, withMotionFx, type MotionDir, type MotionFx } from '@/lib/motion-effects';
import { SP_ANIMATE_CHIPS, SP_ANIMATE_HALF } from '@/lib/maker-animate-rows';
import { SP_ROWS, SP_ROWS_ROW } from '@/lib/maker-stage-room';
import type { PickOption } from '../../../website/editor/_components/pick-menu-types';
import { Dd, Phases } from './kit';
import { useAnimatePhase, type AnimatePhase } from './store';

/**
 * ✨ ANIMATE — FOUR ROWS, nothing scrolling (`TOOLBAR-SPEC-2026-10-09.md` § ANIMATE + decision 8; it was one
 * column of eleven rows, 364–416 px in a 210-px box):
 *
 *   row 1   [ Build in | Action | Build out ]
 *   row 2   Build in / Build out — Fade · Blur · Move · Size, four chips, each on or off      Action — Still | Drift
 *   row 3   only what the ON ones need: From / To ▾ (Move) · Grow | Shrink (Size), a half each
 *   row 4   Build in  — Movement ◆ + Rows (a scene of rows) + Delay (a part)
 *           Action    — Movement ◆
 *           Build out — Movement ◆ + Next scene ◆          (NO Delay — decision 8)
 *
 * NO Duration anywhere and no Timing in Action (owner: "build in no duration" · "action does not need next scene
 * and timing"). What those two stored is NOT touched: a part's `speed` / `timeline` and a scene's `duration` /
 * `timeline` stay as they are and still play; only their controls left the toolbar.
 *
 * Every control writes the SHIPPED four-effect vocabulary (`lib/motion-effects.ts` `withMotionFx` — a part's
 * `motion.in/out`, a scene's `inFx/outFx`) through the shipped saves the caller hands in. Action offers the SHIPPED
 * words only (a part: Still · Drift; a scene: Still · Slow lift) — nothing is invented.
 */

export type AnimateDd = { value: string; options: readonly PickOption[]; onPick: (k: string) => void; buttonText?: string } | null;
/** Delay — the shipped steps, in seconds (a part's None · 0.3 s · 0.8 s). */
export type AnimateTime = { value: number; steps: readonly number[]; onPick: (seconds: number) => void } | null;

/** The arrow is the way the part TRAVELS: Build in ← comes from the right; Build out ↑ leaves to the top (prototype `DIRS`). */
const DIRS: Record<'in' | 'out', readonly MotionDir[]> = {
  in: ['right', 'left', 'above', 'below'],
  out: ['above', 'left', 'right', 'below'],
};
/** Size's two ways — the shipped words (`MOTION_SIZE_LABEL`). */
const SIZES = [
  { key: 'grow', label: MOTION_SIZE_LABEL.grow },
  { key: 'shrink', label: MOTION_SIZE_LABEL.shrink },
] as const;
/** Move switched on with no way chosen: the prototype's default (Build in ↑ from the bottom · Build out ↑ to the top). */
const FIRST_DIR: Record<'in' | 'out', MotionDir> = { in: 'below', out: 'above' };
/** Row 2's four, in the prototype's order. */
const EFFECTS = [
  { key: 'fade', label: 'Fade' },
  { key: 'blur', label: 'Blur' },
  { key: 'move', label: 'Move' },
  { key: 'size', label: 'Size' },
] as const;
type Effect = (typeof EFFECTS)[number]['key'];

/** Row 2 pressed: the effect goes on (Move and Size with their first way) or off. */
export function toggleMotionFx(fx: MotionFx | null, end: 'in' | 'out', effect: Effect): MotionFx | null {
  if (effect === 'move') return withMotionFx(fx, 'move', fx?.move ? null : FIRST_DIR[end]);
  if (effect === 'size') return withMotionFx(fx, 'size', fx?.size ? null : 'grow');
  return withMotionFx(fx, effect, !fx?.[effect]);
}

const seconds = (n: number) => `${n.toFixed(1)} s`;

export function StageAnimate({
  how,
  inFx,
  outFx,
  onIn,
  onOut,
  rows = null,
  delay = null,
  does,
  next = null,
  pending = false,
  error = null,
}: {
  /** Movement ◆ — the preset (a part: its own, or the scene's). On every phase's row 4. */
  how: AnimateDd;
  inFx: MotionFx | null;
  outFx: MotionFx | null;
  onIn: (fx: MotionFx | null) => void;
  onOut: (fx: MotionFx | null) => void;
  /** 🧾 A scene of rows (a schedule, the march, the story …): Rows ▾ beside Movement — the shipped `sequence`. */
  rows?: AnimateDd;
  /** Build in's Delay, beside Movement (a part's — a scene stores none). Build out has none (decision 8). */
  delay?: AnimateTime;
  /** Action's two (Still | Drift) — the caller's shipped words. */
  does: AnimateDd;
  /** Build out's Next scene ◆ (null on the stage's last scene). */
  next?: AnimateDd;
  pending?: boolean;
  error?: string | null;
}) {
  const [phase, setPhase] = useAnimatePhase();
  const end = phase === 'act' ? null : phase;
  const fx = end === 'in' ? inFx : end === 'out' ? outFx : null;
  const keep = end === 'in' ? onIn : onOut;
  const set = (part: keyof MotionFx, value: string | boolean | null) => keep(withMotionFx(fx, part, value));
  const verb = end === 'in' ? 'in' : 'out';
  return (
    <div className={`${SP_ROWS} shrink-0 px-[10px]`} data-stage-animate={phase} data-stage-animate-rows="" aria-busy={pending}>
      {/* ══ ROW 1 — when ══ */}
      <div className={`${SP_ROWS_ROW} row-start-1`}>
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
      </div>
      {/* ══ ROW 2 — what it does ══ */}
      {end ? (
        <div className={`${SP_ROWS_ROW} row-start-2`} data-stage-effects={end}>
          {/* Four that are each on or off — the app's CHIPS (filled when on, plain when off), never segments of a
              track: a different kind of control from row 1's one-of-three, so it looks different. */}
          <Chips even={false} className={SP_ANIMATE_CHIPS} label={`Build ${verb}`} data={`${end}-effects`} value={EFFECTS.filter((e) => Boolean(fx?.[e.key])).map((e) => e.key)} options={EFFECTS} onToggle={(e) => keep(toggleMotionFx(fx, end, e))} />
        </div>
      ) : does ? (
        <div className={`${SP_ROWS_ROW} row-start-2`} data-stage-does="">
          {/* A two-way choice → the pill selector, its thumb sliding. A stored word that is neither presses nothing. */}
          <PillSelector label="While on screen" data="does" value={does.options.some((o) => o.key === does.value) ? does.value : null} options={does.options.map((o) => ({ key: o.key, label: o.label }))} onPick={does.onPick} />
        </div>
      ) : null}
      {/* ══ ROW 3 — only what the ON ones need, a half each ══ */}
      {error ? (
        <p role="alert" className={`${SP_ROWS_ROW} row-start-3 text-[12.5px] font-semibold text-[rgb(var(--color-danger))]`}>
          {error}
        </p>
      ) : end && (fx?.move || fx?.size) ? (
        <div className={`${SP_ROWS_ROW} row-start-3`} data-stage-needs={end}>
          {fx?.move ? (
            <span className={SP_ANIMATE_HALF} data-stage-need="move">
              <Dd
                stacked
                small={end === 'in' ? 'From' : 'To'}
                label={end === 'in' ? 'Comes in from' : 'Goes out to'}
                data={`${end}-move-dir`}
                value={fx.move}
                options={DIRS[end].map((d) => ({ key: d, label: `${motionArrow(d, end)}  ${motionDirName(d, end)}` }))}
                buttonText={motionDirLabel(fx.move, end).replace(/^(?:From|To) /, '')}
                onPick={(d) => set('move', d)}
              />
            </span>
          ) : null}
          {fx?.size ? (
            <span className={SP_ANIMATE_HALF} data-stage-need="size">
              {/* A stored "Settle back" is neither, so nothing is picked until one is. */}
              <PillSelector label={`Size ${verb}`} data={`${end}-size`} value={fx.size === 'grow' || fx.size === 'shrink' ? fx.size : null} options={SIZES} onPick={(s) => set('size', s)} />
            </span>
          ) : null}
        </div>
      ) : null}
      {/* ══ ROW 4 — the whole movement, and what goes with this phase ══ */}
      <div className={`${SP_ROWS_ROW} row-start-4`} data-stage-animate-row4={phase}>
        {how ? <Dd stacked small="Movement ◆" label="Movement" data="how" value={how.value} options={how.options} onPick={how.onPick} buttonText={how.buttonText} /> : null}
        {phase === 'in' && rows ? <Dd stacked small="Rows" label="How its rows arrive" data="rows" value={rows.value} options={rows.options} onPick={rows.onPick} /> : null}
        {phase === 'in' && delay ? (
          <Dd
            stacked
            small="Delay"
            label="Delay"
            data="delay"
            value={String(delay.value)}
            options={delay.steps.map((s) => ({ key: String(s), label: seconds(s) }))}
            onPick={(k) => {
              const s = Number(k);
              if (s !== delay.value) delay.onPick(s);
            }}
          />
        ) : null}
        {phase === 'out' && next ? <Dd stacked small="Next scene ◆" label="Into the next scene" data="next" value={next.value} options={next.options} onPick={next.onPick} buttonText={next.buttonText} /> : null}
      </div>
    </div>
  );
}
