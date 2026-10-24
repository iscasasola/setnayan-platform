## 2026-10-22 · fix(help, tours, ⓘ): Help, every ⓘ and the spotlight tours say what ships

Owner, 22 Oct: *"have you updated our Help, all (i) and spotlight tutorials?"* — they had not been, for a week
of features. Swept against `git log origin/main --since=2026-10-14 --merges` and the week's `changelog.d`
fragments; the full table (missing · stale · OK, per surface, per feature) is
`shots-2026-10-22/help-sync/HELP-SYNC.md`.

- **Tours.** Two new first-visit SPOTLIGHTS (dim + gliding ring — never the centred card), each after the host's
  journey so none stack, neither repeating #6799's five page tours: `customer_account_bar_v1` on the Events board
  (Events · Memories · People, lit on the bar's own tab tokens, then **Switch to** on the avatar — `data-tour=
  "account-avatar"`, drawn at every width, so a laptop's tour lands there; Discover is not a stop — the app drops it
  and `/` stamps no segment) and `customer_people_v2` on
  People (the counts · Loved ones · the find-or-invite field). People's switched-off carousel mount is replaced by the
  spotlight. Stale words fixed: the supplier Today tour's "The bar is Today, Customers, Shop and More…" (More left
  the bar 21 Oct), People's carousel ("The picker at the top…", removed 22 Oct), the couple welcome's "18 roles" and
  "invitation site".
- **A missing stop skips — checked, unchanged.** The engine already lifts the dim and draws no ring while a stop's
  element is absent, and jumps ahead once a later stop is on screen. So Loved ones (gated) is People's MIDDLE stop
  and the always-drawn find field its last — held by the new guard.
- **ⓘ.** The Event Hub stage's ⓘ no longer explains "the strip across the top" (removed 15 Oct). All 61 ⓘ re-read;
  no other one names a removed thing. An "About loved ones" ⓘ was built and walked, then DROPPED: People's folds
  (`.fold > div { overflow: clip }`, the Guest list's own CSS) cut its popover off at the section's edge. What it said
  — a shop you own is one of your loved ones — is the People tour's second stop and the `loved-ones` Help answer.
- **Help.** 13 new: the tabs at the bottom (account bar, event bar; the app's answer without Discover) · switching
  between your events and your shops · what search finds · one account for a shop and events · the supplier
  dashboard's four tabs · People · Loved ones (with the For tag) · Memories · the dress code by role · the venue pin ·
  Event Hub Pro part by part (web only; no figure; the app's answer is `HELP_NOT_IN_THE_APP`) · cookies (essential
  only) · the guest's "What should I wear?". Updated: the theme (your screens can be light or dark, #6809/#6811), privacy (essential cookies only), roles
  (man of honor, best woman, grandparents, several roles per guest), plus-ones (named / no name yet, Release seat,
  no +1 of a +1), supplier sign-up (one account does both). Older stale lines found by the sweep are fixed where the
  shipped UI was confirmed (table).
- **Guard** `lib/help-tips-and-tours-name-what-ships.test.ts` — a PROPERTY: no Help, tour or ⓘ string names a removed
  thing (the cookie banner / analytics cookies / PostHog, Event Hub Plus, the token wallet, "celebration"), each with
  its proof of removal checked first; and none points at More on a bar that has none (the supplier and account bars'
  labels are READ from their source; the app's help too). `spotlight-anchors-exist` now also reads the account bar's
  tabs and a spread `'data-tour'` mark. `people-redesign-holds` + `people-wears-the-guest-list` re-aimed ON PURPOSE
  from the MiniTour mount to the spotlight (same property: People has a first-visit tour).
- **Still open on 23 Oct, so not written into the product** (words in HELP-SYNC.md): other accounts on this phone
  (#6784), people in search (#6792), the web event bar without More (#6791 — it rewrites the event-menu slide itself),
  Memories' new page (#6778). The venue pin (#6787) gets Help but no tour — one field on an existing screen, inside the
  Maker, whose first load is at its ceiling and whose own tour runs there.

SPEC IMPACT: None — words only, every one checked against the shipped UI; no ruling changed.
