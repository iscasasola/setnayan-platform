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
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
// 🔑 THE SHARED EXACT FORMATTER, not a local one. This file had its own
// `Math.round(n).toLocaleString('en-PH')`, which printed a 33⅓% instalment of
// ₱79,993.50 as ₱26,665 instead of ₱26,664.50 — the very bug PR #5744 traced
// (₱837.50 shown as ₱838 on the screen whose job is to name the figure to type
// into GCash). The money-formatter scan did not catch it only because it
// inspects functions NAMED like converters; the rule is the intent, not the
// scan's reach.
import { formatPhp } from '@/lib/php';

type Row = {
  key: number;
  label: string;
  kind: 'percent' | 'fixed';
  value: string;
  anchor: '' | 'on_lock' | 'before_event';
  days: string;
};

const ANCHOR_LABEL: Record<'on_lock' | 'before_event', string> = {
  on_lock: 'after you book', // counts from the day Lock is clicked (owner 2026-09-21)
  before_event: 'before the event',
};

const MAX_ROWS = 12;

/**
 * ⚠ NO WIDTH IN HERE — every call site sets its own (`flex-1`, `w-20`…).
 *
 * This carried `w-full` until 2026-09-21, and every control ALSO added a fixed
 * width on top. Two width utilities on one element do not resolve by the order
 * they are written in `className`; they resolve by the order Tailwind emits
 * them in the stylesheet — and `w-full` won. Every control went to 100% and the
 * flex row shrank them all together: measured on a live 375px phone, the
 * payment's NAME input was 18px and its due-date rule 18px. The two-line layout
 * alone would have shipped still broken; removing this is what fixed it (name
 * 169px, rule 130px against the 88px "before the event" needs).
 */
const CELL =
  'rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-xs text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60';


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
          { label: 'First payment', kind: 'percent' as const, value: '50', anchor: 'on_lock' as const, days: '0' },
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
          /* ── TWO LINES PER PAYMENT, NOT SIX COLUMNS (2026-09-21) ──────────
             Measured live on production the day this shipped: one six-column
             row put the payment's NAME in a 34px input and its DUE-DATE rule
             in a 31px select on a 375px phone, and still clipped them on a
             448px desktop sheet ("Downpaymer", "after bo", "before t"). A
             couple could not read which rule they had picked — which is the
             whole point of a dated plan. Line 1 is WHAT and HOW MUCH; line 2
             is WHEN; every control now gets real width at 375px. */
          <div
            key={r.key}
            className="sn-canvas-rise space-y-1.5 border-t border-ink/10 py-2 first:border-t-0"
            style={{ animationDelay: `${Math.min(i, 8) * 26}ms` }}
          >
            {/* HEADER — the payment's number, and its reorder/delete controls.
                They lived on the due-date line until 2026-09-21, where they took
                72px of a 317px row. Measured on a live 375px phone in the
                select's REAL font, "before the event" needs ~152px (118px of
                text at 16px + padding + arrow) and got 130: clipped. The 16px is
                deliberate and must not be shrunk — globals.css floors mobile
                form fields at 16px because iOS Safari zooms the whole page into
                any field smaller than that on tap. So the space came from
                layout: the controls moved up here, keeping full 24px targets. */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
                Payment {i + 1}
              </span>
              {/* The row's three presses — the one ActionButton, icon-only: ↑ ↓ and
                  the bin are marks everyone reads the same way (§ 9: an icon with
                  no word only for those). */}
              <span className="flex shrink-0 items-center gap-1">
                <ActionButton
                  tone="neutral"
                  iconOnly
                  icon={ArrowUp}
                  label={`Move payment ${i + 1} earlier`}
                  disabled={disabled || i === 0}
                  onClick={() => move(r.key, -1)}
                />
                <ActionButton
                  tone="neutral"
                  iconOnly
                  icon={ArrowDown}
                  label={`Move payment ${i + 1} later`}
                  disabled={disabled || i === rows.length - 1}
                  onClick={() => move(r.key, 1)}
                />
                <ActionButton
                  tone="danger"
                  iconOnly
                  icon={Trash2}
                  label={`Remove payment ${i + 1}`}
                  disabled={disabled || rows.length <= 1}
                  onClick={() => remove(r.key)}
                />
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                name="plan_label"
                value={r.label}
                disabled={disabled}
                maxLength={60}
                placeholder="First payment"
                aria-label={`Payment ${i + 1} name`}
                onChange={(e) => patch(r.key, { label: e.target.value })}
                className={`${CELL} min-w-0 flex-1`}
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
                className={`${CELL} w-20 shrink-0`}
              />
              {/* % or ₱ — the house dropdown; the hidden input is what the form posts. */}
              <input type="hidden" name="plan_kind" value={r.kind} />
              <PickMenu
                label={`Payment ${i + 1} amount type`}
                value={r.kind}
                buttonText={r.kind === 'fixed' ? '₱' : '%'}
                compact
                dataAttr="data-plan-kind"
                options={[
                  { key: 'percent', label: '% of the price' },
                  { key: 'fixed', label: '₱ amount' },
                ]}
                onPick={(k) => {
                  if (!disabled) patch(r.key, { kind: k === 'fixed' ? 'fixed' : 'percent' });
                }}
                className="shrink-0 border border-ink/15"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                name="plan_days"
                inputMode="numeric"
                value={r.days}
                disabled={disabled}
                placeholder="0"
                aria-label={`Payment ${i + 1} days from the anchor`}
                onChange={(e) => patch(r.key, { days: e.target.value })}
                className={`${CELL} w-12 shrink-0 text-center`}
              />
              <span className="shrink-0 text-[11px] text-ink/50">days</span>
              <input type="hidden" name="plan_anchor" value={r.anchor} />
              <PickMenu
                label={`Payment ${i + 1} due date`}
                value={r.anchor}
                buttonText={ANCHOR_LABEL[r.anchor]}
                compact
                dataAttr="data-plan-anchor"
                options={[
                  { key: 'on_lock', label: ANCHOR_LABEL.on_lock },
                  { key: 'before_event', label: ANCHOR_LABEL.before_event },
                ]}
                onPick={(k) => {
                  if (!disabled) patch(r.key, { anchor: k as Row['anchor'] });
                }}
                className="min-w-0 flex-1 border border-ink/15"
              />
            </div>
          </div>
        ))}
      </div>

      {rows.length < MAX_ROWS ? (
        <ActionButton tone="brand" icon={Plus} label="Add payment" onClick={add} disabled={disabled} />
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-ink/10 pt-2 text-[11px]">
        <span className="flex items-center gap-1 text-ink/55">
          <CalendarClock aria-hidden className="h-3 w-3" strokeWidth={1.9} />
          Dates settle against your booking date and event date.
        </span>
        <span className={covered ? 'font-medium text-success-800' : 'font-medium text-warn-800'}>
          {totalPhp == null
            ? 'Set a price first'
            : `${formatPhp(scheduled)} of ${formatPhp(totalPhp)}`}
        </span>
      </div>
    </div>
  );
}
