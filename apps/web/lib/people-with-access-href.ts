/**
 * Where access is SET: People with access (owner 2026-10-03, the ONE home). Its own tiny module so the guest list's
 * client bundle — which links here from every Access cell — carries one string, not the row builder.
 *
 * ⚙ SINCE 2026-10-30 IT IS INSIDE HOME'S ⚙ EVENT SETTINGS (owner, verbatim: *"no. that shoud be inside home settings"*
 * → *"move them all in the event settings"*). The same `PeopleWithAccess` section is the Event Settings sheet's last
 * section; every "Change ›" link opens Home with that sheet open and landed on it (`?settings=1&row=access`).
 */

/** The section's id — inside the sheet (and on Event Details while that page still draws it). */
export const PEOPLE_WITH_ACCESS_ANCHOR = 'people-with-access';

/** The Event Settings sheet's rows a link may land on (`?settings=1&row=<row>`). */
export const EVENT_SETTINGS_ROWS = ['names', 'date', 'venues', 'parents', 'event', 'plan', 'get-in', 'access', 'put-away'] as const;
export type EventSettingsRow = (typeof EVENT_SETTINGS_ROWS)[number];

export function isEventSettingsRow(v: unknown): v is EventSettingsRow {
  return typeof v === 'string' && (EVENT_SETTINGS_ROWS as readonly string[]).includes(v);
}

/** Home with its ⚙ Event Settings sheet open — landed on `row` when one is named. */
export function eventSettingsHref(eventId: string, row?: EventSettingsRow, extra?: Record<string, string>): string {
  const q = new URLSearchParams({ settings: '1', ...(row ? { row } : {}), ...(extra ?? {}) });
  return `/dashboard/${eventId}?${q.toString()}`;
}

export function peopleWithAccessHref(eventId: string): string {
  return eventSettingsHref(eventId, 'access');
}
