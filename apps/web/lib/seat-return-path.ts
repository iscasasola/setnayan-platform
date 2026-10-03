/**
 * WHERE A HOST-SEAT ACTION LANDS — the screen it was pressed on (the Hosts
 * fold, owner 2026-09-30).
 *
 * `/hosts` is redirect-only now. The forms that post to `hosts/actions.ts`
 * live on the hired planner's supplier workspace (hidden `vendor_id`) and,
 * next, on a limited helper's guest card (hidden `guest_id`, build F2). Each
 * action redirects back there with its one-word flash.
 *
 * 🔑 A HIDDEN FIELD NEVER CHOOSES THE ADDRESS. Only a well-formed id is
 * accepted, and it only ever fills a path INSIDE this event; anything else
 * falls back to the guest list. Pure, so `seat-return-path.test.ts` runs it.
 *
 * People with access (Event Details) posts `return_to=details` and lands back
 * on its own section.
 *
 * The workspace lands on its Details tab (where the card sits) and scrolls to
 * the card, so the "saved" line and the planner's share link are on screen.
 */
const ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function seatReturnPath(
  form: { get(name: string): unknown },
  eventId: string,
  flash: Record<string, string>,
): string {
  const q = new URLSearchParams(flash);
  // Event Details › People with access — the one home for setting access
  // (owner 2026-10-03). Its forms carry `return_to=details`.
  if (form.get('return_to') === 'details') {
    const qs = q.toString();
    return `/dashboard/${eventId}/details${qs ? `?${qs}` : ''}#people-with-access`;
  }
  const vendorId = form.get('vendor_id');
  if (typeof vendorId === 'string' && ID_SHAPE.test(vendorId)) {
    q.set('tab', 'details');
    return `/dashboard/${eventId}/vendors/${vendorId}/workspace?${q.toString()}#promote-coordinator`;
  }
  const guestId = form.get('guest_id');
  const qs = q.toString();
  if (typeof guestId === 'string' && ID_SHAPE.test(guestId)) {
    return `/dashboard/${eventId}/guests/${guestId}${qs ? `?${qs}` : ''}`;
  }
  return `/dashboard/${eventId}/guests${qs ? `?${qs}` : ''}`;
}

/** The same place without its query or fragment — what to revalidate. */
export function seatReturnScreen(form: { get(name: string): unknown }, eventId: string): string {
  const path = seatReturnPath(form, eventId, {});
  const cut = path.search(/[?#]/);
  return cut === -1 ? path : path.slice(0, cut);
}
