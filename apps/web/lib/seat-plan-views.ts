/**
 * 🗂 The 3D room asks the seat plan it is drawn inside (Guests › Seats) to show another view — "Switch to 2D" in the
 * room's ⓘ (owner 2026-10-30, the room is view-only: every edit lives on the 2D plan). The room is a separate tree
 * (streamed by the 3D page), so it cannot call the plan's `onSelectView`; it sends this window event and the plan,
 * which owns the switch, listens. `detail` is the view: '2d' | 'list'.
 */
export const SEAT_PLAN_SHOW_VIEW_EVENT = 'setnayan:seat-plan-show-view';
