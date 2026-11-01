## 2026-11-01 · feat(dates): no event before December 19, 2026 — the founders' wedding is the first

Owner ruling (DECISION_LOG 2026-11-01, "NO EVENT BEFORE DECEMBER 19, 2026 — THE FOUNDERS' WEDDING IS THE FIRST
(fixed rule)"): a new event's date, and any change to an existing event's date, must be on or after 2026-12-19. The
founders' (`users.is_internal`) accounts may use any date; an existing event keeps its date until it is changed.

- **One rule, a constant** — `lib/event-date-floor.ts` (`FIRST_EVENT_DAY`, the owner's sentence verbatim,
  `eventDateFloorRefusal`). No Admin setting, no database row. A month or year is read at its last day (December 2026
  is allowed; the day it narrows to is asked again). Who is exempt: `lib/event-date-floor.server.ts` — the acting
  account is internal, or (for a date change) the event's host is; an unread answer is "not internal".
- **Every server door asks it** — Event Settings › date (`updateEventDate`, now RETURNS the refusal so the words reach
  the screen) and the suppliers page "Lock this day"; Date Finder › Lock (`lockEventDate`, all three callers); the
  Maker (refused at the pick, held at Apply as `date_before_first_event`, and never asked of booked suppliers);
  the create grid's candidate days / window; every typed onboarding (the "Worth planning" door), the wedding
  onboarding and the Simple Event form; the Save-the-Date film-date backfill; a supplier lock / agreement narrowing
  (an early candidate is never narrowed to); a supplier's Locked QR date; the wizard's set-the-date card.
- **Every event-date picker** a normal account sees starts at December 19, 2026 (`eventDateMinFor`): the create grid,
  Event Settings + the Maker's day, Date Finder, Find your date, the onboarding calendar, "When (optional)", the Simple
  Event form, the Locked QR. A day typed past `min` (iPhone Safari allows it) is answered beside the date.
- **Said in place** — beside the date, never a reset screen: the create grid, the "When" field, the onboarding date
  screen (a "Worth planning" day before the 19th is not offered as a chip), Event Settings / the Maker's row, Date
  Finder, the candidate cards, the Save-the-Date date, the Locked QR date.
- Guards: `lib/event-date-floor.test.ts` (the rule — 12-18 refused, 12-19 allowed, internal any date — plus every
  door asks it, a NEW writer must be a door or say why not, and every picker starts at the floor) and
  `app/onboarding/_shared/the-date-floor-is-said-beside-the-date.test.ts` (the real When field, painted). Each
  sabotaged red once.

SPEC IMPACT: None — implements the DECISION_LOG 2026-11-01 row as written; no corpus decision changed.
