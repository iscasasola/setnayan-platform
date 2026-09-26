'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Check, Clock } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SubmitButton } from '@/app/_components/submit-button';
import { PAY_CHANNEL_LABEL, type PayChannel } from '@/lib/payment-channels';
import { PaymentsPausedNote } from '@/app/vendor-dashboard/_components/payments-paused-note';
import {
  activateVendorAiAddon,
  type VendorAiAddonActionState,
} from '../ai-addon-actions';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';

/**
 * Vendor AI ("the AI Chatbot") add-on card — the sellable surface on the
 * "Plan & tokens" hub (owner-locked 2026-07-22). Free first 28-day cycle, then
 * ₱1,500 / 28 days, on paid (Solo+) + verified shops only.
 *
 * Honest states:
 *   • assistant not live yet (master flag off) → "Coming soon", NO buy CTA. We
 *     never sell an add-on that can't run — the assistant only answers couples
 *     once NEXT_PUBLIC_VENDOR_AUTOREPLY_V1 is on (the server action rejects too).
 *   • not eligible (free/verified tier OR unverified) → a muted upsell, no CTA.
 *   • eligible + trial available → "Turn on Vendor AI — free first cycle".
 *   • eligible + active → live chip + "active through …" + a Renew button.
 *   • eligible + trial used, not active → "Reactivate — ₱1,500 / 28 days".
 *
 * The buy CTA opens an apply-then-pay order (BDO/GCash) that a Setnayan admin
 * confirms; the FREE first cycle activates instantly. The inbox stays free —
 * this only buys the AI auto-answer.
 */

const IDLE: VendorAiAddonActionState = { status: 'idle' };
const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export type AiAddonCardProps = {
  /** openChannels(settings) — the rails the owner has left ON. Empty = payments
   *  paused: the paid path shows PaymentsPausedNote and its button is disabled
   *  (the server action refuses the same case). A free grant ignores it. */
  openRails: readonly PayChannel[];
  /** Paid tier (Solo+) AND verified — the only shops that can buy. */
  eligible: boolean;
  /** True while the shop is on a paid tier but NOT yet verified. */
  paidButUnverified: boolean;
  /** ai_addon_trial_used_at IS NULL — the free first cycle is still available. */
  trialAvailable: boolean;
  /** isVendorAiAddonActive(ai_addon_expires_at). */
  active: boolean;
  /** ai_addon_expires_at, when set. */
  expiresAt: string | null;
  /** Standing renewal price (₱1,500) from the admin-managed catalog. */
  pricePhp: number;
  /** vendorAutoReplyEnabled() — the GLOBAL master switch. When OFF the whole
   *  add-on is "Coming soon": no buy CTA renders (and the server action rejects),
   *  because the assistant can't answer anyone until it's turned on platform-wide.
   *  We never take money for a feature that can't run yet. */
  assistantLive: boolean;
};

export function AiAddonCard(props: AiAddonCardProps) {
  const {
    eligible,
    paidButUnverified,
    trialAvailable,
    active,
    expiresAt,
    pricePhp,
    assistantLive,
    openRails,
  } = props;

  const toast = useToast();
  const router = useRouter();
  const [state, formAction] = useActionState(activateVendorAiAddon, IDLE);
  const handled = useRef<VendorAiAddonActionState | null>(null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'activated') {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, toast, router]);

  return (
    <section className="sn-tile mt-8 p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
        >
          <Bot className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">Vendor AI — the AI Chatbot</h2>
            {active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-800">
                <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                Active
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-prose text-sm text-ink/65">
            An AI front desk that auto-answers couples&rsquo; factual questions
            (prices, availability, what&rsquo;s included) straight from your own
            catalog — so leads get a reply in seconds. Your inbox is always free;
            this only adds the AI auto-answer.
          </p>
          <p className="mt-2 text-sm font-medium text-ink">
            {trialAvailable ? (
              <>Free first 28-day cycle, then {peso(pricePhp)} / 28 days.</>
            ) : (
              <>{peso(pricePhp)} / 28 days.</>
            )}
          </p>
          {active && expiresAt ? (
            <p className="mt-0.5 text-xs text-ink/55">Active through {fmtDate(expiresAt)}.</p>
          ) : null}
        </div>
      </div>

      {/* ── Availability + eligibility-gated CTA ──────────────────────────── */}
      {!assistantLive ? (
        /* Master flag off → the whole add-on is "Coming soon": no buy CTA, so a
           vendor can't pay for an assistant that can't answer anyone yet. */
        <div
          className="mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs text-ink/60"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          <span>
            Coming soon — Vendor AI is launching shortly. You&rsquo;ll be able to
            turn it on here the moment it goes live.
          </span>
        </div>
      ) : !eligible ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs text-ink/60"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <PaidMark state="locked" label={paidMarkLabel('locked', 'a paid plan')} className="mt-0.5" />
          {paidButUnverified ? (
            <span>Get your shop verified to unlock Vendor AI — it&rsquo;s a verified-only add-on.</span>
          ) : (
            <span>Vendor AI is available on the paid plans (Solo, Pro, Enterprise). Upgrade above to add it.</span>
          )}
        </div>
      ) : (
        <form action={formAction} className="mt-4">
          {/* The paid path needs a pay channel; the free first cycle ignores it. */}
          {!trialAvailable ? (
            openRails.length > 0 ? (
              <fieldset className="mb-3">
                <legend className="text-xs font-medium text-ink">Pay with</legend>
                <div className="mt-1.5 flex flex-wrap gap-3">
                  {/* Only the rails the owner has left open (lib/payment-channels.ts). */}
                  {(['bdo', 'gcash'] as const)
                    .filter((r) => openRails.includes(r))
                    .map((r, n) => (
                      <label key={r} className="inline-flex items-center gap-1.5 text-sm text-ink/80">
                        <input type="radio" name="channel" value={r} defaultChecked={n === 0} />
                        {PAY_CHANNEL_LABEL[r]}
                      </label>
                    ))}
                </div>
              </fieldset>
            ) : (
              <PaymentsPausedNote className="mb-3" />
            )
          ) : null}

          <SubmitButton
            disabled={!trialAvailable && openRails.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta-700 px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta-800"
            pendingLabel={trialAvailable ? 'Turning on…' : 'Starting…'}
          >
            {trialAvailable
              ? 'Turn on Vendor AI — free first cycle'
              : active
                ? `Renew — ${peso(pricePhp)} / 28 days`
                : `Reactivate — ${peso(pricePhp)} / 28 days`}
          </SubmitButton>

          {/* Apply-then-pay instructions after a paid order was started. */}
          {state.status === 'ordered' ? (
            <div className="mt-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
              <p className="font-mono text-lg font-bold">{peso(state.amountPhp)}</p>
              <p className="mt-1">
                Pay to our BDO or GCash account and put{' '}
                <span className="font-mono font-semibold">{state.referenceCode}</span> in the
                transfer note. Vendor AI switches on once our team confirms your
                payment (within 24 hours).
              </p>
            </div>
          ) : null}
        </form>
      )}
    </section>
  );
}
