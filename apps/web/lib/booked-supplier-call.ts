/**
 * 📞 CALL A BOOKED SUPPLIER — the two hand-offs OUT of the app, and the only place they are spelled.
 *
 * Owner 2026-11-04 (DECISION_LOG "SIX OWNER ANSWERS", item 2): *"We can call and video call suppliers as well on the
 * chat"*; and 2026-11-05: *"yes for the video and voice call, have a button for it."* So a chat with a supplier the
 * couple has BOOKED carries two buttons in its head:
 *
 *   · Call               → `tel:` the shop's business phone (the phone's own dialler);
 *   · Video call · Viber → Viber's chat with that number, where the video button is one tap. Viber is a MOBILE app, so
 *                          a landline gets Call only. Whether Viber is installed cannot be known from a web page, so the
 *                          label names the app — a couple without it knows before they press.
 *
 * 📵 THESE ARE NOT IN-APP CALLS. The WebRTC call in the chat stays removed (owner 2026-10-28, "remove both voice and
 * video call"; `lib/the-chat-has-no-calls.test.ts`). These open the phone's own apps, nothing more.
 *
 * 🚪 WHY THIS IS NOT A DOOR OUT (`lib/no-door-out-of-the-app.test.ts`, BOOKED_SUPPLIER_CALL_BILL): that rule exists so
 * a couple who FOUND a shop here cannot book it around the platform — no booking fee, no record, no protection. A
 * BOOKED supplier has been booked HERE: the fee, the record and the lock already exist. So the exemption is keyed on
 * the booking and on nothing else — `BookedSupplierCall` is built only by `readBookedSupplierCall`
 * (`lib/booked-supplier-call.server.ts`), which reads the phone only AFTER it has found a confirmed booking.
 *
 * Pure: no I/O, safe on both sides.
 */
import { parsePhPhone } from './ph-phone';

export type SupplierCallLinks = {
  /** `tel:+63…` — the dialler. */
  tel: string;
  /** Viber's chat with this number — null for a landline (Viber is a mobile app). */
  viber: string | null;
  /** The number as a person reads it (`+63 917 123 4567`), for the button's title. */
  display: string;
};

/**
 * What the chat head may offer for this thread.
 *   booked          — a confirmed booking AND a usable business phone: the two buttons.
 *   booked_no_phone — booked, but the shop has no usable phone on file: nothing (never a button that dials nothing).
 *   not_booked      — the booking read answered, and there is no confirmed booking: the one-line hint.
 *   unknown         — a read was refused: NOTHING. Neither a button nor "once you've booked" — we do not know.
 */
export type BookedSupplierCall =
  | { kind: 'booked'; links: SupplierCallLinks }
  | { kind: 'booked_no_phone' }
  | { kind: 'not_booked' }
  | { kind: 'unknown' };

/** The links for one business phone, or null when it is not a usable Philippine number. */
export function supplierCallLinks(rawPhone: string | null | undefined): SupplierCallLinks | null {
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

/** The ONE line an unbooked thread shows where the buttons would be. */
export const CALLS_OPEN_ONCE_BOOKED = 'Calls open once you’ve booked.';
