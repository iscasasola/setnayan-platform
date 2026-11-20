import Link from 'next/link';
import { matchedOnText, type FreeBookingMatch } from '@/lib/business-free-booking-match';
import { formatCount } from '@/lib/format-number';

/**
 * 🛡 "Same business as another shop" + a link to each (owner 2026-11-06, DECISION_LOG "ONE FREE FIRST BOOKING PER
 * BUSINESS, NOT PER ACCOUNT" — the match itself). Read-only, like the shared-number note.
 *
 * ⚖ 20 Nov: there is no free first booking any more (DECISION_LOG "BILLING MUST FOLLOW THE RETIRED COPY"). What the
 * match still decides is whether this is a NEW business, which the new-business waivers need. The waivers today:
 * the supplier's own import (a new account) · the first import onto a new event · every 100,000th fee · a badge
 * ticket · a NEW shop opened from a couple's Suppliers › Find invite (specs 1abf35bd). A place frozen free under the
 * old rule stays free, so "used the old free booking" is said in the past tense only.
 *
 * `null` (the read failed) is said out loud — silence would read as "a new business" — and it says what the money
 * path does meanwhile: it bills.
 */
export function FreeBookingMatchNote({ match }: { match: FreeBookingMatch | null }) {
  if (!match || match.shops === null) {
    return (
      <p data-free-booking-match="unchecked" className="text-xs text-ink/60">
        Couldn&rsquo;t check this shop against other shops — reload to try again. Until the check runs, nothing is
        waived for being a new business: a booking is billed.
      </p>
    );
  }
  const { shops, withheld } = match;
  const heldLine =
    withheld && withheld.checkUnreadable > 0 ? (
      <span data-free-booking-withheld="unreadable" className="mt-1 block text-[11px]">
        {withheld.checkUnreadable === 1 ? 'One booking was' : `${formatCount(withheld.checkUnreadable)} bookings were`} billed
        because the same-business check could not run — check whether it should have been waived for a new business.
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
        Same business as {shops.length === 1 ? 'another shop' : `${formatCount(shops.length)} other shops`} — not a new
        business
      </p>
      <ul className="mt-1 space-y-0.5">
        {shops.map((s) => (
          <li key={s.vendorProfileId}>
            <Link href={`/admin/vendors/${s.vendorProfileId}`} className="underline underline-offset-2">
              {s.businessName} &rarr;
            </Link>{' '}
            <span className="opacity-80">· same {matchedOnText(s.matchedOn)}</span>
            {s.tookFree ? <span className="font-semibold"> · used the old free booking (before 20 Nov)</span> : null}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] opacity-80">
        Matching another shop means this is not a new business or a new account. Free bookings today: its own import as a
        new account · the first import onto a new event · a new shop opened from a couple&rsquo;s Find invite · every
        100,000th fee · a badge ticket.
        {withheld?.selfTookFree
          ? ' This shop used the old free booking before 20 Nov.'
          : holder
            ? ' Another shop of this business used the old free booking before 20 Nov.'
            : null}
        {withheld && withheld.alreadyUsed > 0
          ? ` ${withheld.alreadyUsed === 1 ? 'One booking has' : `${formatCount(withheld.alreadyUsed)} bookings have`} already been billed for this.`
          : null}
      </p>
      {heldLine}
    </div>
  );
}
