/**
 * The shop's name on a supplier card — and the way into its record page.
 *
 * Built 2026-10-01, `/admin/vendors/<id>` is the ONE page per supplier (who runs
 * it, its plan, team, verification, what it has been paid). The supplier list
 * cards — claimed and unclaimed — never linked to it: the page existed and the
 * list an admin starts from had no door (admin audit 2026-10-02, Area E). The
 * name is the link, so the whole title row is a 44px-tall tap target on a
 * phone, and both card kinds render THIS component so they cannot diverge.
 */
import Link from 'next/link';

export function VendorCardTitle({
  vendorProfileId,
  name,
}: {
  vendorProfileId: string;
  name: string;
}) {
  return (
    <Link
      href={`/admin/vendors/${vendorProfileId}`}
      className="block truncate text-sm font-semibold text-ink hover:text-mulberry hover:underline"
    >
      {name || 'Unnamed'}
    </Link>
  );
}
