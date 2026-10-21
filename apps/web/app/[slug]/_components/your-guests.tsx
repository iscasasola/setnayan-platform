import Link from 'next/link';
import { AddNameInPlace } from './add-name-in-place';
import { SendTheirInvite } from './send-their-invite';
import type { InviteEventFacts } from '@/lib/guest-invite-message';
import { SavePassCardButton } from '@/app/_components/save-pass-card-button';
import { PASS_CARD_WORDS } from '@/lib/pass-card';
import { displayPersonName } from '@/lib/person-name-case';
import { TicketRow } from './ticket-row';

/**
 * "YOUR GUESTS" — the people this guest is bringing, each a guest row with their
 * own key (owner 2026-09-26: *"so the make a name. and they get a qr for that
 * name."*). Shown in ONE place — the guest's Me (owner 2026-10-03: "Send their
 * invite" had a second home on the thank-you, which also drew each plus-one as
 * a ticket; that layout went with it).
 *
 *   · a NAMED seat with a ticket → the shipped `TicketRow` (owner 2026-10-21,
 *     guest_page_fixes_2_4 fix 4): their ticket · their name · ONE button,
 *     "Send their invite" (the phone's share sheet, their own link). The ticket
 *     is the "Show": tapped, it opens big in the guest page's one sheet —
 *     scannable at the door for a plus-one with no phone of their own (a child,
 *     an elder) — with "Save <name>'s ticket" inside. (Retired: the row's
 *     "Show <name>'s ticket", a second drawing of the QR the ticket carries.)
 *     A named seat with no ticket yet (not coming, or the bringer not accepted —
 *     `passCardEligibility`) is the name and Send;
 *   · every name is SHOWN cased (`displayPersonName` — "pamela labriaga" reads
 *     "Pamela Labriaga"); the typed name is never rewritten;
 *   · a TBA seat → "Add name". Given `addName` (Me), the four boxes open IN
 *     PLACE under the row (owner 2026-09-29, frame E — no link-outs), and
 *     saving names the seat, whose own link and QR then show here. Without it
 *     (the couple's plus-ones switch is off), the link back to the reply's name
 *     boxes.
 *
 * Draws nothing for a guest bringing nobody.
 */
export function YourGuests({
  guests,
  eventName,
  addNamesHref,
  addName,
  inviteFacts,
  passCards,
}: {
  guests: { guestId: string; name: string | null; inviteUrl: string | null }[];
  eventName: string;
  addNamesHref: string;
  /**
   * Me's in-place naming (frame E): whose key this page holds and which of the
   * four boxes the couple asks. Absent → the TBA row links to `addNamesHref`.
   */
  addName?: { eventId: string; guestId: string; askMeal: boolean; askDietary: boolean };
  /** The event's words for "Send their invite" (lib/guest-invite-message.ts). */
  inviteFacts?: InviteEventFacts;
  /**
   * 🎫 The pass CARDS this bringer may save (owner 2026-09-29) — their own and
   * each named plus-one's who is coming, keyed by guest id.
   */
  passCards?: { own: string; plusOnes: Readonly<Record<string, string>> } | null;
}) {
  if (guests.length === 0) return null;
  const cardHrefs = passCards ? [passCards.own, ...guests.flatMap((g) => (g.name && passCards.plusOnes[g.guestId] ? [passCards.plusOnes[g.guestId]!] : []))] : [];
  return (
    <section aria-labelledby="your-guests" className="space-y-2">
      {/* `!text-xl`: inside the Hub's scene card (`.sn-hub-cards h2` is a card's own title), this stays the section's. */}
      <h2 id="your-guests" className="font-serif !text-xl text-ink">
        Your guests
      </h2>
      {cardHrefs.length > 1 ? <SavePassCardButton hrefs={cardHrefs} label={PASS_CARD_WORDS.saveAll} /> : null}
      <ul className={`divide-y divide-ink/10${cardHrefs.length > 1 ? ' border-t border-ink/10' : ''}`}>
        {guests.map((g, i) => {
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
          const shown = g.name ? displayPersonName(g.name) : null;
          const ticket = g.name ? passCards?.plusOnes[g.guestId] : undefined;
          const send = shown && g.inviteUrl ? (
            <SendTheirInvite name={shown} url={g.inviteUrl} eventName={eventName} facts={inviteFacts} wide={Boolean(ticket)} />
          ) : null;
          if (shown && ticket) {
            const first = shown.split(' ')[0]!;
            return (
              <li key={g.guestId} className="py-3" data-plus-one-ticket="">
                <TicketRow
                  href={ticket}
                  name={shown}
                  sub={PASS_CARD_WORDS.tapToShow}
                  show={{ eyebrow: PASS_CARD_WORDS.ofName(first), saveLabel: PASS_CARD_WORDS.saveOf(first) }}
                  also={send}
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
                    {shown ?? `+${i + 1} · TBA`}
                  </span>
                </span>
                {send ?? (
                  <Link
                    href={addNamesHref}
                    className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-gild px-4 text-sm font-medium text-ink"
                  >
                    Add their name
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
