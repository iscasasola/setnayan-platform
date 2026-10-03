/**
 * invitation-link.ts — the TAIL of a guest's personal invitation link.
 *
 * `buildInvitationUrl` (lib/qr.ts) is the one speller of a guest's link: the
 * event's public address plus `?invite=<their token>`. It ends in THIS
 * function, which lives on its own only because lib/qr.ts imports the QR
 * renderer — a client component that needs nothing but the link (the Guest
 * list's rows, the Invite sheet's "Copy invitation link") must not carry that
 * library to the phone.
 *
 * So a page that already holds the event's address (`fetchInvitationBase`,
 * which is `buildInvitationUrl`'s head) finishes the link HERE, never by hand:
 * the link a host copies, the QR a guest scans and the NFC tag they tap are
 * then one string by construction. `lib/one-speller-for-a-guest-link.test.ts`.
 */
export function invitationLinkOn(base: string, qrToken: string): string {
  return `${base}?invite=${qrToken}`;
}
