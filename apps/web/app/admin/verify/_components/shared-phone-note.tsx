import Link from 'next/link';
import type { OtherShop } from '@/lib/shared-contact-phone';

/**
 * "This number is also on another shop" + a link to each (owner 2026-11-06).
 * Information for the reviewer, never a block. `null` = the check could not run —
 * said out loud, because silence here would read as "the number is unique".
 */
export function SharedPhoneNote({ shops }: { shops: OtherShop[] | null }) {
  if (shops === null) {
    return (
      <p data-shared-phone="unchecked" className="text-ink/60">
        Couldn&rsquo;t check this number against other shops — reload to try again.
      </p>
    );
  }
  if (shops.length === 0) return null;
  return (
    <p
      data-shared-phone="flag"
      className="rounded-md border border-warn-300/60 bg-warn-50 px-2 py-1 text-warn-900"
    >
      <span className="font-semibold">
        This number is also on {shops.length === 1 ? 'another shop' : `${shops.length} other shops`}
      </span>
      {' · '}
      {shops.map((o, i) => (
        <span key={o.vendorProfileId}>
          {i > 0 ? ', ' : null}
          <Link href={`/admin/vendors/${o.vendorProfileId}`} className="underline underline-offset-2">
            {o.businessName} &rarr;
          </Link>
        </span>
      ))}
      <span className="block text-[11px] opacity-80">
        Sign-up was not refused — the owner&rsquo;s papers decide.
      </span>
    </p>
  );
}
