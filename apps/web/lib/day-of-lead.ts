/**
 * apps/web/lib/day-of-lead.ts
 *
 * ON THE DAY, THE INVITATION LEADS WITH THE ROOM — NOT WITH THE PLAN.
 *
 * Fifth slice of the arrival design (owner-approved canvas, board "5 · On the
 * day"). Every other day of the year the invitation's job is to persuade and to
 * collect a reply. On the wedding day itself a guest is standing in a lobby
 * holding a phone, and the three things they need are: what is happening now,
 * the pass that opens the door, and the camera. The planning rows — the
 * salutation, the ask, the vendor pitch — step back behind them.
 *
 * ⚠ THIS MODULE DECIDES ORDER AND NOTHING ELSE. It does not decide what is
 * happening now, it does not decide whether a guest has a camera, and it does
 * not fetch anything. Those answers already exist and are passed in. A second
 * definition of "what is happening now" is the defect this slice was warned
 * about: the programme rail renders it from `pickTriggerNowNext`
 * (lib/run-of-show.ts), which is the same resolver the day-of hub's
 * `WhatsHappeningCard` reads. This file never re-derives it; it only says that
 * on the day that rail comes first.
 *
 * 🕐 THE DAY IS MANILA'S DAY. `manilaToday()` (lib/std-views.ts) formats the
 * current instant in Asia/Manila, and `events.event_date` is a Manila-local
 * DATE. Both sides are compared as plain `YYYY-MM-DD` STRINGS and there is no
 * Date arithmetic anywhere in this file. `new Date('YYYY-MM-DD')` is midnight
 * UTC, which is the PREVIOUS day in Manila, and would rearrange the invitation
 * EIGHT HOURS EARLY — during the evening before the wedding, while guests are
 * still reading it as an invitation. The test states that instant explicitly.
 *
 * 🔑 THE CALENDAR DAY IS NARROWER THAN `dayOfPhase === 'live'`, DELIBERATELY.
 * `getDayOfPhase` runs T−12h .. T+36h (noon the day before → noon the day
 * after) so an evening reception is covered. This lead is the calendar day
 * alone, T .. T+24h, which for a Manila venue sits strictly INSIDE that window.
 * That is the invariant worth having and the test asserts it: the invitation
 * can never rearrange itself on a page that is not already in its day-of
 * state. It also matches `lib/arrival-action.ts`, whose control says "Show your
 * pass" on exactly this boundary — the two must agree, or the button offers a
 * pass on a page that has not brought it forward.
 *
 * ⛔ NOTHING HERE GATES ON THE BOOKING FEE. `lib/event-access-stage.ts` narrows
 * a SUPPLIER's view of an event. Guests are not gated, and a guest at a door is
 * the last person who should meet a paywall.
 *
 * Pure: `today` is passed in, so every branch is executed by a test.
 */

import type { RsvpStatus } from '@/lib/guests';

/** The three things a guest needs in the room, in the order they lead. */
export type DayOfLeadSlot = 'now' | 'pass' | 'camera';

export type DayOfLead = {
  /** Is today the celebration's own day, in Manila? */
  active: boolean;
  /**
   * Does the pass (the invitation QR) come forward to the lead? False off the
   * day, false when there is no pass to show, and false for a guest who
   * declined — see the note on the input.
   */
  passLeads: boolean;
  /** Does the salutation step back below the lead? */
  greetingStepsBack: boolean;
  /**
   * Which slots actually lead, in order, counting only the ones with something
   * to show. Empty off the day. Exposed so the render can be asserted against a
   * decision rather than against a guess about the markup.
   */
  order: DayOfLeadSlot[];
};

export type DayOfLeadInput = {
  /** The celebration's calendar date, `YYYY-MM-DD` (Manila-local in the DB). */
  eventDate?: string | null;
  /** `manilaToday()`. Passed in so this module stays pure. */
  today: string;
  /**
   * The reader's own reply.
   *
   * 🚪 A GUEST WHO DECLINED IS NOT HANDED A DOOR PASS. They keep the page, the
   * photos and everything else — the pass simply does not climb to the top of
   * a page belonging to somebody who said they would not be there. Their QR
   * still renders in its usual place, because it is also how photographs get
   * tagged to them, and a decline is not a deletion.
   */
  rsvpStatus?: RsvpStatus | null;
  /** Is there a pass to show at all? (The QR card renders for this guest.) */
  hasPass: boolean;
  /** Is there a programme to lead with? (Public schedule blocks exist.) */
  hasSchedule: boolean;
  /** Is a camera offered to this guest? (Candid capture or face enrolment.) */
  hasCamera: boolean;
};

function isIsoDay(v: string | null | undefined): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.slice(0, 10));
}

/** Off the day this is the whole answer: every flag false, nothing reordered. */
const INERT: DayOfLead = {
  active: false,
  passLeads: false,
  greetingStepsBack: false,
  order: [],
};

/**
 * Resolve how the invitation is ordered today.
 *
 * Returns `INERT` for every day that is not the celebration's own, so the page
 * renders exactly as it does now — the reorder is a branch, not a rewrite.
 */
export function resolveDayOfLead(input: DayOfLeadInput): DayOfLead {
  const day = isIsoDay(input.eventDate) ? input.eventDate.slice(0, 10) : null;
  const today = isIsoDay(input.today) ? input.today.slice(0, 10) : null;

  // String comparison, both sides YYYY-MM-DD in Manila. See the file note.
  if (day === null || today === null || today !== day) return INERT;

  const passLeads = input.hasPass && input.rsvpStatus !== 'declined';

  const order: DayOfLeadSlot[] = [];
  if (input.hasSchedule) order.push('now');
  if (passLeads) order.push('pass');
  if (input.hasCamera) order.push('camera');

  return {
    active: true,
    passLeads,
    // The salutation steps back whenever the day is on, including for a guest
    // who declined and for one with nothing else to lead with: on the day the
    // page is a utility, and "Hi, <name>" is not what the room needs first.
    greetingStepsBack: true,
    order,
  };
}
