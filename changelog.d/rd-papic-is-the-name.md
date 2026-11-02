## 2026-10-26 · feat(papic): the Papic card is a quick on/off and a head that opens its settings

Owner, live, 2026-10-26, on Home's Papic card: *"shouldn't this be the one on home?"* · *"name it Papic and not Guest
Photos."* · *"the gallery should not be there."* · *"it just needs to have a quick on off button and expand for more
settings for papic"*.

- **The name.** `SERVICE_NAMES.papic` reads `plain: 'Papic'`, `brand: 'Guest photos'` — the card's title is "Papic"
  with "Guest photos" as its small line. Three readers that used `.brand` to mean "Papic" now read `.plain` (the
  Today card's "Open Papic", the app's Thank-You row's small line, onboarding's "Papic is live on this event").
- **The card, closed** (`papic-home-card.tsx`): the head only — camera mark · Papic · Guest photos · the Papic ON/OFF
  switch (`PapicSwitch`, now shown closed AND open, still a sibling of the head's button) · ›. Removed from the closed
  card: the coverage line, the credits line + meter, the latest-five strip ("Frames fill as your guests shoot" /
  "See all ›"), Add more. The phone's own closed tile face (2026-10-24, "credits left · coverage · Add more") is gone:
  the phone draws the same card, full width.
- **The card, open:** unchanged — `PapicCameraSettings` holds the credits counter, Add more, the dates and every
  setting. After the event day the Thank-You Video door (which lived only on the closed card) is now the open card's
  first row.
- **Deleted:** `papic-card-strip.tsx` (`PapicCardStrip` / `PapicCardStripView` — no consumer left) and
  `papicCoverageWords` (its only reader was the closed card).
- **Guards:** `papic-opens-on-home.test.ts` test 5 renders the card closed and fails on anything beyond mark · name ·
  small line · switch · › (and on any prop beyond the head and its settings); sabotaged three ways (the strip re-added
  as a prop, five frames hard-coded under the head, the switch gated on `open`) → red each time. Test 3 now pins
  that the credits counter and Add more live in the open settings and the Thank-You door leads the open card.
- Port-controls baseline regenerated: `<PapicCardStrip>` / `<PapicCardStripView>` (owner: "the gallery should not be
  there") and the Papic page's `<Suspense>` that wrapped only that strip.

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-26 "PAPIC CARD = ON/OFF + EXPAND" — supersedes the 2026-10-23/24 quick
view (latest five, coverage, credits meter, Add more on the closed card) and the 2026-10-24 phone tile face.
