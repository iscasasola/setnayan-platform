'use client';

import { useTransition } from 'react';
import { X } from 'lucide-react';
import {
  type CategoryDecisionState,
  CATEGORY_STATE_PROMPTS,
} from '@/lib/checklist-state';
import { setCategoryDecision } from '../checklist/actions';

type Props = {
  planGroupId: string;
  currentState: CategoryDecisionState;
  eventId: string;
  /** Display name for the plan group (e.g. "Catering"). */
  label: string;
};

/**
 * CategoryDecisionPrompt — inline contextual nudge for vendor plan groups.
 *
 * Renders a subtle note below a vendor-category group in the checklist.
 * Only shows for two "active" states:
 *   - not_started → 3-button prompt asking what the couple wants to do
 *   - needs_more_options → different prompt suggesting next actions
 *
 * For excluded / deferred → shows a muted pill with an undo button.
 * For all other states (one_option, searching, in_progress, done) → null.
 *
 * Uses useTransition so button press is instant (optimistic) — the
 * revalidation runs in the background without blocking the UI.
 */
export function CategoryDecisionPrompt({ planGroupId, currentState, eventId, label }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleDecision(decision: 'excluded' | 'deferred' | null) {
    startTransition(async () => {
      await setCategoryDecision(eventId, planGroupId, decision);
    });
  }

  // Not started — show the decision prompt
  if (currentState === 'not_started') {
    const prompt = CATEGORY_STATE_PROMPTS.not_started;
    return (
      <div
        className={`mt-1 rounded-lg border border-ink/8 bg-cream px-3 py-2.5 transition-opacity ${
          isPending ? 'opacity-50' : ''
        }`}
      >
        <p className="mb-2 text-xs text-ink/60">{prompt.title}</p>
        <div className="flex flex-wrap gap-1.5">
          {/* "Let's look for one" → no decision, just navigate to vendors */}
          <a
            href={`/dashboard/${eventId}/vendors`}
            className="inline-flex items-center rounded-md border border-ink/15 bg-white px-2.5 py-1 text-xs font-medium text-ink/75 transition hover:border-terracotta/40 hover:text-terracotta"
          >
            {prompt.actions[0]}
          </a>
          {/* "Definite No" → excluded */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleDecision('excluded')}
            className="inline-flex items-center rounded-md border border-ink/15 bg-white px-2.5 py-1 text-xs font-medium text-ink/75 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-40"
          >
            {prompt.actions[1]}
          </button>
          {/* "Not sure yet" → deferred */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleDecision('deferred')}
            className="inline-flex items-center rounded-md border border-ink/15 bg-white px-2.5 py-1 text-xs font-medium text-ink/75 transition hover:border-amber-300 hover:text-amber-700 disabled:opacity-40"
          >
            {prompt.actions[2]}
          </button>
        </div>
      </div>
    );
  }

  // Needs more options — show an alternative prompt
  if (currentState === 'needs_more_options') {
    const prompt = CATEGORY_STATE_PROMPTS.needs_more_options;
    return (
      <div
        className={`mt-1 rounded-lg border border-ink/8 bg-cream px-3 py-2.5 transition-opacity ${
          isPending ? 'opacity-50' : ''
        }`}
      >
        <p className="mb-2 text-xs text-ink/60">{prompt.title}</p>
        <div className="flex flex-wrap gap-1.5">
          {/* "Search more vendors" → vendors tab */}
          <a
            href={`/dashboard/${eventId}/vendors`}
            className="inline-flex items-center rounded-md border border-ink/15 bg-white px-2.5 py-1 text-xs font-medium text-ink/75 transition hover:border-terracotta/40 hover:text-terracotta"
          >
            {prompt.actions[0]}
          </a>
          {/* "Negotiate with current" → messages */}
          <a
            href={`/dashboard/${eventId}/messages`}
            className="inline-flex items-center rounded-md border border-ink/15 bg-white px-2.5 py-1 text-xs font-medium text-ink/75 transition hover:border-ink/30 hover:text-ink disabled:opacity-40"
          >
            {prompt.actions[1]}
          </a>
          {/* "Remove this category" → excluded */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleDecision('excluded')}
            className="inline-flex items-center rounded-md border border-ink/15 bg-white px-2.5 py-1 text-xs font-medium text-ink/75 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-40"
          >
            {prompt.actions[2]}
          </button>
        </div>
      </div>
    );
  }

  // Excluded — show a muted "Not needed" pill with an undo link
  if (currentState === 'excluded') {
    return (
      <div
        className={`mt-1 flex items-center gap-2 transition-opacity ${
          isPending ? 'opacity-50' : ''
        }`}
      >
        <span className="inline-flex items-center gap-1 rounded-full bg-ink/8 px-2 py-0.5 text-[11px] text-ink/50">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink/30" />
          {label} not needed
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleDecision(null)}
          aria-label={`Undo — add ${label} back to your plan`}
          className="inline-flex items-center gap-1 text-[11px] text-ink/40 transition hover:text-terracotta disabled:opacity-40"
        >
          <X aria-hidden className="h-3 w-3" />
          Undo
        </button>
      </div>
    );
  }

  // Deferred — show a muted "Deciding later" pill with an undo link
  if (currentState === 'deferred') {
    return (
      <div
        className={`mt-1 flex items-center gap-2 transition-opacity ${
          isPending ? 'opacity-50' : ''
        }`}
      >
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700/70">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400/50" />
          Deciding later
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleDecision(null)}
          aria-label={`Undo — resume planning for ${label}`}
          className="inline-flex items-center gap-1 text-[11px] text-ink/40 transition hover:text-terracotta disabled:opacity-40"
        >
          <X aria-hidden className="h-3 w-3" />
          Undo
        </button>
      </div>
    );
  }

  // one_option, searching, in_progress, done — no prompt needed
  return null;
}
