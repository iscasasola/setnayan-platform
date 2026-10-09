'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Chips } from '@/app/_components/chips';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { PillSelector } from '@/app/_components/pill-selector';
import { MOTION_SIZE_LABEL, motionArrow, motionDirLabel, motionDirName, withMotionFx, type MotionDir, type MotionFx } from '@/lib/motion-effects';
import { ANIMATE_FEEL_LABEL, ANIMATE_FEELS, FEEL_OFF, type AnimateFeel } from '@/lib/animate-feel';
import { SP_ANIMATE_CHIPS, SP_ANIMATE_HALF, SP_ANIMATE_LINE } from '@/lib/maker-animate-rows';
import { SP_ROWS, SP_ROWS_ROW } from '@/lib/maker-stage-room';
import type { PickOption } from '../../../website/editor/_components/pick-menu-types';
import { Dd, PanelSwitch, Phases } from './kit';
import { useAnimatePhase, type AnimatePhase } from './store';

/**
 * ✨ ANIMATE — FOUR ROWS, nothing scrolling (`TOOLBAR-SPEC-2026-10-09.md` § ANIMATE; it was one column of eleven rows,
 * 364–416 px in a 210-px box):
 *
 *   row 1   [ Build in | Action | Build out ]
 *   row 2   Build in / Build out — Fade · Blur · Move · Size, four chips, each on or off      Action — Still | Drift
 *           (Build out while this plays ON ARRIVAL: there is no Build out — one line says so, with the switch that
 *           makes it follow the scroll. It never looks live and does nothing.)
 *   row 3   only what the ON ones need: From / To ▾ (Move) · Grow | Shrink (Size), a half each
 *   row 4   Build in  — Movement ◆ · Plays (On arrival | On scroll) · Delay (a part) or Rows (a scene of rows)
 *           Action    — nothing (it has no feel and no drive of its own)
 *           Build out — Movement ◆ · Leaves ◆ (As it scrolls away | Scrub out | Auto scroll)
 *
 * 🎚 MOVEMENT IS THE PHASE'S OWN FEEL (owner 2026-10-09: *"movement independent from each. not universal for all"* ·
 * *"how does the effect execute its effect, calmly, cinematic"*) — Quick · Calm · Cinematic, `lib/animate-feel.ts`.
 * It never chooses an effect (row 2 does), never the drive (Plays / Leaves do). Where there is nothing for it to
 * time it is GREY and a tap says why. The old one-for-all preset (Still · Calm · Editorial · Cinematic · Custom) is
 * not offered here any more; a stored one keeps playing, untouched.
 *
 * NO Duration row and no Timing row (owner: "build in no duration" · "action does not need next scene and timing").
 * Every control writes through the shipped saves the caller hands in.
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

/** Movement ◆ for one phase: the feel that plays, and — when there is nothing for it to time — why (a tap says it). */
export type AnimateMove = { value: AnimateFeel; onPick: (feel: AnimateFeel) => void; off?: string | null } | null;
/** Build in's drive. */
export type AnimatePlays = { value: 'arrival' | 'scroll'; onPick: (drive: 'arrival' | 'scroll') => void } | null;

const FEEL_OPTIONS = ANIMATE_FEELS.map((f) => ({ key: f, label: ANIMATE_FEEL_LABEL[f] }));
const PLAYS_OPTIONS = [
  { key: 'arrival', label: 'On arrival' },
  { key: 'scroll', label: 'On scroll' },
] as const;

export function StageAnimate({
  move,
  plays = null,
  inFx,
  outFx,
  onIn,
  onOut,
  rows = null,
  delay = null,
  does,
  leaves = null,
  pending = false,
  error = null,
}: {
  /** Movement ◆ — each end's OWN feel. Never an effect, never the drive. */
  move: { in: AnimateMove; out: AnimateMove };
  /** Build in's drive — and, on arrival, the reason Build out has nothing to play. */
  plays?: AnimatePlays;
  inFx: MotionFx | null;
  outFx: MotionFx | null;
  onIn: (fx: MotionFx | null) => void;
  onOut: (fx: MotionFx | null) => void;
  /** 🧾 A scene of rows (a schedule, the march, the story …): Rows ▾ — the shipped `sequence`. */
  rows?: AnimateDd;
  /** Build in's Delay (a part's — a scene stores none). Build out has none (decision 8). */
  delay?: AnimateTime;
  /** Action's two (Still | Drift) — the caller's shipped words. */
  does: AnimateDd;
  /** Build out's Leaves ◆ — the scene's hand-off to the next one (null on the stage's last scene). */
  leaves?: AnimateDd;
  pending?: boolean;
  error?: string | null;
}) {
  const [phase, setPhase] = useAnimatePhase();
  const [why, setWhy] = useState<{ words: string; n: number } | null>(null);
  const end = phase === 'act' ? null : phase;
  const fx = end === 'in' ? inFx : end === 'out' ? outFx : null;
  const keep = end === 'in' ? onIn : onOut;
  const set = (part: keyof MotionFx, value: string | boolean | null) => keep(withMotionFx(fx, part, value));
  const verb = end === 'in' ? 'in' : 'out';
  /* On arrival there is no Build out at all (the page has no timed exit; a part's is dropped) — say so. */
  const noOut = end === 'out' && plays?.value === 'arrival';
  const feel = end ? move[end] : null;
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
      {noOut && plays ? (
        <div className={`${SP_ROWS_ROW} row-start-2`} data-stage-no-out="">
          <p className={SP_ANIMATE_LINE}>{FEEL_OFF.arrival}</p>
          <PanelSwitch on={false} label="Follow the scroll" data="out-follow" onChange={() => plays.onPick('scroll')} />
        </div>
      ) : end ? (
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
      ) : end && !noOut && (fx?.move || fx?.size) ? (
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
      {/* ══ ROW 4 — this phase's own feel, and what drives it (Action has neither) ══ */}
      {end ? (
        <div className={`${SP_ROWS_ROW} row-start-4`} data-stage-animate-row4={phase}>
          {feel ? (
            <Dd
              stacked
              small="Movement ◆"
              label="Movement"
              data={`${end}-move`}
              value={feel.value}
              options={FEEL_OPTIONS}
              onPick={(f) => feel.onPick(f as AnimateFeel)}
              off={feel.off ? () => setWhy((w) => ({ words: feel.off as string, n: (w?.n ?? 0) + 1 })) : undefined}
            />
          ) : null}
          {end === 'in' && plays ? <Dd stacked small="Plays" label="Build in plays" data="plays" value={plays.value} options={PLAYS_OPTIONS} onPick={(d) => plays.onPick(d as 'arrival' | 'scroll')} /> : null}
          {end === 'in' && rows ? <Dd stacked small="Rows" label="How its rows arrive" data="rows" value={rows.value} options={rows.options} onPick={rows.onPick} /> : null}
          {end === 'in' && delay ? (
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
          {end === 'out' && leaves ? <Dd stacked small="Leaves ◆" label="How it leaves" data="leaves" value={leaves.value} options={leaves.options} onPick={leaves.onPick} buttonText={leaves.buttonText} /> : null}
        </div>
      ) : null}
      {/* The reason a grey Movement gives. Drawn on the page's body, not in the four rows: the tool sits in a box
          that clips and may be moved, and a toast peeks from the top of the SCREEN. (`why` is only ever set by a tap.) */}
      {why
        ? createPortal(
            <PeekToast key={why.n} tone="note" data="move-why" onGone={() => setWhy((w) => (w?.n === why.n ? null : w))}>
              {why.words}
            </PeekToast>,
            document.body,
          )
        : null}
    </div>
  );
}
