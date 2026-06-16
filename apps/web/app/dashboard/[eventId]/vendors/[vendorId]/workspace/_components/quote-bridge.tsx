'use client';

/**
 * apps/web/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/quote-bridge.tsx
 *
 * Vendor-authored quote bridge — host-search improvement #1.
 *
 * Lets a vendor's quoted price flow into the couple's Build with ONE tap +
 * couple confirmation, instead of the couple hand-typing it. Two entry points,
 * one money-safety gate:
 *
 *   • Chat-quote chip — when the detector finds a ₱ amount in a recent VENDOR
 *     chat message and the couple hasn't logged a matching service cost yet, a
 *     calm "Quote received — log it to your build?" chip appears on the Costing
 *     header.
 *   • Proposal action — "Log as service price" on a structured proposal.
 *
 * Both open the SAME confirm modal (the gate). The modal is PRE-FILLED but
 * EVERY number is editable, and transport/food pre-fill with the couple's
 * CURRENT stored values (never zeroed). Only on explicit Confirm does it post
 * to the existing `updateVendorCosts` server action — the detector never writes.
 *
 * Reuses updateVendorCosts (../../actions) — no new writer, no schema.
 */

import { useState, useTransition } from 'react';
import { X, Receipt, Sparkles } from 'lucide-react';
import { updateVendorCosts } from '../../../actions';

/** A candidate quote the couple can choose to log. */
export type QuoteCandidate = {
  /** Stable key for the picker. */
  id: string;
  /** Short human label, e.g. "From chat" or the proposal title. */
  label: string;
  /** Where it came from — drives the chip copy + icon. */
  source: 'chat' | 'proposal';
  /** Pre-fill for the Service price line (pesos). */
  servicePesos: number;
  /** Optional pre-fill for Transport (pesos) — only proposals split this. */
  transportPesos?: number | null;
  /** Optional pre-fill for Food allowance (pesos) — only proposals split this. */
  foodPesos?: number | null;
};

type Props = {
  eventId: string;
  vendorId: string;
  /** Detected amounts from recent VENDOR chat messages (pesos), newest-first. */
  chatAmountsPesos: number[];
  /** Structured proposals the couple can log (already split). */
  proposalCandidates: QuoteCandidate[];
  /** Couple's CURRENT stored costs (pesos) — pre-fill seeds, never zeroed. */
  currentServicePesos: number | null;
  currentTransportPesos: number | null;
  currentFoodPesos: number | null;
  /** Whether the chat chip should show (computed server-side, advisory only). */
  showChatChip: boolean;
};

function pesoStr(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '';
  // Trim trailing .00 for clean default values in the number input.
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function fmtPeso(n: number): string {
  return `₱${n.toLocaleString('en-PH', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function QuoteBridge({
  eventId,
  vendorId,
  chatAmountsPesos,
  proposalCandidates,
  currentServicePesos,
  currentTransportPesos,
  currentFoodPesos,
  showChatChip,
}: Props) {
  const [open, setOpen] = useState(false);
  // Editable modal fields (strings — they're number-input values).
  const [service, setService] = useState('');
  const [transport, setTransport] = useState('');
  const [food, setFood] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasChat = showChatChip && chatAmountsPesos.length > 0;
  const hasProposals = proposalCandidates.length > 0;
  // Nothing to offer → render nothing (fail-soft).
  if (!hasChat && !hasProposals) return null;

  /**
   * Open the gate. Pre-fill service from the chosen amount; pre-fill transport
   * + food from the candidate's split IF it carries one, else from the couple's
   * CURRENT stored values (never zero them out).
   */
  function openWith(opts: {
    servicePesos: number;
    transportPesos?: number | null;
    foodPesos?: number | null;
    label: string;
  }) {
    setErrorMsg(null);
    setService(pesoStr(opts.servicePesos));
    setTransport(
      pesoStr(
        typeof opts.transportPesos === 'number' && opts.transportPesos > 0
          ? opts.transportPesos
          : currentTransportPesos,
      ),
    );
    setFood(
      pesoStr(
        typeof opts.foodPesos === 'number' && opts.foodPesos > 0
          ? opts.foodPesos
          : currentFoodPesos,
      ),
    );
    setSourceLabel(opts.label);
    setOpen(true);
  }

  function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const form = new FormData();
    form.set('event_id', eventId);
    form.set('vendor_id', vendorId);
    // Blank → omit so parseMoney maps it to null (₱0), matching the Costing form.
    if (service.trim()) form.set('total_cost_php', service.trim());
    if (transport.trim()) form.set('transport_php', transport.trim());
    if (food.trim()) form.set('food_allowance_php', food.trim());
    startTransition(async () => {
      try {
        await updateVendorCosts(form);
        setOpen(false);
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Could not save — please try again.',
        );
      }
    });
  }

  // The single chat amount we lead the chip with (freshest, first in list).
  const leadChat = hasChat ? chatAmountsPesos[0] : null;

  return (
    <>
      {/* --- Advisory affordances (no auto-fill; just open the gate) --- */}
      <div className="space-y-2">
        {hasChat && leadChat != null ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-terracotta/25 bg-terracotta/5 px-3 py-2.5">
            <Sparkles
              aria-hidden
              className="h-4 w-4 shrink-0 text-terracotta"
              strokeWidth={1.75}
            />
            <p className="min-w-0 flex-1 text-xs text-ink/75">
              Quote received in chat —{' '}
              <span className="font-semibold text-ink">{fmtPeso(leadChat)}</span>. Log it
              to your build?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {chatAmountsPesos.slice(0, 3).map((amt) => (
                <button
                  key={`chat-${amt}`}
                  type="button"
                  onClick={() =>
                    openWith({ servicePesos: amt, label: 'Quote from chat' })
                  }
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-terracotta/30 bg-cream px-3 py-1.5 text-xs font-semibold text-terracotta transition-colors hover:bg-terracotta/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                >
                  Log {fmtPeso(amt)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {hasProposals
          ? proposalCandidates.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-mulberry/20 bg-mulberry/5 px-3 py-2.5"
              >
                <Receipt
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-mulberry"
                  strokeWidth={1.75}
                />
                <p className="min-w-0 flex-1 text-xs text-ink/75">
                  <span className="font-medium text-ink">{p.label}</span> —{' '}
                  <span className="font-semibold text-ink">
                    {fmtPeso(
                      (p.servicePesos || 0) +
                        (p.transportPesos || 0) +
                        (p.foodPesos || 0),
                    )}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() =>
                    openWith({
                      servicePesos: p.servicePesos,
                      transportPesos: p.transportPesos,
                      foodPesos: p.foodPesos,
                      label: p.label,
                    })
                  }
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-mulberry/30 bg-cream px-3 py-1.5 text-xs font-semibold text-mulberry transition-colors hover:bg-mulberry/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                >
                  Log as service price
                </button>
              </div>
            ))
          : null}
      </div>

      {/* --- The money-safety gate: editable confirm modal --- */}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quote-bridge-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !pending) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-cream p-6 shadow-xl ring-1 ring-ink/10">
            <header className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                  {sourceLabel || 'Log this quote'}
                </p>
                <h2
                  id="quote-bridge-heading"
                  className="text-lg font-semibold text-ink"
                >
                  Log this quote to your build
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                disabled={pending}
                className="rounded-full p-1 text-ink/50 hover:bg-ink/5 hover:text-ink disabled:opacity-50"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </header>

            <p className="mt-3 text-sm text-ink/70">
              We&rsquo;ve filled in the amount we found. Check every number and edit
              anything before saving — nothing is saved until you confirm.
            </p>

            <form className="mt-4 space-y-3" onSubmit={handleConfirm}>
              {[
                { label: 'Service price', value: service, set: setService, name: 'service' },
                {
                  label: 'Transport cost',
                  value: transport,
                  set: setTransport,
                  name: 'transport',
                },
                { label: 'Food allowance', value: food, set: setFood, name: 'food' },
              ].map((line) => (
                <label
                  key={line.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-ink/65">{line.label}</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="text-ink/40">₱</span>
                    <input
                      name={line.name}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={line.value}
                      onChange={(e) => line.set(e.target.value)}
                      autoFocus={line.name === 'service'}
                      className="w-32 rounded-md border border-ink/15 bg-white px-2 py-1 text-right font-medium text-ink focus:border-terracotta focus:outline-none"
                    />
                  </span>
                </label>
              ))}

              <p className="text-[11px] leading-relaxed text-ink/55">
                Saving overwrites your stored costs for this vendor. Transport &amp; food
                start from your current values — change them only if you mean to.
              </p>

              {errorMsg ? (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-inset ring-rose-200">
                  {errorMsg}
                </p>
              ) : null}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/10 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600 disabled:opacity-60"
                >
                  {pending ? 'Saving…' : 'Confirm & save to build'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
