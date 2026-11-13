/**
 * ✨ "WHAT THEIR OWN WEBSITE CAN'T DO" — one soft panel in the verified shop's About (owner 2026-11-13, DECISION_LOG
 * "THE SHOP PAGE HAS ONE MAIN BUTTON — INQUIRE": the four equal "Do it from here" doors are replaced by one door and
 * three quiet lines; prototype `public_pages_three_2026-11-13`, `.cando`).
 *
 *   Check a date — the ONE door here (the shipped `CheckADateLink`, to `/v/[slug]/dates`);
 *   the chat · Add to your event · Book a package — supporting copy, NOT buttons. Each says what that step does, and the
 *   real control lives where it belongs: Inquire + Add in the calling card, Book on each package card next to its price.
 *   The chat line never says "Inquire" (owner 13 Nov, "Yes, only one": one Inquire label on the page, the button).
 *
 * Verified shops only — the caller gates it on the same `bookable` gate as every booking door, so an unverified shop
 * never shows a Check a date (owner 13 Nov, "date check only for verified").
 */
import { MessageCircle, Package, Plus } from 'lucide-react';
import { CheckADateLink } from './check-a-date-link';

export function ShopCanDoPanel({ checkHref, hasPackages }: { checkHref: string; hasPackages: boolean }) {
  return (
    <div
      data-shop-can-do=""
      className="grid gap-3.5 rounded-3xl bg-ink/[0.04] p-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center lg:gap-6 lg:px-6 lg:py-[22px]"
    >
      <div className="grid justify-items-start gap-2.5">
        <p className="text-[1.02rem] font-semibold leading-tight text-ink">What their own website can&rsquo;t do</p>
        <p className="text-[0.88rem] text-ink/75">Check a date against their real calendar, not a contact form.</p>
        <CheckADateLink href={checkHref} className="button-secondary inline-flex items-center gap-2" />
      </div>
      <ul className="grid gap-2 border-t border-ink/10 pt-3 text-[0.86rem] text-ink/75 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <li className="flex items-start gap-2.5">
          <MessageCircle aria-hidden className="mt-[3px] h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          <span>
            <b className="font-semibold text-ink">Ask them anything</b> — the chat lands in your Setnayan inbox and stays
            with your event.
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <Plus aria-hidden className="mt-[3px] h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          <span>
            <b className="font-semibold text-ink">Add to your event</b> puts them on your supplier list, budget and
            schedule.
          </span>
        </li>
        {hasPackages ? (
          <li className="flex items-start gap-2.5">
            <Package aria-hidden className="mt-[3px] h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            <span>
              <b className="font-semibold text-ink">Book a package</b> below at its price, held for your date.
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
