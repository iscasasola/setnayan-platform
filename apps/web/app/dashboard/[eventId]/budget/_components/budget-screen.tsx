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
 *
 * ── The frosted thumb row (plan row B3) ───────────────────────────────────
 * ＋ Add expense (brand, full colour) · All ▾ (All · Owing · Paid — ONE
 * `PickMenu`, never a pill row) · search. The row has no background of its
 * own; the dropdown and the search are frosted (`.sn-glass-row`). The filter
 * and the search narrow all three groups (`filterBudgetList`); the summary
 * does NOT move — it is the whole ledger, and a filter is a way of looking at
 * the list, not a different budget. An emptied group says why (`whyEmpty`).
 * A delegate who may only read gets the row too, without Add.
 *
 * ── A refused group can be asked again ────────────────────────────────────
 * "Couldn't load your purchases." carries Retry — a fresh server render
 * (`router.refresh()`), which re-runs the ONE resolver for every group.
 */

import { useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PaymentDoor } from '@/lib/accepted-quote-terms';
import {
  LIST_FILTERS,
  filterBudgetList,
  filterLine,
  isListFilter,
  shortDate,
  whyEmpty,
  type BudgetList,
  type ExpenseRow,
  type ListFilter,
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

/** The shipped Guests / Find search waits the same 250 ms after the last keystroke. */
const SEARCH_DEBOUNCE_MS = 250;

export function BudgetScreen({
  eventId,
  canEdit,
  summary,
  list,
  supplierExtras,
  categories,
  targetNote,
  initialPayVendorId = null,
}: {
  eventId: string;
  /** Writing money is the couple's alone; a delegate who may read sees the same rows without the verbs. */
  canEdit: boolean;
  summary: {
    targetPhp: number | null;
    agreedPhp: number | null;
    paidPhp: number | null;
    owedPhp: number | null;
    /** `owedPhp` is a floor — a source was refused ("₱994,400+"). */
    owedAtLeast?: boolean;
    /** A source was refused — the summary says part of it couldn't load. */
    partial?: boolean;
    next: NextPayment | null;
  };
  list: BudgetList;
  supplierExtras: Record<string, SupplierExtras>;
  categories: CostCategoryOption[];
  /** More words in the Target's ⓘ — the tradition notes, for the event types that have one. */
  targetNote?: ReactNode;
  /** 🔗 `?pay=<line_item_id>` resolved to its supplier (`payTargetVendor`): that Pay sheet opens on arrival. */
  initialPayVendorId?: string | null;
}) {
  const [sheet, setSheet] = useState<BudgetSheetState>(initialPayVendorId ? { kind: 'pay', vendorId: initialPayVendorId } : null);
  const [filter, setFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterBudgetList(list, filter, query), [list, filter, query]);
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  // one-render: keep (retry) — the person's Try again on a budget that could not be read; no write came before it.
  const retry = () => startRetry(() => router.refresh());
  const line = filterLine(filter);
  // Once a sheet has been opened its code stays mounted, so the next open is instant.
  const [sheetsWanted, setSheetsWanted] = useState(Boolean(initialPayVendorId));

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
        owedAtLeast={summary.owedAtLeast}
        partial={summary.partial}
        next={summary.next}
        payHref="#budget-payments"
        onPay={nextIsOpenable ? onPay : undefined}
        targetNote={targetNote}
      />

      {line ? (
        <div className={styles.filterline} data-budget-filterline={filter}>
          {line}
        </div>
      ) : null}

      <div className={`${styles.list} ${styles.listRoom}`} id="budget-payments" data-budget-list="" data-tour="budget-list">
        <SupplierGroup
          rows={list.suppliers}
          shown={shown.suppliers}
          why={whyEmpty('suppliers', filter, query)}
          onOpen={(vendorId) => open({ kind: 'pay', vendorId })}
          onRetry={retry}
          retrying={retrying}
        />
        <OrderGroup
          rows={list.orders}
          shown={shown.orders}
          why={whyEmpty('orders', filter, query)}
          onRetry={retry}
          retrying={retrying}
        />
        <ExpenseGroup
          rows={list.expenses}
          shown={shown.expenses}
          why={whyEmpty('expenses', filter, query)}
          canEdit={canEdit}
          onOpen={(costId) => open({ kind: 'expense', costId })}
          onRetry={retry}
          retrying={retrying}
        />
      </div>

      {/* The thumb row: fixed over the list, in the lower third. Portalled to
          <body> — inside the dashboard a transformed ancestor would capture a
          `position: fixed` child and it would scroll away with the page. */}
      <BodyPortal>
        <ThumbRow
          canEdit={canEdit}
          filter={filter}
          onFilter={setFilter}
          onSearch={setQuery}
          onAdd={() => open({ kind: 'add' })}
        />
      </BodyPortal>

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

/**
 * Portals its children to `<body>` once the page is in the browser (a server render has no `document`).
 *
 * 🔂 RENDERED ONCE ON OPEN (2026-10-22). The "am I mounted yet?" flag lives HERE, in its own small component — when it
 * lived in `BudgetScreen` (`const [mounted, setMounted] = useState(false)` + `useEffect(() => setMounted(true), [])`),
 * flipping it re-rendered the WHOLE screen (the summary, every supplier, order and expense row) right after the first
 * paint, only to draw the thumb row. Now only this host renders a second time; the screen above it renders once.
 * Guard: `apps/web/lib/budget-and-seating-render-once.test.ts`.
 */
function BodyPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(children, host) : null;
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

/**
 * The thumb row's controls — their OWN component, mounted WITH the row, so
 * `useFitRow` has a row to measure on its first pass (the Find thumb row's
 * lesson: called from the parent it ran before the portal existed, and never
 * ran again).
 *
 * Search opens a frosted field in the row; it keeps its own text and the list
 * hears it 250 ms after the last keystroke. ✕ empties it and closes it. While
 * the field is open the buttons give way by width (rule 3b: the field keeps at
 * least 60 % of the row).
 */
function ThumbRow({
  canEdit,
  filter,
  onFilter,
  onSearch,
  onAdd,
}: {
  canEdit: boolean;
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
  onSearch: (q: string) => void;
  onAdd: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useFitRow(rowRef);
  const [searching, setSearching] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // The label holds the ✕ button too: without `htmlFor`, a tap on the label would press ✕, not focus the field.
  const fieldId = useId();

  useEffect(() => {
    const t = window.setTimeout(() => onSearch(text), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [text, onSearch]);
  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  const close = () => {
    setText('');
    onSearch('');
    setSearching(false);
  };

  return (
    <div ref={rowRef} className={`${styles.page} ${styles.lower}`} data-budget-thumb="" data-tour="budget-thumb">
      {canEdit ? (
        // Full colour at every width — on glass it is the one solid thing. `filled`
        // rather than `main`, so on a phone with the search open it may drop its
        // word with the rest of the row (the Find thumb row's ＋ Add your own).
        <ActionButton tone="brand" filled icon={Plus} label="Add expense" onClick={onAdd} />
      ) : null}
      <span
        className="sn-glass-row inline-flex shrink-0 rounded-full"
        data-glass-row="budget-filter"
        data-press-reach=""
        // 👆 The glass's 1px edge is part of the 44px pill, but a press on it hit the glass, not the control
        // (measured 42px, fits-every-phone 2026-10-21) — so a press anywhere on the pill is the control's press,
        // the Find thumb row's own forwarder (`find-thumb-row.tsx`, `data-press-reach`).
        onClick={(e) => {
          if (!(e.target as Element).closest('button')) e.currentTarget.querySelector('button')?.click();
        }}
      >
        <PickMenu
          label="Show"
          value={filter}
          options={LIST_FILTERS}
          onPick={(k) => {
            if (isListFilter(k)) onFilter(k);
          }}
          dataAttr="data-budget-filter"
          // 42px inside the glass's 1px edge = the row's 44px (the prototype's `.sel`).
          className="!min-h-[42px] !border-transparent !bg-transparent"
        />
      </span>
      {searching ? (
        <label
          htmlFor={fieldId}
          data-glass-row="budget-search"
          data-fit-field=""
          className="sn-glass-row flex h-11 min-w-[60%] flex-1 items-center gap-2 rounded-full pl-3.5 pr-1 text-ink"
        >
          <Search className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.9} aria-hidden />
          <input
            ref={inputRef}
            id={fieldId}
            // `text`, not `search`: a search input draws the browser's own ✕ beside ours.
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
            }}
            placeholder="Search"
            aria-label="Search the budget"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink/55"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/60"
          >
            <X className="h-4 w-4" strokeWidth={1.9} aria-hidden />
          </button>
        </label>
      ) : (
        <>
          <span className={styles.grow} aria-hidden="true" />
          <span
            className="sn-glass-row inline-flex shrink-0 rounded-full"
            data-press-reach=""
            onClick={(e) => {
              if (!(e.target as Element).closest('button')) e.currentTarget.querySelector('button')?.click();
            }}
          >
            <ActionButton
              tone="neutral"
              iconOnly
              icon={Search}
              label="Search"
              onClick={() => setSearching(true)}
              className="!h-[42px] !min-h-[42px] !w-[42px] !min-w-[42px] !border-transparent"
            />
          </span>
        </>
      )}
    </div>
  );
}

/**
 * A group whose read was refused. Words — never a zero, never an empty state —
 * and Retry, which re-reads the whole page.
 */
function GroupUnread({ what, onRetry, retrying }: { what: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div className={styles.fail} role="status" data-budget-unread="">
      <span className={styles.dot} aria-hidden="true" />
      Couldn&rsquo;t load {what}.
      <button
        type="button"
        className={styles.retry}
        onClick={onRetry}
        disabled={retrying}
        aria-busy={retrying || undefined}
        data-budget-retry=""
      >
        Retry
      </button>
    </div>
  );
}

/** Why a group the filter or the search emptied has no rows. */
function GroupWhy({ text }: { text: string }) {
  return (
    <div className={styles.empty} data-budget-why="">
      {text}
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

type GroupProps<R> = {
  /** Every row the read returned — `null` when it was refused. The count is of these. */
  rows: R[] | null;
  /** The rows the filter and the search leave. `null` exactly when `rows` is. */
  shown: R[] | null;
  /** What to say when `shown` is empty (`whyEmpty`); `null` = say nothing. */
  why: string | null;
  onRetry: () => void;
  retrying: boolean;
};

function SupplierGroup({
  rows,
  shown,
  why,
  onOpen,
  onRetry,
  retrying,
}: GroupProps<SupplierRow> & {
  onOpen: (vendorId: string) => void;
}) {
  return (
    <>
      <GroupHead title="Booked suppliers" count={rows === null ? null : rows.length} />
      {rows === null ? (
        <GroupUnread what="your suppliers" onRetry={onRetry} retrying={retrying} />
      ) : (shown ?? []).length === 0 && why ? (
        <GroupWhy text={why} />
      ) : (
        (shown ?? []).map((s) => (
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

function OrderGroup({ rows, shown, why, onRetry, retrying }: GroupProps<OrderRow>) {
  return (
    <>
      <GroupHead title="Bought on Setnayan" count={rows === null ? null : rows.length} />
      {rows === null ? (
        <GroupUnread what="your purchases" onRetry={onRetry} retrying={retrying} />
      ) : (shown ?? []).length === 0 && why ? (
        <GroupWhy text={why} />
      ) : (
        (shown ?? []).map((o) => (
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
  shown,
  why,
  canEdit,
  onOpen,
  onRetry,
  retrying,
}: GroupProps<ExpenseRow> & {
  canEdit: boolean;
  onOpen: (costId: string) => void;
}) {
  return (
    <>
      <GroupHead title="Your expenses" count={rows === null ? null : rows.length} />
      {rows === null ? (
        <GroupUnread what="your expenses" onRetry={onRetry} retrying={retrying} />
      ) : rows.length === 0 ? (
        <div className={styles.empty}>
          Nothing added yet. Use ＋ Add expense for anything paid outside Setnayan.
        </div>
      ) : (shown ?? []).length === 0 && why ? (
        <GroupWhy text={why} />
      ) : (
        (shown ?? []).map((e) => {
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
