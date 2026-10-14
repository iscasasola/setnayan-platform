'use client';

/**
 * <BudgetSummary> — the top of the Budget page: Target · Agreed · Paid · Owed,
 * two by two, as ROWS (no tile, no box), one meter, one "Next" line.
 *
 * Built from `prototypes/budget_page_2026-10-08_fable.html` (owner 2026-10-08:
 * "budget looks good!"; plan row B1 of `BUDGET_PAGE_2026-10-08_fable.md`). It
 * replaces three things that used to stack here: the "What's your total …
 * budget?" setter form, the boxed four-stat tile, and the live card with its
 * pinned bar.
 *
 * ── Target edits in place ─────────────────────────────────────────────────
 * Tap the number, type, and it saves — debounced through the SAME action the
 * old form posted to (`setEventBudget`). There is no Save button. A refused
 * save says "not saved" where "saved" would have flashed: a failure must never
 * look like success.
 *
 * ── A figure nobody measured is not a number ──────────────────────────────
 * `agreedPhp` / `paidPhp` / `owedPhp` are `null` when a source the figure
 * depends on was refused (`EventMoney.reads`, B0). They then draw "—", and the
 * meter draws no bar. Never ₱0.
 *
 * ── It stays live ─────────────────────────────────────────────────────────
 * A payment or a line item landing from another device refreshes the page's
 * server render (`router.refresh()`), so the summary and everything under it
 * re-read the ONE resolver together. The old card refetched its own figures
 * through a second server action — two writers of one number.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InfoTip } from '@/app/_components/info-tip';
import { Count, Fill } from '@/components/count';
import { createClient } from '@/lib/supabase/client';
import { formatPhp } from '@/lib/orders';
import { budgetMeter, shortDate, type NextPayment } from '@/lib/budget-page-view';
import { setEventBudget } from '../actions';
import styles from './budget-page.module.css';

const SAVE_DEBOUNCE_MS = 500;
const SAVED_FLASH_MS = 1400;

/** `2250000` → `"2,250,000"` — the Target field's own text, no ₱ (it is drawn beside it). */
function targetText(php: number | null): string {
  return php === null ? '' : Math.round(php).toLocaleString('en-PH');
}

/** What was typed, as whole pesos. Empty → `null` (no target), garbage → `undefined`. */
function parseTarget(raw: string): number | null | undefined {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 0) return raw.trim().length === 0 ? null : undefined;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * A peso figure. Whole pesos count to their value (Rule 2 of the button rule);
 * a figure carrying centavos is printed exact and still, because `Count` steps
 * through whole numbers and this page is the couple's books.
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

export function BudgetSummary({
  eventId,
  canEdit,
  targetPhp: initialTargetPhp,
  agreedPhp,
  paidPhp,
  owedPhp,
  next,
  payHref,
  onPay,
}: {
  eventId: string;
  /** Setting the target is the couple's alone (locked D1); a delegate reads it. */
  canEdit: boolean;
  targetPhp: number | null;
  agreedPhp: number | null;
  paidPhp: number | null;
  owedPhp: number | null;
  next: NextPayment | null;
  /** Where "Pay ›" goes when there is no `onPay`. */
  payHref: string;
  onPay?: (next: NextPayment) => void;
}) {
  const router = useRouter();
  const [targetPhp, setTargetPhp] = useState<number | null>(initialTargetPhp);
  const [text, setText] = useState(() => targetText(initialTargetPhp));
  const [flash, setFlash] = useState<'saved' | 'bad' | null>(null);
  const focused = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeq = useRef(0);

  // A fresh server render (another device, a refresh) wins — unless the couple
  // is mid-type, when rewriting the field under the caret would eat a keystroke.
  useEffect(() => {
    if (focused.current) return;
    setTargetPhp(initialTargetPhp);
    setText(targetText(initialTargetPhp));
  }, [initialTargetPhp]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  // Live: a payment or a line item changing anywhere re-reads the page.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stop = () => {};
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`budget-${eventId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'event_vendor_payments', filter: `event_id=eq.${eventId}` },
          refresh,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'event_vendor_line_items', filter: `event_id=eq.${eventId}` },
          refresh,
        )
        .subscribe();
      stop = () => void supabase.removeChannel(channel);
    } catch {
      // The live channel is an extra: every figure here was read on load and is
      // read again on the next visit. A socket that cannot open must not take
      // the couple's summary down with it.
    }
    return () => {
      if (timer) clearTimeout(timer);
      stop();
    };
  }, [eventId, router]);

  function showFlash(kind: 'saved' | 'bad') {
    setFlash(kind);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    // "not saved" stays until the next keystroke; "saved" fades on its own.
    if (kind === 'saved') flashTimer.current = setTimeout(() => setFlash(null), SAVED_FLASH_MS);
  }

  function onType(raw: string) {
    setText(raw);
    const parsed = parseTarget(raw);
    if (parsed === undefined) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const seq = ++saveSeq.current;
      setTargetPhp(parsed);
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('budget_php', parsed === null ? '' : String(parsed));
      let ok = false;
      try {
        ok = (await setEventBudget(fd)).ok;
      } catch {
        ok = false;
      }
      // A slower, older save must not overwrite the verdict of a newer one.
      if (seq !== saveSeq.current) return;
      showFlash(ok ? 'saved' : 'bad');
    }, SAVE_DEBOUNCE_MS);
  }

  const meter = budgetMeter({ targetPhp, agreedPhp, paidPhp });
  const left = targetPhp !== null && agreedPhp !== null ? targetPhp - agreedPhp : null;

  return (
    <section className={`${styles.page} ${styles.sum}`} aria-label="Budget summary" data-budget-summary="">
      <div className={styles.grid}>
        <div className={styles.cell} data-budget-cell="target">
          <div className={styles.k}>
            <InfoTip label="Target" align="start">
              What you plan to spend in all.{canEdit ? ' Tap the number to change it; it saves as you type.' : ''}
            </InfoTip>
            <span
              className={styles.saved}
              data-on={flash !== null}
              data-tone={flash === 'bad' ? 'bad' : 'ok'}
              role="status"
              aria-live="polite"
            >
              {/* Empty until there is something to say: a live region that always
                  held the word would have a screen reader announce "saved" on load. */}
              {flash === 'bad' ? 'not saved' : flash === 'saved' ? 'saved' : ''}
            </span>
          </div>
          {canEdit ? (
            <div className={`${styles.v} ${styles.target}`}>
              <span className={styles.pencil} aria-hidden="true">
                ₱
              </span>
              <input
                className={styles.num}
                inputMode="numeric"
                autoComplete="off"
                aria-label="Target"
                value={text}
                onFocus={() => {
                  focused.current = true;
                }}
                onBlur={() => {
                  focused.current = false;
                  setText(targetText(targetPhp));
                }}
                onChange={(e) => onType(e.target.value)}
              />
            </div>
          ) : (
            <div className={`${styles.v} ${styles.num}${targetPhp === null ? ` ${styles.vMuted}` : ''}`}>
              {targetPhp === null ? '—' : <Peso value={targetPhp} id="budget-target" />}
            </div>
          )}
        </div>
        <div className={styles.cell} data-budget-cell="agreed">
          <div className={styles.k}>
            <InfoTip label="Agreed" align="end">
              Everything booked, bought or added below, at the price agreed.
            </InfoTip>
          </div>
          <Figure value={agreedPhp} id="budget-agreed" />
        </div>
        <div className={styles.cell} data-budget-cell="paid">
          <div className={styles.k}>Paid</div>
          <Figure value={paidPhp} id="budget-paid" tone={styles.vOk} />
        </div>
        <div className={styles.cell} data-budget-cell="owed">
          <div className={styles.k}>Owed</div>
          <Figure value={owedPhp} id="budget-owed" tone={styles.vWine} />
        </div>
      </div>

      <div className={styles.meter} role="presentation">
        <Fill value={meter.agreedPct} id="budget-agreed" className={styles.meterAgreed} />
        <Fill value={meter.paidPct} id="budget-paid" className={styles.meterPaid} />
        <Fill value={meter.overPct} id="budget-over" className={styles.meterOver} />
      </div>
      <div className={styles.legend}>
        <span>
          <i className={styles.swPaid} />
          paid
        </span>
        <span>
          <i className={styles.swAgreed} />
          agreed
        </span>
        <span>
          <i className={styles.swTarget} />
          target
        </span>
        {left === null ? null : left >= 0 ? (
          <span className={`${styles.left} ${styles.num}`}>
            <Peso value={left} id="budget-left" /> left of target
          </span>
        ) : (
          <span className={`${styles.left} ${styles.num} ${styles.wine}`}>
            <Peso value={-left} id="budget-over-by" /> over target
          </span>
        )}
      </div>

      {next ? (
        <div className={styles.nextdue} data-budget-next="">
          <span className={styles.mute}>Next</span>
          <span className={styles.nextTxt}>
            <b className={styles.num}>
              <Peso value={next.amountPhp} id="budget-next" />
            </b>{' '}
            · {next.name} · {shortDate(next.dueDate)}
          </span>
          {onPay ? (
            <button type="button" className={styles.go} onClick={() => onPay(next)}>
              Pay ›
            </button>
          ) : (
            <a className={styles.go} href={payHref}>
              Pay ›
            </a>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** One summary figure — or "—" when nobody measured it. Never ₱0 for unknown. */
function Figure({ value, id, tone }: { value: number | null; id: string; tone?: string }) {
  if (value === null) {
    return <div className={`${styles.v} ${styles.vMuted}`}>—</div>;
  }
  return (
    <div className={`${styles.v} ${styles.num}${tone ? ` ${tone}` : ''}`}>
      <Peso value={value} id={id} />
    </div>
  );
}
