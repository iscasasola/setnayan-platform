/**
 * lib/event-menu-gates.ts — WHAT THE EVENT TYPE HANDS THE ONE EVENT MENU (the phone's bottom bar, the
 * iPad rail, the ☰ drawer — `buildEventMenuSections` in `lib/customer-menu.ts`).
 *
 * ⚖ EVERY EVENT WEARS THE WEDDING'S BAR (owner 22 Oct 2026, on a just-created Simple event's Home on
 * its day, whose bar read "Home · Hub · More": *"Fix both"* → *"I think this might be an issue on
 * other events as well"*). The bar is Home · Guests · Suppliers · Hub (+ More on the web; the iPhone
 * app has no More, `the-app-bar-has-no-more.test.ts`) for EVERY type, in every phase.
 *
 * 🔴 WHY IT WAS "HOME · HUB · MORE": the layout dropped Guests and Suppliers by key —
 *   · `needsHiddenNavKeys(eventNeeds)` (Level 1, 2026-10-08, matrix §2 "a need that is OFF is absent,
 *     never greyed — the bottom bar, Home rows, Maker stages, Studio tiles"): the "Simple event ·
 *     Papic + one QR" preset switches OFF the guest list AND suppliers, and "Open event · one QR"
 *     switches off the guest list — so a simple_event / date / hangout lost both tabs and a birthday,
 *     graduation, reunion, tournament, concert, wake … lost Guests, by DEFAULT;
 *   · `marketplace_enabled = false` (the Simple Event type, 2026-06-27) dropped Suppliers again.
 * Both now stop at the bar. What the event left off still leaves HOME (its doors, numbers, money and
 * the one "Switch on more" row — `what-the-event-left-off-is-absent.test.ts`), the Maker's stages and
 * the Studio tiles; the bar is the event's frame and is the same frame for everyone.
 *
 * 🔑 Pure and client-safe, so the layout, the lab (`/dev/bar-lab?type=…`) and the guard that sweeps
 * EVERY event type in the migrations (`tests/db/every-event-type-wears-the-one-bar.db.test.ts`) read
 * this one rule. There is deliberately NO `hideKeys` here: a key that hides a tab is the bug.
 */
import { surfaceEnabled, type EventTypeProfile } from './event-type-profile';

export type EventMenuGates = {
  /** The type enables the Event Hub (`website` surface) — gates the Hub row. Every seeded type has it. */
  websiteEnabled: boolean;
  /** The type seats people — gates only which row claims the Seat plan's page, never a tab. */
  seatingEnabled: boolean;
};

export function eventMenuGates(profile: EventTypeProfile): EventMenuGates {
  return {
    websiteEnabled: surfaceEnabled(profile, 'website'),
    seatingEnabled: surfaceEnabled(profile, 'seating'),
  };
}
