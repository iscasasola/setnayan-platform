import type { ReactNode } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { formatPhp } from '@/lib/orders';
import { purchaseHref, type Purchase, type PurchasesRead } from '@/lib/billing';
import {
  BILLING_SECTION_LABEL,
  PAYMENT_STATE_WORD,
  REWARDS_HREF,
  giftHref,
  manilaDay,
  paymentHref,
  refundsOf,
  sectionSummary,
  type BillingSection,
  type BillingShow,
  type SupplierBillingRead,
} from '@/lib/supplier-billing';
import { BillingFilter } from './billing-filter';
import { BillingList, BillingRow } from './billing-list';

/**
 * 🧾 THE SUPPLIER'S BILLING & RECEIPTS (Build 2 #39, prototype v118 `?tab=billing`) — a SERVER component. The shipped
 * Purchases list (`BillingList`, unchanged) is the first of five sections; Gifts given · Payments received · Refunds ·
 * Rewards earned follow, each with a heading that sticks under the pinned row (title · one short line · ⓘ — details
 * live in the ⓘ, owner 23 Oct) and the SAME `BillingRow` the purchases draw. One dropdown (`BillingFilter`) picks.
 *
 * HONEST STATES, each list its own: refused → "didn't load" (never the empty line); measured and empty → its own words.
 */

const TIPS: Readonly<Record<Exclude<BillingSection, 'purchases'>, string>> = {
  gifts:
    'A gift lives on the client’s quote. Held = waiting on their answer; given = theirs once their first payment clears; refunded = back in your stock when the quote ended without it. Tap a row to open the quote.',
  payments:
    'Every payment clients logged to you, across all your clients. Confirmed = you said it arrived; proof to check = their receipt waits for your word. Tap a row to open that client’s Payment page.',
  refunds: 'Money Setnayan sent back to you, for a plan, a booking fee or a gift pack. Tap a row for the slip it reverses.',
  rewards:
    'What each badge earned you. A Papic or Event Plus reward sits in your gift stock until you give it on a quote; a free booking fee pays your next customer’s fee. Tap to open your badges.',
};

function Heading({ section, line }: { section: BillingSection; line: string }) {
  return (
    <div
      className="sticky top-11 z-[4] -mx-4 sn-pin-hair px-4 pb-1.5 pt-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      style={{ background: 'var(--sn-canvas)' }}
      data-billing-heading={section}
    >
      <InfoTip
        label={BILLING_SECTION_LABEL[section]}
        labelAs="h2"
        align="start"
        labelClassName="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/55"
      >
        {section === 'purchases'
          ? 'Every order your shop placed — plan, booking fees, add-ons and gift packs — newest first. Tap a row for its receipt.'
          : TIPS[section]}
      </InfoTip>
      {line ? <p className="mt-0.5 truncate text-[12.5px] text-ink/60">{line}</p> : null}
    </div>
  );
}

function Unread({ what }: { what: string }) {
  return (
    <p role="status" className="border-y border-ink/10 py-6 text-center text-sm text-ink/60" data-billing-state="unread">
      {what} didn&rsquo;t load. Refresh the page to try again.
    </p>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="border-y border-ink/10 py-6 text-center text-sm text-ink/60" data-billing-state="empty">
      {children}
    </p>
  );
}

const ok = 'text-success-700';
const wine = 'text-terracotta-700';

export function SupplierBillingSections({
  purchases,
  storeShell,
  supplier,
  initial,
}: {
  purchases: PurchasesRead;
  storeShell: boolean;
  supplier: SupplierBillingRead;
  initial: BillingShow;
}) {
  const refunds: Purchase[] = purchases.measured ? refundsOf(purchases.rows) : [];

  const sections: Array<{ key: BillingSection; node: ReactNode }> = [
    {
      key: 'purchases',
      node: (
        <section aria-label="Purchases" className="pb-4">
          <Heading section="purchases" line="" />
          <div className="pt-2">
            <BillingList read={purchases} storeShell={storeShell} />
          </div>
        </section>
      ),
    },
    {
      key: 'gifts',
      node: (
        <section aria-label="Gifts given" className="pb-4">
          <Heading section="gifts" line={sectionSummary('gifts', supplier, refunds)} />
          {!supplier.gifts.measured ? (
            <Unread what="Your gifts" />
          ) : supplier.gifts.rows.length === 0 ? (
            <Empty>No gifts given yet</Empty>
          ) : (
            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {supplier.gifts.rows.map((g) => (
                <BillingRow
                  key={g.lineId}
                  mark="gift"
                  href={giftHref(g)}
                  title={g.client ?? 'A client'}
                  sub={
                    <>
                      {[g.eventDate ? manilaDay(g.eventDate) : null, g.gift].filter(Boolean).join(' · ')} ·{' '}
                      <span className={g.state === 'given' ? ok : g.state === 'refunded' ? wine : ''}>{g.state}</span>
                      {g.state === 'held' ? ' · until they accept the quote' : g.state === 'refunded' ? ' · back in your stock' : ''}
                      {g.fromBadgeReward ? ' · your badge reward' : ''}
                    </>
                  }
                  amount={formatPhp(g.amountPhp)}
                />
              ))}
            </ul>
          )}
        </section>
      ),
    },
    {
      key: 'payments',
      node: (
        <section aria-label="Payments received" className="pb-4">
          <Heading section="payments" line={sectionSummary('payments', supplier, refunds)} />
          {!supplier.payments.measured ? (
            <Unread what="Your payments" />
          ) : supplier.payments.rows.length === 0 ? (
            <Empty>No payments received yet</Empty>
          ) : (
            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {supplier.payments.rows.map((p) => (
                <BillingRow
                  key={p.paymentId}
                  mark="payment"
                  href={paymentHref(p)}
                  title={p.client ?? 'A client'}
                  sub={
                    <>
                      {[p.isDeposit ? 'First payment' : 'Payment', p.method, p.paidOn ? manilaDay(p.paidOn) : null].filter(Boolean).join(' · ')} ·{' '}
                      <span className={p.state === 'confirmed' ? ok : wine}>{PAYMENT_STATE_WORD[p.state]}</span>
                    </>
                  }
                  amount={formatPhp(p.amountPhp)}
                />
              ))}
            </ul>
          )}
        </section>
      ),
    },
    {
      key: 'refunds',
      node: (
        <section aria-label="Refunds" className="pb-4">
          <Heading section="refunds" line={purchases.measured ? sectionSummary('refunds', supplier, refunds) : 'Couldn’t load'} />
          {!purchases.measured ? (
            <Unread what="Your refunds" />
          ) : refunds.length === 0 ? (
            <Empty>No refunds yet</Empty>
          ) : (
            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {refunds.map((r) => (
                <BillingRow
                  key={r.orderId}
                  mark="refund"
                  href={purchaseHref(r)}
                  title={r.description}
                  sub={<>Setnayan → you · {manilaDay(r.createdAt)}</>}
                  amount={formatPhp(r.grossPhp)}
                />
              ))}
            </ul>
          )}
        </section>
      ),
    },
    {
      key: 'rewards',
      node: (
        <section aria-label="Rewards earned" className="pb-4">
          <Heading section="rewards" line={sectionSummary('rewards', supplier, refunds)} />
          {!supplier.rewards.measured ? (
            <Unread what="Your rewards" />
          ) : supplier.rewards.rows.length === 0 ? (
            <Empty>No rewards earned yet</Empty>
          ) : (
            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {supplier.rewards.rows.map((w) => (
                <BillingRow
                  key={w.rewardId}
                  mark="reward"
                  href={REWARDS_HREF}
                  title={w.badge}
                  sub={
                    <>
                      {w.reward} · <span className={w.open ? ok : ''}>{w.where}</span>
                    </>
                  }
                  amount={manilaDay(w.grantedAt)}
                />
              ))}
            </ul>
          )}
        </section>
      ),
    },
  ];

  return <BillingFilter initial={initial} sections={sections} />;
}
