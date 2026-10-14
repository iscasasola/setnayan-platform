'use client';

/**
 * <BudgetScreen> — the Budget page a couple sees: the summary rows, then ONE
 * list in three groups, then the sheets a row opens.
 *
 * Built from `prototypes/budget_page_2026-10-08_fable.html` (owner 2026-10-08:
 * "opening budget will show all your booked vendors, and expenses and they can
 * add more manually" · "including purchased in setnayan" · "budget looks
 * good!"). Plan rows B1 (the summary) + B2 (the list and its sheets) of
 * `BUDGET_PAGE_2026-10-08_fable.md`.
 *
 *   Booked suppliers ..... agreed · paid · owed per supplier; tap → payments
 *   Bought on Setnayan ... read-only: name · date · receipt · amount · paid ✓
 *   Your expenses ........ what you added yourself; tap → amount · paid so far
 *
 * ── One source ────────────────────────────────────────────────────────────
 * Every row is a reading of `EventMoney.lines` (`buildBudgetList`), and the
 * summary is the resolver's own sum of those lines. Nothing here adds money up
 * and nothing here runs a query.
 *
 * ── A group nobody could read is not an empty group ───────────────────────
 * `list.suppliers | orders | expenses` is `null` when that read was refused.
 * A `null` group draws a sentence. It never draws "Nothing added yet", and it
 * never draws a count.
 *
 * ── The sheets load when a row is first opened ────────────────────────────
 * `budget-sheets.tsx` is a dynamic import: none of its code is in the page's
 * first load.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import type { PaymentDoor } from '@/lib/accepted-quote-terms';
import {
  shortDate,
  type BudgetList,
  type ExpenseRow,
  type NextPayment,
  type OrderRow,
  type SupplierRow,
} from '@/lib/budget-page-view';
import type { CostCategoryOption } from '@/lib/event-costs';
import { formatCount } from '@/lib/format-number';
import { BudgetSummary, Peso } from './budget-summary';
import styles from './budget-page.module.css';

/** One payment already made to a supplier — a "Paid" row in their sheet. */
export type SupplierPayment = {
  paymentId: string;
  /** ISO date, `YYYY-MM-DD`. */
  paidAt: string;
  amountPhp: number;
  /** How it was paid, as recorded. */
  method: string | null;
};

/** What a supplier's sheet needs that the money lines do not carry. */
export type SupplierExtras = {
  payments: SupplierPayment[];
  /**
   * Which door a payment to this supplier goes through (`paymentDoor`).
   * `'log'` records it here; `'amount_to_pay'` is a supplier on Setnayan, whose
   * payments are recorded under Amount to pay (one door — a second writer here
   * counted a first payment as Paid and held no date); `'unknown'` could not be
   * checked, and never becomes a blind log.
   */
  door: PaymentDoor;
  amountToPayHref: string;
  /** A supplier on Setnayan opens their conversation; anyone else, Messages. */
  chat: { kind: 'thread' } | { kind: 'link'; href: string };
};

export type BudgetSheetState =
  | { kind: 'pay'; vendorId: string }
  | { kind: 'record'; vendorId: string }
  | { kind: 'expense'; costId: string }
  | { kind: 'add' }
  | null;

const BudgetSheets = dynamic(() => import('./budget-sheets').then((m) => m.BudgetSheets), { ssr: false });

export function BudgetScreen({
  eventId,
  canEdit,
  summary,
  list,
  supplierExtras,
  categories,
  children,
}: {
  eventId: string;
  /** Writing money is the couple's alone; a delegate who may read sees the same rows without the verbs. */
  canEdit: boolean;
  summary: {
    targetPhp: number | null;
    agreedPhp: number | null;
    paidPhp: number | null;
    owedPhp: number | null;
    next: NextPayment | null;
  };
  list: BudgetList;
  supplierExtras: Record<string, SupplierExtras>;
  categories: CostCategoryOption[];
  /** Drawn between the summary and the list (the tradition notes, for the event types that have one). */
  children?: ReactNode;
}) {
  const [sheet, setSheet] = useState<BudgetSheetState>(null);
  // Once a sheet has been opened its code stays mounted, so the next open is instant.
  const [sheetsWanted, setSheetsWanted] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const open = (next: BudgetSheetState) => {
    setSheetsWanted(true);
    setSheet(next);
  };

  // "Pay ›" opens the sheet of whatever the Next line names.
  const onPay = (next: NextPayment) => {
    if (next.vendorId) open({ kind: 'pay', vendorId: next.vendorId });
    else if (next.costId && canEdit) open({ kind: 'expense', costId: next.costId });
  };
  const nextIsOpenable =
    summary.next !== null && (summary.next.vendorId !== null || (summary.next.costId !== null && canEdit));

  return (
    <div className={styles.page} data-budget-screen="">
      <BudgetSummary
        eventId={eventId}
        canEdit={canEdit}
        targetPhp={summary.targetPhp}
        agreedPhp={summary.agreedPhp}
        paidPhp={summary.paidPhp}
        owedPhp={summary.owedPhp}
        next={summary.next}
        payHref="#budget-payments"
        onPay={nextIsOpenable ? onPay : undefined}
      />

      {children}

      <div className={`${styles.list} ${canEdit ? styles.listRoom : ''}`} id="budget-payments" data-budget-list="">
        <SupplierGroup rows={list.suppliers} onOpen={(vendorId) => open({ kind: 'pay', vendorId })} />
        <OrderGroup rows={list.orders} />
        <ExpenseGroup
          rows={list.expenses}
          canEdit={canEdit}
          onOpen={(costId) => open({ kind: 'expense', costId })}
        />
      </div>

      {/* The thumb row: fixed over the list, in the lower third. Portalled to
          <body> — inside the dashboard a transformed ancestor would capture a
          `position: fixed` child and it would scroll away with the page. */}
      {canEdit && mounted
        ? createPortal(
            <div className={`${styles.page} ${styles.lower}`} data-budget-thumb="">
              <ActionButton tone="brand" main icon={Plus} label="Add expense" onClick={() => open({ kind: 'add' })} />
            </div>,
            document.body,
          )
        : null}

      {sheetsWanted ? (
        <BudgetSheets
          eventId={eventId}
          canEdit={canEdit}
          sheet={sheet}
          onChange={setSheet}
          list={list}
          supplierExtras={supplierExtras}
          categories={categories}
        />
      ) : null}
    </div>
  );
}

/** A group's heading — its name, and how many rows it holds. No count when the read was refused. */
function GroupHead({ title, count }: { title: string; count: number | null }) {
  return (
    <div className={styles.grp}>
      <h2>{title}</h2>
      {count === null ? null : <span className={`${styles.cnt} ${styles.num}`}>{formatCount(count)}</span>}
    </div>
  );
}

/** A group whose read was refused. Words — never a zero, never an empty state. */
function GroupUnread({ what }: { what: string }) {
  return (
    <div className={styles.fail} role="status" data-budget-unread="">
      <span className={styles.dot} aria-hidden="true" />
      Couldn&rsquo;t load {what}.
    </div>
  );
}

/** The second line under an amount: what is still owed (and by when), or "paid ✓". */
function OwedLine({ owedPhp, dueDate, id }: { owedPhp: number; dueDate: string | null; id: string }) {
  if (owedPhp > 0) {
    return (
      <small className={`${styles.wine} ${styles.num}`}>
        <Peso value={owedPhp} id={`${id}-owed`} /> owed{dueDate ? ` · ${shortDate(dueDate)}` : ''}
      </small>
    );
  }
  return <small className={styles.ok}>paid ✓</small>;
}

function SupplierGroup({
  rows,
  onOpen,
}: {
  rows: SupplierRow[] | null;
  onOpen: (vendorId: string) => void;
}) {
  return (
    <>
      <GroupHead title="Booked suppliers" count={rows === null ? null : rows.length} />
      {rows === null ? (
        <GroupUnread what="your suppliers" />
      ) : (
        rows.map((s) => (
          <button
            key={s.vendorId}
            type="button"
            className={styles.row}
            onClick={() => onOpen(s.vendorId)}
            data-budget-row="supplier"
          >
            <span className={styles.logo} aria-hidden="true">
              {s.initials}
            </span>
            <span className={styles.mid}>
              <span className={styles.name}>{s.name}</span>
              <span className={`${styles.svc} ${styles.num}`}>
                {s.service} ·{' '}
                {s.owedPhp > 0 ? (
                  <>
                    <Peso value={s.paidPhp} id={`bs-${s.vendorId}-paid`} /> paid
                  </>
                ) : (
                  'paid in full'
                )}
              </span>
            </span>
            <span className={styles.end}>
              <span className={styles.amt}>
                <b className={styles.num}>
                  <Peso value={s.agreedPhp} id={`bs-${s.vendorId}`} />
                </b>
                <OwedLine owedPhp={s.owedPhp} dueDate={s.dues[0]?.dueDate ?? null} id={`bs-${s.vendorId}`} />
              </span>
              <span className={styles.chev} aria-hidden="true">
                ›
              </span>
            </span>
          </button>
        ))
      )}
    </>
  );
}

function OrderGroup({ rows }: { rows: OrderRow[] | null }) {
  return (
    <>
      <GroupHead title="Bought on Setnayan" count={rows === null ? null : rows.length} />
      {rows === null ? (
        <GroupUnread what="your purchases" />
      ) : (
        rows.map((o) => (
          <div key={o.orderId} className={styles.row} data-budget-row="order">
            <span className={`${styles.logo} ${styles.logoS}`} aria-hidden="true">
              S
            </span>
            <span className={styles.mid}>
              <span className={styles.name}>{o.name}</span>
              <span className={styles.svc}>
                {/* A paid order has a receipt; one still awaiting payment has only its date. */}
                {[o.bookedOn ? shortDate(o.bookedOn) : null, o.owedPhp > 0 ? null : 'receipt']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <span className={styles.end}>
              <span className={styles.amt}>
                <b className={styles.num}>
                  <Peso value={o.amountPhp} id={`bo-${o.orderId}`} />
                </b>
                <OwedLine owedPhp={o.owedPhp} dueDate={null} id={`bo-${o.orderId}`} />
              </span>
            </span>
          </div>
        ))
      )}
    </>
  );
}

function ExpenseGroup({
  rows,
  canEdit,
  onOpen,
}: {
  rows: ExpenseRow[] | null;
  canEdit: boolean;
  onOpen: (costId: string) => void;
}) {
  return (
    <>
      <GroupHead title="Your expenses" count={rows === null ? null : rows.length} />
      {rows === null ? (
        <GroupUnread what="your expenses" />
      ) : rows.length === 0 ? (
        <div className={styles.empty}>
          Nothing added yet. Use ＋ Add expense for anything paid outside Setnayan.
        </div>
      ) : (
        rows.map((e) => {
          const inner = (
            <>
              <span className={styles.logo} aria-hidden="true">
                {e.initials}
              </span>
              <span className={styles.mid}>
                <span className={styles.name}>{e.name}</span>
                <span className={`${styles.svc} ${styles.num}`}>
                  {e.category ? `${e.category} · ` : ''}
                  {e.owedPhp > 0 ? (
                    <>
                      <Peso value={e.paidPhp} id={`be-${e.costId}-paid`} /> paid
                    </>
                  ) : (
                    'paid in full'
                  )}
                </span>
              </span>
              <span className={styles.end}>
                <span className={styles.amt}>
                  <b className={styles.num}>
                    <Peso value={e.amountPhp} id={`be-${e.costId}`} />
                  </b>
                  <OwedLine owedPhp={e.owedPhp} dueDate={null} id={`be-${e.costId}`} />
                </span>
                {canEdit ? (
                  <span className={styles.chev} aria-hidden="true">
                    ›
                  </span>
                ) : null}
              </span>
            </>
          );
          return canEdit ? (
            <button
              key={e.costId}
              type="button"
              className={styles.row}
              onClick={() => onOpen(e.costId)}
              data-budget-row="expense"
            >
              {inner}
            </button>
          ) : (
            <div key={e.costId} className={styles.row} data-budget-row="expense">
              {inner}
            </div>
          );
        })
      )}
    </>
  );
}
