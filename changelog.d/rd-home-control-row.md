## 2026-10-24 · feat(home): Home is a control center — Today on top, six widgets that open their page at the exact item, services that grow in place (PR-D)

Owner, 24 Oct: *"our home page handles the full overview and quick access to the different parts of the event. It is
basically a control center for the whole event."* Approved ("ok", ~16:50) `prototypes/home_control_center_2026-10-24_fable.html`
(corpus 10067d39). Stacked on PR-C (`rd/home-service-widgets`, #6861).

- **Today** — one line on top naming the shipped picker's one thing to do (`pickHomeNext`, unchanged order) and a
  POINTER: a tap scrolls Home to the widget it names and rings it for 1.8 s. "Later" beside the verb folds it to
  "Back tomorrow · Undo" (device only).
- **The control row** (`home-control-faces.ts` → `home-control-row.tsx`, one data shape drawn twice): ① Countdown →
  Event Details · ② Guests → Guests · ③ Event Hub → the page guests see (Edit in Maker · View Event Hub) · ④ Suppliers
  → Suppliers · ⑤ Budget → Budget · ⑥ Checklist → Checklist. One widget per page; no page twice.
  - **Compact below 768 px** (`home-tile.tsx`): a 2-column grid of tiles; multi-face tiles swipe (finger or mouse,
    20 % snap, < 6 px is a tap) and auto-rotate — 4.5 s a face, 320 ms slide, 0.9 s stagger, a filling dot; paused
    under a finger, off screen, on a hidden page; never under reduced motion, for one face or a failed read; a touch
    rests the tile 9 s and it resumes from the face it was left on. A tap opens the face's EXACT item.
  - **Detail from 768 px**: the shipped card's head · dot · status · acts, no grow, in two columns read column by
    column; details inside each card's ⓘ (InfoTip). The column fills the body from `md` (moved down from `lg`).
  - **Budget faces** = every payment still to settle from the resolved ledger (`event_vendor_line_items`, banded by
    `lib/budget-truth.ts` `dueState`), soonest first, overdue in red, each with Pay; then the summary; > 5 → "+N more".
  - **Suppliers**: the dashboard's own "N of M booked", quotes to decide (`SupplierStanding.needsYou`) and who
    replied (`standingRollUp`) — `lib/home-control.server.ts`. **Checklist**: % done, open, due this week, the next
    three dated tasks (`rankUrgentChecklistItems`).
  - A failed read is ONE "Couldn't load" face with ⟳ Reload — never 0, never ₱0, never rotating.
- **Removed**: the "Your next step" card, the aggregate "What's next" (and `EventDashboard`'s `only="whatsnext"`
  mode — its ~15 reads no longer run on the plan Home), the separate coming / no-reply tiles, the cover's ⚙ Settings
  pill (the Countdown is Event Details' one door), the dead `getNavSlotMap` read, the never-twice stand-down rule.
- **Services** (PR-B/PR-C cards, reused): below `md` a closed service is a compact tile; a tap grows the card in place
  across both columns; one open at a time (`useOneOpen`). The Event Hub card left Your services (it is the ③ widget).
- **View Event Hub** opens a new tab on the web (`target="_blank"`, through `openEventHub(url)` — a local stand-in for
  `lib/open-external.ts`, #6866, swapped in once it lands).
- **Tours**: `customer_home_widgets_v1` → Today · the faces · Your services; the host journey's Home stops ring the
  control row (`home-tiles`) instead of the Next card.
- Guards: `home-one-widget-per-page` · `home-control-reads-honestly` · `home-tiles-rotate-politely` ·
  `home-upper-opens-lower-grows` · `home-hub-view-opens-a-new-tab`; re-aimed: `the-home-leads-with-one-next`,
  `the-home-grid-reads-in-order`, `home-tiles-open-their-guests`, `home-has-no-go-elsewhere-links`,
  `one-door-to-event-details`, `home-never-reads-a-failed-read-as-on-track` and the others the removals touched.

Data: two columns added to the event row the dashboard reads once (`DASHBOARD_ROW_CARRIES`):
`venue_name`, `std_invitation_launch_date`.

SPEC IMPACT: None — builds the approved prototype; its "Review notes" are the record (decisions taken where the notes
left a question are listed in the PR body: Settings pill removed as drawn; Suppliers says "booked", the dashboard's own
count).
