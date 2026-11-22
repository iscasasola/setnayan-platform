import Link from 'next/link';
import { matchedOnText, type FreeBookingMatch } from '@/lib/business-free-booking-match';
import { formatCount } from '@/lib/format-number';

/**
 * 🛡 "Same business as another shop" + a link to each (owner 2026-11-06, DECISION_LOG "ONE FREE FIRST BOOKING PER
 * BUSINESS, NOT PER ACCOUNT"). Read-only, like the shared-number note.
 *
 * ⚖ 20 Nov: there is NO free first booking any more (`booking_fee_free_booking_limit()` = 0), so nothing here may say
 * one is still waiting to be taken. A shop that took one before 20 Nov keeps it — that is said in the past tense, and
 * only when it happened. `null` (the read failed) is said out loud — silence would read as "a new business".
 */
export function FreeBookingMatchNote({ match }: { match: FreeBookingMatch | null }) {
  if (!match || match.shops === null) {
    return (
      <p data-free-booking-match="unchecked" className="text-xs text-ink/60">
        Couldn&rsquo;t check this shop against other shops — reload to try again.
      </p>
    );
  }
  const { shops, withheld } = match;
  const heldLine =
    withheld && withheld.checkUnreadable > 0 ? (
      <span data-free-booking-withheld="unreadable" className="mt-1 block text-[11px]">
        {withheld.checkUnreadable === 1 ? 'One booking was' : `${formatCount(withheld.checkUnreadable)} bookings were`} billed
        because the same-business check could not run — check whether it should have been this business&rsquo;s free
        first booking.
      </span>
    ) : null;
  if (shops.length === 0) {
    return heldLine ? (
      <p data-free-booking-match="none" className="rounded-md border border-warn-300/60 bg-warn-50 px-3 py-2 text-xs text-warn-900">
        No other shop matches this business.
        {heldLine}
      </p>
    ) : null;
  }
  const holder = shops.find((s) => s.tookFree) ?? null;
  return (
    <div
      data-free-booking-match="flag"
      className="rounded-md border border-warn-300/60 bg-warn-50 px-3 py-2 text-xs text-warn-900"
    >
      <p className="font-semibold">
        Same business as {shops.length === 1 ? 'another shop' : `${formatCount(shops.length)} other shops`}
      </p>
      <ul className="mt-1 space-y-0.5">
        {shops.map((s) => (
          <li key={s.vendorProfileId}>
            <Link href={`/admin/vendors/${s.vendorProfileId}`} className="underline underline-offset-2">
              {s.businessName} &rarr;
            </Link>{' '}
            <span className="opacity-80">· same {matchedOnText(s.matchedOn)}</span>
            {s.tookFree ? <span className="font-semibold"> · had a free first booking before 20 Nov</span> : null}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] opacity-80">
        {withheld?.selfTookFree
          ? 'This shop had a free first booking before 20 Nov; that one stays free. Every other booking carries the fee.'
          : holder
            ? 'One of these shops had a free first booking before 20 Nov; that one stays free. Every other booking carries the fee.'
            : 'There is no free first booking since 20 Nov — every booking of these shops carries the fee unless the free rule applies.'}
        {withheld && withheld.alreadyUsed > 0
          ? ` ${withheld.alreadyUsed === 1 ? 'One booking has' : `${formatCount(withheld.alreadyUsed)} bookings have`} already been billed for this.`
          : null}
      </p>
      {heldLine}
    </div>
  );
}
