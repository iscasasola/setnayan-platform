## 2026-10-01 · feat(onboarding): the event onboarding engine (G1) — setup cards at the end of creating an event

One engine at the end of creating an event, its cards chosen by the event-type profile
(DECISION_LOG 2026-09-30 "THE SETUP LIVES AT THE END OF CREATING THE EVENT…", "EVERY SETUP CARD
NEEDS AN ANSWER", "THE EVENT TYPE SHAPES EVERYTHING…", "GUEST-LIST ROLES AND GROUPS FOLLOW THE EVENT
TYPE", "THE RSVP IS OPTIONAL…"; 2026-10-01 "THE ONBOARDING PHONE DESIGN — APPROVED", "ELEVEN OWNER
ANSWERS" #4 #5 #8).

- **Migration `20271258536791`** adds the setup five to `event_type_profiles` (`guest_word ·
  gifts_mode · team_first · look_set · camera_default`), seeded from matrix M for wedding · birthday ·
  hangout · date · simple_event. A seeded `look_set` is what admits a type to the engine; every code
  fallback says no, so a failed profile read degrades to yesterday's onboarding. Birthday gets the
  `birthday` role set, hangout/date `hangout`; "Get-together" becomes the simple_event label.
- **The cards** (`app/onboarding/_shared/setup-card.tsx`, one component): where · photo · look ·
  "How do guests get in?" (Will guests reply? Yes/No → Entry ▾ only on No) · guests · a Yes/No list
  (logo · questions · Papic · gifts). "n of N", a quick answer on every card, "You can change this
  anytime". Never re-asks what creation already asked (`CREATION_ASKS`). A wake has no guests card.
- **Mounted on all three creation flows**: `/onboarding/[type]` (birthday · hangout · date — the long
  quiz leaves onboarding for these), `/onboarding/simple` (the one form, paced; still one
  `commitSimpleEvent`) and the wedding shell (before its services step). Answers land in their real
  homes — `venue_name`, `invite_theme`, `rsvp_ask_config` (`guestsReply: false` lets a key holder
  straight in), `style_preferences.setup` — via one `setupColumns`. The guests card picks the landing.
- **Guest groups follow the type**: "Officiant" is wedding-only (`guestGroupsFor`).
- No new server action, no Maker file touched.
- **Guards** (each sabotage-checked red → restored green): `lib/onboarding/setup-engine.test.ts`
  (exact screens per type · never asks twice · a wake has no guest-list step · every card has a quick
  answer) and `tests/db/onboarding-engine-seed.db.test.ts` (the seed, read from the replayed
  migrations).

SPEC IMPACT: None.
