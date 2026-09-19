/**
 * The words on the couple's "A gift from the Setnayan team" notification —
 * emitted by issueCompGrant (app/admin/users/actions.ts) when an admin gifts
 * a couple a service. Pure, so the sentence is tested rather than grepped.
 *
 * It says only what the grant row says: how much was gifted, for which event,
 * and until when. It does not name services it cannot see (the row holds SKU
 * codes, not titles) and does not promise more than "it is already on" — which
 * is true because eventHasCompGrant reads the row at every feature gate.
 *
 * `expiryIso` is an INSTANT (the action already converted the admin's PH-local
 * input), so it is rendered in Asia/Manila — the zone it was typed in.
 */
export function compGiftNoticeBody(args: {
  allServices: boolean;
  serviceCount: number;
  eventDisplayName: string | null;
  expiryIso: string | null;
}): string {
  const what = args.allServices
    ? 'every Setnayan service'
    : args.serviceCount === 1
      ? 'a Setnayan service'
      : `${args.serviceCount} Setnayan services`;
  const where = args.eventDisplayName ? ` for ${args.eventDisplayName}` : '';
  const until = args.expiryIso
    ? `, until ${new Date(args.expiryIso).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : '';
  return `We've given you ${what}${where}${until}. It's already switched on — there's nothing to pay.`;
}
