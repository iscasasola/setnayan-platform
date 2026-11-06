/**
 * guest-seat-view.ts — 🪑 HOW A GUEST SEES THEIR SEAT (owner 2026-11-01, DECISION_LOG "SEATS: WHAT EACH VIEW DOES",
 * item 3): *"A Seats ⚙ setting, next to "Show guests their seats early", picks how guests see their seat: 2D map · 3D
 * walk · Both (default Both, 2D first, today's behaviour)."* Stored on `event_floor_plan.guest_seat_view`
 * (migration 20271302002155_guest_seat_view.sql).
 *
 * ONE answer for what a seat view draws (`seatViewParts`) — the guest's own seat page (`/[slug]/find-seat`) and the
 * host's preview of it on the guest card both ask it, so the preview is the guest's page, never a second guess.
 * 🔒 lib/a-guest-sees-their-seat-the-hosts-way.test.ts
 */

export type GuestSeatView = '2d' | '3d' | 'both';

export const GUEST_SEAT_VIEWS: readonly GuestSeatView[] = ['both', '2d', '3d'];

/** The ⚙'s words for each choice. */
export const GUEST_SEAT_VIEW_LABEL: Record<GuestSeatView, string> = {
  both: 'Both — 2D map first',
  '2d': '2D map',
  '3d': '3D walk',
};

/** The pill's word — short, so the row's name keeps its line at 390 (the full words are the dropdown's). */
export const GUEST_SEAT_VIEW_SHORT: Record<GuestSeatView, string> = { both: 'Both', '2d': '2D map', '3d': '3D walk' };

/** Anything unknown (an unread row, an old value) is today's behaviour: Both. */
export function parseGuestSeatView(v: unknown): GuestSeatView {
  return v === '2d' || v === '3d' || v === 'both' ? v : 'both';
}

/**
 * What a guest's seat view draws: the 2D map or not, and the 3D walk as nothing, a quiet link beside the map, or the
 * one big way in. The walk exists only where the event has a 3D room (`has3d`) — a "3D walk" setting on an event with
 * no room still shows the map (never a blank seat page).
 */
export function seatViewParts(view: GuestSeatView, has3d: boolean): { map: boolean; walk: 'none' | 'link' | 'main' } {
  if (view === '3d' && has3d) return { map: false, walk: 'main' };
  if (view === '2d' || !has3d) return { map: true, walk: 'none' };
  return { map: true, walk: 'link' };
}
