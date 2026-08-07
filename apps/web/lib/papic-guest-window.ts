/**
 * apps/web/lib/papic-guest-window.ts
 *
 * WHEN may a GUEST's phone shoot? (owner 2026-08-07)
 *
 * Owner, verbatim: *"The guests can have the option to use the app on the exact
 * event or when the host allows it."* — so:
 *
 *   host switch OFF (default) → the EVENT DAY only, the whole Manila day
 *   host switch ON            → the event's whole Papic capture window
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────
 * Guests had NO time gate anywhere. `eventPapicGuestActive()` asks whether the
 * event holds the guest-camera pass; nothing asked when. A guest who redeemed
 * their invite months early could shoot into the couple's gallery on any random
 * Tuesday.
 *
 * 🔑 ONE RESOLVER, TWO CALLERS — DELIBERATELY. The guest page uses this to decide
 * whether to render a camera, and the upload route uses the SAME function to
 * decide whether to accept bytes. Two copies of a time comparison is precisely
 * how the seat window broke: `Date.parse('2026-09-19')` is midnight UTC — 08:00
 * in Manila — so a one-day window collapsed to a single instant and every shot
 * was refused. The page is a courtesy; the route is the enforcement.
 *
 * PURE + unit-testable. No DB, no I/O. Asia/Manila has no DST, so the fixed
 * +08:00 offset used by the shared window helpers is exact.
 */
import { PAPIC_TZ_OFFSET, manilaDate } from '@/lib/papic-window';

export type GuestCaptureState =
  /** Shoot away. */
  | 'open'
  /** Too early: the host has not opened guest cameras yet. */
  | 'not_open_yet'
  /** The event day (or the window) has passed. */
  | 'closed';

export type GuestCaptureGate = {
  state: GuestCaptureState;
  /** The Manila calendar date guests may shoot, when the switch is OFF. */
  eventDay: string | null;
};

/**
 * Resolve whether a guest may capture right now.
 *
 * @param earlyAllowed  events.papic_guest_capture_early — the host's button.
 * @param eventDate     events.event_date (a DATE column: 'YYYY-MM-DD').
 * @param windowStart   the event's Papic window start ISO, when one is stored.
 * @param windowEnd     the event's Papic window end ISO, when one is stored.
 *
 * ⚠ FAILS OPEN ON MISSING DATA, deliberately. An event with no date cannot have
 * an "event day", and refusing there would brick the camera for a guest standing
 * at a real party over a value the couple never filled in. The pass check
 * (`eventPapicGuestActive`) is the gate that decides IF at all; this one only
 * decides WHEN, and it should never be the thing that silently breaks a live
 * event. Same posture as the seat window's null bounds.
 */
export function guestCaptureGate(opts: {
  earlyAllowed: boolean | null | undefined;
  eventDate: string | null | undefined;
  windowStart?: string | null;
  windowEnd?: string | null;
  nowMs?: number;
}): GuestCaptureGate {
  const nowMs = opts.nowMs ?? Date.now();
  const eventDay = manilaDate(opts.eventDate ?? null);

  if (opts.earlyAllowed === true) {
    // The host opened the doors: guests get the same span as the seat cameras.
    // Bounds are already full ISO instants with an offset, so a plain parse is
    // correct here — unlike the bare DATE columns on paparazzi_seats.
    const startMs = opts.windowStart ? Date.parse(opts.windowStart) : NaN;
    const endMs = opts.windowEnd ? Date.parse(opts.windowEnd) : NaN;
    if (Number.isFinite(startMs) && nowMs < startMs) {
      return { state: 'not_open_yet', eventDay };
    }
    if (Number.isFinite(endMs) && nowMs > endMs) return { state: 'closed', eventDay };
    return { state: 'open', eventDay };
  }

  // Switch OFF: the event day, whole, in Manila.
  if (!eventDay) return { state: 'open', eventDay: null };

  const dayStartMs = Date.parse(`${eventDay}T00:00:00${PAPIC_TZ_OFFSET}`);
  const dayEndMs = Date.parse(`${eventDay}T23:59:59.999${PAPIC_TZ_OFFSET}`);
  if (!Number.isFinite(dayStartMs) || !Number.isFinite(dayEndMs)) {
    return { state: 'open', eventDay };
  }
  if (nowMs < dayStartMs) return { state: 'not_open_yet', eventDay };
  if (nowMs > dayEndMs) return { state: 'closed', eventDay };
  return { state: 'open', eventDay };
}

/** The columns every caller of {@link guestCaptureGate} must select. */
export const GUEST_CAPTURE_GATE_COLUMNS =
  'event_date, papic_guest_capture_early, papic_window_start, papic_window_end' as const;
