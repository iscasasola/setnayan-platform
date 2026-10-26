/**
 * guest-card-flash.ts — WHAT THE GUEST CARD SAYS AFTER ITS CAREFUL ACTIONS (⋯ › New QR · Unlink · Give the spot · the
 * couple row's sign-in link). Moved out of `[guestId]/page.tsx` (2026-10-26) so the in-place door
 * (`app/_actions/save-in-place.ts`) says the SAME words on the card when the press stays on the screen. Pure.
 */
type Search = { swapped?: string; unlinked?: string; new_qr?: string; invite?: string };

export function guestCardFlash(search: Search, email?: string | null): { ok: boolean; msg: string } | null {
  if (search.swapped === '1') {
    return { ok: true, msg: 'Done — the spot is theirs, with a new key. The old link and QR no longer work. Share their invitation from the guest list.' };
  }
  if (search.unlinked === '1') {
    return { ok: true, msg: 'Unlinked — that account no longer holds this invitation, and it has a new key. The old link and QR no longer work.' };
  }
  if (search.new_qr === '1') return { ok: true, msg: 'Done — a new QR and link. The old ones no longer work. Send them the new one.' };
  // The couple row's sign-in link (the one email left — see the card's Access).
  if (search.invite === 'sent') return { ok: true, msg: email ? `Sign-in link sent to ${email}.` : 'Sign-in link sent.' };
  if (search.invite && search.invite !== 'sent') return { ok: false, msg: 'We couldn’t send the link just now — please try again.' };
  return null;
}
