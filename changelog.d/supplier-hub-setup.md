## 2026-10-29 · feat(supplier-hub): the Hub sets up one event — Set up · Crew · The event's pages; "Events" folds into Hub

Owner, 29 Oct (supplier dashboard v13, *"Approved."*); DECISION_LOG 2026-10-29 "THE SUPPLIER'S BOTTOM BAR = TODAY ·
CUSTOMERS · SHOP · HUB — 'EVENTS' FOLDS INTO HUB" and "A SUPPLIER'S TOOLS + SCANNER ARE SET ONCE PER SERVICE, APPLIED TO
EVERY EVENT". Builder S6, slice 1 of 3 (Hub set up). Prototype `renderHub` / `hubSetup` / `hubCrew` / `hubPages`.

- **Hub ▾** (`on-the-day/_components/hub-event-menu.tsx`) — ONE dropdown of every event: the days this shop is booked
  on AND the events this person runs as the hosts' coordinator, one row per event (`lib/hub-events.ts`), grouped Today ·
  Next 7 days · Coming up · Date not set yet · Earlier, with a search row past eight. From 701 it moves up into the
  pinned row's left (the shell's page menu opens a slot for it, `[data-pin-lead-hub]`); below 701 it leads the page.
- **Set up · Crew · The event's pages** — one segmented control, each its own address (`?event=…&seg=…`).
  - *Set up*: the shipped per-booking tools (`ModuleConfigurator`, restyled to house switch rows — same action, same
    `vendor_dayof_configs` saves) · the run of show's first moments (`fetchRunOfShowBlocks`, a refused read says so) ·
    the coordinator's Check-in desk and Message everyone for an event they run · on the day itself, "The Day": Find a
    guest's seat and everything the old console carried (headcount + delivery, the shot list, report to the
    coordinator, capture, the review QR) — kept whole.
  - *Crew*: the shipped per-event team grants (`AccessGrants`, restyled; `vendor_event_access_grants`); a refused team
    read says so.
  - *The event's pages*: run as their coordinator → the hosts' Guests · Seats · Schedule · Event Hub; booked only →
    the shipped view-only pages for this shop's service (`forYourServicePages`).
- **The right column** (from 701; the page's top on a phone) — the event card + **Open the Event Hub** (the live page,
  on the day only, booked and unlocked) or the day it opens, with the offline copy's mark.
- **Locked** — a day still waiting on its booking fee is its lock in Set up and Crew (the gate's words, the bill's link;
  no tools, no brief read); one gate read for the whole list (`resolveEventFeeGates`), as before.
- **"Events" folds into Hub** — no fifth tab on the bar or the rail; a scoped helper who runs an event gets the Hub door
  exactly as on an event day; `/vendor-dashboard/events` forwards to the Hub and lights it; `EVENTS_YOU_RUN_HREF` is
  the Hub; the two registry slots for the tab are gone.
- Retired: `on-the-day/_components/event-picker.tsx` (the list became the Hub ▾), the "compact" no-event page and the
  `?preview=1` console (the Hub now always shows its event's set-up).
- Lab: `/dev/supplier-lab?s=hub&shell=1` (`&seg=setup|crew|pages` · `&ev=ic|rf|lk|mj`).

Guards: `on-the-day/the-hub-is-set-up-per-event.test.ts` (replaces `the-empty-hub-lists-the-next-events.test.ts`,
carrying its lock properties); re-aimed: `coordinator-door` (1 · 6 · 7), `the-columns-are-the-system` (Hub fills the
frame), `the-fee-unlocks-the-event` (the Hub's plural gate + lock row), `the-supplier-tools-have-doors`,
`the-app-says-event-in-plain-words`, `spotlight-anchors-exist` (+ the Hub tour's words).

- **Review fixes (2026-10-30, against the prototype at 390):** the segments sit directly under the pinned row, ABOVE
  the event card (`HubScreen`); the Hub ▾ carries the event's ⓘ (`HubEventInfo`, the house `Explain` — date · place ·
  role, only what was read); the thumb row (`hub-thumb-row.tsx`, shared `ThumbRow`): Set up "Find an event to set up"
  (opens the Hub ▾ on its words) + ＋ "Add a moment, tool or helper" (`hubAddChoices`, only doors the supplier may use;
  none when locked), The event's pages "Find a guest or a table" (narrows the rows; says so when none match); the
  event's pages are icon rows that open in place (`HubPageRow`, the shared `Fold`) with live counts only from reads
  already made — Guests from the brief, Schedule / Run of show from the run-of-show read (`hubScheduleLine`); Seats,
  the Event Hub and the other view-only pages keep their plain words (no supplier read for them). An event only run
  no longer reads "0 invited · 0 coming" (no brief was asked). Guards 6–9 in `the-hub-is-set-up-per-event.test.ts`.

SPEC IMPACT: None — builds the approved v13 prototype and the 2026-10-29 rulings already in DECISION_LOG; no new decision.
