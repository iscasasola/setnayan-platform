import { guestDisplayName, guestInitials, guestRoleLabel, RSVP_ROW_WORDS, SIDE_LABELS } from '@/lib/guests';
import { displayPersonName } from '@/lib/person-name-case';
import { representedByWords } from '@/lib/guest-proxy';
import type { GuestCardData } from './guest-card-data';

/**
 * 🪪 THE GUEST CARD'S HEAD — eyebrow · name · reply, and the face. Pure words and one small drawing, with no form, no
 * action and no database, so BOTH halves of a card's opening can draw it:
 *
 *   · the card itself (`GuestCard` → `InspectorColumn`, and the standalone page's identity row in `guest-card-body.tsx`,
 *     which re-exports these), once the card's own read has arrived; and
 *   · the Guest list, AT THE TAP (guest card opens fast, owner 2026-10-27: the card took ~2 s to open on his iPhone),
 *     from the row it already has on screen — so the sheet shows the person at once and only the body fills in.
 *
 * One source, so the head drawn at the tap and the head the card arrives with say the same thing and the header does
 * not jump. 🔒 `guests/_components/the-card-opens-at-the-tap.test.ts`.
 */
/**
 * The card's identity line and its reply, as words — ONE source for the body
 * (the standalone page) and the sticky header over the panel (owner 2026-10-02:
 * "maybe we can leave this part persistent?"), so they are drawn once each.
 */
export function guestCardEyebrow(
  guest: Pick<GuestCardData['guest'], 'role' | 'side'>,
  opts: { hasSides: boolean; roleNames: GuestCardData['roleNames']; plusOneOf?: GuestCardData['plusOneOf'] },
): string {
  const isCouple = guest.role === 'bride' || guest.role === 'groom';
  // 🤝 A +1 is "+1 of Rose Marie Buanhug", on their guest's side (lib/plus-one-of.ts) — never a plain "Guest".
  const of = isCouple ? null : (opts.plusOneOf ?? null);
  const side = of ? of.side : guest.side;
  return [isCouple ? guestRoleLabel(guest.role, opts.roleNames) : (of?.of ?? 'Guest'), opts.hasSides && !isCouple ? SIDE_LABELS[side] : null]
    .filter(Boolean)
    .join(' · ');
}
/** The card's title: an unnamed +1 seat is named by its guest ("Rose Marie Buanhug’s +1 · TBA"), everyone else by name. */
export function guestCardTitle(
  guest: Parameters<typeof guestDisplayName>[0],
  plusOneOf?: GuestCardData['plusOneOf'],
): string {
  return plusOneOf?.name ?? displayPersonName(guestDisplayName(guest));
}
export function guestCardReply(guest: Pick<GuestCardData['guest'], 'role' | 'rsvp_status'>, proxy?: GuestCardData['proxy']): string {
  if (guest.role === 'bride' || guest.role === 'groom') return '✓ Attending · always';
  // 🧍 A represented role holder's answer is their proxy's — the pair counts once, as them.
  if (proxy?.representedBy) return representedByWords(proxy.representedBy.name);
  return `${guest.rsvp_status === 'attending' ? '✓ ' : ''}${RSVP_ROW_WORDS[guest.rsvp_status]}`;
}


/**
 * 👤 THE GUEST'S FACE — their photo, else their initials. ONE drawing for both places it lives: the sticky header over
 * the panel (`size="head"`, 44 px, left of the name — owner 2026-10-26) and the standalone page's identity row (48 px).
 * Not a button: it opens nothing, here or there.
 */
export function GuestCardAvatar({
  guest,
  photoDisplayUrl,
  size = 'body',
}: {
  guest: Parameters<typeof guestInitials>[0];
  photoDisplayUrl: string | null;
  size?: 'head' | 'body';
}) {
  const box = size === 'head' ? 'h-11 w-11' : 'h-12 w-12';
  return photoDisplayUrl ? (
    <span className={`inline-flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-full bg-sn-accent/10`} data-guest-card-avatar={size}>
      {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL, resolved by the loader */}
      <img src={photoDisplayUrl} alt="" width={48} height={48} className="h-full w-full object-cover" />
    </span>
  ) : (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-sn-accent/10 text-sm font-semibold text-sn-accent`}
      data-guest-card-avatar={size}
    >
      {guestInitials(guest)}
    </span>
  );
}
