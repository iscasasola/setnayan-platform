import Link from 'next/link';
import { SendTheirInvite } from './send-their-invite';

/**
 * "YOUR GUESTS" — the people this guest is bringing, each a guest row with their
 * own key (owner 2026-09-26: *"so the make a name. and they get a qr for that
 * name."*). Shown on the thank-you and in Me.
 *
 *   · a NAMED seat → one button, "Send their invite" (the phone's share sheet,
 *     their own link);
 *   · a TBA seat → "Add their name", back to the RSVP page's name boxes, where
 *     naming them mints their key.
 *
 * Draws nothing for a guest bringing nobody.
 */
export function YourGuests({
  guests,
  eventName,
  addNamesHref,
  sendLabel,
}: {
  guests: { guestId: string; name: string | null; inviteUrl: string | null }[];
  eventName: string;
  addNamesHref: string;
  sendLabel?: string;
}) {
  if (guests.length === 0) return null;
  return (
    <section aria-labelledby="your-guests" className="space-y-2">
      <h2 id="your-guests" className="font-serif text-xl text-ink">
        Your guests
      </h2>
      <p className="text-xs text-ink/60">
        Each name gets their own pass and QR — sent from your phone, with their own link.
      </p>
      <ul className="divide-y divide-ink/10">
        {guests.map((g, i) => (
          <li key={g.guestId} className="flex items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="block truncate font-serif text-lg text-ink">
                {g.name ?? `Seat ${i + 2}`}
              </span>
              {g.name ? null : <span className="block text-xs text-ink/60">TBA</span>}
            </span>
            {g.name && g.inviteUrl ? (
              <SendTheirInvite name={g.name} url={g.inviteUrl} eventName={eventName} label={sendLabel} />
            ) : (
              <Link
                href={addNamesHref}
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-gild px-4 text-sm font-medium text-ink"
              >
                Add their name
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
