'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Lock, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { useToast } from '@/app/_components/toast/toast-provider';
import { routes } from '@/lib/routes';
import type { DeepSearchAllowance } from '@/lib/vendor-deep-search-offer';
import { DEEP_SEARCH_PLANS_WORDS, deepSearchRunsWords } from '@/lib/deep-search-findings';
import { TIER_LABEL } from '@/lib/vendor-tier-caps';
import { runVendorDeepSearch, type VendorDeepSearchActionState } from '../actions';

/**
 * Deep Search runner — the one Run surface (the Deep Search page and Shop › Details' card mount it). Honest states,
 * owner 2026-11-22 (DECISION_LOG ✂️ "DEEP SEARCH IS RETIRED" + 🔎 "DEEP SEARCH ALLOWANCE = 1 RUN A MONTH"):
 *   • Free or Verified → the lock: "Included in Plus · Upgrade", the door to the Plans page. Nothing to buy here.
 *   • a paid plan, not verified → the one step that opens it (get verified), no Run.
 *   • this month's searches couldn't be read → says so; no Run (the server would refuse too).
 *   • searches left → "1 of 1 search left this month · comes back <date>" and Run.
 *   • none left → when they come back; no Run.
 * ⛔ No price, no pay rails, no order: Deep Search is never sold per search. 🔒 lib/deep-search-is-never-sold.test.ts
 */

const IDLE: VendorDeepSearchActionState = { status: 'idle' };

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

export type DeepSearchRunnerProps = {
  /** The shop is verified — the one requirement no plan lifts. */
  verified: boolean;
  /** The plan includes Deep Search (Plus, Pro, Ultra). */
  included: boolean;
  /** This month's searches (`loadDeepSearchOffer`). */
  allowance: DeepSearchAllowance;
};

export function DeepSearchRunner({ verified, included, allowance }: DeepSearchRunnerProps) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState(runVendorDeepSearch, IDLE);
  const handled = useRef<VendorDeepSearchActionState | null>(null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'started') toast.success('Deep Search started');
  }, [state, toast]);

  if (!included) {
    return (
      <div className="sn-row mt-4 flex flex-wrap items-center gap-3 px-3 py-2.5" data-deep-search-lock="">
        <Lock aria-hidden className="h-4 w-4 shrink-0 text-ink/60" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 text-sm text-ink">
          Included in {TIER_LABEL.solo}
          <span className="block text-xs text-ink/60">Every paid plan — {DEEP_SEARCH_PLANS_WORDS} — includes searches each month.</span>
        </span>
        <ActionButton tone="brand" icon={Sparkles} label="Upgrade" href={routes.vendorDashboard.subscription()} />
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="sn-row mt-4 flex items-start gap-2 px-3 py-2.5 text-xs text-ink/60">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span>Get your shop verified to run Deep Search — it&rsquo;s for verified shops.</span>
      </div>
    );
  }

  if (!allowance.read) {
    return (
      <p className="mt-4 text-sm text-ink/70" data-deep-search-allowance="unread">
        Couldn&rsquo;t read this month&rsquo;s searches. Reload to try again.
      </p>
    );
  }

  const { perMonth, left, resetsAtIso } = allowance;
  const running = state.status === 'started';
  return (
    <div className="mt-4" data-deep-search-allowance={String(left)}>
      <p className="text-sm text-ink">
        {perMonth === null
          ? 'No searches are set for this month yet.'
          : `${deepSearchRunsWords(left)} left this month, of ${deepSearchRunsWords(perMonth)} your plan includes.`}
        <span className="block text-xs text-ink/60">
          {/* "Unused searches don't carry over" is said once, in the card's intro (final check B5-12). */}
          New searches on {shortDate(resetsAtIso)}.
        </span>
      </p>

      {left > 0 && !running ? (
        <form action={formAction} className="mt-3">
          <ActionButton
            tone="brand"
            main
            type="submit"
            icon={Search}
            label={pending ? 'Starting…' : 'Run Deep Search'}
            disabled={pending}
          />
        </form>
      ) : null}

      {running ? (
        <p className="mt-3 text-sm text-ink" role="status">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
