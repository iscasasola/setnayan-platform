import { formatEventDate } from '@/lib/events';

/**
 * PahinaKeepsake — the punched reply-card ticket (design 2026-07-25 §11).
 *
 * This is the RSVPed state's payoff: once a guest has replied "attending", the
 * ask stops shouting at them and the same stock they replied on comes back as a
 * stamped keepsake. Per the owner's five-timeline model this is the page a guest
 * re-opens weekly until the wedding, so it is built to be screenshot-worthy.
 *
 * NOT a new lifecycle phase (build plan §4): "RSVPed" is a per-GUEST fork inside
 * the existing `rsvp` phase, keyed on this guest's own reply. Anonymous visitors
 * have no guest identity, so the fork is structurally unreachable for them — the
 * RA 10173 zero-guest-bytes fence is untouched.
 *
 * After the wedding the same object returns as the memento (`variant="attended"`),
 * which is the platform's most shareable artifact: proof of presence.
 */

/**
 * Display-only stub number for the ticket corner. A short stable digest of the
 * guest id — per build plan §4 the Nº is flavor and must NEVER expose a raw
 * internal id, so the id itself is never rendered, only this 3-digit fold.
 */
export function stubNo(guestId: string): string {
  let h = 0;
  for (let i = 0; i < guestId.length; i++) {
    h = (h * 31 + guestId.charCodeAt(i)) % 997;
  }
  return String(h).padStart(3, '0');
}

const ROMAN: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

function toRoman(n: number): string {
  let out = '';
  let left = n;
  for (const [value, numeral] of ROMAN) {
    while (left >= value) {
      out += numeral;
      left -= value;
    }
  }
  return out;
}

/**
 * The date as a roman stub — "XII · XII · MMXXVI". Returns null for an absent or
 * unparseable date (null-date-safe: plenty of events have no date set yet).
 */
function romanDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return [d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()]
    .map((part) => toRoman(part))
    .join(' · ');
}

export function PahinaKeepsake({
  variant,
  displayName,
  guestId,
  tableLabel,
  venueName,
  eventDate,
}: {
  /** 'accepted' = the RSVPed reward state; 'attended' = the after-event memento. */
  variant: 'accepted' | 'attended';
  displayName: string;
  guestId: string;
  tableLabel: string | null;
  venueName: string | null;
  eventDate: string | null;
}) {
  const stamp = variant === 'accepted' ? 'Joyfully accepted' : 'You were there';
  const roman = romanDate(eventDate);
  const dateLabel = formatEventDate(eventDate);

  return (
    <section className="pahina-deckle space-y-5 sm:p-8" aria-label="Your keepsake">
      <header className="flex items-start justify-between gap-4">
        <p className="pahina-eyebrow">
          <span aria-hidden>✦</span>
          <span>{variant === 'accepted' ? 'Your reply' : 'Your memento'}</span>
        </p>
        <p className="shrink-0 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
          Nº {stubNo(guestId)}
        </p>
      </header>

      {/* The rubber stamp — sits at a slight angle over the stock, the way a
          received-and-marked card actually reads. Decorative rotation only; the
          text is real content and stays selectable. */}
      <p className="-rotate-2 border-2 border-gild px-4 py-2 text-center font-mono text-[0.72rem] uppercase tracking-[0.3em] text-gild">
        {stamp}
      </p>

      <p className="font-pahina text-[1.6rem] font-light italic leading-snug text-ink">
        {displayName}
        {variant === 'accepted' ? ' — one seat, reserved.' : '.'}
      </p>

      <hr className="pahina-perforation" />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-[0.66rem] uppercase tracking-[0.18em]">
        {tableLabel ? (
          <div>
            <dt className="text-ink/45">Table</dt>
            <dd className="mt-1 text-ink/80">{tableLabel}</dd>
          </div>
        ) : null}
        {venueName ? (
          <div>
            <dt className="text-ink/45">Where</dt>
            <dd className="mt-1 text-ink/80">{venueName}</dd>
          </div>
        ) : null}
        {dateLabel ? (
          <div>
            <dt className="text-ink/45">When</dt>
            <dd className="mt-1 text-ink/80">{dateLabel}</dd>
          </div>
        ) : null}
        {roman ? (
          <div>
            <dt className="text-ink/45">Stub</dt>
            <dd className="mt-1 text-gild">{roman}</dd>
          </div>
        ) : null}
      </dl>

      <p className="text-sm leading-relaxed text-ink/60">
        {variant === 'accepted'
          ? 'Keep this page — it’s your invitation, your seat, and your QR on the day.'
          : 'Thank you for being there. Your photos from the day are on this page.'}
      </p>
    </section>
  );
}
