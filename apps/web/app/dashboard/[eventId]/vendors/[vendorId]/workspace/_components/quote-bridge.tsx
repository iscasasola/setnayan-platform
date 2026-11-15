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
import { ActionButton, EqualRow } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { updateVendorCosts } from '../../../actions';
import { useSaveLoader } from '@/components/sd-loader';

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
  const save = useSaveLoader();
  // Esc, the backdrop, the ✕ and the phone's Back all go through the house sheet's onClose — suspended mid-submit so
  // an in-flight save can't be interrupted (matched the old inline guard).
  const close = () => {
    if (!pending) setOpen(false);
  };

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
        await save.run(() => updateVendorCosts(form), {
          steps: ['Saving the quote'],
          hint: 'Saving',
        });
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

  // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 9 · 11 · 13 · 14): each offer is a row that needs you — a gold edge,
  // bold money, one shared pill — not a tinted box; the money-safety gate RISES as the house sheet (✕ and Cancel go
  // back, the two foot buttons equal widths) instead of a hand-drawn overlay. Every number and word kept.
  return (
    <>
      {/* --- Advisory affordances (no auto-fill; just open the gate) --- */}
      <div className="divide-y divide-ink/10">
        {hasChat && leadChat != null ? (
          <div className="flex min-h-14 flex-wrap items-center gap-2 border-l-[3px] border-l-terracotta py-2.5 pl-3">
            <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            <p className="min-w-0 flex-1 text-sm text-ink">
              Quote received in chat — <span className="font-bold tabular-nums">{fmtPeso(leadChat)}</span>. Log it
              to your build?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {chatAmountsPesos.slice(0, 3).map((amt) => (
                <ActionButton
                  key={`chat-${amt}`}
                  tone="brand"
                  icon={Receipt}
                  label={`Log ${fmtPeso(amt)}`}
                  onClick={() => openWith({ servicePesos: amt, label: 'Quote from chat' })}
                />
              ))}
            </div>
          </div>
        ) : null}

        {hasProposals
          ? proposalCandidates.map((p) => (
              <div
                key={p.id}
                className="flex min-h-14 flex-wrap items-center gap-2 border-l-[3px] border-l-terracotta py-2.5 pl-3"
              >
                <Receipt aria-hidden className="h-4 w-4 shrink-0 text-ink/70" strokeWidth={1.75} />
                <p className="min-w-0 flex-1 text-sm text-ink">
                  <span className="font-semibold">{p.label}</span> —{' '}
                  <span className="font-bold tabular-nums">
                    {fmtPeso((p.servicePesos || 0) + (p.transportPesos || 0) + (p.foodPesos || 0))}
                  </span>
                </p>
                <ActionButton
                  tone="brand"
                  icon={Receipt}
                  label="Log as service price"
                  onClick={() =>
                    openWith({
                      servicePesos: p.servicePesos,
                      transportPesos: p.transportPesos,
                      foodPesos: p.foodPesos,
                      label: p.label,
                    })
                  }
                />
              </div>
            ))
          : null}
      </div>

      {/* --- The money-safety gate: an editable confirm, in the house sheet --- */}
      <Sheet
        open={open}
        onClose={close}
        labelledById="quote-bridge-heading"
        rise
        foot={
          <div className="px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
            <EqualRow>
              <ActionButton tone="neutral" icon={X} label="Cancel" onClick={close} disabled={pending} />
              <ActionButton
                type="submit"
                form="quote-bridge-form"
                tone="brand"
                main
                icon={Receipt}
                label={pending ? 'Saving…' : 'Confirm & save to build'}
                waiting={pending}
              />
            </EqualRow>
          </div>
        }
      >
        <div className="space-y-3 px-4 pb-4 pt-3">
          <header className="space-y-1 pr-12">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
              {sourceLabel || 'Log this quote'}
            </p>
            <h2 id="quote-bridge-heading" className="text-[17px] font-semibold text-ink">
              <InfoTip label="Log this quote to your build" labelAs="span" labelClassName="text-[17px] font-semibold text-ink" align="start">
                We&rsquo;ve filled in the amount we found. Check every number and edit anything before saving — nothing is
                saved until you confirm.
              </InfoTip>
            </h2>
          </header>

          <form id="quote-bridge-form" className="divide-y divide-ink/10" onSubmit={handleConfirm}>
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
              <label key={line.name} className="flex min-h-14 items-center justify-between gap-3 text-[15px]">
                <span className="text-ink">{line.label}</span>
                <span className="inline-flex items-center gap-1">
                  <span className="font-semibold text-ink/70">₱</span>
                  <input
                    name={line.name}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={line.value}
                    onChange={(e) => line.set(e.target.value)}
                    autoFocus={line.name === 'service'}
                    className="min-h-12 w-36 rounded-xl border border-ink/15 bg-white dark:bg-raised px-3 text-right text-[15px] font-semibold tabular-nums text-ink focus:border-terracotta focus:outline-none"
                  />
                </span>
              </label>
            ))}
          </form>

          <p className="text-[13px] leading-relaxed text-ink/70">
            Saving overwrites your stored costs for this supplier. Transport &amp; food start from your current values —
            change them only if you mean to.
          </p>

          {errorMsg ? (
            <p role="alert" className="text-[13px] text-[rgb(var(--color-danger))]">
              {errorMsg}
            </p>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
