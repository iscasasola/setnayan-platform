'use client';

/**
 * PaymentPlanRows — the couple's instalment plan for a supplier they added.
 * (owner 2026-09-20: *"Payment Plan Must set date for until the payment is
 * fully paid. just like on our quote maker."*)
 *
 * ── The same control the suppliers already use ────────────────────────────
 * Deliberately the shape of `vendor-dashboard/services/_components/
 * payment-schedule-editor.tsx`: a label, an amount as % or ₱, and a due date
 * anchored *after booking is locked* / *before the event* plus a day offset.
 * The owner chose relative anchors over calendar dates so a plan self-corrects
 * when a wedding date moves.
 *
 * It is a SIBLING, not an import: that editor posts to
 * `setServicePaymentSchedule` (a vendor's reusable template on a
 * `vendor_services` row) and carries the no-show protection fields, which a
 * couple has no business setting. This one posts the couple's own per-booking
 * plan. The shared part — the date and amount MATH — is genuinely shared:
 * both resolve through `computePlanInstances`, so neither can drift on what a
 * date means.
 *
 * ── The running total is the feature ──────────────────────────────────────
 * "Until fully paid" is only checkable if the plan covers the price, so the
 * footer shows scheduled-vs-price live and the server refuses a plan that
 * misses (`buildCouplePaymentPlan`). The number here is a preview; the server
 * re-computes it. A percent row with no price shows "—", never ₱0.
 *
 * Motion: rows enter on `.sn-canvas-rise` (the maker's own entrance) and leave
 * by removal. The global `prefers-reduced-motion` block in globals.css
 * disables all of it with `!important`; nothing here opts out.
 */

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarClock, Plus, Trash2 } from 'lucide-react';

type Row = {
  key: number;
  label: string;
  kind: 'percent' | 'fixed';
  value: string;
  anchor: '' | 'on_lock' | 'before_event';
  days: string;
};

const ANCHOR_LABEL: Record<'on_lock' | 'before_event', string> = {
  on_lock: 'after booking',
  before_event: 'before the event',
};

const MAX_ROWS = 12;

const CELL =
  'w-full rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-xs text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60';

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString('en-PH')}`;
}

export function PaymentPlanRows({
  totalPhp,
  initial,
  disabled,
}: {
  /** The agreed total the plan must add up to. Null = no price set yet. */
  totalPhp: number | null;
  initial?: ReadonlyArray<Omit<Row, 'key'>>;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    (initial && initial.length > 0
      ? initial
      : [
          { label: 'Downpayment', kind: 'percent' as const, value: '50', anchor: 'on_lock' as const, days: '0' },
          { label: 'Balance', kind: 'percent' as const, value: '50', anchor: 'before_event' as const, days: '7' },
        ]
    ).map((r, i) => ({ ...r, key: i })),
  );
  const [nextKey, setNextKey] = useState(rows.length);

  function patch(key: number, p: Partial<Row>) {
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }
  function add() {
    if (rows.length >= MAX_ROWS) return;
    setRows((cur) => [
      ...cur,
      { key: nextKey, label: '', kind: 'percent', value: '', anchor: 'before_event', days: '0' },
    ]);
    setNextKey((k) => k + 1);
  }
  function remove(key: number) {
    setRows((cur) => cur.filter((r) => r.key !== key));
  }
  function move(key: number, dir: -1 | 1) {
    setRows((cur) => {
      const i = cur.findIndex((r) => r.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  /** Preview only — the server re-computes and is the authority. */
  const scheduled = useMemo(() => {
    let sum = 0;
    for (const r of rows) {
      const n = Number(r.value);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (r.kind === 'fixed') sum += n;
      else if (totalPhp != null) sum += (totalPhp * n) / 100;
    }
    return sum;
  }, [rows, totalPhp]);

  const covered = totalPhp != null && Math.abs(scheduled - totalPhp) <= 1;

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="sn-canvas-rise grid grid-cols-[minmax(0,1.3fr)_52px_44px_minmax(0,1.2fr)_40px_auto] items-center gap-1.5"
            style={{ animationDelay: `${Math.min(i, 8) * 26}ms` }}
          >
            <input
              type="text"
              name="plan_label"
              value={r.label}
              disabled={disabled}
              maxLength={60}
              placeholder="Downpayment"
              aria-label={`Payment ${i + 1} name`}
              onChange={(e) => patch(r.key, { label: e.target.value })}
              className={CELL}
            />
            <input
              type="text"
              name="plan_value"
              inputMode="decimal"
              value={r.value}
              disabled={disabled}
              placeholder="50"
              aria-label={`Payment ${i + 1} amount`}
              onChange={(e) => patch(r.key, { value: e.target.value })}
              className={CELL}
            />
            <select
              name="plan_kind"
              value={r.kind}
              disabled={disabled}
              aria-label={`Payment ${i + 1} amount type`}
              onChange={(e) => patch(r.key, { kind: e.target.value === 'fixed' ? 'fixed' : 'percent' })}
              className={CELL}
            >
              <option value="percent">%</option>
              <option value="fixed">₱</option>
            </select>
            <select
              name="plan_anchor"
              value={r.anchor}
              disabled={disabled}
              aria-label={`Payment ${i + 1} due date`}
              onChange={(e) =>
                patch(r.key, { anchor: e.target.value as Row['anchor'] })
              }
              className={CELL}
            >
              <option value="on_lock">{ANCHOR_LABEL.on_lock}</option>
              <option value="before_event">{ANCHOR_LABEL.before_event}</option>
            </select>
            <input
              type="text"
              name="plan_days"
              inputMode="numeric"
              value={r.days}
              disabled={disabled}
              placeholder="0"
              aria-label={`Payment ${i + 1} days from the anchor`}
              onChange={(e) => patch(r.key, { days: e.target.value })}
              className={CELL}
            />
            <span className="flex items-center">
              <button
                type="button"
                disabled={disabled || i === 0}
                onClick={() => move(r.key, -1)}
                aria-label={`Move payment ${i + 1} earlier`}
                className="inline-flex h-7 w-6 items-center justify-center rounded text-ink/40 transition-colors hover:text-ink disabled:opacity-30"
              >
                <ArrowUp aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                disabled={disabled || i === rows.length - 1}
                onClick={() => move(r.key, 1)}
                aria-label={`Move payment ${i + 1} later`}
                className="inline-flex h-7 w-6 items-center justify-center rounded text-ink/40 transition-colors hover:text-ink disabled:opacity-30"
              >
                <ArrowDown aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                disabled={disabled || rows.length <= 1}
                onClick={() => remove(r.key)}
                aria-label={`Remove payment ${i + 1}`}
                className="inline-flex h-7 w-6 items-center justify-center rounded text-ink/40 transition-colors hover:text-danger-700 disabled:opacity-30"
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </span>
          </div>
        ))}
      </div>

      {rows.length < MAX_ROWS ? (
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-mulberry transition-colors hover:text-mulberry-700 disabled:opacity-60"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
          Add payment
        </button>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-ink/10 pt-2 text-[11px]">
        <span className="flex items-center gap-1 text-ink/55">
          <CalendarClock aria-hidden className="h-3 w-3" strokeWidth={1.9} />
          Dates settle against your lock date and event date.
        </span>
        <span className={covered ? 'font-medium text-success-800' : 'font-medium text-warn-800'}>
          {totalPhp == null
            ? 'Set a price first'
            : `${peso(scheduled)} of ${peso(totalPhp)}`}
        </span>
      </div>
    </div>
  );
}
