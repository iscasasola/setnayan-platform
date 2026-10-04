'use client';

import { useState } from 'react';
import { Check, ChevronLeft } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { roundName, type GuidedPlan, type GuidedRound } from '@/lib/details-guided-flow';
import {
  SELF_FILLING_STAGE,
  SETUP_STAGES,
  beforeWeStart,
  setupProgress,
  stageLine,
  stageProgress,
  suggestedStage,
  type SetupStage,
} from '@/lib/stage-setup';

/**
 * 🗂 "WHICH STAGE DO YOU WANT READY?" AND ITS "BEFORE WE START" — PR-2, owner
 * 2026-10-04 ("YES TO ALL"; `EVENT_DETAILS_STUDY_2026-10-04_fable.md` § 3 and
 * screens 1–2 of `prototypes/event_details_improved_2026-10-04_fable.html`;
 * frame 0 of the approved `prototypes/finish_your_event_hub_v2_2026-10-01_fable.html`).
 *
 *   · THE PICKER — the five stages the Maker's Page ▾ names, each with the
 *     short line of what it asks and its own "n of m" (`stageProgress`: the
 *     facts THAT stage shows — a fact two stages share counts for both); the
 *     whole, once, above (`setupProgress`). Post Event is listed, never walked —
 *     it fills itself from the day. One list, one button ("Get … ready").
 *   · BEFORE WE START — the approved frame 0, filtered to the stage picked:
 *     what is already in place (never asked again) · media that helps (optional)
 *     · what this stage will ask. "I'm ready" and "Start anyway" both go to the
 *     stage's first step still to do; neither is required reading.
 *
 * 🔒 NOTHING HERE WRITES. Picking a stage, opening Before we start and starting
 * the steps change what is SHOWN — never a field, a draft or a save
 * (`opening-a-step-writes-nothing.test.ts`). Every step then opens the field
 * the Maker already uses.
 *
 * Drawn in the flow, never over the page (the Maker's in-flow rule) — loads
 * with the Details pieces (`details-lazy.tsx`), never in the Maker's first load.
 */

const PANE = 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6';

function Bar({ done, total }: { done: number; total: number }) {
  const share = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span aria-hidden className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-ink/10">
      <span className="block h-full rounded-full bg-terracotta-700" style={{ width: `${share}%` }} />
    </span>
  );
}

/** Screen 1 — "Which stage do you want ready?" */
export function StagePicker({
  plan,
  onPick,
  initial = null,
}: {
  plan: GuidedPlan;
  /** A stage picked — the flow goes to its Before we start (first time) or its first step still to do. */
  onPick: (round: GuidedRound) => void;
  /** The stage ticked when the picker opens (the one just walked); else the first still to do. */
  initial?: GuidedRound | null;
}) {
  const walkable = (s: SetupStage) => plan.rounds.includes(s);
  const [picked, setPicked] = useState<SetupStage>(() => (initial && walkable(initial) ? initial : suggestedStage(plan)));
  const whole = setupProgress(plan);
  return (
    <section data-stage-picker="" aria-label="Which stage do you want ready?" className={PANE}>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <header className="flex flex-col gap-0.5">
          <h2 className="font-serif text-2xl text-ink">Which stage do you want ready?</h2>
          <p className="text-[13px] text-ink/65" data-stage-picker-whole="">
            {formatCount(whole.done)} of {formatCount(whole.total)} in place
          </p>
        </header>
        <ul role="radiogroup" aria-label="Stages" className="flex flex-col divide-y divide-ink/10 overflow-hidden rounded-xl bg-white/80 shadow-[0_1px_2px_rgba(40,34,24,.06)]">
          {SETUP_STAGES.map((s) => {
            const open = walkable(s);
            const p = stageProgress(plan, s);
            const on = open && s === picked;
            return (
              <li key={s}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!open}
                  onClick={() => setPicked(s)}
                  data-stage-row={s}
                  data-stage-count={open ? `${p.done}/${p.total}` : ''}
                  className={`sn-press flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-sn-control ease-sn disabled:cursor-default ${
                    on ? 'bg-terracotta-700/[0.07]' : ''
                  }`}
                >
                  <span
                    aria-hidden
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      on ? 'border-terracotta-700' : open ? 'border-ink/25' : 'border-ink/10'
                    }`}
                  >
                    {on ? <span className="h-2.5 w-2.5 rounded-full bg-terracotta-700" /> : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-[15px] font-semibold ${open ? 'text-ink' : 'text-ink/45'}`}>{roundName(plan, s)}</span>
                    <span className={`text-[12.5px] ${open ? 'text-ink/60' : 'text-ink/40'}`}>{stageLine(plan, s)}</span>
                    {open ? <Bar done={p.done} total={p.total} /> : null}
                  </span>
                  <span className={`shrink-0 text-[13px] ${open ? 'text-ink/70' : 'text-ink/40'}`}>
                    {open ? `${formatCount(p.done)} of ${formatCount(p.total)}` : '—'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {walkable(picked) && picked !== SELF_FILLING_STAGE ? (
          <button
            type="button"
            onClick={() => onPick(picked)}
            data-stage-go={picked}
            className="sn-press inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 text-[16px] font-semibold text-cream hover:bg-ink/90"
          >
            Get {roundName(plan, picked)} ready
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** Screen 2 — the stage's "Before we start" (approved 2026-10-01 frame 0), filtered to the stage. */
export function BeforeWeStartScreen({
  plan,
  round,
  onStart,
  onBack,
}: {
  plan: GuidedPlan;
  round: GuidedRound;
  /** "I'm ready" and "Start anyway" — both go to the stage's first step still to do. */
  onStart: () => void;
  /** ‹ Stages — back to the picker. */
  onBack: () => void;
}) {
  const b = beforeWeStart(plan, round);
  const title = roundName(plan, round);
  const card = 'flex flex-col gap-1.5 rounded-xl bg-white/80 px-3.5 py-3 shadow-[0_1px_2px_rgba(40,34,24,.06)]';
  const head = 'flex items-baseline justify-between px-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55';
  return (
    <section data-before-we-start={round} aria-label={`${title} — before we start`} className={PANE}>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <button
          type="button"
          onClick={onBack}
          data-before-back=""
          className="sn-press inline-flex min-h-10 items-center gap-1 self-start text-[14px] font-semibold text-terracotta-700"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
          Stages
        </button>
        <h2 className="font-serif text-2xl text-ink">{title} — before we start</h2>
        {b.have.length > 0 ? (
          <div className="flex flex-col gap-1.5" data-before-have="">
            <p className={head}>
              In place <span className="normal-case tracking-normal">{formatCount(b.have.length)}</span>
            </p>
            <ul className={card}>
              {b.have.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14px] text-ink">
                  <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success-700" strokeWidth={2.25} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {b.media.length > 0 ? (
          <div className="flex flex-col gap-1.5" data-before-media="">
            <p className={head}>
              Media that helps <span className="normal-case tracking-normal">optional</span>
            </p>
            <ul className={card}>
              {b.media.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14px] text-ink">
                  <span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-ink/30" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5" data-before-ask="">
          <p className={head}>
            We’ll ask{' '}
            <span className="normal-case tracking-normal">
              {b.ask.length === 0 ? 'nothing left' : `${formatCount(b.ask.length)} ${b.ask.length === 1 ? 'thing' : 'things'}`}
            </span>
          </p>
          {b.ask.length > 0 ? (
            <ul className={card}>
              {b.ask.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14px] text-ink">
                  <span aria-hidden className="w-4 shrink-0 text-center font-semibold text-terracotta-700">
                    ?
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onStart}
            data-before-start-anyway=""
            className="sn-press inline-flex min-h-12 items-center justify-center rounded-full border border-ink/15 bg-white px-4 text-[15px] font-semibold text-ink"
          >
            Start anyway
          </button>
          <button
            type="button"
            onClick={onStart}
            data-before-ready=""
            className="sn-press inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-4 text-[15px] font-semibold text-cream hover:bg-ink/90"
          >
            I’m ready
          </button>
        </div>
      </div>
    </section>
  );
}
