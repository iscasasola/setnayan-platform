/**
 * lib/plus-one-of.ts — HOW A +1 IS NAMED WITH THE GUEST WHO BRINGS THEM. One wording for every surface that draws a
 * +1: the Guest List's row and map leaf (`plusOneWordsFrom`, lib/guest-roster-view.ts) and the guest card's title and
 * eyebrow (`loadGuestCard` → `guestCardEyebrow`).
 *
 * Owner 2026-10-19, on the List: *"the plus 1 did not connect properly to the guest"*; 2026-10-20, the card opened on
 * Rose Marie Buanhug's seat still read "+1 · TBA" under "GUEST · BRIDE'S SIDE".
 *   · an unnamed seat is named by its guest: "Rose Marie Buanhug’s +1 · TBA" — the seat's own label
 *     (`seatPlaceholderLabel`, numbered per guest), never the stored "+1 · TBA";
 *   · a named +1 keeps their own name, followed by "+1 of Rose Marie Buanhug";
 *   · the side shown is their guest's (a +1's side follows the guest who brings them).
 * Pure — no database, no React.
 */
import { guestDisplayName, type GuestRow } from '@/lib/guests';
import { isPlaceholderSeat, seatPlaceholderLabel } from '@/lib/extra-seats';

export type PlusOneOf = {
  hostId: string;
  /** The guest who brings them, as the List names a guest ("Rose Marie Buanhug"). */
  hostName: string;
  /** "Rose Marie Buanhug’s +1 · TBA" — an unnamed seat's name. Null when the +1 has a name of their own. */
  name: string | null;
  /** "+1 of Rose Marie Buanhug" — said beside a named +1, and as the card's eyebrow for every +1. */
  of: string;
  /** Their guest's side. */
  side: GuestRow['side'];
};

type Host = Pick<GuestRow, 'guest_id' | 'first_name' | 'last_name' | 'display_name' | 'side'>;

/** `seatIndex` is 0-based among the guest's seats ("+2" is the second). */
export function plusOneOfWords(
  g: Pick<GuestRow, 'guest_id' | 'first_name' | 'plus_one_name_confirmed_at'>,
  host: Host,
  seatIndex: number,
): PlusOneOf {
  const hostName = guestDisplayName(host);
  // The name's stamp when the read carried it — the same answer as the List's "no name yet" (`plusOneHasNoName`).
  const unnamed = isPlaceholderSeat({ guest_id: g.guest_id, first_name: g.first_name, confirmed_at: g.plus_one_name_confirmed_at ?? null });
  return {
    hostId: host.guest_id,
    hostName,
    name: unnamed ? `${hostName}’s ${seatPlaceholderLabel(seatIndex)}` : null,
    of: `+1 of ${hostName}`,
    side: host.side,
  };
}
