# FINAL CHECK KIT — the staging copy, the 8 checkers, one checklist

> Owner, 24 Nov 2026: once all coding is finished, **8 cloud sessions check a STAGING copy at the same time**, split
> by area, and report every error. Fixes follow in groups, one builder per area, then one final live walk with the
> owner signed in. This file is the whole kit: what the controller runs, what each checker opens, the one checklist,
> and the one findings format.
>
> **Nothing in this kit creates anything by itself.** The controller creates the paid database branch and the
> preview, on the day, by running the steps in § 2. Every script refuses production before it reads or writes a row.
>
> Built in PR #8281 (`scripts/staging/*`, `apps/web/lib/staging-locks.ts`). Proven on every pull request by
> `apps/web/tests/db/the-staging-seed-runs-clean.db.test.ts` (the seed and the catalogue copy on the replayed
> schema), `apps/web/lib/staging-locks.test.ts`, `apps/web/lib/staging-r2-confine.test.ts` and
> `apps/web/lib/staging-kit.test.ts`.

---

## 1 · What keeps the copy harmless — the five locks

A process started with **`STAGING=1`** is held by five locks. Each is one rule in `apps/web/lib/staging-locks.ts`,
wired into the ONE place every call of its kind goes through, and each has a guard test.

| Lock | What it guarantees on the copy | Where | Set on the preview |
|---|---|---|---|
| **(a) Email** | Every email reaches only the allowlisted test inbox — the real recipient is masked into the subject — or is dropped and logged "not configured". It never reaches the address it was given. | `sendEmail` in `lib/email.ts` | `STAGING_EMAIL_SINK=<one test inbox>` (unset ⇒ every email dropped) |
| **(b) Payments** | Test money only: a Maya endpoint that is not Maya's sandbox is real money, so its keys are refused and the Maya rail reads as closed. | `resolveMayaConfig` in `lib/integration-config.ts` | Maya SANDBOX keys, or none |
| **(c) Hidden** | Every non-production build answers `X-Robots-Tag: noindex, nofollow` on every path — never on setnayan.com, whatever `VERCEL_ENV` says. | `next.config.ts` `headers()` | nothing (automatic on a preview) |
| **(d) Storage** | Every R2 object key — PUT, DELETE, COPY, batch delete, multipart, presigned URL — is confined under `STAGING_R2_PREFIX`; a bucket-level write throws. No valid prefix ⇒ R2 is OFF. A staging copy can never write or delete a live object. | `getR2Client` in `lib/r2.ts` (an SDK middleware, `lib/staging-r2-confine.ts`) | `STAGING_R2_PREFIX=staging/final-check/` + R2 keys, **or** no R2 keys at all |
| **(e) Flags** | Staging runs production's VALUES, not code defaults — and the names that would make a copy act on something real are never set. | `scripts/staging/flags.ts` | the commands it prints |

**What (d) means for pictures (say this to the checkers):** with a prefix, what a checker uploads lands under the
prefix and shows. A picture production stored before the copy (a catalogue or library key) is drawn from the prefix
too and may not show — a staging artefact. Server reads of the public media bucket fall back to the live object.

**Two more safety rails, in the database:** `scripts/staging/seal.sql` (run by the seed, first) switches every
`pg_cron` job off on the copy, and refuses to go on if the chat notify webhook could reach production (its secret
set while its URL is unset or names setnayan.com). And the seed itself refuses a database that holds real people.

---

## 2 · Controller steps — in this order, on the day

> 🔑 **Before ANY command that writes, run `seed.ts --dry-run` with the same URLs.** It prints the project ref and
> refuses production. Production's ref is `njrupjnvkjkitfctetvi`; if you see it anywhere in a staging variable, stop.
> **Never paste a password, key or the bypass secret into GitHub — this repository is public.**

**0 · Pin the commit.** Everything coded is merged. `curl -sL https://setnayan.com/api/health` names the commit
production runs; the staging preview is built from `main` at or after it.

**1 · Create the branch (the paid part — it bills by the hour while it exists, so step 11 deletes it).** A Supabase preview
branch of the production project (dashboard → Branches, or the MCP `create_branch`). Record, in a password manager
and nowhere else: the branch's project ref, its database URL (pooler, port 5432), its API URL, its anon key and its
service key. **The branch has its own ref — check it is not `njrupjnvkjkitfctetvi`.**

**2 · Migrations.** A new branch applies the repository's migrations itself. Confirm it holds every file in
`supabase/migrations` (`list_migrations` on the BRANCH). If it does not, apply them **to the branch's database URL
only**, never production's: `supabase db push --db-url "$STAGING_DB_URL" --include-all`.

**3 · Copy the catalogue (before the seed, so the seed's orders carry production's prices).** Production is read
through `scripts/lib/read-only-db.mjs` only — one SELECT at a time, in a read-only transaction, on a read-only
session. Twenty admin tables, each with its reason (`scripts/staging/copy-catalog-core.ts`); a table that points at
a person, a shop or an event is refused; admin audit stamps land as NULL; staging keeps its sandbox Maya endpoint.

```bash
STAGING=1 PROD_READ_DB_URL='<a read-only connection to production>' STAGING_DB_URL='<the branch database URL>' pnpm exec tsx scripts/staging/copy-catalog.ts --dry-run
```

Then the same line without `--dry-run`. The staging side lands in one transaction: every table or none.

**4 · Seed.** Creates the 10 test sign-ins through the branch's admin API with generated passwords, writes them to
`scripts/staging/accounts.local.json` (git-ignored, mode 600) BEFORE anything else can fail, seals the database,
then runs `seed.sql` in one transaction. Shape of the file: `scripts/staging/accounts.example.json`.

```bash
STAGING=1 STAGING_DB_URL='<branch database URL>' STAGING_SUPABASE_URL='https://<branch-ref>.supabase.co' STAGING_SERVICE_ROLE_KEY='<the BRANCH service key>' pnpm exec tsx scripts/staging/seed.ts --dry-run
```

Then without `--dry-run`. Optional: `STAGING_COVER_URL='https://…'` (one picture for every seeded card) and
`--plus-sink` (sign-ins become `<sink>+<account>@…` instead of `@final-check.test`, if the branch's Auth refuses the
`.test` domain). Expected output: `9 events · 1,056 guests · 15 shops · 36 cards · 29 bookings · 28 chats
(182 messages) · 62 tables (256 seated) · 8 orders · 9 payments` (the CI proof's numbers).

**5 · Branch Auth settings.** Supabase → the branch → Authentication → URL configuration: Site URL and redirect
URLs = the preview address (step 7). Leave email confirmation as it is — the seed confirms its own sign-ins.

**6 · Flags (lock e).**

```bash
VERCEL_API_TOKEN='<read token>' VERCEL_PROJECT_ID='<project>' pnpm exec tsx scripts/staging/flags.ts --branch preview/final-check --out /tmp/final-check-flags.md
```

It lists all 102 `NEXT_PUBLIC_*` switches and every server name in three groups: **copy production's value**
(printed with the exact `vercel env add … preview preview/final-check` command), **staging's own value** (the
database, the keys, the addresses — with what to set), and **NEVER on staging**. Without a token it prints the same
list as READ BY HAND rows. It sends GETs only and never prints a value that is not public or switch-shaped.

**7 · The preview's environment** — Vercel → Settings → Environment Variables → **Preview, git branch
`preview/final-check`** (branch-scoped, so no other preview changes). A branch value overrides the general Preview
value, so **check the general Preview list too: any secret it carries that is not overridden here reaches the copy.**

| Set | Value |
|---|---|
| `STAGING` | `1` |
| `STAGING_EMAIL_SINK` | one test inbox you own (or leave unset — every email is then dropped) |
| `STAGING_R2_PREFIX` | `staging/final-check/` (with R2 keys), or no R2 keys at all |
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_URL` | the BRANCH's — production's would make the copy write to PRODUCTION |
| `ENCRYPTION_KEY` · `CRON_SECRET` · `INTERNAL_WORKER_SECRET` · `OAUTH_REFRESH_CRON_SECRET` · the hash salts | fresh values for staging |
| `NEXT_PUBLIC_APP_URL` · `NEXT_PUBLIC_SITE_URL` · `SITE_URL` | the preview address |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` · `TURNSTILE_SECRET_KEY` | Cloudflare's always-pass TEST pair |
| Maya | sandbox keys, or none |
| everything in the flags checklist's "copy" groups | production's value, via the printed commands |

| **NEVER on the preview** | Why |
|---|---|
| `VERCEL_API_TOKEN` · `VERCEL_PROJECT_ID` · `VERCEL_TEAM_ID` | `/admin/secrets` writes env vars to the PRODUCTION project and redeploys it |
| `META_*` · `IG_*` · `TIKTOK_ACCESS_TOKEN` | the social sweep rides admin page loads and would post to Setnayan's real accounts |
| `GSC_*` · `GOOGLE_SITE_VERIFICATION` · `BING_SITE_VERIFICATION` | production's search ownership |
| `PAPIC_FULLRES_DROP_ENABLED=true` · `PAPIC_CLIP_DROP_ENABLED` · `CSAM_HASH_MATCH_ENABLED` | irreversible sweeps / a contract-gated hook — set the drop to `false` |
| production's `SENTRY_DSN` · `VAPID_PRIVATE_KEY` · `RESEND_API_KEY` without a sink | production's alerts, push and mail |

Then build the preview: push `main` (at the pinned commit) to the branch **`preview/final-check`** — only
`preview/*` branches build a Vercel preview.

**8 · Protect it.** Keep Vercel's preview protection on. Create a **Protection Bypass for Automation** secret and
hand each checker the address
`https://<preview>/?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true` (it sets a cookie, so the
rest of the walk needs no secret). Lock (c) keeps it out of search engines regardless.

**9 · Prove the locks on the real preview (the parts CI cannot prove — § 7):**

```bash
curl -sI https://<preview>/ | grep -i x-robots-tag        # → noindex, nofollow
curl -sL https://<preview>/api/health                      # → the pinned commit, env "preview"
```

Send one chat message as `couple_plan` and confirm in `/admin/email-delivery` (as `admin`) that it went to the sink
or was logged "not configured". Upload one photo and confirm the object sits under `staging/final-check/` in R2.
Open `/admin/integrations` and confirm Maya shows sandbox or closed.

**10 · Hand out.** Each checker gets, privately (never on GitHub): the bypass address, **their own row** of
`accounts.local.json`, their area's route list (§ 4 — or today's list from
`pnpm exec tsx scripts/staging/areas.ts --area <n>`), and §§ 5–6 of this file.

**11 · After.** Delete the branch (billing stops), remove the `preview/final-check` variables, delete the R2
prefix, delete `accounts.local.json`.

---

## 3 · What the seed made, per area

| Area | Sign in as | What is waiting |
|---|---|---|
| 1 · Front door | (signed OUT) · `front` is a spare for the sign-in pages | the public site; the demo pair (a demo event + two demo shops) shows on Explore marked DEMO ONLY |
| 2 · Plan | `couple_plan` | **Bea & Paolo** (wedding, 90 days out, 80+ guests in every reply state set by guest and by host, 5 groups, a 10-table seat plan, 9 suppliers in every funnel state with chats and payments, an Event Plus order waiting for payment) · **Sofia's 18th** (debut) · **Lolo Ben at 80** (birthday, private) |
| 3 · Maker | `couple_maker` | **Carla & Miguel** (wedding, Event Plus PAID, public Event Hub, a 12-table plan) · **Mika turns 7** (birthday, 30 days ago — Memories, recap) · the demo event |
| 4 · Guest | (no sign-in for the Event Hub) · `guest` for claim/join | Event Hubs: `/stg-bea-paolo`, `/stg-carla-miguel`, `/stg-mika-turns-7`; `guest_links` in the accounts file = one guest per reply state with their pass code. Personal invite links: as `couple_plan`, Guests → a guest → share link |
| 5 · Shop | `supplier_shop` | **Liwanag Photo & Film** — Pro plan, published, verified, 4 cards (fixed · per guest · by the hour · by the piece) |
| 6 · Bookings | `supplier_bookings` | **Kusina ni Aling Nena Catering** — Free (Verified) plan, booked on 6 events in all six states, chats waiting / answered / declined, recorded payments, a 60-message thread on the reunion |
| 7 · Coordinator | `coordinator` | **Tala Events Coordination** booked on two weddings (the coordinator seat) + a seat on **Hardin ng Tagaytay Events Place** (venue: map pin, a 30 × 45 m hall for the 3D plan and Spaces) |
| 8 · Admin | `admin` | account type admin (not internal — its own paid gates stay honest); 8 orders in every state, a shop waiting for verification |
| everyone | `messy_one` · `messy_two` | 350- and 320-guest events, accented / apostrophe / very long names, two guests with the same name, invitations sent 400 days ago and never answered, phone numbers typed every which way, a hand-typed supplier with no shop, an undated old event, lapsed and refunded orders |

---

## 4 · The 8 areas — every shipped page, each in one area

From `apps/web/lib/ugat/screens.generated.json` and `apps/web/lib/admin-map/admin-routes.generated.ts` by
`scripts/staging/areas.ts` (first matching rule wins; every map area has a fallback, so a page added later still
lands somewhere). **This list is a snapshot of the commit this PR merges at — print today's with
`pnpm exec tsx scripts/staging/areas.ts --area <n>`.** `[slug]`/`[eventId]` are the seeded ones from § 3. A forward
must land where it says.

**Area 1 — 74 pages, 2 forwards.**

`/` · `/about` · `/acceptable-use` · `/alaala` · `/api/v1` · `/articles` · `/articles/[slug]` · `/articles/write` · `/budget` · `/cookies` · `/creators` · `/download` · `/explore/compare` · `/features` · `/features/[slug]` · `/for-suppliers` · `/forgot-password` · `/guest-list` · `/help` · `/help/[slug]` · `/help/guides/[key]` · `/help/topics` · `/help/topics/[key]` · `/i/[slug]` · `/login` · `/marketplace` · `/monogram` · `/mood-board` · `/our-story` · `/palogo` · `/panood` · `/panood/demo/[token]` · `/papic` · `/pawebsite` · `/pricing` · `/pricing/plan` · `/privacy` · `/privacy/google-access` · `/refunds` · `/reset-password` · `/samahan` · `/samahan/chat/[threadId]` · `/samahan/chat/new` · `/sample` · `/sample/[...rest]` · `/sample/hub/[guestKey]` · `/schedule` · `/seat-plan` · `/setnayan-ai` · `/signup` · `/signup/you` · `/start` · `/suppliers` · `/suppliers/[event]/[category]` · `/suppliers/[event]/[category]/[city]` · `/terms` · `/tl/about` · `/tl/features` · `/tl/features/[slug]` · `/tour` · `/tour/budget` · `/tour/gallery` · `/tour/seating` · `/tour/vendors` · `/u/[userSlug]` · `/u/[userSlug]/c/[chapterId]` · `/v/[slug]` · `/v/[slug]/booth` · `/v/[slug]/cached` · `/v/[slug]/dates` · `/v/[slug]/guest-review` · `/v/[slug]/story/[eventSlug]` · `/waitlist` · `/web-only`

Forwards (check each lands): `/pakanta` → `/features` · `/patiktok` → `/features`

**Area 2 — 67 pages, 6 forwards.**

`/dashboard` · `/dashboard/[eventId]` · `/dashboard/[eventId]/access-requests` · `/dashboard/[eventId]/activity` · `/dashboard/[eventId]/budget` · `/dashboard/[eventId]/checklist` · `/dashboard/[eventId]/clearance` · `/dashboard/[eventId]/contracts` · `/dashboard/[eventId]/contracts/[contractId]` · `/dashboard/[eventId]/date-selection` · `/dashboard/[eventId]/details` · `/dashboard/[eventId]/details/field/[row]` · `/dashboard/[eventId]/disputes` · `/dashboard/[eventId]/documents` · `/dashboard/[eventId]/find-date` · `/dashboard/[eventId]/guests` · `/dashboard/[eventId]/guests/[guestId]` · `/dashboard/[eventId]/guests/checkin` · `/dashboard/[eventId]/guests/claims` · `/dashboard/[eventId]/guests/import` · `/dashboard/[eventId]/guests/new` · `/dashboard/[eventId]/guests/quick` · `/dashboard/[eventId]/guests/souvenirs` · `/dashboard/[eventId]/guests/tea-ceremony` · `/dashboard/[eventId]/hosts` · `/dashboard/[eventId]/manpower` · `/dashboard/[eventId]/messages` · `/dashboard/[eventId]/messages/[threadId]` · `/dashboard/[eventId]/nikah` · `/dashboard/[eventId]/orders` · `/dashboard/[eventId]/orders/[orderId]` · `/dashboard/[eventId]/orders/new` · `/dashboard/[eventId]/paperwork` · `/dashboard/[eventId]/people` · `/dashboard/[eventId]/refer` · `/dashboard/[eventId]/schedule` · `/dashboard/[eventId]/seating` · `/dashboard/[eventId]/seating/chart` · `/dashboard/[eventId]/seating/lab` · `/dashboard/[eventId]/seating/walkthrough` · `/dashboard/[eventId]/sponsors` · `/dashboard/[eventId]/vendors` · `/dashboard/[eventId]/vendors/[vendorId]/review` · `/dashboard/[eventId]/vendors/categories` · `/dashboard/[eventId]/vendors/packages/[bookingId]` · `/dashboard/api-keys` · `/dashboard/billing` · `/dashboard/clusters` · `/dashboard/clusters/[clusterId]` · `/dashboard/create-event` · `/dashboard/notifications` · `/dashboard/people` · `/dashboard/people/[dependentId]` · `/dashboard/profile` · `/dashboard/profile/concierge` · `/dashboard/samahan/[communityId]` · `/dashboard/samahan/new` · `/dashboard/search` · `/host/accept/[token]` · `/onboarding/[type]` · `/onboarding/simple` · `/onboarding/wedding` · `/pay/[reference]` · `/proposals/[publicId]` · `/receipts/[receiptId]` · `/receipts/order/[orderId]` · `/receipts/payment/[paymentId]`

Forwards (check each lands): `/dashboard/[eventId]/details/change` → `/dashboard/[…]/details/field/area` · `/dashboard/[eventId]/more` → `/dashboard/[…]` · `/dashboard/[eventId]/progress` → `/dashboard/[…][…]` · `/dashboard/[eventId]/vendors/[vendorId]` → `/dashboard/[…]/vendors/[…]/workspace` · `/dashboard/samahan` → `/dashboard?seg=people&view=samahan[…]` · `/dashboard/year` → `/dashboard?seg=events#worth-planning`

**Area 3 — 59 pages, 13 forwards.**

`/dashboard/[eventId]/alaala` · `/dashboard/[eventId]/alaala/assignments` · `/dashboard/[eventId]/apple-pro` · `/dashboard/[eventId]/event-qr` · `/dashboard/[eventId]/galleries` · `/dashboard/[eventId]/guests/invite` · `/dashboard/[eventId]/guests/send` · `/dashboard/[eventId]/invitation` · `/dashboard/[eventId]/invitation/print` · `/dashboard/[eventId]/launch` · `/dashboard/[eventId]/live` · `/dashboard/[eventId]/memories` · `/dashboard/[eventId]/memories/download-all` · `/dashboard/[eventId]/memories/thank-you` · `/dashboard/[eventId]/monogram` · `/dashboard/[eventId]/pabuya` · `/dashboard/[eventId]/prints` · `/dashboard/[eventId]/story` · `/dashboard/[eventId]/studio/about/[addon]` · `/dashboard/[eventId]/studio/guest-columns` · `/dashboard/[eventId]/studio/live-studio-control` · `/dashboard/[eventId]/studio/live-studio-control/setup` · `/dashboard/[eventId]/studio/mood-board` · `/dashboard/[eventId]/studio/pakanta` · `/dashboard/[eventId]/studio/panood` · `/dashboard/[eventId]/studio/panood/broadcast` · `/dashboard/[eventId]/studio/panood/cameras` · `/dashboard/[eventId]/studio/panood/cameras/print` · `/dashboard/[eventId]/studio/panood/setup` · `/dashboard/[eventId]/studio/papic/challenges` · `/dashboard/[eventId]/studio/papic/crew` · `/dashboard/[eventId]/studio/papic/crew/poster` · `/dashboard/[eventId]/studio/papic/moderation` · `/dashboard/[eventId]/studio/papic/recap` · `/dashboard/[eventId]/studio/papic/run-of-show` · `/dashboard/[eventId]/studio/patiktok` · `/dashboard/[eventId]/studio/patiktok/[templateId]` · `/dashboard/[eventId]/studio/patiktok/booth` · `/dashboard/[eventId]/studio/photo-delivery` · `/dashboard/[eventId]/studio/playlist` · `/dashboard/[eventId]/studio/save-the-date` · `/dashboard/[eventId]/studio/save-the-date/stamp` · `/dashboard/[eventId]/studio/setnayan-ai` · `/dashboard/[eventId]/studio/website-pro` · `/dashboard/[eventId]/website/editor` · `/dashboard/[eventId]/website/hero-photo` · `/dashboard/[eventId]/website/living-hero` · `/dashboard/[eventId]/website/our-photos` · `/dashboard/[eventId]/website/our-story` · `/dashboard/[eventId]/website/photo-moments` · `/dashboard/[eventId]/website/privacy` · `/dashboard/[eventId]/website/site-chrome` · `/dashboard/[eventId]/website/stories` · `/dashboard/[eventId]/website/widgets` · `/dashboard/creator` · `/dashboard/library` · `/dashboard/life-flash` · `/panood/control/[eventId]` · `/panood/program/[eventId]`

Forwards (check each lands): `/dashboard/[eventId]/event-page` → `[…]` · `/dashboard/[eventId]/studio/[addon]` → `/dashboard/[…]/[…]` · `/dashboard/[eventId]/studio/indoor-blueprint` → `/dashboard/[…]` · `/dashboard/[eventId]/studio/papic/crew/print` → `/dashboard/[…]/studio/papic/crew/poster` · `/dashboard/[eventId]/website` → `/dashboard/[…]/launch` · `/dashboard/[eventId]/website/colors` → `/dashboard/[…]/website/editor?open=colors` · `/dashboard/[eventId]/website/editorial` → `/dashboard/[…]/story` · `/dashboard/[eventId]/website/special-message` → `/dashboard/[…]/website/editor?open=special-message` · `/dashboard/[eventId]/website/what-to-bring` → `/dashboard/[…]/website/editor?open=what-to-bring` · `/site-editor/[eventId]` → `/dashboard/[…]/website/editor` · `/site-editor/[eventId]/editorial` → `/dashboard/[…]/website/editor` · `/site-editor/[eventId]/event` → `/dashboard/[…]/website/editor` · `/site-editor/[eventId]/rsvp` → `/dashboard/[…]/website/editor`

**Area 4 — 37 pages, 1 forward.**

`/[slug]` · `/[slug]/avatar` · `/[slug]/cached/[key]` · `/[slug]/everyone` · `/[slug]/find-my-table` · `/[slug]/find-seat` · `/[slug]/invite` · `/[slug]/invite/enter` · `/[slug]/invite/reply` · `/[slug]/pabuya` · `/[slug]/print` · `/[slug]/recap` · `/[slug]/request` · `/[slug]/seat` · `/[slug]/welcome` · `/claim/[token]` · `/join/[eventId]` · `/join/[eventId]/connect/confirm` · `/join/[eventId]/set-password` · `/join/[eventId]/success` · `/join/crew/[token]` · `/live` · `/live/screen` · `/panood/cam/[token]` · `/papic/claim/[token]` · `/papic/decorate` · `/papic/demo/[token]` · `/papic/guest` · `/papic/join/[token]` · `/papic/lightcheck` · `/papic/me/[token]` · `/papic/order/[token]` · `/papic/pool` · `/papic/seat/[token]` · `/papic/try` · `/samahan/join/[token]` · `/wall/[eventId]`

Forwards (check each lands): `/[slug]/hub` → `/[…][…]`

**Area 5 — 48 pages, 5 forwards.**

`/open-shop` · `/open-shop/invite` · `/open-shop/logo` · `/vendor-dashboard` · `/vendor-dashboard/activities` · `/vendor-dashboard/attributes` · `/vendor-dashboard/collections` · `/vendor-dashboard/collections/albums` · `/vendor-dashboard/creators` · `/vendor-dashboard/deep-search` · `/vendor-dashboard/help` · `/vendor-dashboard/invite` · `/vendor-dashboard/lines` · `/vendor-dashboard/moodboard-library` · `/vendor-dashboard/packages` · `/vendor-dashboard/packages/[packageId]` · `/vendor-dashboard/partnerships` · `/vendor-dashboard/profile` · `/vendor-dashboard/recommendations` · `/vendor-dashboard/repertoire` · `/vendor-dashboard/services` · `/vendor-dashboard/services/[serviceId]` · `/vendor-dashboard/services/new` · `/vendor-dashboard/services/new/[category]` · `/vendor-dashboard/services/requests` · `/vendor-dashboard/services/requests/[requestId]` · `/vendor-dashboard/services/requests/new` · `/vendor-dashboard/services/their-work` · `/vendor-dashboard/settings` · `/vendor-dashboard/shop` · `/vendor-dashboard/shop/badges` · `/vendor-dashboard/shop/promote` · `/vendor-dashboard/shop/qrs` · `/vendor-dashboard/shop/qrs/[code]` · `/vendor-dashboard/shop/store` · `/vendor-dashboard/shop/store/[shelf]` · `/vendor-dashboard/shop/store/[shelf]/[item]` · `/vendor-dashboard/subscription` · `/vendor-dashboard/team` · `/vendor-dashboard/team/roles` · `/vendor-dashboard/team/roles/inquiries` · `/vendor-dashboard/theft-watch` · `/vendor-dashboard/track-record` · `/vendor-dashboard/website` · `/vendor-invite/[slug]` · `/vendor/claim/[token]` · `/vendor/claim/[token]/finalize` · `/vendor/fit/[ref]`

Forwards (check each lands): `/vendor-dashboard/branches` → `/vendor-dashboard/profile[…]#where` · `/vendor-dashboard/more` → `/vendor-dashboard/settings` · `/vendor-dashboard/performance` → `/vendor-dashboard/shop#analytics` · `/vendor-dashboard/reviews` → `/vendor-dashboard/website#reviews` · `/vendor-dashboard/verify` → `/vendor-dashboard/profile[…]#docs`

**Area 6 — 22 pages, 12 forwards.**

`/vendor-dashboard/booking-fees` · `/vendor-dashboard/booking-fees/[orderId]` · `/vendor-dashboard/calendar/[date]` · `/vendor-dashboard/clients/[eventId]` · `/vendor-dashboard/clients/[eventId]/challenge-photos` · `/vendor-dashboard/clients/[eventId]/cocktail` · `/vendor-dashboard/clients/[eventId]/editorial-media` · `/vendor-dashboard/clients/[eventId]/mood-board` · `/vendor-dashboard/clients/[eventId]/production-sheet` · `/vendor-dashboard/clients/[eventId]/their-event/[part]` · `/vendor-dashboard/contracts/[contractId]` · `/vendor-dashboard/contracts/new` · `/vendor-dashboard/customers` · `/vendor-dashboard/disputes` · `/vendor-dashboard/manpower` · `/vendor-dashboard/messages` · `/vendor-dashboard/messages/[threadId]` · `/vendor-dashboard/notifications` · `/vendor-dashboard/on-the-day` · `/vendor-dashboard/on-the-day/live/[eventId]` · `/vendor-dashboard/on-the-day/live/[eventId]/papic` · `/vendor/lock/[token]`

Forwards (check each lands): `/vendor-dashboard/bookings` → `/vendor-dashboard/customers?[…][…]` · `/vendor-dashboard/calendar` → `/vendor-dashboard/customers?[…][…]` · `/vendor-dashboard/clients` → `/vendor-dashboard/customers?[…]` · `/vendor-dashboard/contracts` → `/vendor-dashboard/customers?[…][…]` · `/vendor-dashboard/demand` → `/vendor-dashboard/shop[…]#analytics` · `/vendor-dashboard/earnings` → `/vendor-dashboard/customers?[…][…]` · `/vendor-dashboard/events` → `/vendor-dashboard/on-the-day` · `/vendor-dashboard/locked-qr` → `/vendor-dashboard/invite?mode=locked&ledger=1#issued` · `/vendor-dashboard/payday` → `/vendor-dashboard/customers?[…][…]` · `/vendor-dashboard/payment-options` → `/vendor-dashboard/profile[…]#pay` · `/vendor-dashboard/proposals` → `/vendor-dashboard/customers?[…][…]` · `/vendor-dashboard/recaps` → `/vendor-dashboard/shop/promote#share`

**Area 7 — 10 pages.**

`/[slug]/venue` · `/3d_plan/demo/[token]` · `/dashboard/[eventId]/plan3d` · `/dashboard/[eventId]/studio/panood/setup/venue-check` · `/dashboard/[eventId]/vendors/[vendorId]/workspace` · `/for-coordinators` · `/pa3d` · `/pa3d/try` · `/vendor-dashboard/clients/[eventId]/seat-plan` · `/vendor-dashboard/spaces`

**Area 8 — 71 pages, 36 forwards.**

`/admin` · `/admin/account-deletions` · `/admin/accounts` · `/admin/admin-log` · `/admin/app-performance` · `/admin/approvals` · `/admin/ask` · `/admin/background-videos` · `/admin/booking-fees` · `/admin/budget-planner` · `/admin/business` · `/admin/catalogue` · `/admin/categories` · `/admin/categories/requests` · `/admin/chat-flags` · `/admin/colours` · `/admin/completions` · `/admin/compliance/data-sheet` · `/admin/concierge-abuse` · `/admin/corrections` · `/admin/data-privacy` · `/admin/demand` · `/admin/demo-vendors/inquiries` · `/admin/directory` · `/admin/discount-codes/new` · `/admin/disputes` · `/admin/editorial-review` · `/admin/email-delivery` · `/admin/event-deletions` · `/admin/force-majeure` · `/admin/founder-seats` · `/admin/fraud` · `/admin/gifts` · `/admin/help` · `/admin/help/guides` · `/admin/hub-music` · `/admin/integrations` · `/admin/integrity-watch` · `/admin/launch-offer` · `/admin/live-studio-channels` · `/admin/money` · `/admin/more` · `/admin/offers` · `/admin/pakanta` · `/admin/papic-storage` · `/admin/pax-changes` · `/admin/payment-options` · `/admin/payments` · `/admin/payments/supplier-refunds` · `/admin/payouts` · `/admin/pricing` · `/admin/receipts` · `/admin/repost-watch` · `/admin/reviews` · `/admin/search-memory` · `/admin/secrets` · `/admin/settings/payment-methods` · `/admin/studio` · `/admin/subscriptions` · `/admin/switches` · `/admin/team` · `/admin/ugat` · `/admin/ugat/map` · `/admin/user-reports` · `/admin/vendor-partnerships` · `/admin/vendor-recommendations` · `/admin/venues/new` · `/admin/verification-docs` · `/admin/verify` · `/admin/website-media` · `/admin/work`

Forwards (check each lands): `/admin/addons` → `/admin/pricing` · `/admin/brain` → `/admin/ugat?tab=brain` · `/admin/compliance` → `/admin/business` · `/admin/connection-logs` → `/admin/app-performance?tab=connection-logs` · `/admin/demo-vendors` → `/admin/accounts?tab=demo-vendors` · `/admin/discount-codes` → `/admin/studio?tab=discount-codes` · `/admin/events` → `/admin/accounts?tab=events` · `/admin/funnels` → `/admin/app-performance?tab=funnels` · `/admin/growth` → `/admin/app-performance?tab=growth` · `/admin/insights` → `/admin/app-performance` · `/admin/intelligence` → `/admin/app-performance?tab=intelligence` · `/admin/journal-spotlights` → `/admin/studio?tab=journal-spotlights` · `/admin/menus` → `/admin/ugat?tab=menus` · `/admin/moodboard-library` → `/admin/studio?tab=moodboard-library` · `/admin/notifications` → `/admin/email-delivery` · `/admin/npc-readiness` → `/admin/data-privacy?tab=checklist` · `/admin/offline` → `/admin/app-performance?tab=offline` · `/admin/onboarding` → `/admin/ugat?tab=onboarding` · `/admin/operations-hiring` → `/admin/app-performance?tab=operations` · `/admin/patiktok` → `/admin/studio?tab=patiktok` · `/admin/price-bands` → `/admin/pricing?tab=price-bands` · `/admin/queues` → `/admin/work` · `/admin/real-stories` → `/admin/studio?tab=real-stories` · `/admin/recaps` → `/admin/studio?tab=recaps` · `/admin/referrals` → `/admin/studio?tab=referrals` · `/admin/reveal-studio` → `/admin/studio?tab=reveal-studio` · `/admin/seo` → `/admin/app-performance?tab=seo` · `/admin/settings` → `/admin/business` · `/admin/settings/demo-mode` → `/admin/switches` · `/admin/social-queue` → `/admin/studio?tab=social-queue` · `/admin/songs` → `/admin/studio?tab=songs` · `/admin/spotlight-awards` → `/admin/studio?tab=spotlight-awards` · `/admin/users` → `/admin/accounts?tab=users` · `/admin/vendors` → `/admin/accounts?tab=vendors` · `/admin/venues` → `/admin/accounts?tab=venues` · `/admin/website` → `/admin/studio?tab=website`

<details><summary>Labs — not checked (builder labs draw sample data; not a person's page)</summary>

**Labs (not checked) — 123 pages.**

`/demo-capture/[slug]` · `/dev/account-lab` · `/dev/add-your-own-lab` · `/dev/admin-catalogue-lab` · `/dev/admin-money-lab` · `/dev/admin-people-lab` · `/dev/admin-shell-lab` · `/dev/admin-supplier-lab` · `/dev/apple-plan-door-lab` · `/dev/art-kit-lab` · `/dev/articles-lab` · `/dev/avatar-sheet-lab` · `/dev/award-lab` · `/dev/bar-lab/[[...path]]` · `/dev/billing-lab` · `/dev/booked-coordinator-lab` · `/dev/booking-ask-lab` · `/dev/booth-lab` · `/dev/budget-lab` · `/dev/bundle-maker-lab` · `/dev/cake-maker-lab` · `/dev/card-maker-lab` · `/dev/card-moderation-lab` · `/dev/categories-lab` · `/dev/chapters-lab` · `/dev/chat-cards-c-lab` · `/dev/chat-cards-lab` · `/dev/chat-lab` · `/dev/chat-lab/t/[threadId]` · `/dev/check-a-date-lab` · `/dev/checkin-desk-lab` · `/dev/clients-lab` · `/dev/collapsing-top-lab` · `/dev/create-for-lab` · `/dev/customer-money-lab` · `/dev/date-sheet-lab` · `/dev/day-poster-lab` · `/dev/desktop-split-lab` · `/dev/details-lab` · `/dev/drive-copy-lab` · `/dev/empty-looks-lab` · `/dev/event-group-chat-lab` · `/dev/favorites-lab` · `/dev/fee-rulings-lab` · `/dev/files-lab` · `/dev/find-lock-lab` · `/dev/for-suppliers-lab` · `/dev/forms-lab` · `/dev/group-lab` · `/dev/guests-lab` · `/dev/help-lab` · `/dev/hero-lab` · `/dev/home-lab` · `/dev/iap-doors-lab` · `/dev/inquire-lab` · `/dev/maker-lab` · `/dev/maker-lab/guest` · `/dev/maker-lab/guest/scrub` · `/dev/mall-card-lab` · `/dev/me-lab` · `/dev/memories-lab` · `/dev/motion-screens-lab` · `/dev/motion-screens-lab/deeper` · `/dev/notifications-lab` · `/dev/offer-card-lab` · `/dev/offer-maker-lab` · `/dev/onboarding-lab` · `/dev/open-shop-lab` · `/dev/papers-renewal-lab` · `/dev/papic-camera-lab` · `/dev/pay-maya-lab` · `/dev/people-lab` · `/dev/personal-invite-lab` · `/dev/photo-privacy-lab` · `/dev/pro-parts-lab` · `/dev/pro-tools-lock-lab` · `/dev/profile-photo-lab` · `/dev/questions-lab` · `/dev/receipt-lab` · `/dev/review-lab` · `/dev/rise-route-lab` · `/dev/rise-route-lab/[row]` · `/dev/schedule-lab` · `/dev/search-lab` · `/dev/selfie-lab` · `/dev/service-card-row-lab` · `/dev/service-requests-lab` · `/dev/shop-back-lab` · `/dev/shop-card-lab` · `/dev/shop-end-lab` · `/dev/shop-layout-lab` · `/dev/shop-page-lab` · `/dev/shop-plan-lab` · `/dev/shop-preview-lab` · `/dev/signature-lab` · `/dev/spaces-lab` · `/dev/spotlight-lab/[[...page]]` · `/dev/story-suppliers-lab` · `/dev/supplier-chat-lab` · `/dev/supplier-hub-tools-lab` · `/dev/supplier-lab` · `/dev/supplier-plan-lab` · `/dev/supplier-print-lab` · `/dev/supplier-set-two-day-lab` · `/dev/supplier-set-two-lab` · `/dev/supplier-tools-lab` · `/dev/suppliers-lab` · `/dev/swipe-rows-lab/clients` · `/dev/swipe-rows-lab/on-the-day` · `/dev/swipe-rows-lab/proposals` · `/dev/swipe-rows-lab/repertoire` · `/dev/swipe-rows-lab/seating` · `/dev/swipe-rows-lab/sponsors` · `/dev/swipe-rows-lab/suppliers` · `/dev/their-event-lab` · `/dev/thumb-row-lab` · `/dev/unichat-a-lab` · `/dev/unichat-f-lab` · `/dev/unihome-lab` · `/dev/venue-check-lab` · `/dev/verify-desk-lab` · `/dev/visits-lab` · `/dev/you-lab`

</details>

---

## 5 · THE checker checklist — one list, every area, every page

> **Checkers REPORT, they never fix.** No commits, no PRs, no edits to data another area uses (never delete or
> rename a seeded event, shop or sign-in — delete only what you created yourself). **A blocker is reported the
> moment it is found**, before the walk goes on. Work at **375 px first**, then desktop; **light, then dark** on
> every signed-in screen. Values and rules: the specs corpus `HOUSE_DESIGN_STANDARD_2026-11-20.md` (it outranks this
> list), `DARK_MODE_STANDARD_2026-11-20.md`, `MOTION_STANDARD_2026-11-18.md`, and `docs/brand.md` for words.

For every page in your area:

1. **Bugs.** It opens: no error screen, no console error, no 5xx, no endless skeleton. Refresh keeps the state; Back
   returns to exactly where you were.
2. **Every button.** Press every control — buttons, tabs, toggles, every option of every dropdown, every sheet
   opened and closed. Each reaches a real action or a real destination. A press that does nothing, a `#` link, a
   "coming soon" a person can press, or a link to a 404 is a finding.
3. **Connections.** Change a shared fact and check every page that shows it agrees: a guest's reply → the guest
   counts, the seat plan, check-in, the supplier's headcount; a booking's state → the budget, the supplier's view,
   the coordinator's seat; a payment → paid / still owed everywhere. Two pages disagreeing about one fact is a finding.
4. **Maps.** The venue pin, the 3D plan, Spaces, find-my-seat, the guest's venue walk: they draw, they match the
   seeded venue, and they work at 375 px.
5. **Template (Part H).** Public pages follow the website blocks and page order (Home · For Suppliers · Pricing ·
   Features): one terracotta button per hero and per close, chips, shelves with no border or shadow, plan rows,
   never a coloured side stripe.
6. **Part K.** K1: **one main button per screen, sheet or card** — every other button is neutral or a text link,
   never the same colour. K2: in dark, the page is flat and **the top block carries the glow**; cards one step
   lighter; no shadows, no white surfaces. K3: **anything on top** (sheet, popup, dropdown, menu) dims and blurs
   what is behind, the page behind cannot be used or scrolled, and tapping the backdrop closes it and returns the
   page exactly as it was (scroll, focus).
7. **Dark mode.** Every signed-in screen in dark: readable text, no white card, no lost icon, nothing flat where the
   glow belongs (public signed-out pages are light only today — not a finding).
8. **Motion.** Content may arrive with motion; controls never dance. Transform and opacity only, the house speeds,
   nothing janky; reduced motion still works.
9. **Honest states.** Loading, empty and failure never look alike. A failed read never shows 0, "Free", ₱0 or an
   empty list as if it were true. A skeleton draws only what the page draws. An empty state states the fact and
   offers one action.
10. **Speed.** Note any page slower than about 0.7 s to usable, and anything over 2 s, with the route. A press should
    look pressed at once.
11. **Words and money.** supplier (never vendor) · Event Hub · E-Gifts · Logo Maker · Articles · reservation fee ·
    Setnayan in full. Prices read in ₱ and match the catalogue on every page that shows them.

**Expected on the copy — NOT findings:** an email arriving at the test inbox (or not at all) instead of the person;
the Maya option missing for test accounts (sandbox Maya is shown to internal accounts only — the BDO/GCash QR path
is the one to check, and **never pay anything**); "Sign in with Google / Apple / Facebook" not finishing on the
preview address (the providers only know setnayan.com — check the button is there and leads to the provider);
password-reset and magic-link emails not arriving at `.test` addresses; a seeded picture that is a placeholder; a
picture production stored before the copy not showing (lock d); the page not being indexed (lock c).

---

## 6 · The findings format — one entry per problem

```
PAGE      /dashboard/[eventId]/budget   (event: stg-bea-paolo)   — never paste the bypass secret
BUTTON    "Record payment" (the label a person reads)
STEPS     1. … 2. … 3. …
EXPECTED  …
ACTUAL    …
SHOTS     375 px light + 375 px dark (+ desktop when layout is the problem)
RULE      HOUSE_DESIGN_STANDARD Part K1 · or CLAUDE.md §5 rule 4 (honest states) · or brand.md word rules …
SEVERITY  blocker | money-signin | broken | wrong | look
```

| Severity | Means | Report |
|---|---|---|
| **blocker** | a whole flow stops for everyone in the area: a crash, a 5xx, cannot sign in, cannot save | **at once**, on its own |
| **money-signin** | anything wrong about money (a price, a total, a charge, a receipt, a ₱0 or "Free" on a failed read) or about signing in, out, or into the wrong account | at once |
| **broken** | a control does nothing, a dead link, a wrong destination, an error on valid input | in the area's list |
| **wrong** | it works but shows the wrong thing: a number two pages disagree on, a wrong count, a wrong word | in the area's list |
| **look** | the design standard is not met: Part K, dark glow, spacing, type, motion | in the area's list |

Where findings go is the controller's call (one GitHub issue per area is the default; a blocker gets its own).
**The repository is public: no password, key, bypass secret or real person's data in a finding.**

---

## 7 · What this PR could NOT prove (controller steps, done on the day)

CI proves the seed, the seal and the catalogue upsert on the replayed schema, and every lock by behaviour (the R2
lock on a real S3 client, request by request). What needs the real branch and preview, and is therefore § 2's step 9:

- the branch's Auth accepting `.test` sign-ins from the admin API (fallback: `--plus-sink`);
- `cron.alter_job` being allowed for the branch's owner role (the seal refuses loudly if not);
- the catalogue read through a real read-only production connection;
- Vercel setting `VERCEL_ENV=preview` at build time on the branch (`curl -sI … | grep -i x-robots-tag`);
- an email actually reaching the sink, an upload actually landing under the prefix, Maya actually reading sandbox;
- the bypass cookie letting a cloud checker through the preview protection.
