/**
 * 💸 HOW SETNAYAN EARNS — the trust block inside For Suppliers beat 11 (`#model`), anchored at `#earn`.
 *
 * Owner-approved 16 Nov 2026 (DECISION_LOG e5d166cd, "1a 2a 3a"); drawing: corpus
 * `prototypes/supplier_how_we_earn_2026-11-16/` v2. Ported, not redrawn — the ruled words replace the drawing's:
 *   · (1) the paid-spot promise reads exactly PAID_SPOT_PROMISE (supplier-how-we-earn-data.ts) (no "there are no paid spots today");
 *   · (2) the found-you receipt line is shown here as a sample; the real one sits on the client card and the fee bill;
 *   · (3) the badge reward ("a free booking fee from 1,000 events") stays ONLY in the Badges ⓘ — never repeated here.
 *
 * ⚠ NO TYPED PESO. Every ₱ arrives as a prop read from the catalogues (`getVendorPrices()` →
 * `vendor_billing_catalog`) or the live fee schedule; an unread price prints "—". The gift row carries NO price: the
 * gift price is a withheld catalogue column (anon/authenticated cannot read it) and applies only to Verified-and-up
 * shops, so a public figure here would be either unreadable or wrong for a Free shop.
 * Deep Search is sold to Plus, Pro and Ultra only (`vendor-deep-search-addon.ts` refuses Free/Verified), so this block
 * does not say "every plan".
 * 🔒 supplier-how-we-earn.test.ts
 */
import { FIRST_BOOKING_FREE } from '@/lib/booking-fee-lock';
import { Info } from './supplier-front-info';
import s from './supplier-front.module.css';
import {
  EARN_FREE_ROWS,
  EARN_PROMISES,
  ONE_WEDDING,
  ONE_WEDDING_RULE,
  SAMPLE_FOUND_LINE,
} from './supplier-how-we-earn-data';

export type EarnFigures = { head: string; band: string; tail: string } | null;

export function SupplierHowWeEarn({
  feeEnabled,
  figures,
  plans,
  deepSearch,
}: {
  feeEnabled: boolean;
  /** `bookingFeeFigures(schedule)` from the live schedule, or null when it could not be read / the fee is off. */
  figures: EarnFigures;
  /** The 28-day price of each plan, from the catalogue (`getVendorPrices()`); null when unread. */
  plans: { plus: string | null; pro: string | null; ultra: string | null };
  /** `vendor_billing_catalog.vendor_deep_search`, formatted; null when unread. */
  deepSearch: string | null;
}) {
  const dash = (v: string | null) => v ?? '—';
  const feePrice = figures
    ? `${figures.head} on the first ${figures.band} of a booking, ${figures.tail} after. ${FIRST_BOOKING_FREE}`
    : feeEnabled
      ? `The rate is shown in full on the booking before you agree. ${FIRST_BOOKING_FREE}`
      : 'There is no booking fee while it is switched off.';
  return (
    <div className={s.earn} id="earn">
      <div className={s.earnHead} data-rv="">
        <p className={s.kicker}>How Setnayan earns</p>
        <h3>We charge for what we add. Never for what you already had.</h3>
      </div>

      <ul className={s.promises}>
        {EARN_PROMISES.map((p) => (
          <li key={p.title}>
            <b>{p.title}</b>
            <span>{p.body}</span>
          </li>
        ))}
      </ul>

      <div className={s.earnCols}>
        <div>
          <h4>
            Free <span className={`${s.pill} ${s.free}`}>Free</span>
          </h4>
          {EARN_FREE_ROWS.map((r) => (
            <div className={s.earnRow} key={r.title}>
              <b>{r.title}</b>
              <span>{r.body}</span>
            </div>
          ))}
        </div>
        <div>
          <h4>What costs, and why it’s fair</h4>
          <div className={s.earnRow}>
            <b>The booking fee</b>
            <span>Only on a couple Setnayan found you. We were the reason they met you.</span>
            <p className={s.earnPrice}>{feePrice}</p>
            <div className={s.receipt}>
              <span className={s.srcTag}>★ {SAMPLE_FOUND_LINE}</span>
              <small>The reason sits on every fee: where the couple found you, and when.</small>
            </div>
          </div>
          <div className={s.earnRow}>
            <b>Plus · Pro · Ultra</b>
            <span>For more tools and more room. Free stays free.</span>
            <p className={s.earnPrice}>
              Plus {dash(plans.plus)} · Pro {dash(plans.pro)} · Ultra {dash(plans.ultra)}, every 4 weeks.
            </p>
          </div>
          <div className={s.earnRow}>
            <b>Deep Search</b>
            <span>One deep search for couples who fit you, when you want it.</span>
            <p className={s.earnPrice}>{dash(deepSearch)} a search, on Plus, Pro and Ultra.</p>
          </div>
          <div className={s.earnRow}>
            <b>Gifts for your couples</b>
            <span>Papic 150, Event Plus or Event Pro in your package — only if you choose.</span>
          </div>
        </div>
      </div>

      <div className={s.wedding}>
        <h4>One wedding, five suppliers</h4>
        <p className={s.fine}>Ana &amp; Paolo, Sat 14 Feb 2027. Names are samples.</p>
        <ol>
          {ONE_WEDDING.map((w) => (
            <li key={w.name} className={w.fee ? s.wFee : s.wFree}>
              <div>
                <b>{w.name}</b>
                <small>{w.role}</small>
              </div>
              <p>{w.story}</p>
              <div className={s.wRow}>
                <span className={`${s.pill} ${w.fee ? s.feePill : s.free}`}>{w.fee ? 'Booking fee' : 'Free'}</span>
                <small>{w.why}</small>
              </div>
            </li>
          ))}
        </ol>
        <p className={s.earnRule}>{ONE_WEDDING_RULE}</p>
      </div>

      <div className={s.earnCtas}>
        <a className={s.btn} href="#plans">
          See the plans
        </a>
        <Info label="How a fee is questioned">
          <p>
            Every fee bill has a “Dispute this fee” button. Your first dispute is accepted. After that, our team reviews each one
            and writes back with the reason.
          </p>
        </Info>
      </div>
    </div>
  );
}
