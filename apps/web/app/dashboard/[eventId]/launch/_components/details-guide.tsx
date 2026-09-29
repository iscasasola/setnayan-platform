'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { PickMenu, type PickOption } from '../../website/editor/_components/pick-menu';
import { pressMakerApply, type MakerApplyOutcome } from '../../website/_components/maker-press-apply';
import { ProfileShareButton } from '@/app/_components/profile-share-button';
import { PreviewStageLink } from './maker-play-menu';
import { useMaker } from './maker-context';
import {
  GUIDED_ROUNDS,
  progressLabel,
  progressShare,
  type GuidedPlan,
  type GuidedRound,
  type GuidedScreen,
  type GuidedStep,
  type GuidedStepState,
} from '@/lib/details-guided-flow';

/**
 * DETAILS › WHAT'S LEFT — the guided flow's own pieces (Details part 5; the pure
 * rules are `lib/details-guided-flow.ts`). `details-workspace.tsx` draws them
 * around the SAME item it always draws — the item's picture and its editor —
 * so a step is never a copy of a Details item, it IS the item, one at a time.
 *
 *   · the top line — the progress bar and "Round 1 · 3 of 7 ▾" (ONE dropdown,
 *     the shared `PickMenu`: every step of all three rounds with ✓ / ○, any one
 *     picked any time — owner: *"they can still pick a step anytime?"*), and
 *     "All items", the grouped navigator one tap away;
 *   · the step's heading — its round, its name, and where it shows in plain
 *     words (no "stage" or "scene" on this path);
 *   · each round's Ready screen — the round's steps ✓ / ○, and its real action
 *     beside Apply: Preview · Share (the Save the Date), Send invitations (the
 *     Guest list's own invite flow), Apply (the bar's ONE Apply);
 *   · the foot — ‹ Back · Skip for now · Next ›, in the flow (never fixed over
 *     the page).
 */

export type DetailsGuideActions = {
  /** Round 1 — the Save the Date as guests meet it, with the draft (null: no address yet). */
  previewHref: string | null;
  /** Round 1 — the Event Hub's address, to share (null: no address yet). */
  shareUrl: string | null;
  /** Round 2 — the Guest list's invite flow. */
  sendHref: string;
};

export type DetailsGuide = {
  plan: GuidedPlan;
  /** Open on the flow (else on the grouped navigator). */
  open: boolean;
  /** The address named a Ready screen (`?guide=ready-N`). */
  ready: GuidedRound | null;
  /** The address itself named what to open (a `?guide=` or an `?item=`), so a remembered choice does not override it. */
  addressed: boolean;
  actions: DetailsGuideActions;
  /** The flow's first-visit tour — drawn once, beside the progress line. */
  tour?: ReactNode;
};

const MARK: Record<GuidedStepState, NonNullable<PickOption['trail']>> = {
  done: { text: '✓', tone: 'ok', label: 'done' },
  left: { text: '○', tone: 'left', label: 'still to do' },
  check: { text: 'Look over', tone: 'muted' },
};

export function screenKey(at: GuidedScreen): string {
  return at.kind === 'step' ? `step:${at.step}` : `ready:${at.round}`;
}

export function screenFromKey(key: string): GuidedScreen | null {
  const [kind, v] = key.split(':');
  if (kind === 'step' && v) return { kind: 'step', step: v as GuidedStep['key'] };
  if (kind === 'ready' && (v === '1' || v === '2' || v === '3')) return { kind: 'ready', round: Number(v) as GuidedRound };
  return null;
}

/** The top line: progress, the step list (one dropdown), All items. */
export function GuideTop({
  plan,
  at,
  onPick,
  onAllItems,
  tour = null,
}: {
  plan: GuidedPlan;
  at: GuidedScreen;
  onPick: (at: GuidedScreen) => void;
  onAllItems: () => void;
  tour?: ReactNode;
}) {
  const options: PickOption[] = plan.rounds.flatMap((r) => {
    const group = `Round ${r} · ${GUIDED_ROUNDS[r].title}`;
    return [
      ...plan.steps
        .filter((s) => s.round === r)
        .map((s): PickOption => ({ key: `step:${s.key}`, label: s.optional ? `${s.title} · optional` : s.title, group, trail: MARK[s.state] })),
      { key: `ready:${r}`, label: `Apply · ${GUIDED_ROUNDS[r].ready}`, group },
    ];
  });
  return (
    <div data-details-guide-top="" className="flex shrink-0 items-center gap-2.5 border-b border-ink/10 bg-cream/80 px-3 py-1.5 sm:px-4">
      <span aria-hidden className="block h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-ink/10 sm:w-24">
        <span className="block h-full rounded-full bg-terracotta-700" style={{ width: `${Math.round(progressShare(plan, at) * 100)}%` }} />
      </span>
      <PickMenu
        label="Pick a step — any time"
        value={screenKey(at)}
        options={options}
        onPick={(k) => {
          const next = screenFromKey(k);
          if (next) onPick(next);
        }}
        buttonText={progressLabel(plan, at)}
        dataAttr="data-details-guide-steps"
        className="font-mono !text-[12px] tracking-[0.04em]"
      />
      <span className="flex-1" />
      <button
        type="button"
        onClick={onAllItems}
        data-details-guide-all=""
        className="sn-press inline-flex min-h-10 shrink-0 items-center rounded-full bg-ink/[0.07] px-3.5 text-[13px] font-semibold text-ink hover:bg-ink/10"
      >
        All items
      </button>
      {tour}
    </div>
  );
}

/** A step's heading: its round, its name, where it shows. */
export function GuideHead({ step, itemLabel, compact }: { step: GuidedStep; itemLabel: string | null; compact: boolean }) {
  const eyebrow = `Round ${step.round} · ${GUIDED_ROUNDS[step.round].title}${step.optional ? ' · optional' : ''}${
    itemLabel && step.items.length > 1 ? ` · ${itemLabel}` : ''
  }`;
  return (
    <header data-details-guide-head={step.key} className={compact ? 'flex shrink-0 flex-col gap-0.5 px-4 pb-1 pt-2.5 sm:px-6' : 'flex flex-col gap-0.5'}>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">{eyebrow}</p>
      <h2 className={compact ? 'font-serif text-lg text-ink' : 'font-serif text-2xl text-ink'}>{step.title}</h2>
      <p className="text-[13px] text-ink/65" data-details-guide-shows="">
        {step.shows}
      </p>
    </header>
  );
}

const APPLY_SAID: Record<MakerApplyOutcome, string | null> = {
  applying: 'Applying — guests see it in a moment.',
  'pro-sheet': null,
  nothing: 'Nothing new to apply — guests already see this.',
  busy: 'Still working on the last one — try again in a moment.',
};

/** A round's Ready screen: what is set, what is not, and the round's own action beside Apply. */
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
  const steps = plan.steps.filter((s) => s.round === round);
  const left = steps.filter((s) => s.state === 'left' && !s.optional).length;
  const [said, setSaid] = useState<string | null>(null);
  /* The preview link reads the window (phone → same view), so it is drawn only
     once mounted in the browser — a Ready screen can be the first paint. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setSaid(null), [round]);
  const apply = () => {
    const outcome = pressMakerApply();
    setSaid(outcome === null ? 'Apply is at the top right.' : APPLY_SAID[outcome]);
  };
  const quiet =
    'sn-press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 text-[14px] font-semibold text-ink hover:bg-ink/[0.04]';
  return (
    <section
      data-details-guide-ready={round}
      aria-label={`Round ${round} — ready`}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <header className="flex flex-col gap-0.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Round {round} · {GUIDED_ROUNDS[round].title}
          </p>
          <h2 className="font-serif text-2xl text-ink">{left ? 'Almost ready' : 'Ready'}</h2>
          <p className="text-[14px] text-ink/75" data-details-guide-ready-line="">
            {left ? (
              <>
                {left} {left === 1 ? 'thing is' : 'things are'} still to do — or Apply what is set now.
              </>
            ) : (
              <>
                <b className="font-semibold text-ink">{GUIDED_ROUNDS[round].ready}.</b> Apply puts it live.
              </>
            )}
          </p>
        </header>
        <ul className="flex flex-col divide-y divide-ink/10 rounded-lg bg-white/80 px-3 shadow-[0_1px_2px_rgba(40,34,24,.06)]">
          {steps.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onGo({ kind: 'step', step: s.key })}
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
        </ul>
        <p className="text-[12.5px] text-ink/60">Guests see what is set once you apply. Anything not yet stays yours until you fill it.</p>
        <div className="flex flex-wrap items-center gap-2">
          {round === 1 ? (
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
          {round === 2 ? (
            <Link href={actions.sendHref} className={quiet} data-details-guide-send="">
              <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Send invitations
            </Link>
          ) : null}
          <button
            type="button"
            onClick={apply}
            data-details-guide-apply={round}
            className="sn-press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-ink px-6 text-[15px] font-semibold text-cream hover:bg-ink/90"
          >
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            Apply
          </button>
        </div>
        {round === 1 && !actions.shareUrl ? (
          <p className="text-[12.5px] text-ink/60">Choose your Event Hub address under All items to share it.</p>
        ) : null}
        {said ? (
          <p role="status" className="text-[13px] font-medium text-ink/75" data-details-guide-applied="">
            {said}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** The foot: ‹ Back · Skip for now · Next › — or, on a Ready screen, on to the next round. */
export function GuideFoot({
  at,
  plan,
  onBack,
  onSkip,
  onNext,
  warning,
  onKeepEditing,
  onGoAnyway,
}: {
  at: GuidedScreen;
  plan: GuidedPlan;
  onBack: (() => void) | null;
  onSkip: (() => void) | null;
  onNext: (() => void) | null;
  /** Next found typing here that is not saved yet. */
  warning: boolean;
  onKeepEditing: () => void;
  onGoAnyway: () => void;
}) {
  const nextRound = at.kind === 'ready' ? plan.rounds[plan.rounds.indexOf(at.round) + 1] : undefined;
  return (
    <div data-details-guide-foot="" className="shrink-0 border-t border-ink/10 bg-cream px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
      {warning ? (
        <div role="alert" data-details-guide-unsaved="" className="mb-2 flex flex-wrap items-center gap-2 rounded-md bg-terracotta-50 px-3 py-2 text-[13px] text-terracotta-800">
          <span className="min-w-0 flex-1">You changed something here that isn’t saved yet.</span>
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
        {at.kind === 'step' ? (
          <>
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
          </>
        ) : nextRound && onNext ? (
          <button
            type="button"
            onClick={onNext}
            data-details-guide-next=""
            className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full border border-ink/15 bg-white px-4 text-[14px] font-semibold text-ink"
          >
            Next round: {GUIDED_ROUNDS[nextRound].title}
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "What's left" — the way back into the flow from the grouped navigator: the
 * first chip of its strip on a phone, the first row of its column on a desk.
 */
export function WhatsLeftDoor({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <li className="shrink-0 lg:mb-1">
      <button
        type="button"
        onClick={onOpen}
        data-details-guide-open=""
        className="sn-press flex min-h-11 w-[84px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-terracotta-700/10 px-1.5 py-1.5 text-center text-terracotta-800 lg:w-full lg:flex-row lg:justify-start lg:gap-2 lg:px-2.5 lg:text-left"
      >
        <span className="text-[11.5px] font-semibold leading-tight lg:text-[13.5px]">What’s left</span>
        <small className="text-[10.5px] leading-tight text-terracotta-800/80 lg:text-[12px]">{label}</small>
      </button>
    </li>
  );
}

/**
 * Typing in this step that is not saved yet? Read from the fields themselves —
 * a field whose value differs from the one it was drawn with. A field React
 * controls keeps the two in step, so it never reads as unsaved (a miss, never
 * a false alarm); a <select> whose drawn choice is unknown is skipped for the
 * same reason. It only ever ASKS — "Go on without saving" is always there.
 */
export function hasUnsavedEdits(scopes: ReadonlyArray<Element | null>): boolean {
  for (const scope of scopes) {
    if (!scope) continue;
    for (const el of scope.querySelectorAll('input, textarea, select')) {
      if (el instanceof HTMLInputElement) {
        if (el.disabled || ['hidden', 'submit', 'button', 'reset', 'file', 'image'].includes(el.type)) continue;
        if (el.type === 'checkbox' || el.type === 'radio') {
          if (el.checked !== el.defaultChecked) return true;
        } else if (el.value !== el.defaultValue) return true;
      } else if (el instanceof HTMLTextAreaElement) {
        if (!el.disabled && el.value !== el.defaultValue) return true;
      } else if (el instanceof HTMLSelectElement) {
        if (el.disabled) continue;
        const drawn = [...el.options].filter((o) => o.defaultSelected);
        if (drawn.length > 0 && drawn.some((o) => !o.selected)) return true;
      }
    }
  }
  return false;
}
