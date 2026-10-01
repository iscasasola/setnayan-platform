# PROGRESS — rd/onboarding-engine (P2 · G1 event onboarding engine)

WIP handoff, 2026-10-01. Branch cut from origin/main @ 49693bf3c. Stopped on controller order
(moving to a cloud session). Typecheck (`tsc --noEmit`, apps/web) was clean at the last edit;
NO tests, lint, guards, bundle or Maker budgets have been run yet.

## Done (uncommitted work now committed as WIP)
- **Migration** `supabase/migrations/20271258536791_event_type_profiles_carry_the_setup.sql`
  (via `pnpm migration:new`): adds `guest_word · gifts_mode · team_first · look_set ·
  camera_default` to `event_type_profiles`; seeds wedding · birthday · hangout · date ·
  simple_event from matrix M; role_set_key birthday→'birthday', hangout/date→'hangout'
  (prod measured: 0 guests on those types); vocab label simple_event → "Get-together".
- **lib/event-type-profile.ts**: `ProfileSetup` + `GiftsMode`/`CameraDefault`; optional
  `setup` + `onboardingEngine` on EventTypeProfile; code fallbacks on WEDDING/GENERIC/SIMPLE/
  TRAVEL/WAKE; `toSetup` per-field strict read; `profileSetup(profile)`; new columns in
  PROFILE_OPTIONAL_COLUMNS. `onboardingEngine` = the DB row has a non-empty `look_set`
  (all code fallbacks say false → a failed read degrades to yesterday's onboarding).
- **lib/role-sets.ts**: BIRTHDAY_ROLE_SET (celebrant·guest·host·family), HANGOUT_ROLE_SET
  (guest·host), `guestGroupsFor(roleSetKey)` (Officiant wedding-only). GROUP_OPTIONS removed
  from guests/_components/guest-card-body.tsx + guests/new/page.tsx (card data now carries
  `groupOptions`, keeping a guest's existing group if the type no longer lists it).
- **lib/rsvp-ask.ts**: `guestsReply?: boolean` key (absent = Yes) + `readGuestsReply`;
  **lib/guest-one-path.ts** `rsvpGate` takes optional `guestsReply` → false = inside;
  wired in `app/[slug]/page.tsx` only (the reply page itself is deliberately untouched).
- **lib/onboarding/setup-answers.ts** (pure, client-safe): card ids, SetupAnswers, SetupView,
  `setupDefaults`, `moreRows`, `setupCardAnswered`, `setupQuickAnswers` (≥1 per card),
  `sanitizeSetupAnswers`, `setupLanding`.
- **lib/onboarding/flow-config.ts**: SETUP_ESSENTIALS, CREATION_ASKS (generic/simple/wedding
  all ask name+when), REPLY_YES_BY_DEFAULT (wedding·debut·gala_night·corporate — decision
  4537), `setupViewFor`, `resolveSetupSteps` (no guests card when solemn = wake),
  `genericFlowScreens` (engine on: quiz pax/region/tq_/axes/reveal removed).
- **lib/onboarding/setup-view.ts**: server composition (`setupViewForProfile`).
- **lib/onboarding/event-insert.ts**: `setupColumns` (venue_name · invite_theme ·
  rsvp_ask_config · style_preferences.setup) + opts.setup in buildGenericEventInsert;
  **types.ts** payload `setup?: unknown`; **commit-event.ts** re-reads via sanitize when
  `profile.onboardingEngine`.
- **app/onboarding/_shared/setup-card.tsx**: the one card (n of N, ⓘ, PickMenu for 3+,
  two buttons for 2, quick answers, "You can change this anytime", skin accent).
- **generic-onboarding.tsx + [type]/page.tsx**: engine mounted for admitted types; screens from
  `genericFlowScreens`; draft persists `setup`; landing via `setupLanding`.

## Not done
1. **simple_event**: `/onboarding/simple` (commitSimpleEvent form) has NO engine yet. Plan:
   client wrapper around the existing form (step 0 = name/date/Papic, then SetupCards, hidden
   input `setup` JSON) and parse in commitSimpleEvent with `sanitizeSetupAnswers` +
   `setupColumns` — OR route simple_event through /onboarding/[type] and retire
   commitSimpleEvent (−1 action) but generic leaves `event_date` NULL (simple writes it).
2. **wedding**: engine not mounted in onboarding-shell.tsx (4.6k lines, commits through
   commitOnboardingWedding, not commitOnboardingEvent). Needs FLOW_IDS entries before
   'services_step', SetupCard sections, payload.setup, and setupColumns in the wedding commit.
3. **Tests** (none written): flow-config per type exact step list; never-asks-twice guard
   (CREATION_ASKS keys absent from resolveSetupSteps output); wake has no setup_guests;
   every card ≥1 quick answer; toProfile reads the five + onboardingEngine; role sets;
   rsvpGate guestsReply; setupColumns. Existing tests that may break: flow-config.test.ts
   (GENERIC_ONBOARDING_SCREENS still exported, untouched), role-sets.test.ts, any guard that
   counts ROLE_SETS keys, solemn-onboarding.test.ts.
4. **Ugat**: not touched yet; run `ugat-schema-claims` / `ugat-concept-coverage` db tests —
   event_type_profiles is not in lib/ugat/graph.ts today.
5. Checks not run: lint, every `node scripts/lint-*.mjs`, bundle (≤206,848), Maker (≤517,120),
   server actions (≤1225 — no new action added), unit + db tests, sabotage checks.
6. Remove the five stale root notes (BAR_/BUILDMEM_/F2_/HOME_/TEAM_PROGRESS.md — present on main).
7. changelog.d/rd-onboarding-engine.md (SPEC IMPACT: None); PR routine per prompt.
8. Intents only (stored in style_preferences.setup, nothing reads them yet): photo upload,
   logo, questions "Change", papic/gifts yes/no; Home "Set up · …" line not built;
   one-QR join still lands as a Request (no auto-admit); hangout/date "pre-answered chips"
   from the concept not built (they get the full cards).

## Gotchas found
- Pro themes are fenced to weddings (`pickableInviteThemes`, owner Q7=A): birthday's seeded
  look_set (whimsical·abaca·house·galeriya) filters to house·galeriya at runtime — the
  approved design's "Whimsical pre-selected" for birthdays conflicts with the fence. Owner call.
- No per-event RSVP on/off existed ("dest.rsvp" is not in the repo) → added `guestsReply`.
- Cover upload needs the event id (`/api/upload` path events/<id>/…) and is Pro-gated in the
  Maker → onboarding records only the intent.
- Prod flags (read 2026-10-01): EXPERIENCE_QUIZ, ANON_ONBOARDING, ONBOARDING_SERVICES_STEP,
  ONBOARDING_V2_BRIEF all "true" — /onboarding/[type] is live.
- In this sandbox heredocs/compound shell commands are refused; edits were made via python
  scripts in the scratchpad + Edit tool. Use /usr/bin/grep (bare grep is silent in worktrees).
