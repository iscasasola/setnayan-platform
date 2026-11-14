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
import { CheckCircle2, FilePlus2, MinusCircle, PlusCircle, XCircle } from 'lucide-react';
import { ActionButton, EqualRow } from '@/components/action-button';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import {
  raiseChangeOrder,
  respondChangeOrder,
  withdrawChangeOrder,
} from '../../../actions';
import { useSaveLoader } from '@/components/sd-loader';
import { formatCalendarDate } from '@/lib/events';

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
  /** 🔌 The change-order read was refused — said, never "No change orders yet." (reads-are-honest, audit #12). */
  readFailed?: boolean;
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
    // A DATE column — the day it names must not move with the reader.
  return formatCalendarDate(iso, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/** Each state as the shared chip — soft fill, no border, never pressable (design template rule 5). */
const STATUS_CHIP: Record<ChangeOrderRow['status'], { label: string; tone: BadgeTone }> = {
  proposed: { label: 'Awaiting response', tone: 'wait' },
  accepted: { label: 'Accepted', tone: 'ok' },
  declined: { label: 'Declined', tone: 'quiet' },
  withdrawn: { label: 'Withdrawn', tone: 'quiet' },
};

export function ChangeOrderTrail({
  eventId,
  vendorId,
  vendorName,
  changeOrders,
  readFailed = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'add-on' | 'removal'>('add-on');
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const save = useSaveLoader();

  function handleRaise(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const form = new FormData(e.currentTarget);
    form.set('event_id', eventId);
    form.set('vendor_id', vendorId);
    form.set('change_kind', kind);
    startTransition(async () => {
      const result = await save.run(() => raiseChangeOrder(form), {
        steps: ['Proposing the change'],
        hint: 'Saving',
      });
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
      const result = await save.run(() => respondChangeOrder(form), {
        steps: ['Sending your response'],
        hint: 'Saving',
      });
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
      const result = await save.run(() => withdrawChangeOrder(form), {
        steps: ['Withdrawing the change'],
        hint: 'Saving',
      });
      setBusyId(null);
      if (result.status !== 'ok' && result.status !== 'already') {
        setErrorMsg(result.message ?? 'Could not withdraw — please try again.');
      }
    });
  }

  // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 5 · 6 · 7 · 9 · 11 · 13 · 15): no card — the section's grey
  // capitals with the "your own record" explaining behind ⓘ and "Propose a change" beside it; the form RISES as the
  // house sheet (✕ and Cancel go back, the two foot buttons equal widths) instead of opening in a box inside the box;
  // each order is a plain row — the money bold on the right, its state a soft chip, a gold edge while it waits on you;
  // every button the shared pill, grey while it saves (no spinner).
  return (
    <div className="space-y-1">
      <div className="mb-1 mt-[18px] flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2">
          <FilePlus2 aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          <InfoTip
            label="Change orders"
            labelAs="span"
            labelClassName="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70"
            align="start"
          >
            Added or dropped something with {vendorName} after booking? Log it as a change order — they accept or
            decline, and an accepted change updates your budget. Setnayan never holds your money; this is your own
            record.
          </InfoTip>
        </p>
        <ActionButton tone="brand" icon={PlusCircle} label="Propose a change" onClick={() => setOpen(true)} />
      </div>

      {errorMsg && !open ? (
        <p role="alert" className="text-[13px] font-medium text-[rgb(var(--color-danger))]">
          {errorMsg}
        </p>
      ) : null}

      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setErrorMsg(null);
        }}
        labelledById="co_sheet_title"
        rise
        foot={
          <div className="px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
            <EqualRow>
              <ActionButton
                tone="neutral"
                icon={XCircle}
                label="Cancel"
                onClick={() => {
                  setOpen(false);
                  setErrorMsg(null);
                }}
              />
              <ActionButton
                type="submit"
                form="co_form"
                tone="brand"
                main
                icon={FilePlus2}
                label={`Send to ${vendorName}`}
                waiting={pending && busyId === null}
              />
            </EqualRow>
          </div>
        }
      >
        <form id="co_form" onSubmit={handleRaise} className="space-y-3 px-4 pb-4 pt-3">
          <h2 id="co_sheet_title" className="pr-12 text-[17px] font-semibold text-ink">
            Propose a change
          </h2>
          <EqualRow>
            <ActionButton
              tone="neutral"
              filled={kind === 'add-on'}
              icon={PlusCircle}
              label="Add-on"
              onClick={() => setKind('add-on')}
            />
            <ActionButton
              tone="neutral"
              filled={kind === 'removal'}
              icon={MinusCircle}
              label="Removal"
              onClick={() => setKind('removal')}
            />
          </EqualRow>

          <div className="space-y-1">
            <label htmlFor="co_title" className="block text-[13px] font-semibold text-ink">
              What&rsquo;s changing
            </label>
            <input
              id="co_title"
              name="title"
              type="text"
              maxLength={120}
              required
              placeholder={kind === 'add-on' ? 'e.g. Extra hour of coverage' : 'e.g. Drop the photo booth'}
              className="min-h-12 w-full rounded-xl border border-ink/15 bg-white dark:bg-raised px-3 py-2 text-[15px] text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="co_amount" className="block text-[13px] font-semibold text-ink">
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
                className="min-h-12 w-full rounded-xl border border-ink/15 bg-white dark:bg-raised px-3 py-2 text-[15px] text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="co_due" className="block text-[13px] font-semibold text-ink">
                Due date <span className="font-normal text-ink/70">(optional)</span>
              </label>
              <input
                id="co_due"
                name="proposed_due_date"
                type="date"
                className="min-h-12 w-full rounded-xl border border-ink/15 bg-white dark:bg-raised px-3 py-2 text-[15px] text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="co_desc" className="block text-[13px] font-semibold text-ink">
              Details <span className="font-normal text-ink/70">(optional)</span>
            </label>
            <textarea
              id="co_desc"
              name="description"
              rows={2}
              maxLength={2000}
              placeholder="Anything the supplier should know"
              className="min-h-12 w-full rounded-xl border border-ink/15 bg-white dark:bg-raised px-3 py-2 text-[15px] text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          {errorMsg ? (
            <p role="alert" className="text-[13px] font-medium text-[rgb(var(--color-danger))]">
              {errorMsg}
            </p>
          ) : null}
        </form>
      </Sheet>

      {readFailed ? (
        <p role="alert" className="py-2 text-sm text-warn-800">
          Couldn’t load the change orders — not the same as none. Reload in a moment.
        </p>
      ) : changeOrders.length === 0 ? (
        <p className="py-2 text-sm text-ink/70">No change orders yet.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {changeOrders.map((co) => {
            const chip = STATUS_CHIP[co.status];
            const isVendorRaised = co.raised_by === 'vendor';
            const isProposed = co.status === 'proposed';
            const busy = busyId === co.change_order_id;
            const delta =
              typeof co.delta_amount_php === 'string' ? Number(co.delta_amount_php) : co.delta_amount_php ?? 0;
            return (
              <li
                key={co.change_order_id}
                className={`min-h-14 py-2.5 ${isProposed && isVendorRaised ? 'border-l-[3px] border-l-terracotta pl-3' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink">{co.title ?? 'Change order'}</p>
                    <p className="text-[13px] text-ink/70">
                      {isVendorRaised ? `${vendorName} proposed` : 'You proposed'} ·{' '}
                      {fmtDate(co.created_at)}
                      {co.proposed_due_date ? ` · due ${fmtDate(co.proposed_due_date)}` : ''}
                    </p>
                    {co.description ? (
                      <p className="mt-1 text-[13px] text-ink/70">{co.description}</p>
                    ) : null}
                    {co.status === 'declined' && co.decline_reason ? (
                      <p className="mt-1 text-[13px] text-ink/70">
                        Reason: {co.decline_reason}
                      </p>
                    ) : null}
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`text-[15px] font-bold tabular-nums ${
                        delta < 0 ? 'text-[rgb(var(--color-ok))]' : 'text-ink'
                      }`}
                    >
                      {fmtPHP(co.delta_amount_php)}
                    </span>
                    <Badge tone={chip.tone}>{chip.label}</Badge>
                  </span>
                </div>

                {/* Couple is the counterparty to a VENDOR-raised proposed order. */}
                {isProposed && isVendorRaised ? (
                  <div className="mt-2 flex items-center gap-2">
                    <ActionButton
                      tone="ok"
                      icon={CheckCircle2}
                      label="Accept"
                      onClick={() => handleRespond(co.change_order_id, 'accept')}
                      waiting={busy && pending}
                      disabled={pending && !busy}
                    />
                    <ActionButton
                      tone="danger"
                      quiet
                      icon={XCircle}
                      label="Decline"
                      onClick={() => handleRespond(co.change_order_id, 'decline')}
                      disabled={pending}
                    />
                  </div>
                ) : null}

                {/* Couple withdraws their OWN proposed order. */}
                {isProposed && !isVendorRaised ? (
                  <div className="mt-2">
                    <ActionButton
                      tone="neutral"
                      icon={MinusCircle}
                      label="Withdraw"
                      onClick={() => handleWithdraw(co.change_order_id)}
                      waiting={busy && pending}
                      disabled={pending && !busy}
                    />
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
