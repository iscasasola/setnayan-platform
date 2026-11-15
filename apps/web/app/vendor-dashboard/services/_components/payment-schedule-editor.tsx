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
import { CalendarClock, Check, Plus, Trash2, ArrowUp, ArrowDown, ShieldCheck } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { PillButton, PillTrack } from '@/app/_components/pill-track';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
// Aliased, not relative: the field-parity scan (`canvas-field-parity.test.ts`) walks relative imports, and this shared
// button's own `name={name}` is supplied at a call site, never a field of the schedule.
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
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
  // No-Show Downpayment Protection — the reservation policy. Only the
  // downpayment (row 0) renders + submits these; non-downpayment rows ignore them.
  cancellation_terms: string;
  downpayment_non_refundable: boolean;
  refund_window_days: string;
  no_show_forfeit: boolean;
};

/** Rule 2's section label — small grey capitals, no box. */
const SECTION_LABEL = 'text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]';
/** A field's own label. */
const FIELD_LABEL = 'block text-sm font-medium text-ink';

/**
 * When a payment is due — the ▾ list (template rule 4: a native select became the shared PickMenu). `none` stands for
 * the old empty option; the row still posts `item_due_anchor` as '' for it, through a hidden input.
 */
const DUE_OPTIONS = [
  { key: 'none', label: 'No fixed due date' },
  { key: 'on_lock', label: 'After booking is locked' },
  { key: 'before_event', label: 'Before the event' },
] as const;

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
    cancellation_terms: d.cancellation_terms ?? '',
    downpayment_non_refundable: Boolean(d.downpayment_non_refundable),
    refund_window_days: d.refund_window_days != null ? String(d.refund_window_days) : '',
    no_show_forfeit: Boolean(d.no_show_forfeit),
  };
}

function blankRow(label: string): Row {
  return {
    label,
    amount_kind: 'percent',
    value: '',
    due_anchor: '',
    due_offset_days: '',
    cancellation_terms: '',
    downpayment_non_refundable: false,
    refund_window_days: '',
    no_show_forfeit: false,
  };
}

export function PaymentScheduleEditor({
  serviceId,
  initial,
  bare = false,
}: {
  serviceId: string;
  initial: ScheduleItemDraft[];
  /**
   * The rows only, posting with the card's ONE save (the simpler maker, 2026-10-14): no `<form>`, no heading, no
   * "Save schedule". Same field names, same row shape — `commitVendorService` parses them with the SAME parser as
   * `setServicePaymentSchedule` (`parsePaymentScheduleForm`), the no-show terms on the first payment included.
   */
  bare?: boolean;
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
        : [...prev, blankRow(prev.length === 0 ? 'First payment' : `Payment ${prev.length}`)],
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

  const Shell = bare ? 'div' : 'form';
  return (
    <Shell
      {...(bare ? { 'data-schedule-bare': '' } : { action: setServicePaymentSchedule })}
      className={bare ? 'space-y-2' : 'mt-3 space-y-2 sn-row p-3'}
    >
      {bare ? (
        <input type="hidden" name="schedule_present" value="1" />
      ) : (
        <>
          <input type="hidden" name="vendor_service_id" value={serviceId} />
          <div className="flex items-center gap-1.5">
            <CalendarClock aria-hidden className="h-4 w-4 text-[color:var(--m-slate-2)]" strokeWidth={1.75} />
            <InfoTip label="Payment schedule" labelAs="p" labelClassName="text-sm font-semibold text-ink" align="start">
              Lay out how a couple pays — a first payment plus follow-on payments. Each one can be a % of the total or
              a fixed peso amount, with a due date anchored to booking or the event.
            </InfoTip>
          </div>
          <p className="text-sm text-[color:var(--m-slate-2)]">Optional. The couple sees this on their plan.</p>
        </>
      )}

      {rows.length === 0 ? (
        <p className="py-2 text-sm text-[color:var(--m-slate-2)]">
          No schedule yet. Add a first payment to get started.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--m-line)]">
          {rows.map((r, i) => (
            <li key={i} className="min-h-14 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={SECTION_LABEL}>
                  {i === 0 ? 'First payment' : `Payment ${i}`}
                </span>
                <div className="flex items-center gap-1">
                  <ActionButton tone="neutral" quiet iconOnly icon={ArrowUp} label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="!h-11 !w-11" />
                  <ActionButton
                    tone="neutral"
                    quiet
                    iconOnly
                    icon={ArrowDown}
                    label="Move down"
                    onClick={() => move(i, 1)}
                    disabled={i === rows.length - 1} className="!h-11 !w-11" />
                  <ActionButton tone="danger" quiet iconOnly icon={Trash2} label="Remove payment" onClick={() => remove(i)} className="!h-11 !w-11" />
                </div>
              </div>

              {/* Parallel-array fields — submitted as item_*[] in row order. */}
              <input type="hidden" name="item_amount_kind" value={r.amount_kind} />

              <div className="space-y-2">
                <label className="block space-y-1">
                  <span className={FIELD_LABEL}>Label</span>
                  <input
                    name="item_label"
                    type="text"
                    required
                    maxLength={80}
                    value={r.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    placeholder={i === 0 ? 'First payment' : `Payment ${i}`}
                    className="input-field"
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-end">
                  {/* The app's ONE pill selector (owner 2026-10-08). Each side now SAYS which is picked
                      (`aria-pressed`) — it said nothing before, and the thumb finds the picked side by it. */}
                  <PillTrack data-payment-amount-kind="">
                    <PillButton on={r.amount_kind === 'percent'} aria-pressed={r.amount_kind === 'percent'} onClick={() => update(i, { amount_kind: 'percent' })} className="px-3">
                      % of total
                    </PillButton>
                    <PillButton on={r.amount_kind === 'fixed'} aria-pressed={r.amount_kind === 'fixed'} onClick={() => update(i, { amount_kind: 'fixed' })} className="px-3">
                      Fixed ₱
                    </PillButton>
                  </PillTrack>
                  <label className="block space-y-1">
                    <span className={FIELD_LABEL}>
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
                      className="input-field font-bold tabular-nums"
                    />
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
                  <div className="block space-y-1">
                    <span className={FIELD_LABEL}>Due (optional)</span>
                    {/* The posted value — one per row, in row order, '' for "No fixed due date" (was the select's own). */}
                    <input type="hidden" name="item_due_anchor" value={r.due_anchor} />
                    <PickMenu
                      label="When this payment is due"
                      value={r.due_anchor || 'none'}
                      options={DUE_OPTIONS}
                      onPick={(k) => update(i, { due_anchor: k === 'none' ? '' : (k as DueAnchor) })}
                      dataAttr="data-payment-due-anchor"
                      className="!min-h-11"
                    />
                  </div>
                  <label className="block space-y-1">
                    <span className={FIELD_LABEL}>Days</span>
                    <input
                      name="item_due_offset_days"
                      type="number"
                      min={0}
                      step={1}
                      value={r.due_offset_days}
                      onChange={(e) => update(i, { due_offset_days: e.target.value })}
                      disabled={r.due_anchor === ''}
                      placeholder={r.due_anchor === 'before_event' ? 'e.g. 30' : 'e.g. 7'}
                      className="input-field tabular-nums disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                </div>

                {/*
                  No-Show Downpayment Protection — reservation policy. Visible
                  ONLY on the downpayment row (i === 0). Hidden inputs are
                  emitted for EVERY row so the parallel arrays stay index-aligned
                  on the server; non-downpayment rows submit empty/false values
                  (the server only keeps the policy on seq 0 anyway).
                */}
                {/*
                  Booleans submit via ALWAYS-PRESENT hidden inputs (driven by
                  state) — NOT raw checkboxes — so every row contributes exactly
                  one array entry and the server's parallel-array indexing stays
                  aligned (an unchecked checkbox submits nothing, which would
                  misalign). The visible checkbox below is pure UI state on row 0.
                */}
                <input
                  type="hidden"
                  name="item_downpayment_non_refundable"
                  value={i === 0 && r.downpayment_non_refundable ? '1' : ''}
                />
                <input
                  type="hidden"
                  name="item_no_show_forfeit"
                  value={i === 0 && r.no_show_forfeit ? '1' : ''}
                />
                {i === 0 ? (
                  <div className="space-y-2 border-t border-[color:var(--m-line)] pt-3" data-no-show-terms="">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck
                        aria-hidden
                        className="h-4 w-4 text-terracotta"
                        strokeWidth={1.75}
                      />
                      <InfoTip label="No-show protection (reservation terms)" labelAs="p" labelClassName={SECTION_LABEL} align="start">
                        Spell out your cancellation / no-show terms for this first payment. The couple must tick
                        &ldquo;I understand&rdquo; before they can lock, and we freeze these exact words as proof if a
                        forfeit is ever disputed. Setnayan never holds the money — you collect it directly.
                      </InfoTip>
                    </div>

                    <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={r.downpayment_non_refundable}
                        onChange={(e) =>
                          update(i, { downpayment_non_refundable: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-[color:var(--m-line)] text-terracotta focus:ring-terracotta"
                      />
                      <span>First payment is non-refundable</span>
                    </label>

                    <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={r.no_show_forfeit}
                        onChange={(e) => update(i, { no_show_forfeit: e.target.checked })}
                        className="h-4 w-4 rounded border-[color:var(--m-line)] text-terracotta focus:ring-terracotta"
                      />
                      <span>A no-show forfeits the first payment</span>
                    </label>

                    <label className="block space-y-1">
                      <span className={FIELD_LABEL}>
                        Refundable up to (days after booking · optional)
                      </span>
                      <input
                        name="item_refund_window_days"
                        type="number"
                        min={0}
                        step={1}
                        value={r.refund_window_days}
                        onChange={(e) => update(i, { refund_window_days: e.target.value })}
                        placeholder="e.g. 7 — leave blank for none"
                        className="input-field tabular-nums"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className={FIELD_LABEL}>
                        Cancellation terms (shown to the couple verbatim)
                      </span>
                      <textarea
                        name="item_cancellation_terms"
                        rows={3}
                        maxLength={2000}
                        value={r.cancellation_terms}
                        onChange={(e) => update(i, { cancellation_terms: e.target.value })}
                        placeholder="e.g. The reservation first payment secures your date and is non-refundable. If you cancel within 7 days of booking, the first payment is returned in full."
                        className="input-field"
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    {/* Index-aligners for non-downpayment rows (empty policy). */}
                    <input type="hidden" name="item_refund_window_days" value="" />
                    <input type="hidden" name="item_cancellation_terms" value="" />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ActionButton
          tone="neutral"
          icon={Plus}
          label={rows.length === 0 ? 'Add first payment' : 'Add payment'}
          onClick={add}
          disabled={rows.length >= MAX_SCHEDULE_ITEMS} className="!h-11" />
        {bare ? null : (
          <SupplierSubmit tone="brand" icon={<Check aria-hidden strokeWidth={1.9} />} label="Save schedule" pendingLabel="Saving…" />
        )}
      </div>
    </Shell>
  );
}
