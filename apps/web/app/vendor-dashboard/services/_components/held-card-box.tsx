import Link from 'next/link';
import { InfoTip } from '@/app/_components/info-tip';
import type { CardReason } from '@/lib/service-card-checks';
import { heldBoxHeading, supplierReasonLines } from '@/lib/service-card-check-copy';

/**
 * 🃏 THE GOLD BOX — "Saved · waiting for a quick check" (service card checks, owner 2026-10-26; approved prototype
 * frame 1 · Delta 1 of 3). It REPLACES the sage after-save box when the automatic check held the card; on a pass the
 * sage box shows exactly as before.
 *
 * Same element as the sage box (`rounded-md border px-4 py-3 text-sm`, `role="status"`), in the gold wash the maker
 * already uses for "Not included" (`--m-orange-4` / `--m-orange-deep`). The reasons are the flag row's, handed in by
 * the manager — never read from the address.
 *
 * `reasons === null` = the flag could not be read: the box still says the card is saved and waiting, and says it
 * could not show why — it never draws an empty list that would read as "nothing to fix".
 */
export function HeldCardBox({
  serviceId,
  reasons,
  serviceLabel,
  afterReject,
  adminNote,
}: {
  serviceId: string;
  reasons: CardReason[] | null;
  serviceLabel: string;
  afterReject: boolean;
  /** "Ask to fix" — the admin's own words, which the supplier reads on the card. */
  adminNote: string | null;
}) {
  const lines = reasons ? supplierReasonLines(reasons, { serviceLabel }) : [];
  const { headline, intro } = reasons
    ? heldBoxHeading({ reasons, afterReject })
    : { headline: 'Saved · waiting for a quick check', intro: 'We couldn’t load the reasons just now — open the card and save it again in a moment.' };
  return (
    <div
      role="status"
      data-held-card-box=""
      className="space-y-1.5 rounded-md border px-4 py-3 text-sm"
      style={{ borderColor: 'var(--m-orange-4)', background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
    >
      <p className="font-semibold">{headline}</p>
      <InfoTip label={intro} labelAs="p" align="start" ariaLabel="More about the check">
        <span className="block">
          Every new card gets the same automatic look: its photos, its price against what this service usually costs,
          its wording, and whether it is filed under the right service.
        </span>
        <span className="mt-2 block">
          A card that passes is live at once. One that doesn’t is saved and kept out of Explore until a person at
          Setnayan has looked, or until you save a version that passes.
        </span>
        <span className="mt-2 block">Your other cards and your bookings are not affected.</span>
      </InfoTip>
      {adminNote || lines.length > 0 ? (
        <ul className="!mt-3">
          {adminNote ? (
            <li className="flex gap-3 border-t py-3" style={{ borderColor: 'color-mix(in srgb, var(--m-orange-deep) 18%, transparent)' }}>
              <span aria-hidden className="w-6 flex-none text-center">✎</span>
              <div>
                <div className="font-semibold">A note from Setnayan</div>
                <div className="mt-0.5 whitespace-pre-line">{adminNote}</div>
              </div>
            </li>
          ) : null}
          {lines.map((l) => (
            <li
              key={l.title}
              className="flex gap-3 border-t py-3"
              style={{ borderColor: 'color-mix(in srgb, var(--m-orange-deep) 18%, transparent)' }}
            >
              <span aria-hidden className="w-6 flex-none text-center">{l.icon}</span>
              <div>
                <div className="font-semibold">{l.title}</div>
                <div className="mt-0.5">{l.line}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="pt-1">
        <Link
          href={`/vendor-dashboard/services/${serviceId}`}
          className="sn-press inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
          style={{ borderColor: 'var(--m-orange-deep)', color: 'var(--m-orange-deep)' }}
          data-held-card-edit=""
        >
          Edit and resubmit
        </Link>
      </div>
    </div>
  );
}
