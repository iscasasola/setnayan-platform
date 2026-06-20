'use client';

/**
 * PaymentScheduleEditor — Vendor Transaction Lifecycle · Phase 2 · PR-A.
 *
 * Lets a vendor define a payment schedule for a service at create/edit time:
 * a downpayment (the first row) plus payment 1…X. Each installment carries
 *   • a label,
 *   • an amount expressed as a % of the total OR a fixed ₱ (a per-row toggle),
 *   • an optional anchored due date ("after booking is locked" / "before the
 *     event") + a number of days.
 *
 * The list is interactive (add / remove / move up-down). On save it submits one
 * parallel-array entry per row to setServicePaymentSchedule, which assigns seq
 * from array order and replaces the whole set. The schedule is OPTIONAL — saving
 * with zero rows clears it. The server action re-validates everything; this is
 * fast-feedback UX, not the security boundary.
 *
 * Styling matches the sibling SlotEditor / setServiceLinks blocks on the page
 * (cream card, ink tokens, terracotta accent, SubmitButton).
 */

import { useState } from 'react';
import { CalendarClock, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { setServicePaymentSchedule } from '../actions';
import {
  MAX_SCHEDULE_ITEMS,
  type AmountKind,
  type DueAnchor,
  type ScheduleItemDraft,
} from '@/lib/vendor-service-payment-schedules';

type Row = {
  label: string;
  amount_kind: AmountKind;
  value: string; // whole percent (0–100) or whole pesos
  due_anchor: '' | DueAnchor;
  due_offset_days: string;
};

function draftToRow(d: ScheduleItemDraft): Row {
  return {
    label: d.label,
    amount_kind: d.amount_kind,
    value:
      d.amount_kind === 'percent'
        ? d.percent != null
          ? String(d.percent)
          : ''
        : d.amount_php != null
          ? String(d.amount_php)
          : '',
    due_anchor: d.due_anchor ?? '',
    due_offset_days: d.due_offset_days != null ? String(d.due_offset_days) : '',
  };
}

function blankRow(label: string): Row {
  return { label, amount_kind: 'percent', value: '', due_anchor: '', due_offset_days: '' };
}

export function PaymentScheduleEditor({
  serviceId,
  initial,
}: {
  serviceId: string;
  initial: ScheduleItemDraft[];
}) {
  const [rows, setRows] = useState<Row[]>(
    initial.length > 0 ? initial.map(draftToRow) : [],
  );

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    setRows((prev) =>
      prev.length >= MAX_SCHEDULE_ITEMS
        ? prev
        : [...prev, blankRow(prev.length === 0 ? 'Downpayment' : `Payment ${prev.length}`)],
    );
  }
  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const a = prev[i];
      const b = prev[j];
      if (a === undefined || b === undefined) return prev;
      const next = [...prev];
      next[i] = b;
      next[j] = a;
      return next;
    });
  }

  return (
    <form
      action={setServicePaymentSchedule}
      className="mt-3 space-y-2 rounded-xl border border-ink/10 bg-cream p-3"
    >
      <input type="hidden" name="vendor_service_id" value={serviceId} />
      <div className="flex items-center gap-1.5">
        <CalendarClock aria-hidden className="h-3.5 w-3.5 text-ink/55" strokeWidth={1.75} />
        <p className="text-sm font-medium text-ink">Payment schedule</p>
      </div>
      <p className="text-xs text-ink/55">
        Optional. Lay out how a couple pays — a downpayment plus follow-on
        payments. Each one can be a % of the total or a fixed peso amount, with a
        due date anchored to booking or the event. The couple sees this on their
        plan.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink/15 px-3 py-3 text-xs text-ink/45">
          No schedule yet. Add a downpayment to get started.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={i}
              className="rounded-lg border border-ink/10 bg-white/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  {i === 0 ? 'Downpayment' : `Payment ${i}`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === rows.length - 1}
                    aria-label="Move down"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label="Remove installment"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-terracotta/10 hover:text-terracotta"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              {/* Parallel-array fields — submitted as item_*[] in row order. */}
              <input type="hidden" name="item_amount_kind" value={r.amount_kind} />

              <div className="space-y-2">
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-ink/75">Label</span>
                  <input
                    name="item_label"
                    type="text"
                    required
                    maxLength={80}
                    value={r.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    placeholder={i === 0 ? 'Downpayment' : `Payment ${i}`}
                    className="input-field"
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-end">
                  <div className="inline-flex overflow-hidden rounded-md border border-ink/20">
                    <button
                      type="button"
                      onClick={() => update(i, { amount_kind: 'percent' })}
                      className={`px-3 py-2 text-xs font-medium ${
                        r.amount_kind === 'percent'
                          ? 'bg-terracotta text-white'
                          : 'bg-cream text-ink/70 hover:bg-ink/5'
                      }`}
                    >
                      % of total
                    </button>
                    <button
                      type="button"
                      onClick={() => update(i, { amount_kind: 'fixed' })}
                      className={`px-3 py-2 text-xs font-medium ${
                        r.amount_kind === 'fixed'
                          ? 'bg-terracotta text-white'
                          : 'bg-cream text-ink/70 hover:bg-ink/5'
                      }`}
                    >
                      Fixed ₱
                    </button>
                  </div>
                  <label className="block space-y-1">
                    <span className="block text-xs font-medium text-ink/75">
                      {r.amount_kind === 'percent' ? 'Percent (0–100)' : 'Amount (PHP)'}
                    </span>
                    <input
                      name="item_value"
                      type="number"
                      required
                      min={0}
                      max={r.amount_kind === 'percent' ? 100 : undefined}
                      step={1}
                      value={r.value}
                      onChange={(e) => update(i, { value: e.target.value })}
                      placeholder={r.amount_kind === 'percent' ? 'e.g. 50' : 'e.g. 10000'}
                      className="input-field"
                    />
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
                  <label className="block space-y-1">
                    <span className="block text-xs font-medium text-ink/75">Due (optional)</span>
                    <select
                      name="item_due_anchor"
                      value={r.due_anchor}
                      onChange={(e) =>
                        update(i, { due_anchor: e.target.value as '' | DueAnchor })
                      }
                      className="input-field cursor-pointer"
                    >
                      <option value="">No fixed due date</option>
                      <option value="on_lock">After booking is locked</option>
                      <option value="before_event">Before the event</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="block text-xs font-medium text-ink/75">Days</span>
                    <input
                      name="item_due_offset_days"
                      type="number"
                      min={0}
                      step={1}
                      value={r.due_offset_days}
                      onChange={(e) => update(i, { due_offset_days: e.target.value })}
                      disabled={r.due_anchor === ''}
                      placeholder={r.due_anchor === 'before_event' ? 'e.g. 30' : 'e.g. 7'}
                      className="input-field disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={add}
          disabled={rows.length >= MAX_SCHEDULE_ITEMS}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ink/20 bg-cream px-3 text-[11px] font-medium text-ink hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
          {rows.length === 0 ? 'Add downpayment' : 'Add payment'}
        </button>
        <SubmitButton
          className="inline-flex h-8 items-center justify-center rounded-md border border-ink/20 bg-cream px-3 text-[11px] font-medium text-ink hover:border-ink/40"
          pendingLabel="Saving…"
        >
          Save schedule
        </SubmitButton>
      </div>
    </form>
  );
}
