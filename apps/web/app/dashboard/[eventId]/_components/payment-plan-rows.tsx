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

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarClock, Plus, Trash2, X } from 'lucide-react';
// 🔑 THE SHARED EXACT FORMATTER, not a local one. This file had its own
// `Math.round(n).toLocaleString('en-PH')`, which printed a 33⅓% instalment of
// ₱79,993.50 as ₱26,665 instead of ₱26,664.50 — the very bug PR #5744 traced
// (₱837.50 shown as ₱838 on the screen whose job is to name the figure to type
// into GCash). The money-formatter scan did not catch it only because it
// inspects functions NAMED like converters; the rule is the intent, not the
// scan's reach.
import { formatPhp } from '@/lib/php';
import { PLAN_PRESENT_FIELD, planAmountNumber, planPreviewTotal, type EditablePlanRow } from '@/lib/self-added-payment-plan';
import {
  addsUpLine,
  amountWords,
  byDue,
  dateToAnchor,
  postedRule,
  rowsFromRules,
  type DatedRow,
  type PlanDates,
} from '@/lib/record-card-plan';
import { replotAmounts } from '@/lib/plan-replot';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/** The amount type's two choices — the one dropdown (`PickMenu`), as values are (2026-10-12 look sweep). */
const KIND_OPTIONS = [
  { key: 'percent', label: '%' },
  { key: 'fixed', label: '₱' },
] as const;

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

const ANCHOR_OPTIONS = [
  { key: 'on_lock', label: ANCHOR_LABEL.on_lock },
  { key: 'before_event', label: ANCHOR_LABEL.before_event },
] as const;

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


/**
 * THE RECORD CARD'S ROWS — name · due date · amount (Booked prototype v4, owner-approved 2026-10-29). Present → the
 * plan is drawn as dated rows over the SAME stored rule (`lib/record-card-plan.ts` maps each way, exactly); absent → the
 * percent / anchor rows below, which the add sheet still uses.
 */
export type DatedPlanSetup = {
  dates: PlanDates;
  /** Each initial row's stored `seq`. */
  seqs?: ReadonlyArray<number | null>;
  /** Instalments with a payment logged against them — kept exactly as they are. */
  settledSeqs?: ReadonlyArray<number>;
  /** The price the plan was last saved against — a change from it re-plots the unpaid rows. */
  keptTotalPhp: number | null;
  /** The newest plan a price change replaced (`replot_history`). */
  lastReplot?: { fromPhp: number; toPhp: number } | null;
  /** The closed fold's one line ("2 payments · adds up") follows the rows. */
  onLine?: (line: string, warn: boolean) => void;
};

export function PaymentPlanRows({
  totalPhp,
  initial,
  disabled,
  dated,
}: {
  /** The agreed total the plan must add up to. Null = no price set yet. */
  totalPhp: number | null;
  initial?: ReadonlyArray<Omit<Row, 'key'>>;
  disabled?: boolean;
  dated?: DatedPlanSetup;
}) {
  if (dated) return <DatedPlanRows totalPhp={totalPhp} initial={initial} disabled={disabled} setup={dated} />;
  return <RulePlanRows totalPhp={totalPhp} initial={initial} disabled={disabled} />;
}

/** The record card's fields — the prototype's size (14 px, 40 px tall), not the dense percent rows' 12 px. */
const DCELL =
  'min-h-10 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-[14px] text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60'; // no-card-ok: worn only by <input> fields

const STARTER: ReadonlyArray<Omit<Row, 'key'>> = [
  { label: 'First payment', kind: 'percent', value: '50', anchor: 'on_lock', days: '0' },
  { label: 'Balance', kind: 'percent', value: '50', anchor: 'before_event', days: '7' },
];

function DatedPlanRows({
  totalPhp,
  initial,
  disabled,
  setup,
}: {
  totalPhp: number | null;
  initial?: ReadonlyArray<Omit<Row, 'key'>>;
  disabled?: boolean;
  setup: DatedPlanSetup;
}) {
  const { dates } = setup;
  const [rows, setRows] = useState<DatedRow[]>(() =>
    rowsFromRules((initial ?? STARTER) as ReadonlyArray<EditablePlanRow>, {
      dates,
      totalPhp: setup.keptTotalPhp,
      seqs: initial ? setup.seqs : undefined,
      settledSeqs: setup.settledSeqs,
    }),
  );
  const [nextKey, setNextKey] = useState(rows.length);
  /** "Price changed ₱A → ₱B · plan updated" — the newest kept plan, or the re-plot this card just made. */
  const [replot, setReplot] = useState<{ fromPhp: number; toPhp: number } | null>(setup.lastReplot ?? null);

  // 🔑 AN ACCEPTED PRICE CHANGE ALWAYS RE-PLOTS THE UNPAID PAYMENTS (owner 2026-10-29: "replot the payments always").
  // When the price the couple KEEPS moves, the unpaid rows re-split by their own proportions; a settled row never
  // moves — the same `replotAmounts` the database twin runs when the save lands.
  const keptRef = useRef(setup.keptTotalPhp);
  const kept = setup.keptTotalPhp;
  useEffect(() => {
    const before = keptRef.current;
    keptRef.current = kept;
    if (before == null || kept == null || !(before > 0) || !(kept > 0) || Math.abs(before - kept) < 0.005) return;
    const to = kept;
    setRows((cur) => {
      if (cur.length === 0) return cur;
      const core = replotAmounts(
        cur.map((r) => {
          const n = planAmountNumber(r.amount);
          return Number.isFinite(n) ? n : null;
        }),
        cur.map((r) => r.settled),
        to,
      );
      const next = cur.flatMap((r, i): DatedRow[] => {
        if (r.settled) return [r];
        const a = core.next[i];
        return a == null ? [] : [{ ...r, amount: amountWords(a) }];
      });
      if (core.balancePhp > 0) {
        const last = byDue(cur).filter((r) => r.dueIso).pop();
        next.push({ key: Date.now(), label: 'Balance', dueIso: last?.dueIso ?? '', amount: amountWords(core.balancePhp), seq: null, settled: false, rule: null });
      }
      return next;
    });
    setReplot({ fromPhp: before, toPhp: to });
  }, [kept]);

  const shown = byDue(rows);
  function patch(key: number, p: Partial<DatedRow>) {
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }
  function add() {
    if (rows.length >= MAX_ROWS) return;
    setRows((cur) => [
      ...cur,
      { key: nextKey, label: cur.length ? `Payment ${cur.length + 1}` : 'First payment', dueIso: '', amount: '', seq: null, settled: false, rule: null },
    ]);
    setNextKey((k) => k + 1);
  }
  const line = addsUpLine(rows, totalPhp, formatPhp);
  const onLine = setup.onLine;
  const foldLine =
    rows.length === 0
      ? 'No payments yet'
      : `${rows.length} payment${rows.length === 1 ? '' : 's'} · ${line.text.replace(/^Adds up to [^·]+· /, '').replace('matches the price', 'adds up')}`;
  useEffect(() => {
    onLine?.(foldLine, rows.length === 0 || line.off);
  }, [foldLine, line.off, rows.length, onLine]);

  return (
    <div className="space-y-2" data-plan-dated="">
      <input type="hidden" name={PLAN_PRESENT_FIELD} value="1" />
      {replot ? (
        <p data-plan-replotted="" className="text-[12.5px] font-medium text-ink/70">
          Price changed {formatPhp(replot.fromPhp)} → {formatPhp(replot.toPhp)} · plan updated
        </p>
      ) : null}
      {shown.length === 0 ? (
        <p data-plan-none="" className="text-[12.5px] text-ink/55">
          No payments yet · add the ones you agreed.
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {shown.map((r, i) => {
          const rule = postedRule(r, dates, totalPhp);
          const unreachable = r.dueIso !== '' && !dateToAnchor(r.dueIso, dates);
          return (
            <li key={r.key} data-plan-row="" className="sn-canvas-rise border-t border-ink/10 py-2 first:border-t-0" style={{ animationDelay: `${Math.min(i, 8) * 26}ms` }}>
              {/* THE STORED RULE, posted per row (`plan_kind`/`plan_value`/`plan_anchor`/`plan_days`) — the save reads
                  exactly what it always read; `plan_seq` keeps a logged payment on its own instalment. */}
              <input type="hidden" name="plan_kind" value={rule.kind} />
              <input type="hidden" name="plan_value" value={rule.value} />
              <input type="hidden" name="plan_anchor" value={rule.anchor} />
              <input type="hidden" name="plan_days" value={rule.days} />
              <input type="hidden" name="plan_seq" value={r.seq == null ? '' : String(r.seq)} />
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  name="plan_label"
                  value={r.label}
                  disabled={disabled}
                  readOnly={r.settled}
                  maxLength={60}
                  placeholder="First payment"
                  aria-label={`Payment ${i + 1} name`}
                  onChange={(e) => patch(r.key, { label: e.target.value })}
                  className={`${DCELL} min-w-0 flex-1`}
                />
                {r.settled ? (
                  <span className="shrink-0 text-[11.5px] font-medium text-[rgb(var(--color-ok))]">Paid</span>
                ) : (
                  <ActionButton
                    tone="neutral"
                    iconOnly
                    icon={X}
                    label={`Remove payment ${i + 1}`}
                    disabled={disabled}
                    onClick={() => setRows((cur) => cur.filter((x) => x.key !== r.key))}
                  />
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <input
                  type="date"
                  value={r.dueIso}
                  disabled={disabled || r.settled}
                  aria-label={`Payment ${i + 1} due date`}
                  onChange={(e) => patch(r.key, { dueIso: e.target.value })}
                  className={`${DCELL} min-w-0 flex-1`}
                />
                <span className="relative w-[44%] shrink-0">
                  <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-ink/45">₱</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={r.amount}
                    disabled={disabled || r.settled}
                    placeholder="0"
                    aria-label={`Payment ${i + 1} amount`}
                    onChange={(e) => patch(r.key, { amount: e.target.value })}
                    onBlur={(e) => {
                      const n = planAmountNumber(e.target.value);
                      if (Number.isFinite(n) && n > 0) patch(r.key, { amount: amountWords(n) });
                    }}
                    className={`${DCELL} w-full pl-7 text-right tabular-nums`}
                  />
                </span>
              </div>
              {r.dueIso === '' && !r.settled ? (
                <p className="mt-1 text-[11.5px] text-warn-800 dark:text-warn-200">Pick the day it is due.</p>
              ) : unreachable ? (
                <p className="mt-1 text-[11.5px] text-warn-800 dark:text-warn-200">
                  Pick a day from {dates.lockIso} on — or set your event date first.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {rows.length < MAX_ROWS ? (
        <ActionButton tone="neutral" icon={Plus} label="Add a payment" onClick={add} disabled={disabled} />
      ) : null}

      <p
        data-plan-adds-up=""
        className={`border-t border-ink/10 pt-2 text-[12.5px] font-medium ${line.off ? 'text-[rgb(var(--color-warn))]' : 'text-ink/65'}`}
      >
        {line.text}
      </p>
    </div>
  );
}

function RulePlanRows({
  totalPhp,
  initial,
  disabled,
}: {
  /** The agreed total the plan must add up to. Null = no price set yet. */
  totalPhp: number | null;
  initial?: ReadonlyArray<Omit<Row, 'key'>>;
  disabled?: boolean;
}) {
  // `initial` given (even EMPTY) is the saved plan, exactly — a plan saved
  // with no payments re-opens with none, not with the 50/50 starter below.
  // The starter is only for a supplier with no saved plan at all.
  const [rows, setRows] = useState<Row[]>(() =>
    (initial
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

  /** Preview only — the server re-computes and is the authority. It reads each
   *  amount the SAME way the server does (`planAmountNumber`), so "100,000"
   *  counts here exactly as it counts there; this used to `Number()` it to NaN
   *  and drop the row from the total while the screen showed it. */
  const scheduled = useMemo(() => planPreviewTotal(rows, totalPhp), [rows, totalPhp]);

  const covered = totalPhp != null && Math.abs(scheduled - totalPhp) <= 1;

  return (
    <div className="space-y-2">
      {/* 📮 Says "the plan editor was here", so a save can tell a plan emptied
          to no payments from a form that never carried one. */}
      <input type="hidden" name={PLAN_PRESENT_FIELD} value="1" />
      {rows.length === 0 ? (
        <p data-plan-none="" className="text-[12.5px] text-ink/55">
          No payments — saving keeps it that way.
        </p>
      ) : null}
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
                  // The last payment can go too — a plan typed down to none is
                  // saved as none (`planSaveStep` 'clear').
                  disabled={disabled}
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
              {/* 🪤 THE FORM STILL POSTS `plan_kind` — one per row, in row order
                  (`formData.getAll('plan_kind')[i]`): the dropdown is a button,
                  so the value rides a hidden field fed by the row's state. */}
              <input type="hidden" name="plan_kind" value={r.kind} />
              <span inert={disabled || undefined} className={`shrink-0${disabled ? ' opacity-60' : ''}`}>
                <PickMenu
                  label={`Payment ${i + 1} amount type`}
                  value={r.kind}
                  options={KIND_OPTIONS}
                  compact
                  dataAttr="data-plan-kind"
                  onPick={(k) => patch(r.key, { kind: k === 'fixed' ? 'fixed' : 'percent' })}
                />
              </span>
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
              {/* Posted the same way as `plan_kind` above — a hidden field per row. */}
              <input type="hidden" name="plan_anchor" value={r.anchor} />
              <span inert={disabled || undefined} className={`min-w-0 flex-1${disabled ? ' opacity-60' : ''}`}>
                <PickMenu
                  label={`Payment ${i + 1} due date`}
                  value={r.anchor || null}
                  options={ANCHOR_OPTIONS}
                  compact
                  dataAttr="data-plan-anchor"
                  onPick={(k) => patch(r.key, { anchor: k === 'on_lock' ? 'on_lock' : 'before_event' })}
                />
              </span>
            </div>
          </div>
        ))}
      </div>

      {rows.length < MAX_ROWS ? (
        <ActionButton tone="neutral" icon={Plus} label="Add payment" onClick={add} disabled={disabled} />
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-ink/10 pt-2 text-[11px]">
        <span className="flex items-center gap-1 text-ink/55">
          <CalendarClock aria-hidden className="h-3 w-3" strokeWidth={1.9} />
          Dates settle against your booking date and event date.
        </span>
        <span className={covered ? 'font-medium text-[rgb(var(--color-ok))]' : 'font-medium text-[rgb(var(--color-warn))]'}>
          {totalPhp == null
            ? 'Set a price first'
            : `${formatPhp(scheduled)} of ${formatPhp(totalPhp)}`}
        </span>
      </div>
    </div>
  );
}
