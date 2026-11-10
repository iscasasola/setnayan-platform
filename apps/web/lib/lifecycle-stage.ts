/**
 * lib/lifecycle-stage.ts — THE GUEST PAGE'S STAGE: Save the Date → Invitation → The Day → Post Event.
 *
 * `getLifecyclePhase` (the stage the DATE puts an event in, at the venue) and `manualLaunchPhase` (the couple's
 * "Pick what shows" pin). Moved here out of `lib/invitation-widgets.ts`, which re-exports both, by the one-clock
 * ruling (owner, 10 Nov 2026): the one function (`eventClock`, lib/event-clock.ts) composes them, and the middleware
 * asks it for the Event Hub's cache key — so this module may import nothing heavier than the window arithmetic
 * (`lib/day-of-mode.ts`) and the invitation's one date (`lib/invitation-opens-on.ts`).
 */
import { getDayOfPhase, getMenuLifecyclePhase, theDayWindow, type TheDayHours } from './day-of-mode';
import { invitationOpensOn, venueDayOf } from './invitation-opens-on';

// NOT the dashboard bottom-nav menu phase: that is `MenuLifecyclePhase` in lib/day-of-mode.ts (plan → dayof → after). This WEBSITE pair is the one `app/[slug]/page.tsx` consumes.
export type LifecyclePhase = 'save_the_date' | 'rsvp' | 'event' | 'editorial';

/**
 * Maps the event date to its lifecycle phase, reusing the day-of date math
 * in lib/day-of-mode.ts for the near-event window:
 *
 *   DayOfPhase 'live'  → 'event'     (The Day: 06:00 on the day .. 06:00 the morning after the last day)
 *   DayOfPhase 'post'  → 'editorial' (the day after The Day closed)
 *   DayOfPhase 'pre'   → 'rsvp'      (the 3 days before The Day opens)
 *
 * ⚠ DayOfPhase 'inactive' is the catch-all for BOTH ends — *more than 3 days
 * before* the wedding AND *more than 24 hours after* it. Those are opposite
 * lifecycle phases, so 'inactive' MUST be disambiguated by comparing the event
 * date to now: a wedding already in the past → 'editorial'; one still in the
 * future → 'save_the_date' when it's more than STD_THRESHOLD_DAYS out, else
 * 'rsvp'. (Mapping 'inactive' straight to 'rsvp' would wrongly show the
 * invitation on a wedding that happened a week ago — the day-of 'post' window
 * only lasts 24h.)
 *
 * A null event date (very early planning, no date set yet) maps to
 * 'save_the_date' — a couple with no finalized date is at the very START of the
 * wedding lifecycle (the announcement stage), so their Save-the-Date shows. This
 * is consistent with the future-date split below: the farther out the wedding,
 * the earlier the phase; no date at all is "farthest out" → Save-the-Date. (Was
 * 'rsvp', which skipped the Save-the-Date entirely for date-less weddings —
 * owner 2026-06-18: a rendered Save-the-Date didn't show because of this.)
 */
// NOT the dashboard menu-phase resolver: that is `getMenuLifecyclePhase` in lib/day-of-mode.ts.
export function getLifecyclePhase(
  eventDate: string | null,
  /*
    THE VENUE'S OWN CLOCK.

    🚨 WITHOUT IT THIS RESOLVER ASKS A SERVER IN UTC WHAT TIME IT IS AT A
    WEDDING IN MANILA. `getDayOfPhase` below has taken a `tz` since 2026-08-05
    and this call never passed one, so the PUBLIC page — the one guests open —
    decided which phase to render from a clock eight hours behind the venue.

    Optional so no caller silently changes meaning; every call site in the app
    passes it, and `every-public-phase-reads-the-venue-clock` fails if a new one
    forgets.
  */
  tz?: string,
  /** The LAST day, for a celebration spanning several — same value the
   *  dashboard's own resolver anchors on. */
  eventEndDate?: string | null,
  /*
    "Now", injectable.

    🪤 ADDED BECAUSE A TEST OF THIS FUNCTION PASSED FOR THE WRONG REASON.
    Without it the only way to assert the post-event answer is to run at the
    real wall clock — and on the morning after a test event, `getDayOfPhase`
    ALREADY returns 'post', which already maps to 'editorial'. So the
    assertion went green with the new boundary deleted: it was measuring the
    old path and reporting the new one. Every other resolver in this pair
    takes an injectable now for exactly this reason.
  */
  nowMs?: number,
  /*
    📬 THE DAY THE INVITATION OPENS — `events.std_invitation_launch_date` (owner 2026-10-14,
    DECISION_LOG 📬 item 6: "the film and the switch read ONE date"). Until then this switched at
    `STD_THRESHOLD_DAYS` and never read the couple's date, while the Save the Date film promised
    that date to guests. Now the switch from the Save the Date to the Invitation is
    `invitationOpensOn(eventDate, invitationLaunchDate)` on the VENUE's calendar — the same date
    the film says. Null / absent = no date of their own: 90 days out, as before (by venue day now,
    not by 24-hour blocks on the server's clock).

    EVERY CALLER PASSES IT — `lib/the-invitation-opens-on-one-date.test.ts` fails a call site that
    does not (a caller that only asks "is it editorial?" says so in that guard's list).
  */
  invitationLaunchDate?: string | null,
  /** The couple's own hours for The Day (default 06:00 on the day → 06:00 the morning after the last day). */
  hours?: TheDayHours | null,
): LifecyclePhase {
  if (!eventDate) return 'save_the_date';

  /*
    ─── ONE ANSWER TO "HAS IT HAPPENED?", NOT TWO ───────────────────────────

    The dashboard flips to its After phase at 06:00 on the day after the last
    day (see lib/day-of-mode.ts). This page used to keep saying "Happening now"
    until T+36h — so on the morning after a wedding, the couple's own dashboard
    could call it finished while the page their guests were opening still ran
    the live day-of surface.

    Delegated, never re-derived: the boundary lives in ONE function and this
    asks it. `cleared_at` is deliberately NOT passed — closing out the day is a
    HOST action on the host's dashboard, and it must not retire the guests'
    page out from under them mid-celebration.
  */
  if (getMenuLifecyclePhase(eventDate, null, tz, nowMs, eventEndDate ?? null, hours) === 'after') {
    return 'editorial';
  }

  switch (getDayOfPhase(eventDate, tz, nowMs, eventEndDate ?? null, hours)) {
    case 'live':
      return 'event';
    case 'post':
      return 'editorial';
    case 'pre':
      return 'rsvp';
    case 'inactive':
    default: {
      // Far from The Day (more than 3 days before it opens, or a day after it closed). Asked of the SAME window the
      // cases above read — never `new Date(eventDate)`, which parses a bare date as midnight UTC.
      const { opensMs } = theDayWindow(eventDate, tz, eventEndDate ?? null, hours);
      if (!Number.isFinite(opensMs)) return 'rsvp';
      const now = nowMs ?? Date.now();
      if (opensMs < now) return 'editorial';
      // Future, beyond the near-event run-up: split the long pre-event window
      // into Save the Date (announcement) and RSVP (invitation) at the ONE
      // date the Invitation opens (`invitationOpensOn` — the couple's own
      // date, else STD_THRESHOLD_DAYS out), on the venue's calendar.
      const opensOn = invitationOpensOn(eventDate, invitationLaunchDate ?? null);
      if (!opensOn) return 'rsvp';
      return venueDayOf(tz, now) < opensOn ? 'save_the_date' : 'rsvp';
    }
  }
}

/**
 * The couple's PINNED phase (owner 2026-07-02, register DAY-33 · PH-6).
 *
 * Owner, verbatim: *"a manual toggle to set it automatic or manual launch,
 * whichever website they want. activating one will deactivate the other …
 * save the date, rsvp, event and editorial."*
 *
 * `events.launch_mode = 'manual'` plus a valid `events.manual_phase` pins that
 * phase for EVERY visitor, until the couple switches back to automatic. Any
 * other combination (auto, a null pin, an unknown value) returns null and the
 * clock decides, exactly as before. The columns have existed since migration
 * `20270426100000`; the reader shipped in PR #2562 was closed unmerged, so
 * until this function they had no reader at all.
 *
 * 🔒 COMPOSED AT EVERY SITE THAT PICKS THE SITE'S FACE, as
 * `manualLaunchPhase(mode, pin) ?? getLifecyclePhase(date, tz, end)` — the
 * page, the arrival door (`lib/invite-destination.ts`) and the editor's
 * preview. Left literal rather than wrapped so the venue-clock guard keeps
 * seeing each real `getLifecyclePhase(` call; `the-couple-can-pin-a-phase.test.ts`
 * fails if one of the three forgets the pin.
 */
export function manualLaunchPhase(
  launchMode: string | null | undefined,
  manualPhase: string | null | undefined,
): LifecyclePhase | null {
  if (launchMode !== 'manual') return null;
  return manualPhase === 'save_the_date' ||
    manualPhase === 'rsvp' ||
    manualPhase === 'event' ||
    manualPhase === 'editorial'
    ? manualPhase
    : null;
}
