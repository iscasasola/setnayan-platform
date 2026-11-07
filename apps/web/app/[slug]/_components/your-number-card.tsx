import { readGuestScanNumbers, type GuestScanNumber } from '@/lib/supplier-scan.server';
import { guestNumberStateWords, scanNumberLabel } from '@/lib/supplier-scan';
import { SIMULATED_GUEST_ID } from '@/lib/simulated-guest-preview';

/**
 * 🎟 "YOUR NUMBER #0042 · Photo booth" — the guest's quiet card on their own Event Hub (approved prototype
 * `supplier_scan_2026-10-03_fable.html`, frame E: "one quiet card under Now — Your number #0042 … No popup, no banner.
 * The same card is in Me"). The SAME number the supplier's scanner showed, so a print or a giveaway matches a person
 * without anyone saying a name (DECISION_LOG 2026-09-25 "EVERY SUPPLIER SCAN GETS A SHARED SEQUENCE NUMBER").
 *
 * Draws nothing when the guest has no number, when the read failed (a guest is never told "no number" about a read
 * that did not happen), in the Maker's canvas, and for the sample guest. The guest is the one the page already
 * resolved from their pass — this never takes an id from the browser.
 */
export async function YourNumberCard({
  eventId,
  guestId,
  preview = false,
  className = '',
}: {
  eventId: string;
  guestId: string;
  /** The Maker's canvas (`isEditorCanvas`). */
  preview?: boolean;
  className?: string;
}) {
  if (preview || guestId === SIMULATED_GUEST_ID) return null;
  const numbers = await readGuestScanNumbers(eventId, guestId);
  if (!numbers || numbers.length === 0) return null;
  return <YourNumberCardView numbers={numbers} className={className} />;
}

/** The card as drawn, from numbers already read (the dev lab draws it from fixtures). */
export function YourNumberCardView({ numbers, className = '' }: { numbers: GuestScanNumber[]; className?: string }) {
  return (
    <section aria-label="Your number" className={className} data-your-number="">
      <ul className="space-y-2">
        {numbers.map((n) => (
          <li key={`${n.number}-${n.service}-${n.at}`} className="text-center">
            <span className="block text-[12px] uppercase tracking-[0.16em] text-ink/55">Your number</span>
            <span className="block font-pahina text-3xl font-light tabular-nums text-ink">{scanNumberLabel(n.number)}</span>
            <span className="block text-[13.5px] text-ink/65">{[n.service, n.shop].filter(Boolean).join(' · ')}</span>
            {guestNumberStateWords(n.state) ? (
              <span className={`block text-[13px] ${n.state === 'ready' ? 'font-medium text-ink' : 'text-ink/55'}`} data-your-number-state={n.state}>
                {guestNumberStateWords(n.state)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
