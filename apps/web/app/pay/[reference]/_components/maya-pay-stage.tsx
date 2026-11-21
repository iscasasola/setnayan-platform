import { Lock } from 'lucide-react';
import { CopyButton } from '@/app/_components/copy-button';
import { SubmitButton } from '@/app/_components/submit-button';
import { payAmount } from '@/lib/pay-amount';
import { submitPaymentProof } from '../actions';
import { MayaMarks } from './maya-marks';

/**
 * 💳 THE PAY STAGE WHEN MAYA IS ON — the approved v3 drawing (owner "approved.", 2026-11-21, DECISION_LOG
 * "MAYA PAY PAGE v3"; `prototypes/pay_maya_2026-11-21/pay_maya_fable.html`). It replaces stage 2 of the shipped page:
 *
 *   the amount, the one focal point → Order summary (item · who · amount, Reference + Copy, Billed to, one hairline,
 *   Total) → "Pay with" and the marks in the ruled order → the pinned "Pay ₱X" with "Secured by Maya · Your receipt
 *   arrives here the moment it's paid." above it — the only accent on the stage.
 *
 * ⚖ BDO is NOT a choice here (DECISION_LOG "BDO QR IS NOT AN OPTION — ONLY THE SAFETY ROUTE WHEN MAYA IS OFF"):
 * no link, no QR, no numbers. ⚖ No fee line: the payer pays the order total exactly; Setnayan absorbs Maya's fee.
 *
 * A server component handed to the pay panel as its stage 2. The press posts `intent=maya_checkout` to the page's
 * existing form action, which re-checks everything and opens Maya's hosted page (./maya-start.ts);
 * it reads "Opening Maya…" while that happens. On a computer the stage splits the way hosted checkouts do.
 */
export function MayaPayStage({
  reference,
  amountPhp,
  title,
  who,
  billedToName,
  billedToEmail,
  line,
}: {
  reference: string;
  amountPhp: number;
  title: string;
  who: string | null;
  billedToName: string | null;
  billedToEmail: string | null;
  /** One line above the summary after a cancelled or failed try ("…Nothing was charged."). */
  line: string | null;
}) {
  const amount = payAmount(amountPhp);
  return (
    <section id="payCard" data-pay-maya-stage="" className="mt-5 scroll-mt-4 pb-40 md:pb-0">
      <p className="sn-eye">Pay this exact amount</p>
      <p className="mt-2 text-[44px] font-bold leading-none tracking-tight tabular-nums text-ink">{amount}</p>
      {line ? (
        <p role="status" data-pay-maya-line="" className="mt-4 text-sm text-ink/75">
          {line}
        </p>
      ) : null}

      <div className="mt-6 md:grid md:grid-cols-2 md:items-start md:gap-8">
        {/* ── Order summary — the one softly warmed card ── */}
        <div className="rounded-card bg-[color:var(--m-paper-2)] p-5" data-pay-maya-summary="">
          <p className="text-sm font-semibold text-ink">Order summary</p>
          <div className="mt-3 flex items-start justify-between gap-4 text-sm">
            <div className="min-w-0">
              <p className="text-ink">{title}</p>
              {who ? <p className="mt-0.5 text-xs text-ink/60">{who}</p> : null}
            </div>
            <p className="shrink-0 tabular-nums text-ink">{amount}</p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span className="text-ink/60">Reference</span>
            <span className="flex items-center gap-2">
              <code className="font-mono text-[13px] font-semibold tracking-wide text-ink">{reference}</code>
              <CopyButton value={reference} label="Copy" />
            </span>
          </div>
          {billedToName || billedToEmail ? (
            <div className="mt-3 flex items-start justify-between gap-3 text-sm">
              <span className="text-ink/60">Billed to</span>
              <span className="min-w-0 text-right">
                {billedToName ? <span className="block text-ink">{billedToName}</span> : null}
                {billedToEmail ? <span className="block truncate text-xs text-ink/60">{billedToEmail}</span> : null}
              </span>
            </div>
          ) : null}
          <div className="mt-4 flex items-baseline justify-between border-t border-ink/10 pt-3">
            <span className="text-sm font-semibold text-ink">Total</span>
            <span className="text-base font-bold tabular-nums text-ink">{amount}</span>
          </div>
        </div>

        {/* ── Pay with — the marks, then the press ── */}
        <div className="mt-6 md:mt-0">
          <p className="text-sm font-semibold text-ink">Pay with</p>
          <div className="mt-3">
            <MayaMarks />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink/60">
            You choose one on Maya&rsquo;s secure page, then come straight back here for your receipt — nothing to
            upload.
          </p>

          {/* Pinned on a phone (the only accent on the stage); in reach under the methods on a computer. */}
          <form
            action={submitPaymentProof}
            data-pay-maya=""
            className="sn-glass-row fixed inset-x-0 bottom-0 z-40 pl-[max(1rem,var(--sn-safe-l))] pr-[max(1rem,var(--sn-safe-r))] py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] md:static md:mt-6 md:bg-transparent md:p-0"
          >
            <input type="hidden" name="intent" value="maya_checkout" />
            <input type="hidden" name="reference" value={reference} />
            <div className="mx-auto max-w-[560px] md:max-w-none">
              <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-ink/60 md:justify-start">
                <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Secured by Maya · Your receipt arrives here the moment it&rsquo;s paid.
              </p>
              <SubmitButton className="button-primary h-11 w-full justify-center" pendingLabel="Opening Maya…">
                Pay {amount}
              </SubmitButton>
              <p className="mt-2 hidden text-xs text-ink/55 md:block">Opens Maya&rsquo;s secure page in this tab.</p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
