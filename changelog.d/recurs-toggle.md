## 2026-07-12 · feat(create-event): "Make it a yearly thing" recurs toggle + recurring events on the Year view (PR-E)

Owner: "travel can be annual or one-time." Recur-eligible types (travel · corporate · gala_night · celebration · reunion · tournament) now show a **"Make it a yearly thing"** toggle at creation; when on, `recurs=true` and the event returns on the couple's Year view each year (never auto-created). Anniversary + birthday recur by nature (no toggle); wedding/debut/christening/gender_reveal/graduation are one-time.

- **`lib/event-anchor.ts`** — `RECUR_TOGGLE_TYPES` + `canToggleRecur()` (pure, tested).
- **Picker** — the yearly toggle, shown only for eligible types.
- **`createWeddingEvent`** — reads the toggle → `recurs` (anniversary still auto-recurs).
- **`lib/year-moments.ts`** — a new `recurring` moment kind: a recurring generic event surfaces its next annual occurrence (off `event_date`); non-recurring generic events don't. +2 tests (45 anchor/year-moments tests total). No page change (new kind falls to the default icon).

SPEC IMPACT: implements the master plan's Phase-1 PR-E (recurs toggle). Season-window + clone-last-cycle stay a Phase-3 follow-up.
