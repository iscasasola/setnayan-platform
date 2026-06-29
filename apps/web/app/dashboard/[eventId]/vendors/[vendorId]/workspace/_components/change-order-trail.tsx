'use client';

// ==========================================================================
// Change-Order Trail — COUPLE surface.
//
// Renders the both-acknowledged add-on/removal log for this booking plus the
// couple's controls:
//   • "Propose a change" → raise a couple-side change order (add-on or removal).
//   • For a VENDOR-raised proposed order → Accept / Decline (the couple is the
//     counterparty; accept settles the delta into the budget ledger via the RPC).
//   • For the couple's OWN proposed order → Withdraw.
//   • Resolved orders (accepted/declined/withdrawn) render as an immutable row.
//
// OFF-PLATFORM MONEY: delta is a host/vendor-entered PHP figure for the couple's
// own ledger — NOT a charge through Setnayan. Setnayan never holds funds. The
// state machine NEVER writes the other side's data; all transitions go through
// the SECURITY DEFINER RPCs (single-winner + idempotent).
// ==========================================================================

import { useState, useTransition } from 'react';
import {
  CheckCircle2,
  Clock,
  FilePlus2,
  Loader2,
  MinusCircle,
  PlusCircle,
  XCircle,
} from 'lucide-react';
import {
  raiseChangeOrder,
  respondChangeOrder,
  withdrawChangeOrder,
} from '../../../actions';

export type ChangeOrderRow = {
  change_order_id: string;
  raised_by: 'couple' | 'vendor';
  title: string | null;
  description: string | null;
  delta_amount_php: number | string | null;
  proposed_due_date: string | null;
  status: 'proposed' | 'accepted' | 'declined' | 'withdrawn';
  acknowledged_at: string | null;
  decline_reason: string | null;
  created_at: string;
};

type Props = {
  eventId: string;
  vendorId: string;
  vendorName: string;
  changeOrders: ChangeOrderRow[];
};

function fmtPHP(raw: number | string | null): string {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (n === null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `−${abs}` : `+${abs}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

const STATUS_CHIP: Record<
  ChangeOrderRow['status'],
  { label: string; cls: string }
> = {
  proposed: {
    label: 'Awaiting response',
    cls: 'border-warn-300 bg-warn-50 text-warn-900',
  },
  accepted: {
    label: 'Accepted',
    cls: 'border-success-400 bg-success-50 text-success-700',
  },
  declined: {
    label: 'Declined',
    cls: 'border-ink/15 bg-ink/5 text-ink/60',
  },
  withdrawn: {
    label: 'Withdrawn',
    cls: 'border-ink/15 bg-ink/5 text-ink/60',
  },
};

export function ChangeOrderTrail({
  eventId,
  vendorId,
  vendorName,
  changeOrders,
}: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'add-on' | 'removal'>('add-on');
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleRaise(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const form = new FormData(e.currentTarget);
    form.set('event_id', eventId);
    form.set('vendor_id', vendorId);
    form.set('change_kind', kind);
    startTransition(async () => {
      const result = await raiseChangeOrder(form);
      if (result.status === 'ok') {
        setOpen(false);
      } else if (result.status === 'not_signed_in') {
        setErrorMsg('Please sign in again to propose a change.');
      } else {
        setErrorMsg(result.message ?? 'Could not propose the change — please try again.');
      }
    });
  }

  function handleRespond(changeOrderId: string, decision: 'accept' | 'decline') {
    setErrorMsg(null);
    setBusyId(changeOrderId);
    const form = new FormData();
    form.set('event_id', eventId);
    form.set('vendor_id', vendorId);
    form.set('change_order_id', changeOrderId);
    form.set('decision', decision);
    startTransition(async () => {
      const result = await respondChangeOrder(form);
      setBusyId(null);
      if (result.status !== 'ok' && result.status !== 'already') {
        setErrorMsg(result.message ?? 'Could not record your response — please try again.');
      }
    });
  }

  function handleWithdraw(changeOrderId: string) {
    setErrorMsg(null);
    setBusyId(changeOrderId);
    const form = new FormData();
    form.set('event_id', eventId);
    form.set('vendor_id', vendorId);
    form.set('change_order_id', changeOrderId);
    startTransition(async () => {
      const result = await withdrawChangeOrder(form);
      setBusyId(null);
      if (result.status !== 'ok' && result.status !== 'already') {
        setErrorMsg(result.message ?? 'Could not withdraw — please try again.');
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-ink/10 bg-white/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold text-ink">
          <FilePlus2 aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Change orders
        </p>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta bg-terracotta px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-terracotta/90"
          >
            <PlusCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Propose a change
          </button>
        ) : null}
      </div>

      <p className="text-[11px] text-ink/60">
        Added or dropped something with {vendorName} after booking? Log it as a
        change order — they accept or decline, and an accepted change updates your
        budget. Setnayan never holds your money; this is your own record.
      </p>

      {errorMsg ? (
        <p role="alert" className="text-[11px] font-medium text-danger-600">
          {errorMsg}
        </p>
      ) : null}

      {open ? (
        <form onSubmit={handleRaise} className="space-y-3 rounded-md border border-ink/10 bg-cream/40 p-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind('add-on')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                kind === 'add-on'
                  ? 'border-terracotta bg-terracotta text-white'
                  : 'border-ink/15 bg-white text-ink/70 hover:bg-cream'
              }`}
            >
              <PlusCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Add-on
            </button>
            <button
              type="button"
              onClick={() => setKind('removal')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                kind === 'removal'
                  ? 'border-terracotta bg-terracotta text-white'
                  : 'border-ink/15 bg-white text-ink/70 hover:bg-cream'
              }`}
            >
              <MinusCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Removal
            </button>
          </div>

          <div className="space-y-1">
            <label htmlFor="co_title" className="block text-[11px] font-medium text-ink/70">
              What&rsquo;s changing
            </label>
            <input
              id="co_title"
              name="title"
              type="text"
              maxLength={120}
              required
              placeholder={kind === 'add-on' ? 'e.g. Extra hour of coverage' : 'e.g. Drop the photo booth'}
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="co_amount" className="block text-[11px] font-medium text-ink/70">
                {kind === 'add-on' ? 'Added cost (₱)' : 'Credit back (₱)'}
              </label>
              <input
                id="co_amount"
                name="amount_php"
                type="number"
                min="1"
                step="0.01"
                required
                inputMode="decimal"
                placeholder="e.g. 5000"
                className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="co_due" className="block text-[11px] font-medium text-ink/70">
                Due date <span className="text-ink/40">(optional)</span>
              </label>
              <input
                id="co_due"
                name="proposed_due_date"
                type="date"
                className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="co_desc" className="block text-[11px] font-medium text-ink/70">
              Details <span className="text-ink/40">(optional)</span>
            </label>
            <textarea
              id="co_desc"
              name="description"
              rows={2}
              maxLength={2000}
              placeholder="Anything the vendor should know"
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta bg-terracotta px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-terracotta/90 disabled:opacity-60"
            >
              {pending && busyId === null ? (
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <FilePlus2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              Send to {vendorName}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setErrorMsg(null);
              }}
              disabled={pending}
              className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-cream disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {changeOrders.length === 0 ? (
        <p className="text-[11px] italic text-ink/45">No change orders yet.</p>
      ) : (
        <ul className="space-y-2">
          {changeOrders.map((co) => {
            const chip = STATUS_CHIP[co.status];
            const isVendorRaised = co.raised_by === 'vendor';
            const isProposed = co.status === 'proposed';
            const busy = busyId === co.change_order_id;
            return (
              <li
                key={co.change_order_id}
                className="rounded-md border border-ink/10 bg-white px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                      {co.title ?? 'Change order'}
                      <span className="font-normal text-ink/45">·</span>
                      <span
                        className={`font-mono ${
                          (typeof co.delta_amount_php === 'string'
                            ? Number(co.delta_amount_php)
                            : co.delta_amount_php ?? 0) < 0
                            ? 'text-success-700'
                            : 'text-ink/75'
                        }`}
                      >
                        {fmtPHP(co.delta_amount_php)}
                      </span>
                    </p>
                    <p className="text-[10px] text-ink/50">
                      {isVendorRaised ? `${vendorName} proposed` : 'You proposed'} ·{' '}
                      {fmtDate(co.created_at)}
                      {co.proposed_due_date ? ` · due ${fmtDate(co.proposed_due_date)}` : ''}
                    </p>
                    {co.description ? (
                      <p className="mt-1 text-[11px] text-ink/60">{co.description}</p>
                    ) : null}
                    {co.status === 'declined' && co.decline_reason ? (
                      <p className="mt-1 text-[11px] text-ink/55">
                        Reason: {co.decline_reason}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${chip.cls}`}
                  >
                    {co.status === 'accepted' ? (
                      <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    ) : co.status === 'proposed' ? (
                      <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    ) : (
                      <XCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                    {chip.label}
                  </span>
                </div>

                {/* Couple is the counterparty to a VENDOR-raised proposed order. */}
                {isProposed && isVendorRaised ? (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleRespond(co.change_order_id, 'accept')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta bg-terracotta px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-terracotta/90 disabled:opacity-60"
                    >
                      {busy && pending ? (
                        <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2} />
                      ) : (
                        <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
                      )}
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleRespond(co.change_order_id, 'decline')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1 text-[11px] font-medium text-ink/70 transition-colors hover:bg-cream disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                ) : null}

                {/* Couple withdraws their OWN proposed order. */}
                {isProposed && !isVendorRaised ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleWithdraw(co.change_order_id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1 text-[11px] font-medium text-ink/70 transition-colors hover:bg-cream disabled:opacity-60"
                    >
                      {busy && pending ? (
                        <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2} />
                      ) : null}
                      Withdraw
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
