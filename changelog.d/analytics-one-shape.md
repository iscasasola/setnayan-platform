## 2026-11-22 · feat(analytics): every Shop › Analytics card is one shape, coloured by meaning, and the count cards compare with last year

Owner 21 Nov 2026, DECISION_LOG "ANALYTICS CARDS, ONE SHAPE — LOOK APPROVED" (*"graphs look better and balance"*) and
"ANALYTICS "VS LAST YEAR" — YES" (*"Yes, add it"*); owner 22 Nov 2026, "ANALYTICS GRAPHS: COLOUR BY MEANING, NOT THE
THEME COLOUR" (*"don't use theme color for the graphs. use what colors are appropriate for each graph"*). Drawing
`prototypes/analytics_one_shape_2026-11-21/analytics-one-shape.html`.

- **One shape.** Every card is 340 × 320 on every screen: head 24 · number row 44 · picture FIXED 144 · line at most two
  lines, 12 between, padding 18, no border and no hairline. A desktop shows 2–3 cards side by side in the same carousel
  (it showed one card the full width). Big number 22 px, axis words 11 px, page text that never scales. The 13-week
  calendar is square 13-px days with its key on the right; Dates you lost is page-text columns with the legend inside
  the box; Where couples found you is label · count over a 6-px track. Extends #8083 (the carousel never changes height).
- **Colour by meaning.** New chart tokens in `globals.css`, light + dark, contrast-checked on both cards
  (`docs/design-token-map.md`): opened blue · asked amber · booked green · last year grey dashed · quiet grey · five
  source hues (`lib/chart-source-hues.ts`, one hue per source everywhere). "+N%" green, "−N%" red, flat grey. Every
  other graph re-pointed from the theme colour to its meaning; buttons and tabs keep the theme.
- **Vs last year** (Opened · Asked · Booked only). A dashed "same days last year" line and "+N% vs last year"; 30 days
  looks back 52 weeks, 12 months one calendar year (its line the same months, the month cut to the same day). Under 10 in
  either period → both counts in words, no percent and no line. A shop under a year old → nothing. A refused last year
  → "Last year: couldn’t load", never a percent. Rules in `lib/analytics-vs-last-year.ts`.
- **Three years.** Tap a count card → one line per year (December → November) and the yearly totals, each counted to
  today's month and day, with the change from the year before.
- **Reads.** `lib/vendor-growth-series.ts` reads views and inquiries from the oldest season's 1 December in three spans
  side by side and builds the lanes, last year and the seasons from that ONE read (opens total as couples,
  `countDistinctViewers`); new `fetchBookedSeries` reads the Booked stage (`BOOKED_EVENT_VENDOR_STATUSES`) on the admin
  client. No migration; the rows were already kept.
- **Guards.** `lib/analytics-vs-last-year.test.ts` (the owner's rules), `performance/every-card-is-one-shape.test.ts`
  (shape, tokens, colour by meaning, the vs-last-year gate — sabotaged red three ways, restored), the series test updated.
- **Lab.** `/dev/supplier-lab?s=analytics&shop=drawing` — the drawing's own generator (three years of daily rows) through
  the real bucketing; the analytics lab wears the supplier's blue look.

SPEC IMPACT: None — builds the approved drawing and the two owner rulings as written.
