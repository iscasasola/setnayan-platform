/**
 * 📞 CALL ONCE BOOKED — the two hand-offs OUT of the app, and the only place they are spelled.
 *
 * Owner 2026-11-04 (DECISION_LOG "SIX OWNER ANSWERS", item 2): *"We can call and video call suppliers as well on the
 * chat"*; 2026-11-05: *"yes for the video and voice call, have a button for it"* — and, for the other side,
 * *"supplier side. only for booked"*. So a chat between a couple and a supplier who is BOOKED on that event carries two
 * buttons in its head, on BOTH sides:
 *
 *   · Call               → `tel:` the other side's phone (the phone's own dialler);
 *   · Video call · Viber → Viber's chat with that number, where the video button is one tap. Viber is a MOBILE app, so
 *                          a landline gets Call only. Whether Viber is installed cannot be known from a web page, so the
 *                          label names the app — a person without it knows before they press.
 *
 * Whose phone: the couple sees the SHOP's business phone (`vendor_profiles.contact_phone`); the supplier sees the
 * phone on the account of the couple member who opened the conversation (`users.phone`).
 *
 * 📵 THESE ARE NOT IN-APP CALLS. The WebRTC call in the chat stays removed (owner 2026-10-28, "remove both voice and
 * video call"; `lib/the-chat-has-no-calls.test.ts`). These open the phone's own apps, nothing more.
 *
 * 🚪 WHY THIS IS NOT A DOOR OUT (`lib/no-door-out-of-the-app.test.ts`, BOOKED_CALL_BILL): that rule exists so a couple
 * who FOUND a shop here cannot book it around the platform — no booking fee, no record, no protection. A BOOKED
 * supplier has been booked HERE: the fee, the record and the lock already exist. So the exemption is keyed on the
 * booking and on nothing else — a `BookedCall` is built only in `lib/booked-call.server.ts`, which reads a phone only
 * AFTER it has found a confirmed booking.
 *
 * Pure: no I/O, safe on both sides.
 */
import { parsePhPhone } from './ph-phone';

export type CallLinks = {
  /** `tel:+63…` — the dialler. */
  tel: string;
  /** Viber's chat with this number — null for a landline (Viber is a mobile app). */
  viber: string | null;
  /** The number as a person reads it (`+63 917 123 4567`), for the button's title. */
  display: string;
};

/**
 * What the chat head may offer for this thread.
 *   booked          — a confirmed booking AND a usable phone on the other side: the two buttons.
 *   booked_no_phone — booked, but no usable phone on file: nothing (never a button that dials nothing).
 *   not_booked      — the booking read answered, and there is no confirmed booking: the one-line hint.
 *   unknown         — a read was refused: NOTHING. Neither a button nor "once booked" — we do not know.
 */
export type BookedCall =
  | { kind: 'booked'; links: CallLinks }
  | { kind: 'booked_no_phone' }
  | { kind: 'not_booked' }
  | { kind: 'unknown' };

/** The links for one phone, or null when it is not a usable Philippine number. */
export function phoneCallLinks(rawPhone: string | null | undefined): CallLinks | null {
  const parsed = parsePhPhone(rawPhone ?? '');
  if (!parsed.ok) return null;
  const digits = parsed.e164.replace(/^\+/, '');
  return {
    tel: `tel:+${digits}`,
    // `%2B` is the `+`, encoded — the form Viber reads on both iOS and Android.
    viber: parsed.kind === 'mobile' ? `viber://chat?number=%2B${digits}` : null,
    display: parsed.display,
  };
}

/** The ONE line an unbooked thread shows where the buttons would be — in each side's own voice. */
export const CALLS_OPEN_ONCE_BOOKED = {
  couple: 'Calls open once you’ve booked.',
  vendor: 'Calls open once they’ve booked you.',
} as const;
