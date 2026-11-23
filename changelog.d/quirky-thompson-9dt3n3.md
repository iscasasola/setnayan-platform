## 2026-11-23 · style(today): the couple's Today in the website's look (v5 drawing)

Owner, 23 Nov 2026: *"we want it to be the same design template as our website"*, then *"Yes, approve"* on the v5 redraw (specs DECISION_LOG "EVENT SERVICES v5 (WEBSITE TEMPLATE) APPROVED, WITH THE TODAY DOOR"; drawing `prototypes/buy_event_services_one_place_2026-11-23/strip-v5-today.jpg`, `frames_v5_website/12-today-proposed*.png`).

Look only. Every row, count, button, door and read is the live #8066 page's:

- **A white page** on Today (dark keeps the dark page). The event card sits on the page: mono kicker, the name, the big number, two grey lines. No peach band.
- **The strip** is a quiet note box. Its level is an outlined OVERDUE tag, and its Pay is the page's one terracotta button.
- **Needs you today** has a website section head (19/700 plus its count). Rows are split by hairlines, with no tints, no coloured edges and no icon discs. The level is an outlined OVERDUE / SOON tag in the line. Pay is a round outlined pill. "62% of the plan done · All N this week ›" is the closing row.
- **Guests · Budget · Schedule · Suppliers · Event Hub** are website sections ("Title  See all →", one grey line, 32 px chips, quiet pills, hairline rows) at every width. They are the 1280 board's own cards. The phone's rotating compact tiles and the tablet's second copy are retired (the drawing replaces them; owner's pick in this build, "Drawing: sections"). Budget rows read who · line · amount · Pay. Paid / still owing / % paid is one fine line, read through the same `Count` readers and ids. The Event Hub stages are the website's step rail.
- **Your services · Prints · Memories** are hairline rows with plain glyphs and grey state words.

The sheet is `app/dashboard/[eventId]/_components/today-website.css`, scoped to `[data-home-first-screen]` and imported by the event layout (and the home lab). Every colour is an existing token by job. No new value, no `globals.css` growth.

Guards: the Home guards that held the retired compact and detail copies are re-aimed at the board's one copy, each with its intent kept: honest failed reads, one page per widget, each fact once, reading order, Examples, new-tab View, Maker only on the Event Hub.

SPEC IMPACT: The phone's widgets on Today are now the board's sections, not rotating tiles. This supersedes the 24 Oct "COMPACT ON THE PHONE" and 1 Nov "frames where you act" layouts, and the 28 Sep / 7 Oct "no → copy" rule for section heads. The DECISION_LOG row is proposed in the PR body for the controller to land in the corpus.
