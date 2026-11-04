// ============================================================================
// lib/booked-handoff.ts — THE ONE PLACE A SHOP ↔ COUPLE PHONE OR VIBER LINK IS MADE.
//
// Owner 2026-11-04 (DECISION_LOG "SIX OWNER ANSWERS (4 Nov afternoon)"), verbatim:
// *"Viber and phone call booked suppliers"* · *"We can call and video call
// suppliers as well on the chat"*. ⇒ a Call (tel:) and a Viber call
// (viber://chat?number=) between a couple and a shop exist ONLY once that shop
// holds a confirmed booking on that event. Before it, the 2026-09-10 rule
// stands untouched: *"not to let them communicate outside the app"* — the
// booking fee is charged on sourced clients, and a phone number handed over
// before the booking is the door off the platform.
//
// 🔑 THE BOOKING IS AN ARGUMENT, NOT A HOPE. Every function here takes the
// booking check's answer (`booked`) and returns null without it — so no caller
// can make a link for an unbooked shop by forgetting a condition. The answer
// comes from `shopIsBookedOnEvent` (lib/shop-booking.server.ts), i.e.
// `event_vendors.status` in `CONFIRMED_VENDOR_STATUSES` — the same set the
// database's `current_vendor_booked_event_ids()` uses for "a booked vendor".
//
// This file is the ONE entry of `BOOKED_HANDOFF_BILL` in
// `lib/no-door-out-of-the-app.test.ts` (count 2), and that guard executes the
// refusal: an unbooked call returns null.
//
// These are hand-offs OUT of the app — never the retired in-app call
// (ThreadCallRoom stays unused; `the-chat-has-no-calls.test.ts`). Used ONLY by
// the booked chat head's Call · Video call — meetings are Jitsi only (owner
// 2026-11-04 "VIRTUAL = JITSI ONLY") and dial nothing.
// ============================================================================

import { phPhoneToE164 } from './ph-dial';

/** tel:+63… — only for a booked shop ↔ couple, only for a PH number. */
export function bookedTelHref(booked: boolean, phone: string | null | undefined): string | null {
  if (booked !== true || !phone) return null;
  const e164 = phPhoneToE164(phone);
  return e164 ? `tel:${e164}` : null;
}

/** viber://chat?number=%2B63… — only for a booked shop ↔ couple, only for a PH mobile. */
export function bookedViberHref(booked: boolean, phone: string | null | undefined): string | null {
  if (booked !== true || !phone) return null;
  const e164 = phPhoneToE164(phone);
  if (!e164 || !/^\+639\d{9}$/.test(e164)) return null;
  return `viber://chat?number=${encodeURIComponent(e164)}`;
}
