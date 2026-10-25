## 2026-10-15 · feat(hub): the Logo switch is real — `logo_wanted` decides the cover's logo and the QR centre

Owner 2026-10-15 (DECISION_LOG "SIX OWNER ANSWERS", answer 4).

- One predicate, `logoSwitchedOff` (`lib/hero-monogram-data.ts`): only an explicit `false` is off; NULL (never asked) keeps the logo every event already shows.
- `heroMarkSvg` asks it — the Event Hub cover, the invite doors' crest and the prints' mark draw initials when it is off.
- `qrLookFromRow` asks it — a Pro code's centre falls back to the lettered lockup when it is off; the Pro gate is unchanged (free codes always wear the Setnayan mark).
- Every cover and QR select now names `logo_wanted` (`QR_LOOK_EXTRA_COLUMNS`, `INVITE_MARK_COLUMNS`, `loadEventShell`, the recap print sheet, the concept PDF and the seating export). Every reader is the service role or the host's session — anon holds no grant on the column.
- Guard `lib/logo-switch-is-real.test.ts` (behaviour on a real logo + the selects), sabotaged twice.

SPEC IMPACT: None — the ruling is already recorded in DECISION_LOG (2026-10-15, "SIX OWNER ANSWERS").
