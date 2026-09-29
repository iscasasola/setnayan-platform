import Link from 'next/link';
import { SendTheirInvite } from './send-their-invite';

/**
 * "YOUR GUESTS" — the people this guest is bringing, each a guest row with their
 * own key (owner 2026-09-26: *"so the make a name. and they get a qr for that
 * name."*). Shown on the thank-you and in Me.
 *
 *   · a NAMED seat → one button, "Send their invite" (the phone's share sheet,
 *     their own link) — and, in Me, "Show <name>'s pass" for a plus-one with no
 *     phone of their own (a child, an elder), scannable at the door;
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
  passes,
}: {
  guests: { guestId: string; name: string | null; inviteUrl: string | null }[];
  eventName: string;
  addNamesHref: string;
  sendLabel?: string;
  /**
   * Each named plus-one's pass, pre-rendered (`renderInvitationQrSvg`), keyed by
   * their guest id. Given only on the bringer's own Me tab, whose page already
   * holds these keys by the owner's ruling ("the guest who brings plus-ones
   * hands each one their own key").
   */
  passes?: Readonly<Record<string, string>>;
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
        {guests.map((g, i) => {
          const pass = g.name ? passes?.[g.guestId] : undefined;
          return (
            <li key={g.guestId} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-serif text-lg text-ink">
                    {g.name ?? `Guest ${i + 2}`}
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
              </div>
              {g.name && pass ? (
                <details className="mt-1" data-plus-one-pass>
                  <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-sm font-medium text-ink underline underline-offset-4">
                    Show {g.name.split(/\s+/)[0]}’s pass
                  </summary>
                  <div
                    className="mx-auto mt-2 w-48 bg-white p-2"
                    role="img"
                    aria-label={`${g.name}’s pass`}
                    dangerouslySetInnerHTML={{ __html: pass }}
                  />
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
