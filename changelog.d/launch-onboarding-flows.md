## 2026-06-28 · feat(onboarding): launch experience-quiz + anon-draft flows; soften the songs step

Owner-authorized go-live of two onboarding flows that were built but flag-gated,
plus a music-adoption fix. Verified against prod before flipping (migrations,
auth config, columns, and the commit data-path all confirmed live).

**1 — Experience-quiz flow LAUNCHED** (`lib/experience-quiz.ts` default → ON).
Replaces the manual 53-tile vendor-category picker with the 5-axis experience quiz
that derives a persona → the persona derives the plan (picks / services / feel).
Prereqs verified: migration `20270208703382` applied in prod (the three
`events.experience_*` columns exist), the quiz screens render + align, the flow
advances end-to-end, and the commit's experience-column insert passes all
constraints. Kill-switch: `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED=false`.

**2 — Anon-draft onboarding LAUNCHED** (`lib/anon-onboarding.ts` default → ON).
Visitors finish onboarding WITHOUT the signup wall — the commit mints a Supabase
anonymous session, saves the event under it, and drops them in the dashboard;
"secure your plan" later converts the same uid to a permanent account. Prereqs
verified live in prod: anonymous sign-ins are ENABLED (a `signInAnonymously` probe
returns a valid session), the null-email `handle_new_auth_user` trigger is applied
(`20270205204166`) and handles anon users without crashing, and the full anon
commit data-path (event + members + moderator + guests) inserts cleanly under an
anonymous uid. Kill-switch: `NEXT_PUBLIC_ANON_ONBOARDING_ENABLED=false`.

**3 — Songs step softened** (`song-bank-step.tsx`). 0 of 56 weddings had ever
picked a song — the "pick at least 10 more" copy read as a mandatory quota on an
optional step. Reframed to invite a few favourites and reward ANY pick ("we’ll
build the rest around them"), so the music actually feeds the couple's wedding
videos. No gate change — the step was already skippable.

SPEC IMPACT: None code-wise (flags + columns already in the corpus/migrations).
The funnel now defaults to the experience-first + no-signup-wall model the owner
staged — both are env kill-switchable. Surfaced for owner awareness: this changes
what every visitor sees on `/onboarding/wedding`.
