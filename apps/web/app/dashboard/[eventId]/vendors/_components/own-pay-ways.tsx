'use client';

/**
 * OwnPayWays — the Pay sheet's "How to pay them" for a supplier the couple ADDED THEMSELVES. (2026-10-29)
 *
 * Booked prototype v4 (owner-approved; owner: *"also manually add payment method/s"* · *"via QR or text details"*):
 * each way the couple wrote on their record — the method, their QR (a tap shows it full size), the details with
 * **Copy details**. Then the payment card below records it ("I paid ₱X" → the Budget's `logPayment`), as it always did.
 *
 * Read-only. Nothing here sends, tracks or creates a payment. A refused read is SAID, never drawn as "none added".
 */

import { useId, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { GuestPopup } from '../../guests/_components/guest-popup';
import { payWayLabel, type PayWayView } from '@/lib/self-added-pay-ways';

const K2 = 'text-[11px] uppercase tracking-[0.14em] text-ink/55';

export function OwnPayWays({ vendorName, ways }: { vendorName: string; ways: PayWayView[] | 'unreadable' }) {
  const [big, setBig] = useState<PayWayView | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const titleId = useId();

  async function copy(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      window.setTimeout(() => setCopied((c) => (c === i ? null : c)), 2000);
    } catch {
      // The details stay on screen to read — nothing was lost by a refused clipboard.
    }
  }

  return (
    <section className="space-y-1.5" data-pay-section="ways">
      <p className={K2}>How to pay them</p>
      {ways === 'unreadable' ? (
        <p role="alert" className="text-[13px] text-danger-800 dark:text-danger-200">
          We couldn&apos;t load how to pay {vendorName} just now. Refresh to try again.
        </p>
      ) : ways.length === 0 ? (
        <p className="text-[13px] leading-snug text-ink/60">
          You haven&apos;t added how to pay {vendorName} yet — add their QR or account details in your record.
        </p>
      ) : (
        <ul>
          {ways.map((w, i) => (
            <li key={i} data-pay-way="" className="flex items-start gap-3 border-t border-ink/10 py-3 first:border-t-0">
              {w.qrUrl ? (
                <button
                  type="button"
                  onClick={() => setBig(w)}
                  aria-label={`${payWayLabel(w.method)} QR — tap to see it full size`}
                  className="sn-press block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-ink/10" // no-card-ok: the QR's quiet zone, pressable
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a presigned private picture */}
                  <img src={w.qrUrl} alt="" className="h-full w-full object-contain" />
                </button>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink">{payWayLabel(w.method)}</p>
                {w.details ? (
                  <>
                    <p className="whitespace-pre-line break-words text-[13.5px] leading-snug text-ink/75">{w.details}</p>
                    <div className="mt-1.5">
                      <ActionButton
                        tone="neutral"
                        icon={copied === i ? Check : Copy}
                        label={copied === i ? 'Copied' : 'Copy details'}
                        onClick={() => void copy(i, w.details ?? '')}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {big?.qrUrl ? (
        <GuestPopup
          onClose={() => setBig(null)}
          rootClassName="fixed inset-0 z-[96] flex items-center justify-center p-4"
          panelClassName="relative flex w-full max-w-[400px] flex-col items-center gap-3 rounded-3xl bg-cream p-4 shadow-[0_30px_80px_-30px_rgba(26,26,26,0.5)]"
          labelledById={titleId}
        >
          <div className="flex w-full items-center justify-between">
            <p id={titleId} className="sn-eye">
              {payWayLabel(big.method)} · {vendorName}
            </p>
            <ActionButton tone="neutral" quiet iconOnly icon={X} label="Close" onClick={() => setBig(null)} />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- a presigned private picture */}
          <img src={big.qrUrl} alt={`${payWayLabel(big.method)} QR`} className="max-h-[70dvh] w-full rounded-xl bg-white object-contain" />
        </GuestPopup>
      ) : null}
    </section>
  );
}
