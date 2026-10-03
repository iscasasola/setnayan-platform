/**
 * lib/nikah-essentials.ts — which of the Nikah's four TRACKABLE essentials are
 * in place (pure, no I/O). Consent is the fifth and is not a data field.
 *
 * One definition, two readers: the Nikah essentials card (the checklist on
 * `/dashboard/[eventId]/nikah`) and the Home's one-line status on its "Your
 * services" row (`nikahStatus`, lib/home-first-screen.ts). Two copies of this
 * count is how the row says "3 of 4" over a card that ticks two.
 */
export type NikahGuestLike = { role: string; extra_roles?: readonly string[] | null };

export function guestsWithRole(guests: ReadonlyArray<NikahGuestLike>, role: string): number {
  return guests.filter((g) => g.role === role || (g.extra_roles ?? []).includes(role)).length;
}

export function nikahTrackedDone(input: {
  guests: ReadonlyArray<NikahGuestLike>;
  mahrDescription: string | null;
  /** An officiant is booked, or a mosque venue resolves the imam. */
  imamBooked: boolean;
}): number {
  const { guests, mahrDescription, imamBooked } = input;
  return [
    guestsWithRole(guests, 'wali') >= 1,
    guestsWithRole(guests, 'witness') >= 2,
    !!mahrDescription && mahrDescription.trim().length > 0,
    guestsWithRole(guests, 'imam') >= 1 || imamBooked,
  ].filter(Boolean).length;
}
