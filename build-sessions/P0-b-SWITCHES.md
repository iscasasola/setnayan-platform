# P0-b · WHICH SWITCHES ARE ON IN PRODUCTION

**Measured 2026-08-30** against the Vercel **Production** environment of
`setnayan-platform-web` (`prj_7VTNk7sj…`, team `icasa-offroad`) and against the
code at `origin/main @ 0d0b265ba`, which is the commit the live production
deployment (`dpl_J9JNbXgNS2z6GWbrxYx1uSe3grVr`, READY, target `production`) was
built from. 109 project environment variables, 101 of them boolean switches.

**Why this file exists.** `CLAUDE.md`: *"A FLAG'S DEFAULT IN CODE IS NOT ITS
VALUE IN PRODUCTION."* A session that reads `defaults OFF` in a docblock and
writes "off in production" into a plan is guessing. Every row below is the value
Vercel holds, paired with what that flag's own reader accepts as ON — because
those two disagree more often than anyone expects.

⚠ **This file rots.** Any flag flip in the Vercel dashboard makes a row false
with no signal here. Re-measure before acting on a row that decides something
(§0). Reader paths carry line numbers as of `0d0b265ba` — **grep the flag name,
never the line number.**

---

## 0 · HOW TO RE-MEASURE (5 minutes, needs the owner's Vercel login)

```bash
cd ~/Documents/Claude/Projects/setnayan-platform     # the linked checkout
vercel env ls production                              # names + which env + age
vercel env pull /tmp/prod.env --environment=production --yes && \
  grep -E '^(NEXT_PUBLIC_[A-Z_]+|[A-Z_]+_ENABLED|[A-Z_]+_GATE)=' /tmp/prod.env
rm -f /tmp/prod.env                                   # ⚠ it contains live secrets
```

🛑 **`vercel env pull` returns an EMPTY VALUE for a variable Vercel marks
`sensitive`, and empty is indistinguishable from "set to nothing".** 47 of this
project's variables are sensitive; on this project that is every credential
**plus** `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_PLAN3D_BOOTH_ADS`, `NEXT_PUBLIC_PILOT_MODE_FREE_UNTIL` and
`NEXT_PUBLIC_FACE_MODEL_URL`. Separate the two cases with the project's env API,
which reports each variable's `type`:

```bash
TOKEN=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/Library/Application Support/com.vercel.cli/auth.json')))['token'])")
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v9/projects/prj_7VTNk7sjPejgXNsSkZsyiPQRLnwA/env?teamId=team_dHILOMWD1LWoDGDT5udD8JV5" \
  | python3 -c "import json,sys;[print(e['type'],e['key']) for e in json.load(sys.stdin)['envs']]" | sort
```

A `sensitive` value cannot be read back by anyone, including the owner — it can
only be overwritten. For those, this register records **presence, not value**.

---

## 1 · THE SEVEN THIS TASK WAS OPENED FOR

| Switch | Prod value | Reader accepts as ON | **In production** |
|---|---|---|---|
| `NEXT_PUBLIC_DEPENDENT_PEOPLE` | `1` | `1` only | 🔴 **ON** |
| `NEXT_PUBLIC_PEOPLE_CONNECTIONS` | `1` | `1` only | 🔴 **ON** |
| `NEXT_PUBLIC_LIFE_STORY` | *empty string* | `1` only | **OFF** |
| `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED` | `true` | `true`·`1`·`yes`·`on` | **ON** |
| `NEXT_PUBLIC_SMART_SORT_ENABLED` | `true` | `true`·`1`·`TRUE` | **ON** |
| `NEXT_PUBLIC_BOOKING_FEE_ENABLED` | `true` | `true`·`1`·`TRUE` | **ON** |
| `SUPPLIER_NIGHT_BEFORE_EMAIL_ENABLED` | `true` | `true` only | **ON** |

Two more that the same sessions will reach for:

| Switch | Prod value | **In production** | Note |
|---|---|---|---|
| `NEXT_PUBLIC_PERSON_LIFE_STORIES` | `1` | **ON** | the Phase-2 life-story gate |
| `NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE` | not set | **OFF** | fee computed, **no rail collects it** |
| `PABUYA_PUBLIC_ROUTE_ENABLED` | not set | **OFF** | answers NPC task `t1-7` (below) |

🔑 **`NEXT_PUBLIC_LIFE_STORY` exists in the dashboard and does nothing.** It is
the project's only `plain`-type variable and its value is the empty string, so
`lifeStoryEnabled()` (`=== '1'`) returns false. In `vercel env ls` it looks
exactly like the switches that are on. **Presence is not value.**

---

## 2 · THE FINDING THAT CHANGES C1 AND C4

**Both counsel-gated People flags are ON in production**, and the code says they
are off. Not one comment — four, plus both session prompts:

* `apps/web/lib/dependent-people-flag.ts` — *"INERT in production and stores /
  surfaces NO dependent data until the DPO/counsel batched review (G1) clears it
  and the owner sets `NEXT_PUBLIC_DEPENDENT_PEOPLE=1`"*. **It is set to `1`.**
* `apps/web/app/dashboard/(launcher)/page.tsx` — *"while
  `NEXT_PUBLIC_DEPENDENT_PEOPLE` is off (production today)"*. **It is on.**
* `apps/web/app/dashboard/[eventId]/vendors/_components/trusted-circle-badge.tsx`
  — *"`NEXT_PUBLIC_PEOPLE_CONNECTIONS !== '1'` — the production default"*, and
  `…/workspace/page.tsx` — *"production-inert"*. **Neither is true now.**
* `build-sessions/C1.md` and `build-sessions/C4.md` both open their gate section
  with *"defaults OFF and is COUNSEL-GATED"*. The default is off; **production is
  not the default.**

**What is actually live:** the dependants surface (a dependant may be a child,
carrying birthdate / sex / religion — RA 10173 sensitive PI + minors) and the
whole suggest→confirm connections flow. Measured the same hour on prod Supabase
(`njrupjnvkjkitfctetvi`): `dependents` **0 rows**, `person_connections` **0
rows**. **Nobody has used them — that is not the same as nobody being able to.**
C1's note *"Production held ZERO person_connections … which may mean the switch
is off"* is answered: **the switch is ON; the table is empty because nobody has
used it.**

🔑 **Consequences that are engineering's to act on**
* C1 and C4 are **unblocked**, and their "build behind the flag, defaulted off"
  instruction now means **building behind a flag that is live to real users**.
  Autonomy rule 12 does not apply — the answer exists; it is this row.
* Anything either session ships behind these flags **reaches production the
  moment it merges.** Ship-dark is not what is happening here.

🔑 **Consequences that are the owner's, not engineering's**
* `apps/web/lib/npc-filing-tasks.ts` task `t1-7` — *"Confirm whether
  `NEXT_PUBLIC_DEPENDENT_PEOPLE` and `PABUYA_PUBLIC_ROUTE_ENABLED` are ON in
  production. If ON, add the live SPI + minors and financial-PI processing
  activities to the RoPA."* **Now answered: DEPENDENT_PEOPLE is ON, PABUYA is
  OFF.** The RoPA edit is owed for the minors/SPI half.
* **Was the G1 DPO/counsel review actually cleared before these were flipped?**
  This register cannot tell — only that they are on. If the answer is no, the
  decision is whether to switch them back off or to complete the review. That is
  an owner call and is **flagged, not resolved here.**

---

## 3 · ELEVEN SWITCHES NOBODY SET THAT ARE ON ANYWAY

These readers are written `!== 'false'` — a **kill switch**, not a feature flag.
Absent from Vercel means **ON**. Every one of them is absent from Vercel.

| Switch | What runs because it is unset | Reader |
|---|---|---|
| `PAPIC_FULLRES_DROP_ENABLED` | the full-res **deletion** job | `lib/papic-fullres-drop.ts` |
| `PAPIC_DROP_REQUIRE_WARN` | that job's warn-first requirement | `lib/papic-fullres-drop.ts` |
| `FACE_DATA_RETENTION_ENABLED` | face-data retention expiry | `lib/face-data-retention.ts` |
| `VENDOR_IDENTITY_RETENTION_ENABLED` | vendor identity-doc retention expiry | `lib/vendor-identity-retention.ts` |
| `BUDGET_BUILD_ENABLED` | the budget builder | `lib/budget-build.ts` |
| `NEXT_PUBLIC_SEATING_3D` | the 3D seating room | `lib/seating-3d-flag.ts` |
| `NEXT_PUBLIC_NAMED_CALENDARS_ENABLED` | named vendor calendars | `lib/vendor-schedule.ts` |
| `NEXT_PUBLIC_SERVICE_WIZARD_ENABLED` | the service wizard | `app/vendor-dashboard/services/_components/services-manager.tsx` |
| `NEXT_PUBLIC_VENDOR_EXPERIENCE_ENABLED` | vendor experience surface | `lib/vendor-experience.ts` |
| `NEXT_PUBLIC_BUNDLE_NUDGE_ENABLED` | the bundle nudge in the inquiry composer | `app/v/[slug]/_components/inquiry-composer.tsx` |
| `NEXT_PUBLIC_WEBSITE_MENU_ENABLED` | the couple-site menu bar (**set** to `true`, but on either way) | `app/[slug]/_lib/site-menu.ts` |

⚠ **Never run a kill switch through `envFlagEnabled()`.** `lib/env-flag.ts` says
so itself: that reader is fail-CLOSED, so converting one of these **inverts its
default** and silently switches the feature off.

---

## 4 · WHAT CANNOT BE READ FROM A SESSION AT ALL

47 variables are Vercel-`sensitive` (write-only). This register records that they
**exist in Production**, nothing more. The ones a session is likely to ask about:

| Variable | Present in Production | Why it matters |
|---|---|---|
| `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` · `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ all three, created 80d ago | **C8's gate** — the keys exist; whether the public/private pair actually matches cannot be read, only tested by sending a push |
| `RESEND_API_KEY` | ✅ | with it unset, every email and the daily digest send **nothing, silently** |
| `CLOUDFLARE_TURN_KEY_ID` · `CLOUDFLARE_TURN_API_TOKEN` | ✅ | the Panood TURN faucet |
| `YOUTUBE_OAUTH_CLIENT_ID` · `_SECRET` · `_REDIRECT_URI` | ✅ | **P0-a** — the creds are in place; the missing half is the re-authorisation, not the config |
| `R2_*` (6) · `SUPABASE_SERVICE_ROLE_KEY` · `ENCRYPTION_KEY` · sentry/posthog/meta/IG/google/openai/anthropic keys | ✅ | credentials — presence only |

---

## 5 · SET IN PRODUCTION, READ BY NOTHING

Six variables exist in Production with **no reader anywhere in the repo**
(verified by textual search across `apps/ packages/ supabase/ scripts/ .github/`
at `0d0b265ba`, not only by `process.env.X` grep):

`NEXT_PUBLIC_NEW_FRONT_DOOR` · `NEXT_PUBLIC_PILOT_MODE_FREE_UNTIL` ·
`GOOGLE_OAUTH_CLIENT_ID` · `R2_BUCKET_SAMPLES` · `R2_BUCKET_THREAD_FILES` ·
`R2_BUCKET_VENDOR_CONTRACTS`

Four more have no `process.env` read, only prose mentions —
`NEXT_PUBLIC_COORDINATOR_P3_ENABLED` · `NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED` ·
`NEXT_PUBLIC_LEAD_TOKEN_HOLD_ENABLED` · `NEXT_PUBLIC_SCHEDULE_ROS_P2_ENABLED` —
and a `NEXT_PUBLIC_*` variable with no literal `process.env.NAME` read **cannot**
be reached dynamically, because Next inlines those by static analysis of the
literal expression. **Setting any of these ten changes nothing.** Deleting them
is a tidy-up, not a fix; they are listed so the next session does not read one in
the dashboard and conclude a feature is live.

---

## 6 · EVERY BOOLEAN SWITCH

Values are the Production environment's; `Reader` is where the value is turned
into a boolean at `0d0b265ba`.

### A · set in Production
| Switch | Value in Vercel | Reader accepts as ON | In production | Reader |
|---|---|---|---|---|
| `CATEGORY_PROPOSAL_DRAFT_ENABLED` | `true` | `true` | **ON** | `lib/category-proposal-flag.ts:23` |
| `NEXT_PUBLIC_ANON_ONBOARDING_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/anon-onboarding.ts:24` |
| `NEXT_PUBLIC_BOOKING_FEE_ENABLED` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/booking-fee-gate.ts:14` |
| `NEXT_PUBLIC_CANVAS_MAKER_ENABLED` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/canvas-maker-flag.ts:22` |
| `NEXT_PUBLIC_CARD_RECORD_ENABLED` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/card-record-flag.ts:22` |
| `NEXT_PUBLIC_CHAT_CONTACT_FILTER_ENABLED` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/chat-contact-filter-flag.ts:17` |
| `NEXT_PUBLIC_CHAT_NEGOTIATION_V1` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/chat-negotiation-flag.ts:17` |
| `NEXT_PUBLIC_DEPENDENT_PEOPLE` | `1` | `1` | **ON** | `lib/dependent-people-flag.ts:18` |
| `NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED` | `true` | `true` | **ON** | `lib/device-capture-flag.ts:25` |
| `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/experience-quiz.ts:31` |
| `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/explore-replan-flag.ts:16` |
| `NEXT_PUBLIC_INQUIRY_GATE_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/inquiry-gate.ts:33` |
| `NEXT_PUBLIC_LEAD_TRUST_BADGE_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/inquiry-gate.ts:42` |
| `NEXT_PUBLIC_LIFE_STORY` | _empty string_ | `1` | OFF | `lib/life-story-flag.ts:14` |
| `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `app/admin/_components/admin-nav-groups.tsx:397` |
| `NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/lock-handshake-flag.ts:30` |
| `NEXT_PUBLIC_MONOGRAM_STUDIO_V2` | `1` | `1`·`true` | **ON** | `lib/monogram-studio/flag.ts:16` |
| `NEXT_PUBLIC_OAUTH_APPLE_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `app/_components/oauth-button-row.tsx:111` |
| `NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `app/_components/oauth-button-row.tsx:140` |
| `NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `app/_components/oauth-button-row.tsx:110` |
| `NEXT_PUBLIC_ONBOARDING_SERVICES_STEP` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/onboarding/services-step-flag.ts:29` |
| `NEXT_PUBLIC_ONBOARDING_V2_BRIEF_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/onboarding-v2-brief-flag.ts:26` |
| `NEXT_PUBLIC_PACKAGE_AUTHORING` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/package-authoring-flag.ts:16` |
| `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/panood-camera-seats-pure.ts:66` |
| `NEXT_PUBLIC_PAPIC_GAMES_V1` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/papic-games-flag.ts:18` |
| `NEXT_PUBLIC_PAPIC_GUEST_BUY` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/papic-guest-buy-flag.ts:20` |
| `NEXT_PUBLIC_PAPIC_POOL_BAR` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/papic-pool-bar-flag.ts:17` |
| `NEXT_PUBLIC_PAPIC_POOL_GALLERY` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/papic-pool-flag.ts:18` |
| `NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/papic-seats.ts:83` |
| `NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/payment-gated-lock.ts:17` |
| `NEXT_PUBLIC_PEOPLE_CONNECTIONS` | `1` | `1` | **ON** | `lib/people-connections.ts:54` |
| `NEXT_PUBLIC_PERSON_LIFE_STORIES` | `1` | `1` | **ON** | `lib/person-life-stories.ts:112` |
| `NEXT_PUBLIC_PLAN3D_BOOTH_ADS` | _write-only_ | `true`·`1`·`yes`·`on` — any case, trimmed | UNKNOWN | `lib/ghost-booths.ts:26` |
| `NEXT_PUBLIC_PLAN3D_DEMO_ADS` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/demo-booth-rotation.ts:135` |
| `NEXT_PUBLIC_PLAN3D_SHARED_ROOM` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `app/_components/plan3d/use-plan3d-room.ts:41` |
| `NEXT_PUBLIC_REGISTER_GATES_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/register-gates.ts:25` |
| `NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/relationship-workspace-flag.ts:15` |
| `NEXT_PUBLIC_SERVICE_DETAILS_ENABLED` | `1` | `1`·`TRUE`·`true` | **ON** | `lib/service-details-flag.ts:39` |
| `NEXT_PUBLIC_SERVICE_TEXT_INTEGRITY_ENABLED` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/service-text-integrity.ts:39` |
| `NEXT_PUBLIC_SMART_SORT_ENABLED` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/smart-sort-flag.ts:21` |
| `NEXT_PUBLIC_SUITE` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `app/dashboard/[eventId]/studio/page.tsx:98` |
| `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` | `true` | `1`·`true` | **ON** | `lib/vendor-addon-tiered-pricing-flag.ts:14` |
| `NEXT_PUBLIC_VENDOR_AUTOREPLY_V1` | `true` | `1`·`TRUE`·`true` | **ON** | `lib/vendor-autoreply-flag.ts:15` |
| `NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP` | `true` | `1`·`true` | **ON** | `lib/vendor-free-tier-booking-cap-flag.ts:12` |
| `NEXT_PUBLIC_WEBSITE_MENU_ENABLED` | `true` | anything except `false` | **ON** | `app/[slug]/_lib/site-menu.ts:89 (via siteMenuEnabled)` |
| `PROMO_FREE_WINDOWS_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/promo-free-windows.ts:73` |
| `SUPPLIER_NIGHT_BEFORE_EMAIL_ENABLED` | `true` | `true` | **ON** | `lib/supplier-night-before-email-flag.ts:19` |
| `VENDOR_FAVORITES_SUBSCRIPTION_GATE` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/vendor-favorite-gate.ts:46` |
| `VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED` | `true` | `true` | **ON** | `lib/vendor-signup-coverage-suggest-flag.ts:32` |
| `WEBSITE_PHASES_ENABLED` | `true` | `true`·`1`·`yes`·`on` — any case, trimmed | **ON** | `lib/invitation-widgets.ts:421` |

Hand-checked additions the classifier could not read (their reader compares to a
non-boolean string in the same window): none set in Production.

### B · read by the code, NOT set in Production — running on the code default

| Switch | Reader accepts as ON | Unset ⇒ | Reader |
|---|---|---|---|
| `BUDGET_BUILD_ENABLED` | anything except `false` | **ON** | `lib/budget-build.ts:168` |
| `CSAM_HASH_MATCH_ENABLED` | `true` | OFF | `lib/known-hash-match-flag.ts:23` |
| `FACE_DATA_RETENTION_ENABLED` | anything except `false` | **ON** | `lib/face-data-retention.ts:75` |
| `FEATURE_ACCOUNT_AUTOSURFACE` | `1` | OFF | `lib/account-autosurface-flag.ts:9` |
| `GUEST_COLUMNS_ENABLED` | `1`·`true` | OFF | `lib/guest-columns.ts:24` |
| `GUEST_QR_SELF_ROTATE` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `app/[slug]/rotate-qr-actions.ts:56` |
| `GUEST_SESSION_TOKEN_CHECK` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/guest-session.ts:31` |
| `NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED` | `true` | OFF | `lib/account-face-profile.ts:39` |
| `NEXT_PUBLIC_BAZI_BIRTHDATA_ENABLED` | `1`·`on`·`true` | OFF | `lib/bazi-birthdata.ts:36` |
| `NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE` | `1`·`TRUE`·`true` | OFF | `lib/booking-fee-gate.ts:25` |
| `NEXT_PUBLIC_BOOTH_STUDIO_ENABLED` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/booth-studio-flag.ts:23` |
| `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED` | `1`·`TRUE`·`true` | OFF | `lib/budget-truth-flag.ts:20` |
| `NEXT_PUBLIC_BUNDLE_NUDGE_ENABLED` | anything except `false` | **ON** | `app/v/[slug]/_components/inquiry-composer.tsx:344` |
| `NEXT_PUBLIC_CAMERA_BRIDGE_ENABLED` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `app/papic/seat/[token]/page.tsx:39` |
| `NEXT_PUBLIC_COORDINATOR_PROPOSE_LOCK_ENABLED` | `1`·`TRUE`·`true` | OFF | `lib/coordinator-propose-lock.ts:20` |
| `NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED` | `1`·`TRUE`·`true` | OFF | `lib/vendor-working-notes.ts:118` |
| `NEXT_PUBLIC_FIGURE_CHIBI` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/chibi-config.ts:47` |
| `NEXT_PUBLIC_GUEST_NOW_TRIGGER` | `1`·`true` | OFF | `lib/guest-now-trigger.ts:18` |
| `NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/live-studio-pool-only.ts:71` |
| `NEXT_PUBLIC_NAMED_CALENDARS_ENABLED` | anything except `false` | **ON** | `app/vendor-dashboard/calendar/surface.tsx:214` |
| `NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `app/layout.tsx:706` |
| `NEXT_PUBLIC_PACKAGE_CREDIT` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/package-credit-flag.ts:28` |
| `NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/panood-camera-seats-pure.ts:51` |
| `NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `app/v/[slug]/page.tsx:816` |
| `NEXT_PUBLIC_PLAUSIBILITY_SCANNER_ENABLED` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/plausibility-scanner-flag.ts:25` |
| `NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED` | `1`·`TRUE`·`true` | OFF | `lib/reusable-bookings.ts:26` |
| `NEXT_PUBLIC_SEATING_3D` | anything except `false` | **ON** | `app/dashboard/[eventId]/seating/lab/page.tsx:70` |
| `NEXT_PUBLIC_SERVICE_WIZARD_ENABLED` | anything except `false` | **ON** | `app/vendor-dashboard/services/_components/services-manager.tsx:487` |
| `NEXT_PUBLIC_STD_REVEAL` | `1` | OFF | `app/[slug]/_components/reveal/reveal-overlay.tsx:97` |
| `NEXT_PUBLIC_STEWARDED_ACCOUNTS` | `1` | OFF | `lib/stewarded-accounts.ts:39` |
| `NEXT_PUBLIC_TABLE_RESERVATIONS_ENABLED` | `1`·`true` | OFF | `lib/slot-seat-reservations-flag.ts:17` |
| `NEXT_PUBLIC_U_NESTING_CUTOVER` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/public-event-url.ts:34` |
| `NEXT_PUBLIC_VENDOR_ADDON_FIRST5_FREE` | `1`·`true` | OFF | `lib/vendor-addon-first5-free-flag.ts:18` |
| `NEXT_PUBLIC_VENDOR_AI_LADDER` | `1`·`true` | OFF | `lib/vendor-ai-ladder-flag.ts:24` |
| `NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH` | `1`·`TRUE`·`true` | OFF | `lib/vendor-voice-match-flag.ts:27` |
| `NEXT_PUBLIC_VENDOR_EXPERIENCE_ENABLED` | anything except `false` | **ON** | `lib/vendor-experience.ts:39` |
| `NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED` | `1`·`true` | OFF | `lib/vendor-free-transport-flag.ts:32` |
| `NEXT_PUBLIC_VENDOR_LAUNCH_FREE_WINDOW` | `1`·`true` | OFF | `lib/vendor-launch-free-window-flag.ts:12` |
| `NEXT_PUBLIC_VENDOR_SEO_TIER_GATE` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/vendor-seo-tier-flag.ts:27` |
| `NEXT_PUBLIC_VERIFIED_MEDIAN_ENABLED` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/verified-median-flag.ts:28` |
| `PABUYA_PUBLIC_ROUTE_ENABLED` | `1`·`true` | OFF | `lib/egift.ts:55` |
| `PAPIC_CLIP_DROP_ENABLED` | `true` | OFF | `lib/daily-email-jobs.ts:467` |
| `PAPIC_DROP_REQUIRE_WARN` | anything except `false` | **ON** | `lib/papic-fullres-drop.ts:224` |
| `PAPIC_FULLRES_DROP_ENABLED` | anything except `false` | **ON** | `lib/papic-fullres-drop.ts:192` |
| `PUBLIC_API_ENABLED` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/public-api-flag.ts:24` |
| `SETNAYAN_AI_PAYWALL_ENABLED` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `app/admin/integrations/page.tsx:105` |
| `VENDOR_GUEST_DELIVERY_ENABLED` | `1` | OFF | `lib/vendor-dayof-flags.ts:24` |
| `VENDOR_IDENTITY_RETENTION_ENABLED` | anything except `false` | **ON** | `lib/vendor-identity-retention.ts:60` |
| `VENDOR_PAPIC_CAPTURE_ENABLED` | `1` | OFF | `lib/vendor-dayof-flags.ts:18` |
| `VENDOR_TIER_FEATURE_GATE` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/vendor-feature-gate.ts:29` |
| `VENDOR_TIER_SEARCH_GATE` | `true`·`1`·`yes`·`on` — any case, trimmed | OFF | `lib/vendor-search-gate.ts:24` |
| `SETNAYAN_DEMO_MODE` | `1` | OFF | `app/api/v1/billing/initialize-maya/route.ts:39` |
| `ALLOW_DEMO_CAPTURE` | `1` | OFF | `app/demo-capture/[slug]/page.tsx:18` |

---

## 7 · THE TRAPS THIS MEASUREMENT HIT

1. **`vercel env pull` returns `""` for a `sensitive` variable.** 60 of 129
   pulled lines were empty; only **one** of them (`NEXT_PUBLIC_LIFE_STORY`) is
   genuinely empty. `NEXT_PUBLIC_SUPABASE_URL` came back empty on a site that
   demonstrably works — that implausibility is what exposed the trap. **Suspect
   the check before the project.**
2. **A three-line window around `process.env.X` mis-reads the reader.** The first
   pass reported `NEXT_PUBLIC_MONOGRAM_STUDIO_V2` and
   `NEXT_PUBLIC_SERVICE_DETAILS_ENABLED` as set-but-inert (`1` against a `'true'`
   reader). Both readers accept `1`; the window had caught a neighbouring
   comparison. **Two false findings, killed by opening the file.** Every
   remaining mismatch candidate was hand-opened; there are none.
3. **A `process.env.X` grep does not find dynamic reads.** `YOUTUBE_OAUTH_*` and
   `GOOGLE_DRIVE_OAUTH_*` first looked orphaned; they are read through
   `lib/integrations/registry.ts`, which stores the variable **name** in a
   `clientIdEnv` field. §5's list is textual-occurrence based for that reason.
4. **A flag's ON vocabulary is per-flag.** `true` alone, `1` alone, `1`/`true`,
   `1`/`true`/`TRUE`, and `envFlagEnabled`'s `true`·`1`·`yes`·`on` all appear
   above. `NEXT_PUBLIC_LIFE_STORY=true` would **not** turn the life story on.
   Column 3 of every table is the accepted set — read it before flipping.

---

## 8 · WHAT THIS UNBLOCKS

| | Status |
|---|---|
| **C1** (family tree) | **UNBLOCKED** — `NEXT_PUBLIC_PEOPLE_CONNECTIONS` is **ON**; anything it ships is live on merge |
| **C4** (business record) | **UNBLOCKED** — `NEXT_PUBLIC_DEPENDENT_PEOPLE` is **ON**; same warning |
| **C8** (notifications) | VAPID trio present in Production; the pair cannot be verified by reading, only by sending |
| **NPC `t1-7`** | answered — DEPENDENT_PEOPLE ON, PABUYA OFF; the RoPA entry is owed |
| **Owner decision** | was G1 (DPO/counsel) cleared before the two People flags were switched on? Flagged, not resolved. |
