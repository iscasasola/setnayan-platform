'use client';

import type { ReactNode } from 'react';
import { PickMenu, type PickOption } from '../../website/editor/_components/pick-menu';
import {
  progressLabel,
  progressShare,
  roundName,
  stageSteps,
  type GuidedPlan,
  type GuidedScreen,
  type GuidedStepKey,
  type GuidedStepState,
} from '@/lib/details-guided-flow';
import { isSetupStage } from '@/lib/stage-setup';

/**
 * DETAILS › WHAT'S LEFT — THE PARTS DRAWN BEFORE A STEP IS (Details part 5):
 * the top line (progress and the ONE step dropdown, "Save the Date · 3 of 7 ▾"), the
 * "What's left" door back into the flow, and the unsaved-typing check. They
 * stay in the Maker's first load; the step's own heading, its foot and the
 * Ready screens (\`details-guide.tsx\`) load with the Details pieces
 * (\`details-lazy.tsx\`) — the Maker must never be slow
 * (\`scripts/check-maker-js-budget.mjs\`).
 */

const MARK: Record<GuidedStepState, NonNullable<PickOption['trail']>> = {
  done: { text: '✓', tone: 'ok', label: 'done' },
  left: { text: '○', tone: 'left', label: 'still to do' },
  check: { text: 'Look over', tone: 'muted' },
};

export function screenKey(at: GuidedScreen): string {
  switch (at.kind) {
    case 'stages':
      return 'stages';
    case 'step':
      return `step:${at.round}:${at.step}`;
    default:
      return `${at.kind}:${at.round}`;
  }
}

export function screenFromKey(key: string): GuidedScreen | null {
  if (key === 'stages') return { kind: 'stages' };
  const [kind, round, step] = key.split(':');
  if (!isSetupStage(round)) return null;
  if (kind === 'step' && step) return { kind: 'step', step: step as GuidedStepKey, round };
  if (kind === 'ready' || kind === 'before') return { kind, round };
  return null;
}

/** The step ▾'s own row for "All items" — leaves the flow for the grouped list. */
const ALL_ITEMS = 'all-items';

/** The top line: progress, the step list (one dropdown), All items. */
export function GuideTop({
  plan,
  at,
  onPick,
  onAllItems,
  tour = null,
  inSheet = false,
}: {
  plan: GuidedPlan;
  at: GuidedScreen;
  onPick: (at: GuidedScreen) => void;
  onAllItems: () => void;
  tour?: ReactNode;
  /**
   * 📱 The step sheet's header lead (`MakerHalfSheet`'s `head`, details-workspace.tsx):
   * ONLY the step ▾ — "Save the Date · 3 of 6 ▾" — and All items is its last
   * row (owner, live iPhone test 2026-10-05: one slim header, step ▾ · Peek · ×).
   * Otherwise this is the desktop's line, with its bar and its All items button.
   */
  inSheet?: boolean;
}) {
  /* 🗂 Every stage's steps, each under its stage — a fact two stages share is
     listed under both (one step, picked from either), then the stage's Apply. */
  const options: PickOption[] = [
    { key: 'stages', label: 'Which stage do you want ready?' },
    ...plan.rounds.flatMap((r) => {
      const group = roundName(plan, r);
      return [
        ...stageSteps(plan, r).map(
          (s): PickOption => ({ key: `step:${r}:${s.key}`, label: s.optional ? `${s.title} · optional` : s.title, group, trail: MARK[s.state] }),
        ),
        { key: `ready:${r}`, label: `Apply · ${plan.roundWords[r].ready}`, group },
      ];
    }),
    ...(inSheet ? [{ key: ALL_ITEMS, label: 'All items' }] : []),
  ];
  const steps = (
    <PickMenu
      label="Pick a step — any time"
      value={screenKey(at)}
      options={options}
      onPick={(k) => {
        if (k === ALL_ITEMS) {
          onAllItems();
          return;
        }
        const next = screenFromKey(k);
        if (next) onPick(next);
      }}
      buttonText={progressLabel(plan, at)}
      dataAttr="data-details-guide-steps"
      className="font-mono !text-[12px] tracking-[0.04em]"
    />
  );
  if (inSheet) {
    return (
      <div data-details-guide-top="sheet" className="flex min-w-0 items-center lg:hidden">
        {steps}
      </div>
    );
  }
  return (
    <div
      data-details-guide-top=""
      className="flex shrink-0 items-center gap-2.5 border-b border-ink/10 bg-cream/80 px-3 py-1.5 max-lg:hidden sm:px-4"
    >
      <span aria-hidden className="block h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-ink/10 sm:w-24">
        <span className="block h-full rounded-full bg-terracotta-700" style={{ width: `${Math.round(progressShare(plan, at) * 100)}%` }} />
      </span>
      {steps}
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
        className="sn-press flex min-h-11 w-[112px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-terracotta-700/10 px-1.5 py-1.5 text-center text-terracotta-800 lg:w-full lg:flex-row lg:justify-start lg:gap-2 lg:px-2.5 lg:text-left"
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
