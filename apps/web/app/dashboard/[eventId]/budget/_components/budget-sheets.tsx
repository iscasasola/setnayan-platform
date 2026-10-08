'use client';

/**
 * The Budget page's four sheets — loaded on the first tap, never on first paint
 * (`budget-screen.tsx` imports this file dynamically).
 *
 *   a supplier's payments ... every payment (Paid · date · how / Due · date),
 *                             Chat, and Record a payment
 *   Record a payment ........ Amount (pre-filled with the next due) · Date · How
 *   an expense .............. Amount and Paid so far, saved as you type; Remove
 *   Add expense ............. Name · Amount · Paid so far · Category (optional)
 *
 * From `prototypes/budget_page_2026-10-08_fable.html` (owner 2026-10-08:
 * "budget looks good!"), on the shipped `Sheet`, `PickMenu` and `ActionButton`.
 *
 * ── Creation is the only button ───────────────────────────────────────────
 * "＋ Add" and "✓ Record" make something new, so they are buttons. Editing an
 * expense afterwards has no Save: the two fields keep as you type.
 *
 * ── A refusal is said where the answer would have been ────────────────────
 * Every write returns a result and this file reads it. A refused payment or a
 * refused edit prints its reason in the sheet and leaves the sheet open — a
 * sheet that closes on failure is a failure rendering as success.
 *
 * ── No second writer of a payment ─────────────────────────────────────────
 * Recording goes through `logScheduledPayment`, which runs `logPayment` and
 * every rule it enforces. A supplier on Setnayan is paid under "Amount to pay"
 * (`SupplierExtras.door`), so their button goes there instead of opening a
 * second form — the rule the old per-supplier card already followed.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { useToast } from '@/app/_components/toast/toast-provider';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ContactShortlistVendorButton } from '@/app/dashboard/[eventId]/vendors/_components/contact-shortlist-vendor-button';
import { OTHER_BUCKET } from '@/lib/budget-truth';
import { shortDate, suggestedPayment, type BudgetList, type ExpenseRow, type SupplierRow } from '@/lib/budget-page-view';
import type { CostCategoryOption } from '@/lib/event-costs';
import { logScheduledPayment } from '../actions';
import { deleteEventCost, recordEventCost } from '../cost-actions';
import { Peso } from './budget-summary';
import type { BudgetSheetState, SupplierExtras } from './budget-screen';
import styles from './budget-page.module.css';

/** The "How" dropdown — the four ways the prototype names. Stored as written. */
const HOW = ['GCash', 'Bank transfer', 'Cash', 'Card'] as const;

const EDIT_DEBOUNCE_MS = 600;

/** `"₱ 15,000"` → `15000`. Empty → `null`. Not a number → `undefined`. */
function parsePesos(raw: string): number | null | undefined {
  const stripped = raw.replace(/[₱,\s]/g, '');
  if (stripped.length === 0) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(stripped)) return undefined;
  return Number(stripped);
}
/** A field's own text for an amount — grouped, centavos only when there are any. */
function pesoText(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
/** Today on the couple's own calendar (`YYYY-MM-DD`) — not UTC's. */
function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date());
}

export function BudgetSheets({
  eventId,
  canEdit,
  sheet,
  onChange,
  list,
  supplierExtras,
  categories,
}: {
  eventId: string;
  canEdit: boolean;
  sheet: BudgetSheetState;
  onChange: (next: BudgetSheetState) => void;
  list: BudgetList;
  supplierExtras: Record<string, SupplierExtras>;
  categories: CostCategoryOption[];
}) {
  const close = () => onChange(null);
  const supplier =
    sheet && (sheet.kind === 'pay' || sheet.kind === 'record')
      ? ((list.suppliers ?? []).find((s) => s.vendorId === sheet.vendorId) ?? null)
      : null;
  const expense =
    sheet && sheet.kind === 'expense'
      ? ((list.expenses ?? []).find((e) => e.costId === sheet.costId) ?? null)
      : null;

  return (
    <>
      {sheet?.kind === 'pay' && supplier ? (
        <SupplierSheet
          eventId={eventId}
          canEdit={canEdit}
          supplier={supplier}
          extras={supplierExtras[supplier.vendorId] ?? null}
          onClose={close}
          onRecord={() => onChange({ kind: 'record', vendorId: supplier.vendorId })}
        />
      ) : null}
      {sheet?.kind === 'record' && supplier ? (
        <RecordSheet eventId={eventId} supplier={supplier} onClose={close} />
      ) : null}
      {sheet?.kind === 'expense' && expense ? (
        // Keyed on the expense, so opening another one starts from ITS figures.
        <ExpenseSheet key={expense.costId} eventId={eventId} expense={expense} onClose={close} />
      ) : null}
      {sheet?.kind === 'add' ? <AddExpenseSheet eventId={eventId} categories={categories} onClose={close} /> : null}
    </>
  );
}

// ── a supplier's payments ───────────────────────────────────────────────────

function SupplierSheet({
  eventId,
  canEdit,
  supplier,
  extras,
  onClose,
  onRecord,
}: {
  eventId: string;
  canEdit: boolean;
  supplier: SupplierRow;
  extras: SupplierExtras | null;
  onClose: () => void;
  onRecord: () => void;
}) {
  const titleId = useId();
  const payments = [...(extras?.payments ?? [])].sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  // The payment log could not be listed (or this is a legacy single-figure
  // record) while the ledger says money HAS been handed over: say the figure,
  // undated — never "no payments yet" beside "₱105,600 paid".
  const paidWithNoLog = payments.length === 0 && supplier.paidPhp > 0;
  const door = extras?.door ?? 'unknown';

  return (
    <Sheet open onClose={onClose} labelledById={titleId} rise>
      <div className={`${styles.page} ${styles.sheet}`} data-budget-sheet="supplier">
        <h3 id={titleId}>{supplier.name}</h3>
        <div className={`${styles.sheetSub} ${styles.num}`}>
          {supplier.service} · <Peso value={supplier.agreedPhp} /> agreed · <Peso value={supplier.paidPhp} /> paid
        </div>

        <div className={styles.sheetBody}>
          {payments.map((p) => (
            <div key={p.paymentId} className={styles.pay}>
              <span>
                Paid{' '}
                <span className={styles.payD}>
                  · {shortDate(p.paidAt)}
                  {p.method ? ` · ${p.method}` : ''}
                </span>
              </span>
              <span className={`${styles.payA} ${styles.payOk} ${styles.num}`}>
                <Peso value={p.amountPhp} />
              </span>
            </div>
          ))}
          {paidWithNoLog ? (
            <div className={styles.pay}>
              <span>Paid</span>
              <span className={`${styles.payA} ${styles.payOk} ${styles.num}`}>
                <Peso value={supplier.paidPhp} />
              </span>
            </div>
          ) : null}
          {supplier.dues.map((d) => (
            <div key={`${d.dueDate}-${d.label}`} className={styles.pay}>
              <span>
                Due <span className={styles.payD}>· {shortDate(d.dueDate)}</span>
              </span>
              <span className={`${styles.payA} ${styles.payDue} ${styles.num}`}>
                <Peso value={d.amountPhp} />
              </span>
            </div>
          ))}
        </div>

        {door === 'unknown' && canEdit ? (
          <p className={styles.said} role="status">
            We couldn&rsquo;t check whether your payment to {supplier.name} is recorded, so recording a
            payment is paused. Refresh to try again.
          </p>
        ) : null}

        <div className={styles.acts}>
          {extras?.chat.kind === 'thread' ? (
            <ContactShortlistVendorButton
              eventId={eventId}
              vendorId={supplier.vendorId}
              label="Chat"
              pendingLabel="Opening…"
              className={actionButtonClass('info')}
              wrapperClassName=""
              errorClassName={`${styles.said} ${styles.saidBad}`}
            />
          ) : extras ? (
            <ActionButton tone="info" icon={MessageCircle} label="Chat" href={extras.chat.href} />
          ) : null}
          {!canEdit || !extras || door === 'unknown' ? null : door === 'amount_to_pay' ? (
            <ActionButton tone="brand" main icon={Check} label="Record a payment" href={extras.amountToPayHref} />
          ) : (
            <ActionButton tone="brand" main icon={Check} label="Record a payment" onClick={onRecord} />
          )}
        </div>
      </div>
    </Sheet>
  );
}

// ── record a payment ────────────────────────────────────────────────────────

function RecordSheet({
  eventId,
  supplier,
  onClose,
}: {
  eventId: string;
  supplier: SupplierRow;
  onClose: () => void;
}) {
  const titleId = useId();
  const router = useRouter();
  const toast = useToast();
  const suggested = suggestedPayment(supplier);
  const [amount, setAmount] = useState(suggested ? pesoText(suggested.amountPhp) : '');
  const [date, setDate] = useState(todayLocal);
  const [how, setHow] = useState<string>(HOW[0]);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  async function record() {
    const php = parsePesos(amount);
    if (!php || php <= 0) {
      toast.info('Amount, please');
      return;
    }
    setBusy(true);
    setRefused(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('vendor_id', supplier.vendorId);
    fd.set('amount_php', String(php));
    fd.set('paid_at', date);
    fd.set('method', how);
    let message: string | null = null;
    try {
      const res = await logScheduledPayment(fd);
      if (res.status !== 'ok') message = res.message;
    } catch {
      message = 'Could not record that payment — please try again.';
    }
    setBusy(false);
    if (message) {
      // Stay open and say why. Nothing was recorded.
      setRefused(message);
      return;
    }
    toast.success('Recorded · owed updated');
    onClose();
    router.refresh();
  }

  return (
    <Sheet open onClose={onClose} labelledById={titleId} rise>
      <div className={`${styles.page} ${styles.sheet}`} data-budget-sheet="record">
        <h3 id={titleId}>Record a payment</h3>
        <div className={`${styles.sheetSub} ${styles.num}`}>
          {supplier.name}
          {suggested?.dueDate ? (
            <>
              {' '}
              · next due <Peso value={suggested.amountPhp} /> by {shortDate(suggested.dueDate)}
            </>
          ) : null}
        </div>
        <div className={styles.sheetBody}>
          <div className={styles.field}>
            <label htmlFor={`${titleId}-amt`}>Amount</label>
            <input
              id={`${titleId}-amt`}
              className={styles.num}
              inputMode="decimal"
              autoComplete="off"
              placeholder="₱"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${titleId}-date`}>Date</label>
            <input id={`${titleId}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>How</span>
            <PickMenu
              label="How it was paid"
              value={how}
              options={HOW.map((h) => ({ key: h, label: h }))}
              onPick={setHow}
              className={styles.pick}
            />
          </div>
        </div>
        {refused ? (
          <p className={`${styles.said} ${styles.saidBad}`} role="alert">
            {refused}
          </p>
        ) : null}
        <div className={styles.acts}>
          <ActionButton tone="brand" main icon={Check} label="Record" onClick={record} disabled={busy} />
        </div>
      </div>
    </Sheet>
  );
}

// ── an expense: edits save as you type ──────────────────────────────────────

function ExpenseSheet({
  eventId,
  expense,
  onClose,
}: {
  eventId: string;
  expense: ExpenseRow;
  onClose: () => void;
}) {
  const titleId = useId();
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState(pesoText(expense.amountPhp));
  const [paid, setPaid] = useState(pesoText(expense.paidPhp));
  const [said, setSaid] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  // What the next save will send — a ref, so a debounced save reads the latest keystroke.
  const draft = useRef({ amount, paid });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function save() {
    const amountPhp = parsePesos(draft.current.amount);
    const paidPhp = parsePesos(draft.current.paid);
    // Half-typed or empty: nothing is sent, and nothing is called saved.
    if (amountPhp === undefined || paidPhp === undefined || amountPhp === null || amountPhp <= 0) {
      setSaid({ tone: 'bad', text: 'Not saved — the amount needs a number above zero.' });
      return;
    }
    const mine = ++seq.current;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('cost_id', expense.costId);
    fd.set('amount_php', String(amountPhp));
    fd.set('paid_php', String(paidPhp ?? 0));
    let error: string | null = null;
    try {
      const res = await recordEventCost(fd);
      if (!res.ok) error = res.error;
    } catch {
      error = 'Could not save that — please try again.';
    }
    if (mine !== seq.current) return; // a newer save owns the verdict
    if (error) {
      setSaid({ tone: 'bad', text: `Not saved — ${error}` });
      return;
    }
    setSaid({ tone: 'ok', text: 'Saved.' });
    router.refresh();
  }

  function onType(field: 'amount' | 'paid', value: string) {
    if (field === 'amount') setAmount(value);
    else setPaid(value);
    draft.current = { ...draft.current, [field]: value };
    setSaid(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), EDIT_DEBOUNCE_MS);
  }

  async function remove() {
    if (timer.current) clearTimeout(timer.current);
    setBusy(true);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('cost_id', expense.costId);
    let error: string | null = null;
    try {
      const res = await deleteEventCost(fd);
      if (!res.ok) error = res.error;
    } catch {
      error = 'Could not remove that — please try again.';
    }
    setBusy(false);
    if (error) {
      setSaid({ tone: 'bad', text: `Not removed — ${error}` });
      return;
    }
    toast.success('Removed');
    onClose();
    router.refresh();
  }

  return (
    <Sheet open onClose={onClose} labelledById={titleId} rise>
      <div className={`${styles.page} ${styles.sheet}`} data-budget-sheet="expense">
        <h3 id={titleId}>{expense.name}</h3>
        <div className={styles.sheetSub}>Edits save as you type.</div>
        <div className={styles.sheetBody}>
          <div className={styles.field}>
            <label htmlFor={`${titleId}-amt`}>Amount</label>
            <input
              id={`${titleId}-amt`}
              className={styles.num}
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => onType('amount', e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${titleId}-paid`}>Paid so far</label>
            <input
              id={`${titleId}-paid`}
              className={styles.num}
              inputMode="decimal"
              autoComplete="off"
              value={paid}
              onChange={(e) => onType('paid', e.target.value)}
            />
          </div>
        </div>
        {said ? (
          <p
            className={`${styles.said}${said.tone === 'bad' ? ` ${styles.saidBad}` : ''}`}
            role={said.tone === 'bad' ? 'alert' : 'status'}
          >
            {said.text}
          </p>
        ) : null}
        <div className={styles.acts}>
          <ActionButton tone="danger" icon={Trash2} label="Remove" onClick={remove} disabled={busy} />
        </div>
      </div>
    </Sheet>
  );
}

// ── add expense ─────────────────────────────────────────────────────────────

function AddExpenseSheet({
  eventId,
  categories,
  onClose,
}: {
  eventId: string;
  categories: CostCategoryOption[];
  onClose: () => void;
}) {
  const titleId = useId();
  const router = useRouter();
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function add() {
    const amountPhp = parsePesos(amount);
    const paidPhp = parsePesos(paid);
    if (name.trim().length === 0 || !amountPhp || amountPhp <= 0) {
      toast.info('Name and amount, please');
      return;
    }
    if (paidPhp === undefined) {
      toast.info('Paid so far needs a number, or leave it empty');
      return;
    }
    setBusy(true);
    setRefused(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('label', name.trim());
    fd.set('amount_php', String(amountPhp));
    fd.set('paid_php', paidPhp === null ? '' : String(paidPhp));
    // Category is optional on the sheet; the column is not. "Other" is the
    // shipped answer for a cost nobody filed anywhere.
    fd.set('plan_group_id', category ?? OTHER_BUCKET);
    let error: string | null = null;
    try {
      const res = await recordEventCost(fd);
      if (!res.ok) error = res.error;
    } catch {
      error = 'Could not add that — please try again.';
    }
    setBusy(false);
    if (error) {
      setRefused(error);
      return;
    }
    toast.success('Added · totals updated');
    onClose();
    router.refresh();
  }

  return (
    <Sheet open onClose={onClose} labelledById={titleId} rise>
      <div className={`${styles.page} ${styles.sheet}`} data-budget-sheet="add">
        <h3 id={titleId}>Add expense</h3>
        <div className={styles.sheetSub}>Anything not booked through Setnayan.</div>
        <div className={styles.sheetBody}>
          <div className={styles.field}>
            <label htmlFor={`${titleId}-name`}>Name</label>
            <input
              ref={nameRef}
              id={`${titleId}-name`}
              className={styles.wide}
              autoComplete="off"
              placeholder="Church offering"
              maxLength={64}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${titleId}-amt`}>Amount</label>
            <input
              id={`${titleId}-amt`}
              className={styles.num}
              inputMode="decimal"
              autoComplete="off"
              placeholder="₱"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <InfoTip label="Paid so far" labelClassName={styles.fieldLabel} align="start">
              What you have already handed over. Leave empty if nothing yet.
            </InfoTip>
            <input
              className={styles.num}
              inputMode="decimal"
              autoComplete="off"
              aria-label="Paid so far"
              placeholder="₱ 0"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Category <span className={styles.optional}>optional</span>
            </span>
            <PickMenu
              label="Category"
              value={category}
              buttonText={category ? undefined : 'Pick'}
              options={categories.map((c) => ({ key: c.id, label: c.label }))}
              onPick={setCategory}
              className={styles.pick}
            />
          </div>
        </div>
        {refused ? (
          <p className={`${styles.said} ${styles.saidBad}`} role="alert">
            {refused}
          </p>
        ) : null}
        <div className={styles.acts}>
          <ActionButton tone="brand" main icon={Plus} label="Add" onClick={add} disabled={busy} />
        </div>
      </div>
    </Sheet>
  );
}
