'use client';

import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { noteDatesFromShop } from './check-a-date-link';
import { BadgeCheck } from 'lucide-react';
import { SeatMonths } from '../dates/_components/seat-months';
import { checkDateStateOf } from '@/lib/check-a-date';
import { SIDE_CARD_WORDS } from '@/lib/shop-side-card';
import { shopQuoteSummary, subscribeShopQuote } from './shop-quote-store';
import { NotYetVerifiedTag } from './not-yet-verified-tag';
import { NOT_YET_VERIFIED_SIDE_LIST } from '@/lib/not-yet-verified-markings';

/**
 * 🗂 THE VERIFIED SHOP'S SIDE CARD — its booking half, on a computer (v16 S4; prototype `<aside><div class="bk">`;
 * DECISION_LOG 2026-11-15: "desktop uses the side card", and its mini month is the Check a date v7 seat plan).
 * It sits at the top of the shop card, which moves to the RIGHT of the page on a tablet and up, above the card's own
 * Inquire · Add to your event · Share row. In the drawing's order:
 *   · "from ₱…" + the shop's best offer (`sideCardPrice`) · "Setnayan Verified · ★ · reviews" (`sideCardVerifiedLine`);
 *   · Check a date: THIS month as the shipped seat plan (`SeatMonths`, the same answer `checkDateStateOf` draws on the
 *     full calendar). A green day opens Check a date on that day; "See every month →" opens it on the first;
 *   · the quote (v16 S3's), once the couple has added a service — on a phone the S3 tray carries it instead.
 * It is ONE Check a date per screen: on a computer this month is the way in, so the action row's Check a date shows on a
 * phone only. On an unverified shop (v16 S6, the drawing's `nvbk`): the tag + its three lines in place of the Verified
 * line, and no month — Check a date is verified only.
 */
export type SideCardMonth = { kind: 'unreadable' } | { kind: 'ok'; today: string; to: string; notBookable: string[] };

export function ShopSideCard({
  price,
  verifiedLine,
  month,
  datesHref,
}: {
  price: { from: string; offer: string | null } | null;
  /** null = not verified yet (v16 S6 `nvbk`): the tag + the drawing's three lines instead. */
  verifiedLine: string | null;
  /** null = the shop takes no date checks (Check a date is verified and bookable only). */
  month: SideCardMonth | null;
  /** Check a date over the shop (`?dates=1`), keeping where the visit came from. */
  datesHref: string;
}) {
  const router = useRouter();
  const quote = useSyncExternalStore(subscribeShopQuote, shopQuoteSummary, () => null);
  const closed = month?.kind === 'ok' ? new Set(month.notBookable) : null;
  return (
    <div className="hidden w-full space-y-3 border-b border-ink/10 pb-5 md:block" data-shop-side-card="">
      {price ? (
        <p className="flex items-baseline justify-between gap-3" data-side-card-price="">
          <b className="text-2xl font-extrabold text-ink">{price.from}</b>
          {price.offer ? <small className="text-right text-xs text-ink/60">{price.offer}</small> : null}
        </p>
      ) : null}
      {verifiedLine !== null ? (
        <p className="flex items-center gap-1.5 text-sm text-ink/75" data-side-card-verified="">
          <BadgeCheck aria-hidden className="h-[18px] w-[18px] shrink-0 text-sn-accent" strokeWidth={2} />
          {verifiedLine}
        </p>
      ) : (
        <div data-side-card-not-verified="">
          <NotYetVerifiedTag />
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/75">
            {NOT_YET_VERIFIED_SIDE_LIST.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {month ? (
        <div data-side-card-month="">
          <h4 className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-[0.1em] text-ink/55">{SIDE_CARD_WORDS.heading}</h4>
          {month.kind === 'ok' && closed ? (
            <>
              <SeatMonths
                today={month.today}
                to={month.to}
                value={null}
                startAt={month.today}
                stateOf={(d) => checkDateStateOf(d, { notBookable: closed, today: month.today, to: month.to })}
                onPick={(d) => {
                  noteDatesFromShop();
                  router.push(`${datesHref}&d=${d}`, { scroll: false });
                }}
              />
              <p className="mt-2 text-sm text-ink/70">{SIDE_CARD_WORDS.hint}</p>
            </>
          ) : (
            <p className="text-sm text-ink/70" role="status" data-side-card-month-unread="">
              {SIDE_CARD_WORDS.unreadable}
            </p>
          )}
          {/* v16 S5: Check a date rises OVER the shop in place (`?dates`, `CheckADateSheet`) — a client step with the
              page kept where it was, never a reload — and × steps back onto the shop. */}
          <Link
            href={datesHref}
            scroll={false}
            onClick={noteDatesFromShop}
            className="inline-flex min-h-11 items-center text-sm font-bold text-sn-accent"
            data-side-card-every-month=""
          >
            {SIDE_CARD_WORDS.everyMonth}
          </Link>
        </div>
      ) : null}
      {quote ? (
        <div className="rounded-2xl bg-ink/5 p-3 text-sm" aria-live="polite" data-side-card-quote="">
          <b className="text-base font-semibold text-ink">{quote.head}</b>
          <div className="mt-0.5 text-ink/70">{quote.names}</div>
        </div>
      ) : null}
    </div>
  );
}
