'use client';

import { formatCount } from '@/lib/format-number';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { ProfileShareButton } from '@/app/_components/profile-share-button';
import { PreviewStageLink } from './maker-play-menu';
import { useMaker } from './maker-context';
import {
  roundName,
  stageSteps,
  type GuidedPlan,
  type GuidedRound,
  type GuidedScreen,
  type GuidedStep,
} from '@/lib/details-guided-flow';

/**
 * DETAILS › WHAT'S LEFT — the guided flow's own pieces (Details part 5; the pure
 * rules are `lib/details-guided-flow.ts`). `details-workspace.tsx` draws them
 * around the SAME item it always draws — the item's picture and its editor —
 * so a step is never a copy of a Details item, it IS the item, one at a time.
 *
 *   · the top line (in \`details-guide-top.tsx\`, drawn before a step is) — the
 *     progress bar and "Save the Date · 3 of 7 ▾" (ONE dropdown, the shared
 *     `PickMenu`: every step of every stage with ✓ / ○, any one picked any time
 *     — owner: *"they can still pick a step anytime?"*), and "All items", the
 *     grouped navigator one tap away;
 *   · the step's heading — its stage and its name (no "where it shows" line
 *     since 2026-10-05: no captions; the step data still carries `shows`);
 *   · each stage's Ready screen — the stage's steps ✓ / ○, and its real action
 *     beside Apply: Preview · Share (the Save the Date), Send invitations (the
 *     Guest list's own invite flow), Apply (the bar's ONE Apply);
 *   · the foot — ‹ Back · Skip for now · Next ›, in the flow;
 *   · 🖼 the cover step's background (B6): Look › Background's own row, the
 *     same node — one setting, two doors.
 * "Which stage do you want ready?" and Before we start are `stage-picker.tsx`.
 */

export type DetailsGuideActions = {
  /** Round 1 — the Save the Date as guests meet it, with the draft (null: no address yet). */
  previewHref: string | null;
  /** Round 1 — the Event Hub's address, to share (null: no address yet). */
  shareUrl: string | null;
  /** Round 2 — the Guest list's invite flow. */
  sendHref: string;
  /** 🧭 The setup's guests' names — the Guest list's template import (`hubSetupGuestsHref`). */
  guestsHref?: string;
};

export type DetailsGuide = {
  plan: GuidedPlan;
  /** Open on the flow (else on the grouped navigator). */
  open: boolean;
  /**
   * The screen the flow opens on — the stage picker, a stage's Before we start
   * or Ready screen, or a step (walked as part of its stage). Null: the step of
   * the item showing.
   */
  entry: GuidedScreen | null;
  /** The address itself named what to open (a `?guide=` or an `?item=`), so a remembered choice does not override it. */
  addressed: boolean;
  actions: DetailsGuideActions;
  /** The flow's first-visit tour — drawn once, beside the progress line. */
  tour?: ReactNode;
};

/**
 * A step's heading: its stage and its name. `bare` (the phone's half sheet) —
 * the stage and the step are the sheet's own step ▾, so only the setup's 🔓
 * line is left, and with none there is no heading at all.
 *
 * No "where it shows" line under it (owner, live iPhone test 2026-10-05: no
 * captions — "The look of your whole Event Hub and every print." sat between
 * the header and the field). A step's place shows on the page beside it.
 */
export function GuideHead({
  step,
  roundTitle,
  itemLabel,
  compact,
  bare = false,
}: {
  step: GuidedStep;
  /** The stage being walked, by name ("Save the Date"). */
  roundTitle: string;
  itemLabel: string | null;
  compact: boolean;
  bare?: boolean;
}) {
  if (bare && !step.unlocks) return null;
  const eyebrow = `${roundTitle}${step.optional ? ' · optional' : ''}${itemLabel && step.items.length > 1 ? ` · ${itemLabel}` : ''}`;
  return (
    <header data-details-guide-head={step.key} className={compact ? 'flex shrink-0 flex-col gap-0.5 px-4 pb-1 pt-2.5 sm:px-6' : 'flex flex-col gap-0.5'}>
      {bare ? null : (
        <>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">{eyebrow}</p>
          <h2 className={compact ? 'font-serif text-lg text-ink' : 'font-serif text-2xl text-ink'}>{step.title}</h2>
        </>
      )}
      {/* 🔓 The setup's line under every step — what filling it in turns on (filled in, never a paywall). */}
      {step.unlocks ? (
        <p
          className={`text-[12.5px] font-medium ${step.state === 'done' ? 'text-success-700' : 'text-terracotta-700'}`}
          data-details-guide-unlocks={step.state === 'done' ? 'unlocked' : 'locked'}
        >
          {step.state === 'done' ? '✓ ' : '🔓 '}
          {step.unlocks}
        </p>
      ) : null}
    </header>
  );
}

/** A stage's Ready screen: what is set, what is not, and the stage's own action beside Apply. */
export function GuideReady({
  plan,
  round,
  actions,
  onGo,
}: {
  plan: GuidedPlan;
  round: GuidedRound;
  actions: DetailsGuideActions;
  onGo: (at: GuidedScreen) => void;
}) {
  const maker = useMaker();
  const steps = stageSteps(plan, round);
  const links = plan.links.filter((l) => l.stages.includes(round));
  const left = steps.filter((s) => s.state === 'left' && !s.optional).length + links.filter((l) => l.state === 'left').length;
  /* The preview link reads the window (phone → same view), so it is drawn only
     once mounted in the browser — a Ready screen can be the first paint. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const quiet =
    'sn-press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 text-[14px] font-semibold text-ink hover:bg-ink/[0.04]';
  return (
    <section
      data-details-guide-ready={round}
      aria-label={`${roundName(plan, round)} — ready`}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <header className="flex flex-col gap-0.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">{roundName(plan, round)}</p>
          <h2 className="font-serif text-2xl text-ink">{left ? 'Almost ready' : 'Ready'}</h2>
          <p className="text-[14px] text-ink/75" data-details-guide-ready-line="">
            {left ? (
              <>
                {formatCount(left)} {left === 1 ? 'thing is' : 'things are'} still to do — or ✓ Apply what is set now.
              </>
            ) : (
              <>
                <b className="font-semibold text-ink">{plan.roundWords[round].ready}.</b> Apply puts it live.
              </>
            )}
          </p>
        </header>
        <ul className="flex flex-col divide-y divide-ink/10 rounded-lg bg-white/80 px-3 shadow-[0_1px_2px_rgba(40,34,24,.06)]">
          {steps.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onGo({ kind: 'step', step: s.key, round })}
                data-details-guide-ready-step={s.key}
                data-state={s.state}
                className="sn-press flex min-h-12 w-full items-center justify-between gap-3 text-left text-[14px] text-ink"
              >
                <span>
                  {s.title}
                  {s.optional ? <span className="ml-1.5 text-[12px] text-ink/55">optional</span> : null}
                </span>
                <span
                  className={`shrink-0 text-[13px] font-semibold ${
                    s.state === 'done' ? 'text-success-700' : s.state === 'left' ? 'text-terracotta-700' : 'text-ink/55'
                  }`}
                >
                  {s.state === 'done' ? '✓ set' : s.state === 'left' ? '○ not yet' : 'Look over'}
                </span>
              </button>
            </li>
          ))}
          {/* 🧭 A setup step with no item of its own (the guests' names): it opens
              the Guest list's template import, where the names are typed. */}
          {links.map((l) => (
            <li key={l.key}>
              {actions.guestsHref ? (
                <Link
                  href={actions.guestsHref}
                  data-details-guide-ready-step={l.key}
                  data-state={l.state}
                  className="sn-press flex min-h-12 w-full items-center justify-between gap-3 text-left text-[14px] text-ink"
                >
                  <span className="flex flex-col">
                    {l.title}
                    <span className="text-[12px] text-ink/60">{l.unlocks}</span>
                  </span>
                  <span className={`shrink-0 text-[13px] font-semibold ${l.state === 'done' ? 'text-success-700' : 'text-terracotta-700'}`}>
                    {l.state === 'done' ? '✓ set' : 'Add names ›'}
                  </span>
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          {round === 'save_the_date' ? (
            <>
              {actions.previewHref && mounted ? (
                <PreviewStageLink
                  href={actions.previewHref}
                  stageLabel="Save the Date"
                  storeShell={Boolean(maker?.storeShell)}
                  className={quiet}
                  onPicked={() => {}}
                  text="Preview"
                />
              ) : null}
              {actions.shareUrl ? (
                <ProfileShareButton
                  url={actions.shareUrl}
                  title="Save the Date"
                  label="Share your Save the Date"
                  ariaLabel="Share your Save the Date"
                  className={quiet}
                />
              ) : null}
            </>
          ) : null}
          {round === 'rsvp' ? (
            <Link href={actions.sendHref} className={quiet} data-details-guide-send="">
              <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Send invitations
            </Link>
          ) : null}
          {/* ✓ ONE Apply (owner 2026-10-05: "two Apply buttons") — the bar's own,
              top right, with its count. This screen has none of its own. */}
        </div>
        {/* 🗂 Then progress per stage: back to "Which stage do you want ready?". */}
        <button
          type="button"
          onClick={() => onGo({ kind: 'stages' })}
          data-details-guide-stages=""
          className="sn-press inline-flex min-h-11 items-center gap-1 self-start text-[14px] font-semibold text-terracotta-700 underline underline-offset-2"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
          Pick another stage
        </button>
      </div>
    </section>
  );
}

/** The foot of a step: ‹ Back · Skip for now · Next ›. A stage's other screens carry their own buttons. */
export function GuideFoot({
  onBack,
  onSkip,
  onNext,
  warning,
  onKeepEditing,
  onGoAnyway,
}: {
  onBack: (() => void) | null;
  onSkip: (() => void) | null;
  onNext: (() => void) | null;
  /** Next found typing here that is not saved yet. */
  warning: boolean;
  onKeepEditing: () => void;
  onGoAnyway: () => void;
}) {
  return (
    <div data-details-guide-foot="" className="shrink-0 border-t border-ink/10 bg-cream px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
      {warning ? (
        <div role="alert" data-details-guide-unsaved="" className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-terracotta-50 px-3 py-2 text-[13px] text-terracotta-800">
          <span className="basis-full">You changed something here that isn’t saved yet.</span>
          <button type="button" onClick={onKeepEditing} className="sn-press min-h-10 rounded-full bg-white px-3 font-semibold text-ink">
            Keep editing
          </button>
          <button type="button" onClick={onGoAnyway} className="sn-press min-h-10 rounded-full px-3 font-semibold underline underline-offset-2">
            Go on without saving
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            data-details-guide-back=""
            className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full border border-ink/15 bg-white px-3.5 text-[14px] font-semibold text-ink"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
            Back
          </button>
        ) : null}
        <span className="flex-1" />
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            data-details-guide-skip=""
            className="sn-press inline-flex min-h-11 items-center px-2 text-[14px] font-semibold text-terracotta-700 underline underline-offset-2"
          >
            Skip for now
          </button>
        ) : null}
        {onNext ? (
          <button
            type="button"
            onClick={onNext}
            data-details-guide-next=""
            className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full bg-ink px-5 text-[15px] font-semibold text-cream"
          >
            Next
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 🖼 THE COVER STEP'S BACKGROUND (B6; DECISION_LOG 2026-10-01 "'FINISH YOUR EVENT
 * HUB' CARRIES THE EVENT HUB'S IMPORTANT PARTS — THE MAIN BACKGROUND INCLUDED":
 * *"Its event photo step also sets Behind every scene (the same saveMain / hub
 * draft the 🎨 panel writes — one setting, two doors)"*). Not a copy: the very
 * node Look › Background draws (`LookPanel`, `maker.lookPages.look.background`
 * — the work area's `MainBackgroundPanel`), so the two show one value and write
 * through one `saveMain`. Where the event has no such row (the store shell), or
 * the work area has not registered it yet, nothing is drawn — never a second
 * control.
 */
export function StepBackground() {
  const node = useMaker()?.lookPages?.look?.background ?? null;
  if (!node) return null;
  return (
    <section data-step-background="" className="flex flex-col gap-2 border-t border-ink/10 pt-4">
      <h3 className="text-[15px] font-semibold text-ink">Background</h3>
      {node}
    </section>
  );
}
