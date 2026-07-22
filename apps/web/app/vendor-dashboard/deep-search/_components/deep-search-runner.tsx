'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Lock, Gift } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  runVendorDeepSearch,
  type VendorDeepSearchActionState,
} from '../actions';
import { DossierView } from './dossier-view';

/**
 * Deep Search runner — the eligible-vendor run/buy surface (owner-locked
 * 2026-07-22). Honest states:
 *   • not eligible (free/verified tier OR unverified) → muted upsell, no CTA.
 *   • eligible + free this cycle (Pro+ with 0 uses) → "Run free Deep Search".
 *   • eligible + paid (Solo always · Pro+ after the free one) → BDO/GCash
 *     apply-then-pay, "Run Deep Search — ₱500".
 *
 * The FREE run executes in the server action and returns the dossier straight
 * back — rendered inline. A PAID run opens an apply-then-pay order and runs on
 * admin approval; the vendor sees it in their history on the next load.
 */

const IDLE: VendorDeepSearchActionState = { status: 'idle' };
const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

export type DeepSearchRunnerProps = {
  /** Paid tier (Solo+) AND verified — the only shops that can run it. */
  eligible: boolean;
  /** True while the shop is on a paid tier but NOT yet verified. */
  paidButUnverified: boolean;
  /** Resolved price is ₱0 (Pro+ with the free allowance unused this cycle). */
  isFreeNow: boolean;
  /** Does this tier get a free search per cycle at all (Pro/Ent/Custom)? */
  hasFreeAllowance: boolean;
  /** Standing per-search price (₱500) from the admin-managed catalog. */
  pricePhp: number;
};

export function DeepSearchRunner(props: DeepSearchRunnerProps) {
  const { eligible, paidButUnverified, isFreeNow, hasFreeAllowance, pricePhp } = props;

  const toast = useToast();
  const router = useRouter();
  const [state, formAction] = useActionState(runVendorDeepSearch, IDLE);
  const handled = useRef<VendorDeepSearchActionState | null>(null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'ran') {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, toast, router]);

  if (!eligible) {
    return (
      <div
        className="mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs text-ink/60"
        style={{ borderColor: 'var(--m-line)' }}
      >
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        {paidButUnverified ? (
          <span>Get your shop verified to unlock Deep Search — it&rsquo;s a verified-only add-on.</span>
        ) : (
          <span>
            Deep Search is available on the paid plans (Solo, Pro, Enterprise). Upgrade to run it.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Honest price line */}
      <div className="flex flex-wrap items-center gap-2">
        {isFreeNow ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-medium text-success-800">
            <Gift className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            1 free this cycle
          </span>
        ) : (
          <span className="text-sm font-medium text-ink">{peso(pricePhp)} per search</span>
        )}
        {hasFreeAllowance ? (
          <span className="text-xs text-ink/55">
            {isFreeNow
              ? `Then ${peso(pricePhp)} each · resets every 28 days.`
              : `You’ve used this cycle’s free search — next resets in your new cycle.`}
          </span>
        ) : (
          <span className="text-xs text-ink/55">Every search is {peso(pricePhp)} on your plan.</span>
        )}
      </div>

      <form action={formAction} className="mt-3 space-y-3">
        {/* The paid path needs a pay channel; the free run ignores it. */}
        {!isFreeNow ? (
          <fieldset>
            <legend className="text-xs font-medium text-ink">Pay with</legend>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-1.5 text-sm text-ink/80">
                <input type="radio" name="channel" value="bdo" defaultChecked />
                BDO
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm text-ink/80">
                <input type="radio" name="channel" value="gcash" />
                GCash
              </label>
            </div>
          </fieldset>
        ) : null}

        <SubmitButton
          className="inline-flex items-center gap-1.5 rounded-lg bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
          pendingLabel={isFreeNow ? 'Searching the web…' : 'Starting…'}
        >
          <Search className="h-4 w-4" strokeWidth={2} aria-hidden />
          {isFreeNow ? 'Run free Deep Search' : `Run Deep Search — ${peso(pricePhp)}`}
        </SubmitButton>
      </form>

      {/* FREE run finished → the dossier, inline. */}
      {state.status === 'ran' ? (
        <div className="mt-5">
          <DossierView dossier={state.dossier} />
        </div>
      ) : null}

      {/* PAID run → apply-then-pay instructions. */}
      {state.status === 'ordered' ? (
        <div className="mt-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          <p className="font-mono text-lg font-bold">{peso(state.amountPhp)}</p>
          <p className="mt-1">
            Pay to our BDO or GCash account and put{' '}
            <span className="font-mono font-semibold">{state.referenceCode}</span> in the
            transfer note. Your Deep Search runs once our team confirms your payment
            (within 24 hours) — the result appears here below.
          </p>
        </div>
      ) : null}
    </div>
  );
}
