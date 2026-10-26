## 2026-10-27 · feat(create-event): "For ▾" folds the grid by who it is for — you · someone else · a business · someone who passed away

Owner 2026-10-26: *"if i click for you, and it i don't have a debut, it should not show. same concept to the
christening, wake … if it is for you, the name of the celebrant should automatically be me … If it is for a business,
only business related events … For someone else, shows everything."* · *"wake is if your declared passed away. so the
event you can only make is anniversary or wake/funeral."* · *"debut 17-18 woman, 20-21 men. so if no gender for
17-21."* · *"also fix how for dropdown is presented."*

- **The rule is data:** new column `event_type_vocab.for_whom text[]` (migration `20271292363990_event_type_for_whom`),
  values `self · someone · memorial · business`, seeded once, editable on Admin › Categories › Event types → "Who it's
  for". The grid folds with `forWhomHiddenTypes` (`lib/create-subjects.ts`); no event-type key is named in that code.
  A row with no rule (fallback roster) fails open. Corporate and Grand opening are a business's — not offered "For
  you" (owner on #6974, 2026-10-27).
- **"For ▾" is always a choice now** (You · loved ones on file · Someone else · A business · Someone who passed away),
  redrawn as one full-width 44-px dropdown row with its one-line hint and the details in an ⓘ. Changing it re-filters
  the grid in place.
- **Debut age band** (`DEBUT_AGE_BAND`, `lib/life-event-gate.ts`): women 17–18, men 20–21, 17–21 when sex is unknown or
  unconsented; unknown birth date → shown. The create page now reads `users.sex` only with `sex_consent_at`.
- **Celebrant autofill:** For you → the wizard's "This one's yours" chip by name (carried as `forSelf`; the cap key
  stays blank), and the inline form says "For <name> — this one's yours" instead of asking. A business → the account's
  own shop name (`vendor_profiles.business_name`), else asked. Someone else / passed away → asked, as before.
- Dev harness `/dev/create-for-lab`. Tests: `lib/create-for-whom.test.ts`, `tests/db/event-type-for-whom.db.test.ts`,
  handoff round-trip; three stale assertions updated (`the-grid-opens-first`, two picker regexes).

SPEC IMPACT: `DECISION_LOG.md` — new row "CREATE-EVENT 'FOR ▾' FOLDS BY WHO IT IS FOR" (owner words quoted, rule table,
open items: anniversary has no death-anniversary origin yet; "kids' birthday" is not a separate type).
