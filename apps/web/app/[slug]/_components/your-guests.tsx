import Link from 'next/link';
import { AddNameInPlace } from './add-name-in-place';
import { SendTheirInvite } from './send-their-invite';
import type { InviteEventFacts } from '@/lib/guest-invite-message';
import { SavePassCardButton } from '@/app/_components/save-pass-card-button';
import { PASS_CARD_WORDS } from '@/lib/pass-card';

/**
 * "YOUR GUESTS" — the people this guest is bringing, each a guest row with their
 * own key (owner 2026-09-26: *"so the make a name. and they get a qr for that
 * name."*). Shown on the thank-you and in Me.
 *
 *   · a NAMED seat → one button, "Send their invite" (the phone's share sheet,
 *     their own link) — and, in Me, "Show <name>'s pass" for a plus-one with no
 *     phone of their own (a child, an elder), scannable at the door;
 *   · a TBA seat → "Add name". Given `addName` (Me), the four boxes open IN
 *     PLACE under the row (owner 2026-09-29, frame E — no link-outs), and
 *     saving names the seat, whose own link and QR then show here. Without it
 *     (the reply's thank-you), the link back to the reply's name boxes, which
 *     are one screen behind.
 *
 * Draws nothing for a guest bringing nobody.
 */
export function YourGuests({
  guests,
  eventName,
  addNamesHref,
  sendLabel,
  passes,
  addName,
  inviteFacts,
  passCards,
}: {
  guests: { guestId: string; name: string | null; inviteUrl: string | null }[];
  eventName: string;
  addNamesHref: string;
  sendLabel?: string;
  /**
   * Me's in-place naming (frame E): whose key this page holds and which of the
   * four boxes the couple asks. Absent → the TBA row links to `addNamesHref`.
   */
  addName?: { eventId: string; guestId: string; askMeal: boolean; askDietary: boolean };
  /**
   * Each named plus-one's pass, pre-rendered (`renderInvitationQrSvg`), keyed by
   * their guest id. Given only on the bringer's own Me tab, whose page already
   * holds these keys by the owner's ruling ("the guest who brings plus-ones
   * hands each one their own key").
   */
  passes?: Readonly<Record<string, string>>;
  /** The event's words for "Send their invite" (lib/guest-invite-message.ts). */
  inviteFacts?: InviteEventFacts;
  /**
   * 🎫 The pass CARDS this bringer may save (owner 2026-09-29) — their own and
   * each named plus-one's who is coming, keyed by guest id. Given only on the
   * bringer's own Me tab; absent everywhere else (the thank-you).
   */
  passCards?: { own: string; plusOnes: Readonly<Record<string, string>> } | null;
}) {
  if (guests.length === 0) return null;
  const cardHrefs = passCards ? [passCards.own, ...guests.flatMap((g) => (g.name && passCards.plusOnes[g.guestId] ? [passCards.plusOnes[g.guestId]!] : []))] : [];
  return (
    <section aria-labelledby="your-guests" className="space-y-2">
      <h2 id="your-guests" className="font-serif text-xl text-ink">
        Your guests
      </h2>
      <p className="text-xs text-ink/60">
        Each name gets their own pass and QR — sent from your phone, with their own link.
      </p>
      {cardHrefs.length > 1 ? <SavePassCardButton hrefs={cardHrefs} label={PASS_CARD_WORDS.saveAll} /> : null}
      <ul className="divide-y divide-ink/10">
        {guests.map((g, i) => {
          const pass = g.name ? passes?.[g.guestId] : undefined;
          if (!g.name && addName) {
            return (
              <li key={g.guestId} className="py-3">
                <AddNameInPlace
                  eventId={addName.eventId}
                  guestId={addName.guestId}
                  seatId={g.guestId}
                  seatLabel={`+${i + 1}`}
                  askMeal={addName.askMeal}
                  askDietary={addName.askDietary}
                />
              </li>
            );
          }
          return (
            <li key={g.guestId} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-serif text-lg text-ink">
                    {/* Numbered by SEAT (owner 2026-09-29): "+2 · TBA", never "Guest 3". */}
                    {g.name ?? `+${i + 1} · TBA`}
                  </span>
                </span>
                {g.name && g.inviteUrl ? (
                  <SendTheirInvite name={g.name} url={g.inviteUrl} eventName={eventName} facts={inviteFacts} label={sendLabel} />
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
                    className="qr-slot mx-auto mt-2 w-48 bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
                    role="img"
                    aria-label={`${g.name}’s pass`}
                    dangerouslySetInnerHTML={{ __html: pass }}
                  />
                </details>
              ) : null}
              {g.name && passCards?.plusOnes[g.guestId] ? (
                <SavePassCardButton
                  hrefs={[passCards.plusOnes[g.guestId]!]}
                  label={PASS_CARD_WORDS.saveOf(g.name.split(/\s+/)[0]!)}
                  variant="link"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
