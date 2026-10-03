/**
 * Where access is SET: Event Details › People with access (owner 2026-10-03,
 * the ONE home). Its own tiny module so the guest list's client bundle — which
 * links here from every Access cell — carries one string, not the row builder.
 */

/** The anchor of the section on Event Details — what every "Change ›" link opens. */
export const PEOPLE_WITH_ACCESS_ANCHOR = 'people-with-access';

export function peopleWithAccessHref(eventId: string): string {
  return `/dashboard/${eventId}/details#${PEOPLE_WITH_ACCESS_ANCHOR}`;
}
