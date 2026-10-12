/**
 * THE BUDGET, UNDER THE BOOKED ROWS (owner 2026-10-07; corpus
 * `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR4 "Budget"; the prototype's
 * Booked mode).
 *
 *   Budget
 *   Due next ₱528,000
 *   BUDGET ₱2,250,000            BOOKED ₱1,056,000
 *   PAID TO SUPPLIERS ₱0         SETNAYAN ORDERS ₱2,500
 *   IF YOU BOOK THESE ₱0         BUFFER ⓘ  Not knowable
 *   ▓▓▓▓▓▓▓░░░░░░░░  47% spoken for · 0% paid to suppliers
 *   SEDA VERTIS NORTH   First payment · by Oct 5          ( Pay ₱528,000 )
 *
 * A SERVER component: it draws `lib/booked-budget.ts`'s answer. Figures count
 * to their value (`Count`) and the meter grows (`Fill`) — the shipped pair.
 *
 * ── A FIGURE NOBODY MEASURED IS WORDS, NEVER ₱0 ────────────────────────────
 * `paidPhp`, `orders` and `dueNextPhp` are `null` when their read was refused.
 * Each then prints "Couldn't load", the meter draws no paid bar, and the line
 * under it says the payments could not be read — the same refusal, in the
 * place the number would have been.
 */
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { Count, Fill } from '@/components/count';
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/php';
import { shortDate } from '@/lib/budget-page-view';
import { subtotalLabel } from '@/lib/your-team';
import { yourTeamBudgetHref } from '@/lib/pillar-parts';
import type { BookedBudget, BudgetLine } from '@/lib/booked-budget';
import { BudgetLineButton } from './booked-row';

const BUDGET_CSS =
  '[data-booked-budget] .bb-meter{position:relative;height:6px;border-radius:3px;background:rgb(var(--color-ink)/.1);margin-top:12px;overflow:hidden}' +
  '[data-booked-budget] .bb-meter>.meter-fill{position:absolute;left:0;top:0;bottom:0}' +
  '[data-booked-budget] .bb-spoken{background:var(--sn-gold-500,#a9834b)}' +
  '[data-booked-budget] .bb-paid{background:rgb(var(--color-ok))}';

const H2 = 'font-display text-[21px] font-medium leading-tight text-ink';
const SUB = 'mt-0.5 text-[14px] text-ink/60';
const K = 'text-[11px] uppercase tracking-[0.14em] text-ink/55';
const V = 'text-[22px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink';
const N = 'mt-0.5 text-[12px] text-ink/55';
/** A refused read, where the figure would have been. */
const UNREAD = 'text-[15px] font-medium leading-[1.4] text-ink/70';

function Figure({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={K}>{k}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export function BookedBudgetSection({ eventId, budget }: { eventId: string; budget: BookedBudget }) {
  const b = budget;
  const ordersNote =
    b.orders === null || b.orders.count === 0
      ? null
      : `${b.orders.onlyName ?? `${formatCount(b.orders.count)} orders`} · ${b.orders.owedPhp > 0 ? `${formatPhp(b.orders.owedPhp)} owed` : 'paid'}`;
  return (
    <section id="svc-budget" data-booked-section="budget" data-booked-budget="" data-money="" aria-labelledby="bk-budget-h">
      <style>{BUDGET_CSS}</style>
      <h2 id="bk-budget-h" className={H2}>
        Budget
      </h2>
      <p className={SUB} data-budget-due={b.dueNextPhp === null ? 'unread' : b.dueNextPhp > 0 ? 'due' : 'none'}>
        {b.dueNextPhp === null ? (
          'We couldn’t check what is due.'
        ) : b.dueNextPhp > 0 ? (
          <>
            Due next <b className="font-semibold tabular-nums text-mulberry">{formatPhp(b.dueNextPhp)}</b>
          </>
        ) : (
          'Nothing due right now.'
        )}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3.5">
        <Figure k="Budget">
          {b.budgetPhp !== null ? (
            <Count value={b.budgetPhp} format="peso" id="bk-budget" className={V} />
          ) : (
            <span className={UNREAD}>No budget set</span>
          )}
        </Figure>
        <Figure k="Booked">
          <Count value={b.bookedPhp} format="peso" id="bk-booked" className={V} />
          {b.bookedUnpriced > 0 ? (
            <p className={N} data-budget-note="booked">
              {formatCount(b.bookedUnpriced)} booked · no price recorded
            </p>
          ) : null}
        </Figure>
        <Figure k="Paid to suppliers">
          {b.paidPhp === null ? (
            <span className={UNREAD} data-budget-unread="paid">
              Couldn’t load
            </span>
          ) : (
            <>
              <Count value={b.paidPhp} format="peso" id="bk-paid" className={V} />
              {b.paidPhp > 0 ? null : <p className={N}>None recorded</p>}
            </>
          )}
        </Figure>
        <Figure k="Setnayan orders">
          {b.orders === null ? (
            <span className={UNREAD} data-budget-unread="orders">
              Couldn’t load
            </span>
          ) : (
            <>
              <Count value={b.orders.totalPhp} format="peso" id="bk-orders" className={V} />
              <p className={N}>{ordersNote ?? 'None yet'}</p>
            </>
          )}
        </Figure>
        <Figure k="If you book these">
          {b.inBuildUnpriced > 0 ? (
            // A partial sum never passes as a whole one (`subtotalLabel`).
            <span className={UNREAD}>{subtotalLabel(b.inBuildPhp, b.inBuildUnpriced)}</span>
          ) : (
            <Count value={b.inBuildPhp} format="peso" id="bk-tobook" className={V} />
          )}
          <p className={N}>{formatCount(b.inBuildCount)} in your build</p>
        </Figure>
        <div className="min-w-0">
          <dt>
            <InfoTip label="Buffer" labelClassName={K} align="end">
              Your budget minus everything booked and in your build. It refuses to guess while any of them has no price.
            </InfoTip>
          </dt>
          <dd className="mt-0.5" data-budget-buffer={b.buffer.tone}>
            <span className={`${b.buffer.tone === 'none' ? 'text-[20px]' : 'text-[22px]'} font-semibold leading-[1.1] tracking-[-0.01em] tabular-nums ${b.buffer.tone === 'over' ? 'text-mulberry' : 'text-ink'}`}>
              {b.buffer.text}
            </span>
            {b.buffer.unpriced > 0 ? (
              <p className={N}>{formatCount(b.buffer.unpriced)} of your people have no price</p>
            ) : null}
          </dd>
        </div>
      </dl>

      {b.meter ? (
        <>
          <div className="bb-meter" role="presentation" data-budget-meter="">
            <Fill value={b.meter.spokenPct} id="bk-meter-spoken" className="bb-spoken" />
            {b.meter.paidPct !== null ? <Fill value={b.meter.paidPct} id="bk-meter-paid" className="bb-paid" /> : null}
          </div>
          <p className="mb-2.5 mt-1.5 text-[12px] text-ink/60">
            <Count value={Math.round(b.meter.spokenPct)} format="pct" id="bk-spoken-pct" /> spoken for ·{' '}
            {b.meter.paidPct !== null ? (
              <>
                <Count value={Math.round(b.meter.paidPct)} format="pct" id="bk-paid-pct" /> paid to suppliers
              </>
            ) : (
              'payments couldn’t load'
            )}
          </p>
        </>
      ) : null}

      {b.lines.length > 0 ? (
        <ul className="mt-1" data-budget-lines="">
          {b.lines.map((l) => (
            <li
              key={l.vendorId}
              data-budget-line={l.kind}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-ink/10 py-2.5 text-[14px] first:border-t-0"
            >
              <span className="min-w-0">
                <span className="block truncate text-[12px] uppercase tracking-[0.08em] text-ink/55">{l.name}</span>
                <span className={`block tabular-nums ${l.kind === 'no_amount' || l.kind === 'unread' ? 'text-ink/55' : 'font-medium text-ink'}`}>
                  {lineWords(l)}
                </span>
              </span>
              {l.kind === 'on_track' ? (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-success-100 px-2.5 py-1 text-[12px] leading-none text-success-900">On track</span>
              ) : l.kind === 'unread' ? null : (
                <BudgetLineButton
                  eventId={eventId}
                  vendorId={l.vendorId}
                  vendorName={l.name}
                  own={l.own}
                  verb={l.kind === 'no_amount' ? 'set_price' : 'pay'}
                  version={JSON.stringify(l)}
                  label={l.kind === 'due' && l.amountPhp !== null ? `Pay ${formatPhp(l.amountPhp)}` : undefined}
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {/* The whole budget — the target, your own expenses, what you bought on
          Setnayan — is its own part of Suppliers. One quiet door, kept. */}
      <div className="mt-4 flex">
        {/* An ELEMENT, not the component: this file is drawn on the server, and a
            function cannot cross to a client button. */}
        <ActionButton
          tone="neutral"
          icon={<ArrowRight aria-hidden="true" strokeWidth={1.9} />}
          label="Open budget"
          href={yourTeamBudgetHref(eventId)}
          prefetch={false}
        />
      </div>
    </section>
  );
}

function lineWords(l: BudgetLine): string {
  switch (l.kind) {
    case 'no_amount':
      return 'No amount yet';
    case 'due':
      return l.dueDate ? `${l.label} · by ${shortDate(l.dueDate)}` : l.label;
    case 'owed':
    case 'on_track':
      return `Paid ${formatPhp(l.paidPhp)} of ${formatPhp(l.agreedPhp)}`;
    case 'unread':
      return 'We couldn’t check their payments';
  }
}
