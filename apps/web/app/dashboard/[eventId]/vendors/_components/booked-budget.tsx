/**
 * THE SMALL BUDGET BLOCK, UNDER THE BOOKED ROWS — plan row B4 of the approved
 * Budget design (`BUDGET_PAGE_2026-10-08_fable.md` § 2; the prototype's
 * `?state=suppliers` frame; owner 2026-10-08 *"budget looks good!"*):
 *
 *   Budget
 *   PAID ₱26,499            OWED ₱950,400
 *   ▓▓▓▓▓░░░░░░░░░  ■ paid ■ agreed ■ target
 *   Next ₱528,000 · Seda Vertis North · Oct 5                Pay ›
 *   ( Open budget › )
 *
 * A SERVER component over `lib/booked-budget.ts` — which reads the SAME
 * `EventMoney` the rows above were drawn from, through the Budget page's own
 * functions. It wears the Budget page's own classes (`budget-page.module.css`:
 * `.meter`, `.legend`, `.nextdue`, `.go`), so the bar and the Next line are
 * one drawing on two screens.
 *
 * ── A FIGURE NOBODY MEASURED IS NOT ₱0 ─────────────────────────────────────
 * Paid unknown → "—". Owed with a source refused → the floor with a "+". The
 * meter then draws no bar (`budgetMeter`'s zeros) and the legend says part of
 * it could not load. Nothing answered → Owed is "—" too.
 */
import { ArrowRight } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Count, Fill } from '@/components/count';
import { formatPhp } from '@/lib/php';
import { shortDate } from '@/lib/budget-page-view';
import { yourTeamBudgetHref } from '@/lib/pillar-parts';
import type { BookedBudgetBlock } from '@/lib/booked-budget';
import styles from '@/app/dashboard/[eventId]/budget/_components/budget-page.module.css';
import { NextPayButton } from './booked-row';

const H2 = 'font-display text-[21px] font-medium leading-tight text-ink';

/**
 * A peso figure, as the Budget page's own `Peso` draws it: whole pesos count to
 * their value; a figure with centavos is printed exact and still (`Count`
 * steps whole numbers, and these are the couple's books). Not imported from
 * `budget-summary.tsx` — that is a client module with the Target editor and a
 * live channel in it, and this block needs only the digits.
 */
function Peso({ value, id }: { value: number; id: string }) {
  return Number.isInteger(value) ? <Count value={value} format="peso" id={id} /> : <span>{formatPhp(value)}</span>;
}

export function BookedBudgetSection({ eventId, budget }: { eventId: string; budget: BookedBudgetBlock }) {
  const b = budget;
  const budgetHref = yourTeamBudgetHref(eventId);
  return (
    <section
      id="svc-budget"
      data-booked-section="budget"
      data-booked-budget={b.partial ? 'partial' : 'whole'}
      data-money=""
      aria-labelledby="bk-budget-h"
      className={styles.page}
    >
      <h2 id="bk-budget-h" className={H2}>
        Budget
      </h2>

      <div className={`${styles.grid} mt-2`}>
        <div className={styles.cell} data-budget-cell="paid">
          <div className={styles.k}>Paid</div>
          {b.paidPhp === null ? (
            <div className={`${styles.v} ${styles.vMuted}`} data-budget-unread="paid">
              —
            </div>
          ) : (
            <div className={`${styles.v} ${styles.num} ${styles.vOk}`}>
              <Peso value={b.paidPhp} id="bk-paid" />
            </div>
          )}
        </div>
        <div className={styles.cell} data-budget-cell="owed">
          <div className={styles.k}>Owed</div>
          {b.owed === null ? (
            <div className={`${styles.v} ${styles.vMuted}`} data-budget-unread="owed">
              —
            </div>
          ) : (
            <div className={`${styles.v} ${styles.num} ${styles.vWine}`} data-budget-owed={b.owed.atLeast ? 'at-least' : 'whole'}>
              <Peso value={b.owed.php} id="bk-owed" />
              {b.owed.atLeast ? '+' : null}
            </div>
          )}
        </div>
      </div>

      <div className={styles.meter} role="presentation" data-budget-meter="">
        <Fill value={b.meter.agreedPct} id="bk-agreed" className={styles.meterAgreed} />
        <Fill value={b.meter.paidPct} id="bk-paid" className={styles.meterPaid} />
        <Fill value={b.meter.overPct} id="bk-over" className={styles.meterOver} />
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
        {b.partial ? (
          <span className={styles.left} data-budget-partial="">
            part of this couldn’t load
          </span>
        ) : null}
      </div>

      <div className={styles.nextdue} data-budget-next={b.next ? 'due' : b.partial ? 'unread' : 'none'}>
        <span className={styles.mute}>Next</span>
        {b.next ? (
          <>
            <span className={styles.nextTxt}>
              <b className={styles.num}>
                <Peso value={b.next.amountPhp} id="bk-next" />
              </b>{' '}
              · {b.next.name} · {shortDate(b.next.dueDate)}
            </span>
            {b.next.vendorId ? (
              // The SAME Pay sheet the row's own Pay opens — one door.
              <NextPayButton
                eventId={eventId}
                vendorId={b.next.vendorId}
                vendorName={b.next.name}
                className={styles.go ?? ''}
                version={`${b.next.amountPhp}:${b.next.dueDate}`}
              />
            ) : (
              // The couple's own expense: it is paid on the Budget page.
              <a className={styles.go} href={budgetHref}>
                Pay ›
              </a>
            )}
          </>
        ) : (
          <span className={styles.nextTxt}>{b.partial ? 'couldn’t check' : 'nothing due'}</span>
        )}
      </div>

      {/* The whole budget — the target, your own expenses, what you bought on
          Setnayan — is its own part of Suppliers. */}
      <div className="mt-3 flex">
        {/* An ELEMENT, not the component: this file is drawn on the server, and a
            function cannot cross to a client button. */}
        <ActionButton
          tone="brand"
          icon={<ArrowRight aria-hidden="true" strokeWidth={1.9} />}
          label="Open budget"
          href={budgetHref}
          prefetch={false}
        />
      </div>
    </section>
  );
}
