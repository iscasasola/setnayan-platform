## 2026-08-13 · feat(profile): opening somebody's page shows the days you were both there — behind the flag, flag still OFF

Redesign Session 9 ("mutual stories"). A signed-in visitor opening `/u/<someone>` now sees the celebrations the two of them were **both** at. Ships **inert**: every path hard-gates on `personLifeStoriesEnabled()`, which is `false` unless `NEXT_PUBLIC_PERSON_LIFE_STORIES === '1'`. **Nothing in this PR sets that variable** — verified by grep across the tree; there is no `.env` carrying it and `.env.example` does not mention it. It is a `NEXT_PUBLIC_*` var, so it inlines at **build** time and needs a cache-free rebuild after the owner sets it in Vercel, and the value must be exactly `1` — `true` reads as OFF (there is a test for that).

### It was assembled from what already ships, not invented

- The Alaala lenses were already *Recent · Owned · **Attended** · People · **With me*** (owner-approved 2026-07-15).
- `person_story_items` already carried `person_id · event_id · origin · consented_at · hidden_at · removed_at`, its RLS, and its no-face-origin constraint.
- `lib/person-life-stories.ts` was already the Phase-2 read model. It was **extended**, not duplicated.
- The "would `/[slug]` actually render this event to a stranger?" gate already existed inside `resolvePublicProfile`. It was **lifted out** to `filterPubliclyVisibleEvents` and both callers now ask the one function — three surfaces each asking their own version of a visibility question is the guest photo-wall defect, and this is the point where a second copy would have been written.

### 🔒 The privacy rule IS the design

A day appears **only when both people are already visible in it** — each has a story item that is consented and live (not hidden, not removed), and the event is publicly visible. Consequences, in order of importance:

1. **It can only ever show what was already shown.** No new fact about either person's whereabouts is published.
2. **It is symmetric by construction** — a set intersection, not two code paths. So if **either** person hides or opts out, the day leaves **both** pages in the same instant. That is a property of the shape, not a promise in a comment.
3. **The only person who learns anything is the signed-in viewer**, and the day is one they were at themselves.
4. **Never derived from a guest list.** `event_members` / `guests` record who was *invited*; that stays private. Presence here comes only from consented story items. Without this rule the feature is an attendance-disclosure engine — the same family as the slug-forwarding leak, where a `307` disclosed in its `Location` header whatever the target then returned.
5. **Never from a face.** `StoryOrigin` still has no face-derived value by construction.

Nothing in the module's hard-locked constraint list was relaxed. One thing got **stricter** — see the consent stamp below.

### 🔑 The gate had no handle, and the feature would have been correct and permanently empty

`person_story_items.consented_at` had **no writer for photo/clip rows**, ever. The schema comment said it "may be NULL" for media and the assembly flow duly never set it, so every media row carried NULL forever. Fine for a person's own private archive; fatal for the one column that says *"this co-presence may be shown publicly."* The public read requires the stamp, so without a writer it would have returned nothing on every input — indistinguishable from a broken query. That is the fifth gate-with-no-handle in this codebase.

`multiHomePapicItem` now stamps `consented_at` **only when the tagged guest's `guests.photo_consent` is exactly `true`**. NULL or missing reads as *no* — fail closed. The row is still written when consent is false, so the person keeps the item in their **own** story; it simply can never surface on anybody else's page. Stricter, never looser.

### ⚠ It is a client island because the page is ISR-cached

`app/u/[userSlug]/page.tsx` sets `revalidate = 60`, and its own comments record that the signed-in-holder probe is "the ONLY branch that reads auth, so the opted-in public render stays cacheable." A per-**viewer** answer rendered into that body would be cached and then served to a **different** visitor — one person's shared days shown to a stranger, which is the worst available failure for this particular feature. So it resolves after hydration through a server action, exactly like the Follow button, and the cached HTML stays identical for everyone. The viewer is taken from the session and never from an argument.

Zero shared days renders a **written invitation**, never a `0` — a count of zero on somebody's memories reads as a rebuke, and the sentence is also where the rule gets explained. Signed-out, your own profile, or flag-off render **nothing at all**.

### ⚠ RLS is a floor, not a scope — this read is deliberately admin-client

`person_story_items`' only policy is `is_admin() OR the person is claimed by auth.uid()`. A viewer's own session can never see the other person's rows, so the intersection would always be empty — and prod has an account that **is** an admin (the owner's), for whom that policy matches every row in the table. A read leaning on RLS would be correctly scoped for everyone except the one person most likely to look. Same trap as the vendor correction-requests card. Every scope is therefore applied by hand in the resolver, and a test asserts the filters are actually there.

Every read failure returns `[]`. This is a disclosure surface; an error must never widen it.

### ⚖ The authority is recorded as what it was

The owner ruled *"allow it. unblock it."* on 2026-08-13. Three docblocks and the table's own `COMMENT` said the flow was inert until **"PH counsel signs off AND** the owner sets the flag" — two conditions. The first was discharged by the **owner's own ruling**, which he is entitled to make as the registered DPO (Indalecio Sacdalan Casasola II, NPC-registered 2026-07-07).

**No external PH counsel opinion exists for Phase 2, and nothing now claims one.** Writing "counsel cleared" for a DPO's own decision would hand a future reader the stronger claim to act on. All four sites were corrected **in the same commit** — a correction at one site is not a correction, and this file's own history records that exact failure three times. The applied migration is not edited; migration `20271141323376` replaces the `COMMENT ON TABLE` (what a reader actually queries) and documents `consented_at`'s second job. Minors remain Phase 3 and genuinely counsel-gated.

### 🛡 Guards, and the proof they can fail

`lint-server-only-boundary.mjs` gains `EXTRA_BOUNDARY_MODULES`, declaring `lib/person-life-stories.ts` a boundary no `'use client'` file may value-import at any depth — it now reads a two-person intersection through the service-role client. Declared there rather than via `import 'server-only'` because `server-only` is a Next **bundler alias** with no installed package in this workspace: adding it makes the module unloadable under `tsx --test`. Measured — of the repo's 171 server-only modules, **zero** have a co-located unit test. A privacy rule that cannot be unit-tested is the worse trade.

**⚠ A REAL FINDING, DELIBERATELY NOT FIXED HERE.** Adding `lib/supabase/admin.ts` itself to that list was tried and reports **23 pre-existing** client→…→service-role chains (`reveal-config`, `entitlements`, `promo-free-windows`, `papic-cameras`, `live-studio-*`, `v2-catalog`). They compile today because the bundler drops the unused edge, so it is latent risk, not a live leak — but 23 findings landed as a baseline is a bill nobody pays, and a guard that cries wolf 23 times teaches you to skim past the one time it is right. It needs its own PR.

Every guard was mutation-tested with **occurrence counts printed before → after**, because an unmeasured mutation proves nothing:

- Boundary lint: green → sabotage lands (0 → 1 import) → **red** → restored (1 → 0) → green.
- Five sabotages of the rule (drop the live check · drop the consent check · turn the intersection into a union · drop the resolver's explicit filters · drop the flag gate): each landed 1 → 0 and each turned the suite **red** (21 pass → 14/17/12/20/19).
- Three sabotages of the SQL predicate in the db test: each landed and each went **red**.

### 📉 Seeded, because there is nothing real to test against

Measured in prod 2026-08-13: `person_story_items` **0 rows**, **0** consented, **0** guests linked to a person, 14 Papic photos (all on the owner's own event), **1** account with a public profile. A "verified against production" claim here would be a false green — the query returns nothing for the same reason a broken one would. `tests/db/mutual-story-days.db.test.ts` therefore seeds two accounts and a shared event against the real replayed schema. **No test data was written to the production database.**

Two facts fell out of that seeding and are now recorded rather than assumed: **signing up already mints the person node** (`people.claimed_by_user_id` is UNIQUE; prod: 9 accounts, 9 claimed people, **0** without one — so the resolver's one-person-per-account lookup is a fact, not a guess), and a seeded wedding must carry `ceremony_type` + `venue_setting` together or the CHECK refuses it.

Totals: **7934 unit tests pass**, 5 seeded db tests pass, both Ugat map guards pass, all 24 lint guards pass, typecheck clean.

### ⚠ THE OWNER HAS ALREADY SET THE VARIABLE — so this goes LIVE on merge

The owner reported `NEXT_PUBLIC_PERSON_LIFE_STORIES=1` set in Vercel on 2026-08-13. **This PR does not set it and never touched it**; the value is his, in the Vercel project, not in this repo. Two consequences worth stating plainly rather than discovering later:

1. **It inlines at BUILD time.** The value only reaches the running app through a rebuild — the merge deploy supplies that. A variable set without a rebuild changes nothing, and `'true'` would read as OFF; only the exact string `1` switches it on.
2. **The both-visible rule stops being theoretical the moment this merges.** What makes that safe today is arithmetic, not optimism: production holds **0** story items and **0** consented rows, so the intersection is empty for every pair of accounts that exists. A signed-in visitor on somebody else's profile sees the written invitation and nothing more. The first real shared day cannot appear until an event has consented, tagged participants — which requires the Papic assembly flow to run against a public event with linked guests.

⏭ After the deploy, the honest check is behavioural (two accounts, one shared public event) rather than reading the bundle: the flag is now consumed **server-side only**, so it does not appear in the client JavaScript and cannot be confirmed the way `NEXT_PUBLIC_PLAN3D_SHARED_ROOM` was.

SPEC IMPACT: `DECISION_LOG.md` — new row for the 2026-08-13 owner/DPO ruling unblocking Phase 2 life stories, recorded as a DPO decision and explicitly **not** as counsel clearance, plus the both-visible rule and the `consented_at` second job. `REDESIGN_SESSIONS_2026-08-12.md` + the corpus `CLAUDE.md` active block — Session 9 done, 10 left.
