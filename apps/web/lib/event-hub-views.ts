/**
 * The supplier's Event Hub — its three views (supplier dashboard v13, prototype `renderEventHub`: the ▾ lists On the day
 * · Scanner · Announce). Each is its own address, `?view=`, on the live page. Pure.
 */
export const EVENT_HUB_VIEWS = ['day', 'scanner', 'announce'] as const;
export type EventHubView = (typeof EVENT_HUB_VIEWS)[number];

export const EVENT_HUB_VIEW_LABEL: Readonly<Record<EventHubView, string>> = {
  day: 'The Day',
  scanner: 'Scanner',
  announce: 'Announce',
};

export const eventHubViewOf = (raw: unknown): EventHubView =>
  (EVENT_HUB_VIEWS as readonly string[]).includes(String(raw)) ? (raw as EventHubView) : 'day';

export function eventHubViewHref(eventId: string, view: EventHubView): string {
  const base = `/vendor-dashboard/on-the-day/live/${eventId}`;
  return view === 'day' ? base : `${base}?view=${view}`;
}
