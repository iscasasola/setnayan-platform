/**
 * <BudgetFigures> — THE PRESENTATIONAL HALF OF THE BUDGET SUMMARY (THE ONE BUILD, B2 §2.3, 8 Nov 2026 — owner v77
 * "the supplier's Payment is like the budget planner"). Split out of `BudgetSummary` unchanged so TWO pages draw the
 * same figures one way:
 *
 *   · the couple's Budget (`budget-summary.tsx`) — Target (edited in place, its own cell) · Agreed · Paid · Owed;
 *   · the supplier's Payment page for one client (`clients/[eventId]/_pages/payment.tsx`) — Agreed · Paid · To collect.
 *
 * The figures two by two as ROWS (no tile, no box), one meter, the legend with its right-hand words, one "Next" line.
 * No hooks and no data: the caller hands in what it read, so a server page and the couple's client island both mount
 * it. A figure nobody measured is `null` and draws "—" (never ₱0); a partial read says "part of this couldn't load".
 *
 * Owner of this file: lane C1 (spec §9 #12).
 */
import type { ReactNode } from 'react';
import { Count, Fill } from '@/components/count';
import { formatPhp } from '@/lib/orders';
import { shortDate } from '@/lib/budget-page-view';
import styles from './budget-page.module.css';

/**
 * A peso figure. Whole pesos count to their value (Rule 2 of the button rule); a figure carrying centavos is printed
 * exact and still, because `Count` steps through whole numbers and this page is the couple's books.
 */
export function Peso({ value, id, className }: { value: number; id?: string; className?: string }) {
  if (Number.isInteger(value)) {
    return <Count value={value} format={formatPhp} id={id} className={className} />;
  }
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatPhp(value)}
    </span>
  );
}

/** One cell of the two-by-two: its label line, and either a measured figure or a body of its own (the Target editor). */
export type BudgetFigureCell = {
  /** `data-budget-cell` — "target" · "agreed" · "paid" · "owed" · "collect". */
  key: string;
  label: ReactNode;
  /** A figure, `null` when nobody measured it. Ignored when `body` is given. */
  value?: number | null;
  /** The cell's own body in place of a figure (the couple's Target field, edited in place). */
  body?: ReactNode;
  id?: string;
  tone?: 'ok' | 'wine' | null;
  /** A floor, drawn with a "+" ("₱994,400+ — at least this"). */
  atLeast?: boolean;
};

export type BudgetFiguresNext =
  | { amountPhp: number; name: string; dueDate: string | null; action: ReactNode }
  | 'unread'
  | null;

export function BudgetFigures({
  label,
  tour,
  marks,
  cells,
  meter,
  swatches,
  right,
  next,
}: {
  /** The section's name ("Budget summary" · "Payment summary"). */
  label: string;
  /** 🔦 The spotlight anchor on the section (`data-tour`). */
  tour?: string;
  /** Data hooks for the host's own guards. */
  marks?: Record<`data-${string}`, string>;
  cells: readonly BudgetFigureCell[];
  /** The meter's three fills, in percent (`budgetMeter`). */
  meter: { agreedPct: number; paidPct: number; overPct: number; ids?: { agreed: string; paid: string; over: string } };
  swatches: ReadonlyArray<'paid' | 'agreed' | 'target'>;
  /** The legend's right-hand words ("₱X left of target" · "part of this couldn't load"). */
  right?: ReactNode;
  next: BudgetFiguresNext;
}) {
  const ids = meter.ids ?? { agreed: 'budget-agreed', paid: 'budget-paid', over: 'budget-over' };
  const sw = { paid: styles.swPaid, agreed: styles.swAgreed, target: styles.swTarget } as const;
  return (
    <section className={`${styles.page} ${styles.sum}`} aria-label={label} data-tour={tour} {...marks}>
      <div className={styles.grid}>
        {cells.map((c) => (
          <div key={c.key} className={styles.cell} data-budget-cell={c.key}>
            <div className={styles.k}>{c.label}</div>
            {c.body !== undefined ? c.body : <Figure value={c.value ?? null} id={c.id ?? `budget-${c.key}`} tone={c.tone ?? null} atLeast={c.atLeast ?? false} />}
          </div>
        ))}
      </div>

      <div className={styles.meter} role="presentation">
        <Fill value={meter.agreedPct} id={ids.agreed} className={styles.meterAgreed} />
        <Fill value={meter.paidPct} id={ids.paid} className={styles.meterPaid} />
        <Fill value={meter.overPct} id={ids.over} className={styles.meterOver} />
      </div>
      <div className={styles.legend}>
        {swatches.map((s) => (
          <span key={s}>
            <i className={sw[s]} />
            {s}
          </span>
        ))}
        {right ?? null}
      </div>

      {next === 'unread' ? (
        <div className={styles.nextdue} data-budget-next="unread">
          <span className={styles.mute}>Next</span>
          <span className={`${styles.nextTxt} ${styles.mute}`}>couldn&rsquo;t check</span>
        </div>
      ) : next ? (
        <div className={styles.nextdue} data-budget-next="">
          <span className={styles.mute}>Next</span>
          <span className={styles.nextTxt}>
            <b className={styles.num}>
              <Peso value={next.amountPhp} id="budget-next" />
            </b>{' '}
            · {next.name}
            {next.dueDate ? ` · ${shortDate(next.dueDate)}` : ''}
          </span>
          {next.action}
        </div>
      ) : null}
    </section>
  );
}

/** The legend's right-hand words in the meter's own type — "₱X left of target", red when it is the bad news. */
export function BudgetLegendRight({ children, wine = false, partial = false }: { children: ReactNode; wine?: boolean; partial?: boolean }) {
  return (
    <span className={`${styles.left}${partial ? '' : ` ${styles.num}`}${wine ? ` ${styles.wine}` : ''}`} data-budget-partial={partial ? '' : undefined}>
      {children}
    </span>
  );
}

/** The Next line's action — a link in the meter's own "go" style ("Pay ›" · "Ask ›" · "Check ›"). */
export function BudgetNextLink({ href, children, mark }: { href: string; children: ReactNode; mark?: string }) {
  return (
    <a className={styles.go} href={href} data-budget-next-go={mark}>
      {children}
    </a>
  );
}

/** The class the couple's Pay button wears, so a button and a link look the same. */
export const BUDGET_NEXT_GO_CLASS = styles.go;

/**
 * One summary figure — or "—" when nobody measured it. Never ₱0 for unknown.
 * `atLeast`: a floor, drawn with a "+" ("₱994,400+ — at least this").
 */
function Figure({ value, id, tone, atLeast = false }: { value: number | null; id: string; tone: 'ok' | 'wine' | null; atLeast?: boolean }) {
  if (value === null) {
    return <div className={`${styles.v} ${styles.vMuted}`}>—</div>;
  }
  const toneClass = tone === 'ok' ? ` ${styles.vOk}` : tone === 'wine' ? ` ${styles.vWine}` : '';
  return (
    <div
      className={`${styles.v} ${styles.num}${toneClass}`}
      data-budget-owed={atLeast ? 'at-least' : undefined}
      title={atLeast ? 'At least this. Part of your budget could not load, so there may be more.' : undefined}
    >
      <Peso value={value} id={id} />
      {atLeast ? '+' : null}
    </div>
  );
}
