/**
 * VendorGrow* — the sections of /for-suppliers, ported from the owner-approved 4 Nov 2026 prototype
 * (`prototypes/for_suppliers_2026-11-04.html`, Setnayan-specs): Verified only → the twelve problems → what your
 * package can include → plans (every tool, climbing) → close. The hero is `vendor-grow-hero.tsx`.
 *
 * Styles: `vendor-grow.module.css` (globals.css tokens; radii through --m-r-*). No peso figure, no allowance and no
 * fee rate is typed here: prices are `getVendorPrices()`, allowances are `TIER_CAPS` (via supplier-page-words.ts),
 * the fee is the live schedule. Server components; the only client islands are in `for-vendors-motion.tsx`.
 */
import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { bookingFeeBandsLine, type BookingFeeSchedule } from '@/lib/booking-fee';
import { BookingFeeLine } from '@/app/_components/booking-fee-line';
import { FIRST_BOOKING_FREE } from '@/lib/booking-fee-lock';
import { formatCount } from '@/lib/format-number';
import { TIER_LABEL } from '@/lib/vendor-tier-caps';
import { ProblemsList } from './for-vendors-motion';
import {
  MARKETING_PHOTOS,
  OPEN_SHOP_HREF,
  capFirst,
  firstRungWith,
  fromPlan,
  ownAddressFrom,
  freePlanLine,
  giftProducts,
  packageTools,
  planLine,
  planTools,
  verifiedPlanLine,
  reachLine,
  seatsLine,
  widerFrom,
} from './supplier-page-words';
import s from './vendor-grow.module.css';

/**
 * Every section below that quotes the booking fee takes the LIVE schedule the
 * page read (`getLiveBookingFeeSchedule`), never the code default (audit
 * 2026-10-12, item 5). NULL = could not read it: the fee is named, no rate.
 */
type FeeProp = { fee: BookingFeeSchedule | null };

/*
 * ── 0 · THE THESIS STRIP WAS HERE (₱0 · 0% commission · first booking free) ──
 * Retired 2026-11-04 by the For Suppliers prototype port: the hero's truths line
 * now says "Free to join · Full dashboard free · … · Booking fee only on the
 * couples Setnayan brings ⓘ", and the plan lines say the fee in full — a strip
 * repeating both right under the hero was the third telling.
 */

/*
 * ── THE OLDER SECTIONS WERE HERE (one home · Setnayan AI · fair by design · get discovered · analytics · trust ·
 *    merit only · reach · the tools · get paid, and their primitives and styles). Owner 2026-11-05 (DECISION_LOG
 *    "FOR SUPPLIERS … (P)"): DROPPED — "the 4 Nov prototype is the page". The twelve problems and the plans carry
 *    what they said. Recover any of them with `git show 6963a378:apps/web/app/for-suppliers/_components/vendor-grow-sections.tsx`.
 */

/* ══ THE 4 NOV 2026 PROTOTYPE PORT ═════════════════════════════════════════
 * `prototypes/for_suppliers_2026-11-04.html` (Setnayan-specs), owner-approved
 * with his own photos the same night (DECISION_LOG 2026-11-04, "THE THREE
 * MARKETING PAGES GO TO CLOUD BUILD"). The top of the page, in its order:
 * hero (vendor-grow-hero.tsx) → Verified only → twelve problems → plans in one
 * line each … → close. Styles: vendor-grow.module.css.
 *
 * 🔑 NO ALLOWANCE IS TYPED. Reach, team seats, waitlists and the own web
 * address are read off `TIER_CAPS` — the table the product enforces — so the
 * day the owner's 4 Nov allowances land there, this page says them without an
 * edit. No peso figure is typed either: plan prices are `getVendorPrices()`
 * (the live `vendor_billing_catalog`), the fee is the live schedule.
 * ═════════════════════════════════════════════════════════════════════════ */

/* ── 1b · VERIFIED ONLY — only real businesses can be found ───────────────── */

export function VendorGrowVerifiedOnly() {
  return (
    <section className={`${s.sec} ${s.vo}`} id="verified-only" aria-labelledby="fs-h-vo">
      <div className={s.voIn}>
        <p className={s.kicker}>Verified only</p>
        <h2 id="fs-h-vo" className={s.h2}>
          Couples only find businesses that have shown their papers.
        </h2>
        <p className={s.lede}>
          We take pride in this. Any shop can use Setnayan free — but only a Verified business can be seen.
        </p>
        <div className={s.voTwo}>
          <div className={`${s.voCol} ${s.voOff}`}>
            <p className={s.voTag}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </svg>
              Free · not yet Verified
            </p>
            <h3 className={s.voH3}>Every tool, free. Hidden from search.</h3>
            <ul className={s.voList}>
              <li>Your shop, dashboard, quotes and calendar</li>
              <li>Bring and serve your own clients</li>
              <li>Not shown in search, no public page</li>
            </ul>
          </div>
          <div className={`${s.voCol} ${s.voOn}`}>
            <p className={s.voTag}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1 3 1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1L2.7 15.5l1-3-1-3 2.8-1.6.9-3.1 3.2.3z" />
                <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
              </svg>
              Verified · still free
            </p>
            <h3 className={s.voH3}>Seen by couples planning near you.</h3>
            <ul className={s.voList}>
              <li>Shown in search, within your reach</li>
              <li>Your public Setnayan page, found by search engines</li>
              <li>The Verified badge on your shop and every card</li>
            </ul>
          </div>
        </div>
        <p className={s.voPapers}>
          <b>The papers:</b> DTI or SEC · BIR 2303 · business permit · bank proof. Upload once; our team checks them.
        </p>
        <div className={s.ctas}>
          <Link href="/vendor-dashboard/profile#docs" className={`${s.btn} ${s.btnPrimary}`}>
            Get Verified — free
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── 2 · TWELVE PROBLEMS SUPPLIERS FACE ───────────────────────────────────── */

type Problem = {
  /** The photo's key in public/marketing/2026-11-04 (the prototype's data-p). */
  photo: string;
  alt: string;
  title: string;
  pain: string;
  ans: string;
  /** The plan that has it. */
  plan: string;
};

function problems(fee: BookingFeeSchedule | null): Problem[] {
  const address = ownAddressFrom();
  const waitFrom = firstRungWith((c) => c.waitlistAcceptances > 0);
  const seatsFrom = firstRungWith((c) => c.agentAccounts > 0);
  const wider = widerFrom();
  return [
    {
      photo: 'supplier-01-no-website',
      alt: 'A supplier’s Facebook page on a laptop, buried in search results',
      title: 'Nobody finds you',
      // The prototype said "no website"; the house word is never "website" (public-copy-says-the-house-words).
      pain: 'You have no web page of your own, or a Facebook page that Google never shows.',
      ans: `Once you’re Verified — still free — your Setnayan page is shown to couples and found by search engines.${address ? ` Your own web address ${address}.` : ''}`,
      plan: 'Free',
    },
    {
      photo: 'supplier-02-inquiries',
      alt: 'A phone with dozens of unread Messenger inquiries',
      title: 'Inquiries lost in Messenger',
      pain: 'Inquiries come from everywhere and get lost. Half are not even serious.',
      ans: 'One inbox, with each couple’s event, date and budget attached, and only the inquiries that match what you do.',
      plan: 'Free',
    },
    {
      photo: 'supplier-03-quotes',
      alt: 'A supplier typing a long price list into a chat',
      title: 'Quotes typed into chats',
      pain: 'Prices are typed into chats, changed three times, and nobody knows which version was agreed.',
      ans: 'Build the quote in the chat — package, per guest or per hour, with inclusions, add-ons and the payment schedule — and send one clear quote.',
      plan: 'Free',
    },
    {
      photo: 'supplier-04-double-booked',
      alt: 'A wall calendar with two bookings written on the same Saturday',
      title: 'Double-booked dates',
      pain: 'Two couples, one Saturday. The calendar is in a notebook, a chat and your head.',
      ans: 'One calendar for every booking. A date you block is blocked everywhere, and a waitlist holds the next couple in line.',
      plan: waitFrom ? `Free · waitlist ${fromPlan(waitFrom)}` : 'Free',
    },
    {
      photo: 'supplier-05-payments',
      alt: 'A caterer checking a bank app for a payment that has not arrived',
      title: 'Chasing every payment',
      pain: 'You chase the reservation fee, then the progress payment, then the balance — by chat, every time.',
      ans: 'Reservation, progress and balance on one timeline, with proof. Couples pay straight to your GCash or bank; we never hold your money.',
      plan: 'Free',
    },
    {
      photo: 'supplier-06-forms',
      alt: 'A printed questionnaire filled in by hand, next to a phone',
      title: 'Forms on paper or Google Forms',
      pain: 'The details you need from the couple — names, pronunciations, songs, timings — live in a form they never finish.',
      ans: 'Ask your questions once; they travel with you to every event, and the couple answers on their own schedule page.',
      plan: 'Free',
    },
    {
      photo: 'supplier-07-contracts',
      alt: 'A folder of permits and a signed contract on a desk',
      title: 'Contracts and permits',
      pain: 'Agreements are screenshots. Your DTI, BIR and permit papers are somewhere in a drawer.',
      ans: 'Every contract on record, timestamped per event. Upload your papers once and earn the Verified badge couples look for.',
      plan: 'Free · Verified',
    },
    {
      photo: 'supplier-08-copied-photos',
      alt: 'A supplier finding her own photos on a stranger’s page',
      title: 'Fake reviews, copied photos',
      pain: 'A page with stolen photos and bought stars outranks you.',
      ans: 'Reviews carry a real “booked through Setnayan” mark, you can reply to any of them, new shops are rated fairly, and we watch for your photos on other pages.',
      plan: 'Free',
    },
    {
      photo: 'supplier-09-team-one-login',
      alt: 'A crew of three sharing one phone to check a booking',
      title: 'A team on one login',
      pain: 'Your crew shares your password, or asks you for every detail on the day.',
      ans: `Each person gets their own login, seeing only what their job needs. ${seatsLine()}`,
      plan: seatsFrom ? capFirst(fromPlan(seatsFrom)) : 'Free',
    },
    {
      photo: 'supplier-10-beyond-city',
      alt: 'A photographer looking at a map of the Philippines',
      title: 'Couples beyond your city',
      pain: 'The couples who would book you are planning in another city, and never see you.',
      ans: `You are shown to couples within your reach — ${reachLine()} — matched to the events and rites you serve.`,
      plan: wider ? `Free · wider ${fromPlan(wider)}` : 'Free',
    },
    {
      photo: 'supplier-11-cut-of-everything',
      alt: 'A supplier counting earnings at a desk',
      title: 'A cut of every booking',
      pain: 'Platforms take a cut of every booking — even the clients you brought yourself.',
      ans: `Your own clients are free, always. ${FIRST_BOOKING_FREE} After that, ${fee ? bookingFeeBandsLine(fee) : 'a booking fee'}.`,
      plan: 'Free to join',
    },
    {
      photo: 'supplier-12-time-changes',
      alt: 'A supplier crew arriving at a venue checking the time',
      title: 'Time changes nobody told you about',
      pain: 'The host moves the program and nobody tells you until you arrive.',
      ans: 'You see the event’s schedule live, confirm your times and ask for changes in one place.',
      plan: 'Free',
    },
  ];
}

export function VendorGrowProblems({ fee }: FeeProp) {
  const list = problems(fee);
  const total = list.length;
  return (
    <section className={s.sec} id="solves" aria-labelledby="fs-h-solves">
      <div className={s.wrap}>
        <div className={s.secHead}>
          <p className={s.kicker}>What it solves</p>
          <h2 id="fs-h-solves" className={s.h2}>
            Twelve problems suppliers face. And what Setnayan does instead.
          </h2>
          <p className={s.lede}>
            Every one of these is a real tool in the supplier dashboard today.
          </p>
        </div>
        <ProblemsList>
          {list.map((p, i) => (
            <Fragment key={p.photo}>
              <figure className={s.scene}>
                <Image
                  src={`${MARKETING_PHOTOS}/${p.photo}.webp`}
                  alt={p.alt}
                  width={960}
                  height={720}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className={s.sceneImg}
                />
                <figcaption className={s.cap}>
                  <span className={s.n}>
                    {String(i + 1).padStart(2, '0')} / {formatCount(total)}
                  </span>
                  <span className={s.t}>{p.title}</span>
                  <p className={s.pain}>{p.pain}</p>
                </figcaption>
              </figure>
              <div className={s.turn}>
                <p className={s.with}>With Setnayan</p>
                <p className={s.ans}>{p.ans}</p>
                <div className={s.act}>
                  <span className={s.plan}>{p.plan}</span>
                </div>
              </div>
            </Fragment>
          ))}
        </ProblemsList>
      </div>
    </section>
  );
}

/* ── 2b · YOUR PACKAGE — the couple's free tools, and the gifts you can give ──────────── */

/**
 * Owner, 5 Nov: a dedicated widget on what a supplier can add to their package when they promote — the couple's
 * Setnayan tools (all free for a couple who books them) — and the gifts they can give that couple's event.
 * Both lists are read, never typed here: `packageTools()` is the Features pages' own list, `giftProducts()` the
 * owner's gift list (supplier-page-words.ts). No buttons (owner: "just do not add buttons").
 */
export function VendorGrowPackage() {
  const tools = packageTools();
  const gifts = giftProducts();
  return (
    <section className={s.sec} id="your-package" aria-labelledby="fs-h-package">
      <div className={s.wrap}>
        <div className={s.secHead}>
          <p className={s.kicker}>Your package</p>
          <h2 id="fs-h-package" className={s.h2}>
            Give your couples more than your service.
          </h2>
          <p className={s.lede}>
            Every couple who books you gets Setnayan’s planning tools free — put them in your package. Then add a gift
            to their event.
          </p>
        </div>
        <div className={s.pkg}>
          <div className={s.pkgCol}>
            <h3 className={s.pkgH3}>Free for your couple — {formatCount(tools.length)} tools</h3>
            <ul className={s.pkgTools}>
              {tools.map((t) => (
                <li key={t.slug}>
                  <b>{t.name}</b>
                  <span>{t.line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={`${s.pkgCol} ${s.pkgGifts}`}>
            <h3 className={s.pkgH3}>Gifts you can give their event</h3>
            <ul className={s.pkgGiftList}>
              {gifts.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <p className={s.fine}>
              Buy gifts ahead and add them on a service card or a quote. Your couple receives the full product.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 3 · PLANS, IN ONE LINE EACH ──────────────────────────────────────────── */

/** The live plan prices, as `getVendorPrices()` formats them; `null` = unreadable. */
export type PlanLinePrices = {
  soloMonthly: string | null;
  proMonthly: string | null;
  enterpriseMonthly: string | null;
};

export function VendorGrowPlanLines({
  prices,
  fee,
  extra,
}: {
  prices: PlanLinePrices;
  fee: BookingFeeSchedule | null;
  /**
   * Owner, 5 Nov ("…coordinators also has special tools that suppliers do not have"): ONE plans widget for
   * /for-suppliers and /for-coordinators, with an optional "extra tools for this trade" row. Empty here.
   */
  extra?: { title: string; tools: readonly string[] };
}) {
  // Free and Verified are free by what they are, not by a price row; the three paid plans read the catalog.
  const tools = Object.fromEntries(planTools().map((t) => [t.plan, t.tools]));
  const rows: { key: string; name: string; line: string; price: string | null }[] = [
    { key: 'free', name: TIER_LABEL.free, line: freePlanLine(), price: '₱0' },
    { key: 'verified', name: 'Verified', line: verifiedPlanLine(), price: '₱0' },
    { key: 'solo', name: TIER_LABEL.solo, line: planLine('solo', 'verified'), price: prices.soloMonthly },
    { key: 'pro', name: TIER_LABEL.pro, line: planLine('pro', 'solo'), price: prices.proMonthly },
    { key: 'enterprise', name: TIER_LABEL.enterprise, line: planLine('enterprise', 'pro'), price: prices.enterpriseMonthly },
  ];
  /** How many tools show before "See all". */
  const FIRST = 4;
  return (
    <section className={s.sec} id="plans" aria-labelledby="fs-h-plans">
      <div className={s.wrap}>
        <div className={s.secHead}>
          <p className={s.kicker}>Plans</p>
          <h2 id="fs-h-plans" className={s.h2}>
            Free to join. Paid plans open once you’re Verified.
          </h2>
          <p className={s.lede}>
            Per 4 weeks. The full table, with reach, categories, service cards and team seats, is{' '}
            <a href="#plan-table" className={s.more}>
              further down this page
            </a>
            .
          </p>
        </div>
        <dl className={s.tiers}>
          {rows.map((r) => {
            const list = tools[r.key] ?? [];
            return (
              <div key={r.key}>
                <dt>{r.name}</dt>
                <dd>{r.line}</dd>
                {r.price ? <span className={s.price}>{r.price}</span> : <span className={`${s.price} ${s.priceNone}`}>Price unavailable</span>}
                {list.length > 0 ? (
                  <div className={s.tools}>
                    <ul>
                      {list.slice(0, FIRST).map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    {list.length > FIRST ? (
                      <details className={s.toolsMore}>
                        <summary>See all {formatCount(list.length)} tools</summary>
                        <ul>
                          {list.slice(FIRST).map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </dl>
        {extra && extra.tools.length > 0 ? (
          <div className={s.extraTools}>
            <h3 className={s.pkgH3}>{extra.title}</h3>
            <ul className={s.pkgGiftList}>
              {extra.tools.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className={`${s.fine} ${s.feeFine}`}>
          <BookingFeeLine fee={fee} /> Your own clients are free, always.
        </p>
      </div>
    </section>
  );
}

/* ── CLOSING CTA — "Set na ’yan. Your shop, open today." ─────────────────── */

export function VendorGrowCTA() {
  return (
    <section className={s.close} aria-labelledby="fs-h-close">
      <h2 id="fs-h-close" className={s.closeH2}>
        Set na ’yan.<em>Your shop, open today.</em>
      </h2>
      <div className={s.closeCtas}>
        <Link href={OPEN_SHOP_HREF} className={`${s.btn} ${s.btnPrimary}`}>
          Open a shop — free
        </Link>
      </div>
      <p className={s.fine}>Free to join · Full dashboard free · Your own clients never carry a fee</p>
    </section>
  );
}
