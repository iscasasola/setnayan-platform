# Setnayan — Owner action items

> Step-by-step guide for everything you need to do outside the code to take
> Setnayan from "shipped" to "running real users". Written for someone who
> hasn't done this before — every step says exactly where to click, what to
> type, and how to check it worked.
>
> Work through these in order. **Phase 1** is the bare minimum to make the
> app legally usable. **Phases 2–4** are V1 launch. **Phases 5+** are polish
> you can do later without breaking anything.

---

## Post 2026-05-22 sprint punch list (read this FIRST)

> 17 PRs shipped autonomously overnight on 2026-05-22 while you were offline.
> Total time to clear this list: ~45 min of owner-side actions, all external
> to the codebase (Vercel env paste, mailbox forward, Supabase CLI, Sentry
> click-test, Better Stack monitor, GSC resubmit, two product decisions).
> Engineering work has landed and is awaiting these owner actions to be
> production-effective. Numbered in recommended execution order.

### ✅ DONE (verified 2026-06-13) — Web Push VAPID keys set · push live on Production

**✅ Completed 2026-06-11 · verified live 2026-06-13.** All three keys (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT`) are set in Vercel (Production + Preview), and a production deploy after that date carries them, so `sendWebPush` is firing. The steps below are retained for reference / key rotation only — **do not re-run with new keys on Production** (rotating the public key invalidates push subscriptions already created against the old one).

Web Push shipped (PR #1229). VAPID keys are self-generated — no Apple/Google account needed.

```bash
npx web-push generate-vapid-keys
```

Copy the two values it prints, then in **Vercel → setnayan-platform-web → Settings → Environment Variables** add (Production + Preview):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the **Public Key** it printed |
| `VAPID_PRIVATE_KEY` | the **Private Key** it printed |
| `VAPID_SUBJECT` | `mailto:iscasasolaii@gmail.com` |

Redeploy (Vercel → Deployments → ⋯ → Redeploy on latest).

**Check it worked:** log in as `couple.test@setnayan.com` on Chrome (desktop or Android), Profile → Notifications → flip **Push notifications** on → accept the browser prompt. Then send that couple a chat message from the vendor test account → a push notification appears even with the tab in the background. (iPhone: only works after the site is installed to the Home Screen — that's an iOS platform rule, not a bug.)

### 2026-06-03 — push the hybrid-Preparation migration (~2 min · recommended)

Push migration `supabase/migrations/20260729000000_event_preparation_items.sql` (hybrid + vendor prep items — **additive**; manual/vendor-added items are hidden until applied). This adds the `event_preparation_items` table that powers the new **hybrid Preparation schedule**: couples can add/delete their own dated prep items, and booked vendors (accepted chat thread) can add items to the couple's prep schedule from their Bookings view. The app **graceful-degrades** without it — the couple's Schedule → Preparation tab still renders the read-only autofill (payments / paperwork / meetings / milestones); the **+ Add to schedule** and vendor **Add to prep schedule** controls only function once this migration lands.

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```

**Check it worked:** open a couple's Schedule → **Preparation** tab, tap **+ Add to schedule**, add an item (label + date) → it appears in the month-grouped agenda with an "Added by you" chip and a delete control. As a booked vendor, open `/vendor-dashboard/bookings`, expand an **accepted** booking, tap **Add to prep schedule** → the item shows on the couple's Preparation agenda tagged "From {your business name}".

### 2026-06-03 — push the typed-Preparation-items migration (~2 min · recommended)

Push migration `supabase/migrations/20260730000000_event_preparation_item_kinds.sql` (typed prep items — **additive**; adds `kind` + `amount_php` columns to `event_preparation_items`, **no RLS change**). This lets couples + booked vendors place **Meeting** and **Payment** schedule entries on the Preparation agenda, not just generic tasks. The app **graceful-degrades** without it: existing and new prep items just read as plain tasks (no Meeting/Payment styling, no amount) until the columns exist. Push **after** `20260729000000` (the #845 table) — that one is the prerequisite.

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```

**Check it worked:** open a couple's Schedule → **Preparation** tab, tap **+ Add to schedule** → the modal now shows a **Task / Meeting / Payment** picker. Add a **Payment** (enter an amount in ₱) → it appears with the same amber Payment tag/icon as an autofilled vendor payment, showing the ₱ amount. Add a **Meeting** → it appears with the indigo Meeting tag/icon. The same picker appears on a booked vendor's **Add to prep schedule** modal in `/vendor-dashboard/bookings`. (Note: a payment placed here is a planning reminder only — it does **not** post to the couple's Budget ledger.)

### 2026-06-03 — push the couple-attending migration (~2 min · recommended)

A new migration `supabase/migrations/20260725000000_guests_couple_attending.sql` makes the **bride & groom always Attending** at the database level (a trigger) and backfills existing couples. The app already coerces this on read, so the Guests page is correct without it — but push it so the **stored** RSVP value + every write path (CSV import, the public RSVP widget) stay consistent:

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```

**Check it worked:** open the Guests page for any event — the bride & groom show **Attending** (not Pending) and the Pending count drops. (They already show Attending in the UI via read-coercion; this makes the database agree.)

### 2026-06-03 — push the Messages unread-badge migration (~2 min · recommended)

**push migration `20260728000000_chat_thread_reads.sql`** (Messages unread badge — additive; badge shows 0 until applied).

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```

It adds the `chat_thread_reads` read marker + the `count_unread_message_threads()` function the Messages icon's unread badge reads from. The app is already deployed and safe without it — `countUnreadMessages()` graceful-degrades to **0** when the table/function isn't present yet, so the badge simply shows nothing until you push. **Check it worked:** open a couple dashboard, have a vendor send a message in a thread you haven't opened — a count badge appears on the Messages icon; open the thread and it clears.

### Today's 17 merges (for awareness)

| Area | PR | What it shipped |
|---|---|---|
| Migration | [#272](https://github.com/iscasasola/setnayan-platform/pull/272) | `launch_promo_until` column (Jan 30 2027 promo) |
| Privacy | [#273](https://github.com/iscasasola/setnayan-platform/pull/273) | RA 10173 4 missing sections in `/privacy` |
| Orphan fix | [#274](https://github.com/iscasasola/setnayan-platform/pull/274) | `/vendors/compare` route reachable |
| Orphan fix | [#285](https://github.com/iscasasola/setnayan-platform/pull/285) | `/admin` payment-methods nav |
| Orphan fix | [#287](https://github.com/iscasasola/setnayan-platform/pull/287) | `/schedule` + `/disputes` couple-side nav |
| Observability | [#275](https://github.com/iscasasola/setnayan-platform/pull/275) | `/api/health` + `/api/health/deep` endpoints |
| Observability | [#280](https://github.com/iscasasola/setnayan-platform/pull/280) | Sentry smoke-test admin trigger |
| Observability | [#289](https://github.com/iscasasola/setnayan-platform/pull/289) | Typecheck fix on health-deep |
| Payments | [#277](https://github.com/iscasasola/setnayan-platform/pull/277) | 3 race conditions sealed in cart/checkout |
| SEO | [#278](https://github.com/iscasasola/setnayan-platform/pull/278) | schema.org JSON-LD across marketing routes |
| SEO | [#279](https://github.com/iscasasola/setnayan-platform/pull/279) | Sitemap +4 routes (pricing/how-it-works/waitlist/download) |
| SEO | [#286](https://github.com/iscasasola/setnayan-platform/pull/286) | Footer link parity |
| Drift cleanup | [#276](https://github.com/iscasasola/setnayan-platform/pull/276) | Lint guard + Pareto + CMP cleanup |
| Drift cleanup | [#288](https://github.com/iscasasola/setnayan-platform/pull/288) | Email link audit + CI guard |
| Marketing | [#281](https://github.com/iscasasola/setnayan-platform/pull/281) | Patiktok + Pakanta copy refresh |
| Marketing | [#282](https://github.com/iscasasola/setnayan-platform/pull/282) | Worked example + actor terms (customer/host) |
| PWA | [#284](https://github.com/iscasasola/setnayan-platform/pull/284) | Day-of mode shell |

### Owner actions (recommended order)

#### 1. Paste 4 crypto secrets in Vercel env (~5 min) 🔴 blocker

Without these, OAuth flows fail decrypt and cron/internal endpoints return 401.

> ⚠️ **Rotate before pasting.** The original pre-generated values for these 4
> variables were briefly committed to this file via PR #291 (now redacted)
> and may have been ingested by GitHub search indexes / forks / mirrors
> before the redaction commit landed. **Generate fresh values via the
> command below** rather than reusing the leaked ones. Pilot-stage so the
> rotation impact is small but visible — any in-flight OAuth refresh tokens
> in `oauth_grants` will fail decrypt and the affected couples need to
> re-authorize their YouTube / Drive / TikTok connections once.

Generate 4 fresh 32-byte base64 secrets:

```bash
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
echo "CRON_SECRET=$(openssl rand -base64 32)"
echo "OAUTH_REFRESH_CRON_SECRET=$(openssl rand -base64 32)"
echo "INTERNAL_WORKER_SECRET=$(openssl rand -base64 32)"
```

The 4 variable names + what each gates:

- `ENCRYPTION_KEY` — `apps/web/lib/encryption.ts` AES-256-GCM OAuth token storage
- `CRON_SECRET` — `/api/admin/cron/*` endpoints
- `OAUTH_REFRESH_CRON_SECRET` — `/api/cron/oauth-refresh`
- `INTERNAL_WORKER_SECRET` — `/api/internal/patiktok/process-job`

Save the freshly-generated values to your password manager FIRST, then paste into Vercel.

1. Open https://vercel.com/iscasasola/setnayan-platform-web/settings/environment-variables
2. For each of the 4 variables: click **Add**, paste the name + value, tick **Production**, **Preview**, **Development** → **Save**
3. Vercel auto-triggers a redeploy. Wait ~2 min.
4. Verify in the deployment logs that no envvar warnings appear.

#### 2. Verify `dpo@setnayan.com` mailbox routes to your inbox (~10 min) 🔴 RA 10173 §21

Privacy policy (PR [#273](https://github.com/iscasasola/setnayan-platform/pull/273)) references this address. Required to be contactable.

Two ways:
- **Domain registrar forward (easier):** in your registrar console → Email forwarding → add `dpo@setnayan.com` → forward to `iscasasolaii@gmail.com`.
- **Mailbox alias:** if you have Google Workspace on `setnayan.com`, add `dpo@` as an alias on your primary user.

**Verify:** send an email from any other account to `dpo@setnayan.com`. It should land in your inbox within 60s.

#### 3. Decide on `CONCIERGE_ENABLED` killswitch (~2 min, product decision)

`apps/web/lib/concierge.ts:33` has `CONCIERGE_ENABLED=false` (you set this 2026-05-20). Engineering doesn't unilaterally flip owner-set killswitches.

**Question:** is Setnayan Concierge in the pilot scope (per CLAUDE.md row 8, pilot-first posture)?

- **YES** → flip to `true` in `apps/web/lib/concierge.ts:33`, commit, push. Pilot couples will see the Concierge upgrade card + 3-day trial CTA.
- **NO** → leave at `false`. Add a one-line comment above the constant explaining the deferral reason ("pilot scope excludes paid Concierge AI brain — defer to V1.5+" or similar) so the next session doesn't re-litigate.

Either way: reply in this thread so engineering can update CLAUDE.md.

#### 4. Push migration to prod via `supabase db push --linked` (~3 min)

PR [#272](https://github.com/iscasasola/setnayan-platform/pull/272) added `20260522080000_iteration_0034_launch_promo_until_jan_30_2027.sql`. Must be applied to production DB before the launch promo column is queryable.

```bash
cd ~/Setnayan/setnayan-platform # or wherever your local checkout lives
git pull origin main
supabase db push --linked
supabase migration list --linked | tail -5 # confirm 20260522080000 appears as applied
```

If the CLI says "Remote migration versions not found locally," your working copy is behind `origin/main` — run `git pull` first. Do NOT run `supabase migration repair` (destructive against production).

#### 5. Sentry smoke-test 3-step verification (~5 min) — closes punch-list #19e

Per the new Sentry section added by PR [#280](https://github.com/iscasasola/setnayan-platform/pull/280):

1. Navigate to `setnayan.com/admin/settings → System health`
2. Click **Fire Sentry smoke test (admin only)** — note the `trace_id` shown in the green confirmation panel
3. Within 60s: open https://sentry.io → Setnayan project → Issues → search by `trace_id:<paste>` → confirm the error appears
4. Within 60s: check your configured alert destination (email or Slack) → confirm the alert lands

If steps 3 or 4 fail, the SDK is mounted but the alert routing or DSN isn't wired correctly — reply with the trace_id and which step failed; engineering investigates.

#### 6. Configure Better Stack synthetic monitor (~10 min)

Target the deep-health endpoint shipped via PR [#275](https://github.com/iscasasola/setnayan-platform/pull/275) + typecheck fix PR [#289](https://github.com/iscasasola/setnayan-platform/pull/289).

1. Open https://betterstack.com → Uptime → **Create monitor**
2. **URL:** `https://www.setnayan.com/api/health/deep`
3. **Region:** Singapore (closest to PH)
4. **Method:** HEAD
5. **Interval:** 60s
6. **Alert on:** non-200 OR duration > 3s
7. Save.

**Optional faster sanity probe:** create a second monitor targeting `https://www.setnayan.com/api/health` (shallow), HEAD, 30s interval. Catches Vercel-edge issues that don't flag in the deep check.

#### 7. Resubmit sitemap to Google Search Console (~3 min)

PR [#279](https://github.com/iscasasola/setnayan-platform/pull/279) added `/pricing` `/how-it-works` `/waitlist` `/download` to the sitemap (now 14 routes total).

1. Open https://search.google.com/search-console
2. Select the `setnayan.com` property
3. Sitemaps → click `sitemap.xml` row → **Resubmit**
4. Google will re-crawl the 4 new high-intent SEO surfaces faster than waiting for the next natural crawl.

#### 8. Decide on PR [#283](https://github.com/iscasasola/setnayan-platform/pull/283) — stress test script (~5 min product decision)

PR open without auto-merge per the "only auto-merge if 5/5 scenarios PASS" gate. Full run wasn't executed (sandbox had no Docker, no remote test-DB).

Three options:
- **(a) Provide real test DB credentials** → reply in PR with `STRESS_TEST_DB_URL=...` (a throwaway Supabase project, not prod) → engineering runs the test → merges if green.
- **(b) Merge with caveat** → comment "merge with run pending"; the script lands in the repo, run executes later when test-DB is provisioned.
- **(c) Leave open until V1.1** → close with `wontfix: defer to V1.1`; revisit after pilot wraps.

Recommended: **(b)** if you want the script in the repo for the V1.5+ traffic phase; **(c)** if pilot scope doesn't justify the test infra investment yet.

#### 9. Push pending Supabase migrations to prod (~5 min · Task #49 fix)

✅ **RESOLVED 2026-06-13** — the `guest_role` enum on prod now includes `bride` + `groom` (24 values total, verified via DB introspection); the edit form no longer throws. _Historical report:_ Guest-list edit form threw `invalid input value for enum guest_role: "bride"` (Claire) and `...groom` (Ice). The migration `20260530020000_guest_role_add_bride_groom.sql` (commit `2e6f64f`, 2026-05-21) exists on `main` but hasn't been applied to prod. Migration follows the same idempotent `ALTER TYPE ... ADD VALUE IF NOT EXISTS` pattern as `20260514012000_notification_type_additions.sql` — safe to push.

There may be other unpushed migrations from the last 12 days too (31 migrations have landed since the 2026-05-20 prod-sync verification). Easiest is to push all in one batch.

**Easy path — Supabase CLI (recommended):**

```bash
# From your local checkout (NOT inside Claude — your real terminal):
cd ~/path/to/setnayan-platform
git pull origin main
supabase migration list --linked  # shows which migrations are unpushed
supabase db push --linked         # applies everything not yet in prod
```

If `migration list --linked` shows `20260530020000_guest_role_add_bride_groom.sql` as not-yet-applied, you've found the bug. After `db push --linked` finishes, re-run `migration list --linked` to confirm parity.

**Fallback path — Supabase Studio SQL editor** (if CLI errors):

1. Open https://supabase.com/dashboard/project/njrupjnvkjkitfctetvi/sql
2. Paste this SQL:

   ```sql
   -- 20260530020000_guest_role_add_bride_groom.sql
   -- Adds 'bride' + 'groom' to public.guest_role enum.
   -- Idempotent: re-run safe.
   ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'bride';
   ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'groom';
   ```

3. Click **Run**. Expect "Success. No rows returned" (the values are added to the enum type definition; nothing inserted into a table).

4. Also paste this SQL (the singleton-constraint migration that depends on the enum change):

   ```sql
   -- 20260531010000_guests_unique_bride_groom_per_event.sql
   -- One bride + one groom per event (not-deleted rows only).
   BEGIN;

   CREATE UNIQUE INDEX IF NOT EXISTS guests_one_bride_per_event
     ON public.guests (event_id)
     WHERE role = 'bride' AND deleted_at IS NULL;

   CREATE UNIQUE INDEX IF NOT EXISTS guests_one_groom_per_event
     ON public.guests (event_id)
     WHERE role = 'groom' AND deleted_at IS NULL;

   COMMIT;
   ```

5. Click **Run**. Expect "Success. No rows returned".

**Verification (post-push):**

1. Refresh https://www.setnayan.com/dashboard/{eventId}/guests/{guestId for Claire — `S89G-6A8RCA9CJQ`}
2. Pick Bride from the Role in wedding dropdown → Save → expect green confirmation banner.
3. Repeat for Ice (`S89G-H83AGFJMK5`) with Groom selected.

Both saves should succeed.

**Note on broader migration gap:** While you're in the Supabase CLI, `supabase migration list --linked` will surface any other migrations from the last 12 days that need pushing. Recommend pushing all in one batch via `supabase db push --linked` rather than spot-fixing per error.

---

**Why:** The app shows placeholders for BIR TIN, business name, and bank
details. Until you replace them, real receipts say "TIN 000-000-000-000"
and the order page says "details emailed once your order is confirmed".

### Step 1.1 — Open Platform Settings

1. Open https://setnayan-platform-web.vercel.app/login in your browser
2. Sign in with `iscasasolaii@gmail.com` and your password
3. Click **Profile** (top-right, the avatar with your initial)
4. Scroll to the bottom of the Profile page
5. Click the **Admin console ↗** button
6. In the top navigation, click **Settings** (it's the last tab on the right)

You should land on a page titled **Platform settings**.

### Step 1.2 — Fill in your business identity

Under **Business identity (BIR §113)**:

| Field | What to type |
|---|---|
| **Business name** | Your registered business name (e.g. `Setnayan Inc.` or your DTI/SEC-registered name). This shows on every receipt. |
| **Tax Identification Number (TIN)** | Your real BIR TIN in `000-000-000-000` format. **Required** before issuing any receipt. |
| **Business address** | Full registered business address — appears on receipts. |
| **Business email** | Reply-to email on receipts (e.g. `hello@setnayan.com`) |
| **Default VAT rate** | Leave at `12.00` unless you're VAT-exempt (e.g. operating under 8% income tax option) |

### Step 1.3 — Fill in BDO bank transfer details

Under **BDO bank transfer**:

| Field | What to type |
|---|---|
| **Account name** | Your BDO account holder name |
| **Account number** | Your BDO account number in `0000-0000-0000` format |

### Step 1.4 — Fill in GCash details

Under **GCash**:

| Field | What to type |
|---|---|
| **Account name** | Your GCash registered name |
| **GCash number** | Your GCash mobile number (`+63 917 XXX XXXX`) |

### Step 1.5 — Save text fields

1. Scroll to the bottom of the main form
2. Click **Save settings**
3. You should see a green banner: **"Settings saved. Live changes propagate to all surfaces immediately."**

### Step 1.6 — Upload merchant QR codes

Below the save button is a new **Merchant QR codes** section with two upload blocks.

For **BDO QR code**:
1. Open your BDO app on your phone, find your merchant QR (BDO QR Ph), save the image
2. AirDrop / email / Drive it to your computer
3. Click the file input under **BDO QR code**, pick the file
4. Click **Upload**
5. Page reloads with a green banner; you'll see your QR rendered inline at 160×160

Repeat for **GCash QR code** with your GCash merchant QR.

If you ever need to swap the image, click **Replace** on the same block. **Remove** clears it.

Files are stored in Supabase Storage (Singapore region) under the `platform-assets` bucket. URLs are public so the couple's order page can render them without auth.

### Step 1.7 — Verify

1. Go to https://setnayan-platform-web.vercel.app/dashboard
2. Click into your event
3. Click the **Orders** tile (or **Services** → **Orders**)
4. Click any existing order, or create one if there are none
5. Scroll to **Payment instructions**
6. You should now see **BDO bank transfer** and **GCash** boxes with your account info AND the uploaded QR images

If receipts were already issued, they show the **business name** + **TIN** you just saved — open any receipt at `/admin/receipts` and click **View** to confirm.

---

## Phase 2 — Wire Resend for real email (DEFERRED — see Phase 2A below)

**Status:** Skipped per owner decision. Cost/limits don't make sense for
V1's user count yet. Without Resend:

- Signup auto-confirms (the existing bypass keeps working) ✓
- Notifications stay in-app only (couples + vendors see badges) ✓
- Password reset via the normal flow is broken — replaced by Phase 2A below ✓

### Phase 2A — Manual password reset (LIVE NOW)

Two paths replace the normal email-based reset:

**A1. Admin resets another user's password:**

1. Open https://setnayan-platform-web.vercel.app/admin/users
2. Find the user (search by email)
3. Click **Reset password** in their row (button has a key icon)
4. Page reloads with an **amber banner at the top** showing a 12-character
   temporary password — shown only once, then cleared on refresh
5. Copy it and share with the user via a secure channel (DM, in person, SMS)
6. The user signs in with the temp password and immediately changes it from
   their Profile page

**A2. User changes their own password:**

1. User signs in (with temp or current password)
2. Goes to `/dashboard/profile`
3. Under **Change password**, types a new password twice
4. Clicks **Change password**
5. New password applies on next sign-in; current session stays active

### Phase 2B — When you eventually want Resend

The integration code is shipped — only env vars are missing. Follow the
**Phase 2 (reference)** steps below and add to Vercel:

```
RESEND_API_KEY=re_…
RESEND_FROM_EMAIL=Setnayan <noreply@yourdomain.com>
```

Redeploy. Every notification + welcome email starts flowing automatically.

---

### Phase 2 — Wire Resend for real email (REFERENCE, NOT REQUIRED)

**Why:** Right now signup confirmation emails, payment-matched notifications,
and welcome messages get queued but don't actually send. The day you paste
the Resend API key into Vercel, all of that starts working.

### Step 2.1 — Create a Resend account

1. Open https://resend.com in a new tab
2. Click **Sign up** (top right)
3. Use any email you have access to — your personal Gmail works
4. Verify your email when Resend sends you a confirmation link

### Step 2.2 — Get an API key

1. In Resend dashboard, click **API Keys** (left sidebar)
2. Click **Create API Key**
3. Name it `setnayan-production` (or anything)
4. Permission: **Sending access** (default)
5. Click **Add**
6. You'll see your key once — it looks like `re_AbCdEf123…`
7. **Copy it now** — you can't see the full value again

### Step 2.3 — Get a "from" email

You have two options:

**Option A: Sandbox (instant, but only sends to your own email)**
- Use the from email `onboarding@resend.dev`
- Resend's sandbox only delivers to the email you used to sign up — fine for smoke-testing but NOT for real users
- Skip to Step 2.4

**Option B: Verify your domain (best, ~10 min + DNS propagation)**
1. In Resend, click **Domains** → **Add Domain**
2. Enter `setnayan.com` (or whatever domain you own)
3. Resend shows you 3-4 DNS records (TXT, MX, CNAME, DMARC). Each has a Type, Name, and Value
4. Open your DNS provider's dashboard (Cloudflare, GoDaddy, Namecheap, etc.)
5. Add each record exactly as Resend specified
6. Back in Resend, click **Verify** for the domain — green checks appear when DNS propagates (anywhere from 5 minutes to 24 hours)
7. Once verified, you can send from `noreply@setnayan.com` or any sub-address

### Step 2.4 — Paste the key into Vercel

1. Open https://vercel.com in another tab
2. Sign in with the account that owns the Setnayan deployment
3. Click on the **setnayan-platform-web** project
4. Click **Settings** (top nav)
5. Click **Environment Variables** (left sidebar)
6. Add two new variables:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | The `re_…` key you copied from Resend |
| `RESEND_FROM_EMAIL` | `Setnayan <onboarding@resend.dev>` for sandbox, or `Setnayan <noreply@setnayan.com>` once your domain is verified |

For each: type the name, paste the value, set environment to **Production, Preview, Development** (all three), then click **Save**.

### Step 2.5 — Trigger a redeploy

1. Still in Vercel, click **Deployments** (top nav)
2. Find the latest production deploy
3. Click the three-dot menu → **Redeploy**
4. Wait ~2 minutes for the new build

### Step 2.6 — Verify

1. Open https://setnayan-platform-web.vercel.app/signup in an incognito window
2. Sign up with a test email you control (use sandbox-mode owner email if you went with Option A)
3. After signup, check your inbox — within 1 minute you should get a **"Welcome to Setnayan"** email
4. Bonus: have someone (or your test couple) trigger a chat message to the test vendor — that should also email you within seconds

If no email arrives within 5 minutes, check Resend's dashboard → **Logs** to see if it sent (and where it went / why it bounced).

---

## Phase 2C — Persistent login (5 min, Supabase dashboard only)

**Why:** The code-side hardening for "stay logged in" ships with this app
(persistent cookie defaults + proactive token refresh + client-aware
session length in middleware). The app already auto-detects three
clients and behaves differently per surface:

- **Desktop app (Tauri)** — 10-year cookie persistence, 30-min proactive refresh window. Treated like a native app — never auto-logs-out.
- **Installed PWA on phone** (any platform that supports `display-mode: standalone`) — same 10-year persistence + 30-min window as desktop.
- **Plain web browser** — 1-year cookie persistence + 10-min refresh window. Standard session behavior.

To make sessions actually long-lived, two settings in the Supabase
dashboard need to match. Without these flipped, the server will still
expire your token in 1 hour regardless of how the cookie is stored.

### Step 2C.1 — Open Auth settings

1. Open https://supabase.com/dashboard (sign in if needed)
2. Click your **setnayan-platform** project
3. Left sidebar → **Authentication**
4. **Sessions** tab (or "Configuration" → "Sessions" depending on version)

### Step 2C.2 — Bump JWT expiry

The default is `3600` seconds (1 hour). On the boundary, browsers / PWAs
sometimes fail to refresh cleanly and the user is bounced to `/login`.

| Field | What to set |
|---|---|
| **Access token (JWT) expiry** | `86400` (24 hours) — recommended; or `604800` (7 days) for a more "set-and-forget" feel |
| **Refresh token reuse interval** | Leave at default (10 s) unless you have a specific reason |

Click **Save**.

### Step 2C.3 — Confirm session lifetime is generous

Scroll for these (names vary by dashboard version):

- **Inactivity timeout** — set to `Never` or at least `30 days`. This is what kills sessions after a long offline period.
- **Session timebox** — leave **disabled**. (When enabled, it forces re-auth at a fixed cadence regardless of activity — usually not what you want for a wedding-planning app where couples open it once a month for a year.)

Click **Save** for each.

### Step 2C.4 — Verify

1. Sign out, sign back in
2. Close the browser entirely
3. Reopen, hit https://setnayan.com/dashboard
4. You should land on the dashboard without re-auth

If you still get bounced to `/login`, paste me a screenshot of the browser's cookies for `setnayan.com` (DevTools → Application → Cookies). I'll read which cookies are there + their expiry dates.

---

## Phase 2D — Social login providers (30 min, Google + Facebook)

**Why:** Hosts can now log in with Google or Facebook in addition to email + password / magic-link. Engineering shipped per owner directive 2026-05-23 (Apple deferred to V1.1 since it requires Apple Developer Program enrollment $99/yr). Both buttons render at the top of `/login` and `/signup` BUT they're dark until you toggle the providers ON in Supabase Studio and paste credentials. Without these steps, clicking the buttons will error.

**Why Google + Facebook specifically:** Filipino market — every Android user has a Google account, and almost every Filipino uses Facebook daily. These two cover the overwhelming majority of new signups for less work than email confirmation flows.

### Step 2D.1 — Google OAuth (10 min)

Reuse the existing Google Cloud project from your YouTube OAuth setup (CLAUDE.md 2026-05-18 row 7 — `Setnayan` project on Google Cloud Console). The YouTube OAuth client there can be extended with Google Sign-In scopes without creating a new client.

1. Open https://console.cloud.google.com → pick the **Setnayan** project
2. Left sidebar → **APIs & Services** → **Credentials**
3. Click the existing **Setnayan Web — Production** OAuth 2.0 Client ID (the one from YouTube work)
4. Scroll to **Authorized redirect URIs**
5. Click **+ ADD URI** and paste your Supabase callback URL — get it from Supabase Studio at step 2D.2 below. The format is `https://<your-project-ref>.supabase.co/auth/v1/callback`
6. Click **SAVE**
7. Back at the OAuth client overview, **copy the Client ID** + **copy the Client Secret** (you'll paste them in step 2D.2)

> **Note:** Google Sign-In with the standard `email + profile + openid` scopes (which is what Supabase requests by default) does NOT require Google's "verified app" review. You're already past that gate for those scopes. The YouTube `youtube` + `youtube.upload` scopes from the YouTube work are a SEPARATE Verification Phase 2 review (still pending for that work, doesn't block Sign-In).

### Step 2D.2 — Wire Google into Supabase

1. Open https://supabase.com/dashboard → **setnayan-platform** project
2. Left sidebar → **Authentication** → **Providers**
3. Find **Google** in the list → click to expand
4. Toggle **Enable Sign in with Google** ON
5. Paste the **Client ID** from step 2D.1 step 7 into **Client ID** field
6. Paste the **Client Secret** from step 2D.1 step 7 into **Client Secret** field
7. **Skip Authorized Client IDs** (leave blank — that's for native iOS / Android only, not web)
8. Click **Save**
9. **Copy the Callback URL** Supabase shows in the same panel (looks like `https://njrupjnvkjkitfctetvi.supabase.co/auth/v1/callback`) — if you didn't paste this exact URL in step 2D.1 step 5, go back and paste it now

### Step 2D.3 — Flip the Vercel env flag for Google

Without this step, the Continue with Google button stays hidden — owner directive 2026-05-23 added env-flag gates so unconfigured providers don't 404 on click.

1. Open https://vercel.com/icasa-offroad/setnayan-platform-web → **Settings** → **Environment Variables**
2. Add a new variable:
   - **Key**: `NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED`
   - **Value**: `true`
   - **Environments**: Production + Preview + Development (all three)
3. **Save** → trigger a redeploy (Deployments tab → ... menu on the latest → **Redeploy** with "Use existing build cache" UNCHECKED so the new env value is picked up)

### Step 2D.3b — Verify Google works

1. Open https://www.setnayan.com/login in an incognito window
2. You should see a **Continue with Google** button at the top
3. Click it
4. Google's consent screen appears → click **Continue**
5. You should land on the Setnayan dashboard (auto-creates a `customer` account if first sign-in, signs in existing user otherwise)
6. Sign out → repeat from a fresh incognito to confirm it works for new accounts

### Step 2D.4 — Facebook OAuth (15 min)

You need a Meta for Developers App for Facebook Login. Free, takes ~15 min.

1. Open https://developers.facebook.com → click **My Apps** → **Create App**
2. **Use case** = **Authenticate and request data from users with Facebook Login** → **Next**
3. **App name** = `Setnayan` (or your preferred display name — this is what users see on the consent screen)
4. **App contact email** = your email
5. **Business portfolio** = pick one or **I don't want to connect a business portfolio** for now
6. Click **Create app**
7. After creation, in the left sidebar → **Add product** → find **Facebook Login** → click **Set up**
8. Choose **Web** as the platform
9. **Site URL** = `https://www.setnayan.com` → **Save** → **Continue**
10. Left sidebar → **Facebook Login** → **Settings**
11. **Valid OAuth Redirect URIs** = paste your Supabase callback URL (same one as Google in step 2D.2 step 9 — looks like `https://njrupjnvkjkitfctetvi.supabase.co/auth/v1/callback`)
12. **Save changes** at the bottom

### Step 2D.5 — Get Facebook credentials

1. Left sidebar → **App settings** → **Basic**
2. **Copy the App ID** (visible at the top)
3. Next to **App secret** click **Show** → enter your Facebook password if prompted → **copy the App Secret**

### Step 2D.6 — Wire Facebook into Supabase

1. Back to https://supabase.com/dashboard → **setnayan-platform** project → **Authentication** → **Providers**
2. Find **Facebook** → click to expand
3. Toggle **Enable Sign in with Facebook** ON
4. Paste **Facebook App ID** from step 2D.5 step 2
5. Paste **Facebook App Secret** from step 2D.5 step 3
6. Click **Save**

### Step 2D.7 — Make the Facebook App live (for non-developer testers)

By default a new Facebook App is in **Development mode** which means only people you've explicitly added as developers / testers can log in. To make it public:

1. Top of dashboard → **App Mode** toggle on the right
2. Flip from **Development** to **Live**
3. Facebook may ask for a **Privacy Policy URL** = `https://www.setnayan.com/privacy` (already exists)
4. Facebook may ask for **Data Deletion Instructions URL** = `https://www.setnayan.com/privacy#data-rights` (the privacy page has the data-rights section per PR #273)
5. Confirm the switch to Live

> **Note:** The Basic `email + public_profile` scopes Supabase uses do NOT require Meta App Review. You can go Live immediately. Any additional scope (friends list, posts, etc. — which Setnayan does NOT need) WOULD require review.

### Step 2D.7b — Flip the Vercel env flag for Facebook

Mirror of step 2D.3 for Google. Without this, the Continue with Facebook button stays hidden.

1. https://vercel.com/icasa-offroad/setnayan-platform-web → **Settings** → **Environment Variables**
2. Add a new variable:
   - **Key**: `NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED`
   - **Value**: `true`
   - **Environments**: Production + Preview + Development
3. **Save** → trigger a redeploy with the build cache disabled

### Step 2D.8 — Verify Facebook works

1. Open https://www.setnayan.com/login in a fresh incognito window
2. You should see a **Continue with Facebook** button below the Google button at the top
3. Click it
4. Facebook's consent screen appears → click **Continue as <your name>**
5. You should land on the Setnayan dashboard
6. Sign out → try from a fresh incognito with a different Facebook account if you have one (to confirm new-user signup works)

### What if a button errors after step 2D.6?

The most common cause is the redirect URI mismatch — the URL pasted in the provider console (Google Cloud / Meta Developers) must EXACTLY match what Supabase generated. If you see "redirect_uri_mismatch" or similar:

1. Go back to https://supabase.com/dashboard → **setnayan-platform** → **Authentication** → **Providers** → **Google** (or Facebook)
2. Copy the **Callback URL (for OAuth)** value from the panel
3. Paste that EXACT URL (including the `https://` prefix and trailing path) into the provider console's redirect URI list
4. Save in both places
5. Wait ~2 min for the change to propagate, then retry

---

## Phase 3 — Custom domain (1 hour + DNS propagation)

**Why:** Right now the app lives at `setnayan-platform-web.vercel.app`. For
launch you'll want `setnayan.com` (or your owned domain) so links + emails
look real.

### Step 3.1 — Make sure you own the domain

If you already own `setnayan.com`:
1. Sign in to wherever you bought it (Cloudflare, GoDaddy, Namecheap, etc.)
2. Confirm it's not expired

If you don't:
1. Go to https://www.namecheap.com or https://cloudflare.com/products/registrar
2. Search for `setnayan.com` (or your preferred name)
3. Buy it (typically ₱600-1,200/year)
4. Wait 10-30 min for the registration to fully activate

### Step 3.2 — Point the domain at Vercel

1. In Vercel → setnayan-platform-web → **Settings** → **Domains**
2. Type `setnayan.com` and click **Add**
3. Vercel shows you the DNS records to add (typically an A record or CNAME)
4. Open your DNS dashboard (Cloudflare or wherever)
5. Add the records Vercel showed you
6. Back in Vercel, wait for the green check next to your domain (takes 5 min - 24 hours)
7. Also add `www.setnayan.com` if you want both — Vercel auto-redirects www→apex

### Step 3.3 — Update the app's base URL

1. In Vercel → Environment Variables
2. Find `NEXT_PUBLIC_APP_URL` (or add it if missing)
3. Set value to `https://setnayan.com`
4. Click **Save**
5. Redeploy (Deployments → latest → Redeploy)

### Step 3.4 — Update Supabase Site URL

1. Open https://supabase.com/dashboard/project/njrupjnvkjkitfctetvi
2. Sign in
3. Click **Authentication** (left sidebar) → **URL Configuration**
4. Change **Site URL** to `https://setnayan.com`
5. Add `https://setnayan.com/auth/callback` to **Redirect URLs** if not already there
6. Click **Save**

### Step 3.5 — Verify

1. Open https://setnayan.com in incognito
2. The marketing landing should load
3. Sign up a test couple — confirmation email links should now point to `setnayan.com`, not `setnayan-platform-web.vercel.app`

---

## Phase 4 — Walk the verification path (30 min)

**Why:** Before declaring V1 launchable, confirm every critical flow works
end-to-end with your real merchant info and real emails.

Open `HANDOFF.md` in the repo and follow **§ 5 Verification path** —
specifically:
- Flow 4: Vendor signup → couple-vendor chat
- Flow 5: Orders → payments → receipts (the commerce loop)
- Flow 8: API gateway

If anything fails, save the URL you were on + the error message and let me
know.

---

## Phase 5 — Spec corpus sync via Cowork (1-2 hours)

**Why:** The spec corpus at `~/Documents/Claude/Projects/Setnayan/` is the
source of truth for product decisions. Several iterations shipped with
deliberate trade-offs that haven't been reconciled with the spec docs yet.

Open `CHANGELOG.md` and find the consolidated entry at the top
("PRE-LAUNCH SPRINT COMPLETE — 19 iterations + 2 polish rounds"). The
**SPEC IMPACT** section lists 18 iteration docs that need Cowork edits.

For each one:
1. Open the spec file at `~/Documents/Claude/Projects/Setnayan/04_Iterations/<filename>.md`
2. Find the "Scope" or "What ships in V1" section
3. Add a "V1 actual" subsection that captures what was actually built
4. Add a "Deferred" subsection with what's been pushed to a follow-on
5. Save via Cowork

This is grindy but important — drift between live behavior and spec docs
compounds. Future Claude Code sessions will rely on these spec docs to
make good decisions.

---

## Phase 6 — V1.0 polish (each is optional)

These each improve the platform but aren't required to launch. Pick whichever
matters most for your timeline.

### Sentry (error tracking, ~20 min, free tier OK)

**Why:** Right now if something breaks in production, you only find out via
user reports. Sentry catches every JavaScript error + server error and pings
you.

**Status:** `@sentry/nextjs` SDK is already wired in the repo (`apps/web/sentry.server.config.ts`
+ `sentry.edge.config.ts` + `instrumentation.ts`). It activates automatically
in production when `SENTRY_DSN` is set in Vercel env.

1. Sign up at https://sentry.io
2. Create a new project → choose **Next.js** as the platform
3. Sentry gives you a DSN string (looks like `https://abc123@sentry.io/456`)
4. Add to Vercel env vars: `SENTRY_DSN=<your DSN>` (production scope at minimum;
   preview/development optional — local dev errors stay in the terminal)
5. Redeploy
6. Configure an alert rule in Sentry (Settings → Alerts → "Issues" rule) to
   notify your email or Slack on new errors. Without an alert rule, Sentry
   captures errors silently and you'll only see them by opening the dashboard.

#### Step Sentry.7 — Verify capture + alert routing (punch-list #19e)

Once the DSN is set and you've redeployed, walk this verification to
confirm Sentry captures errors AND your alert rule routes them to the
right destination:

1. Open `https://setnayan.com/admin/settings` while signed in as an admin user
2. Scroll to the **System health** section near the bottom
3. Click **Fire Sentry smoke test (admin only)**
   - The button posts to `/api/admin/sentry-smoke-test` (POST-only — cannot be
     triggered by URL paste or Vercel preview crawlers)
   - You'll see a green box with a `trace_id` (8 hex chars, e.g. `a3f9b1c2`)
   - The endpoint throws a controlled error 100ms after responding, tagged
     `source=manual-smoke-test` + `initiated_by=<your email>`
4. **Verify capture** — open your Sentry project dashboard. The error should
   appear within 60 seconds. Search by the `trace_id` to find it directly. The
   error message will read: `Sentry smoke test — <trace_id> — owner-initiated controlled error`
5. **Verify alert routing** — check the inbox/Slack channel your Sentry alert
   rule targets. The alert should arrive within 60 seconds of capture. If the
   error is in Sentry but no alert fired, your alert rule isn't routing
   correctly — fix that in Sentry → Settings → Alerts before launch.

If the trace appears in Sentry **and** the alert lands in your inbox/Slack
within 60s, punch-list item #19e is closed and Sentry is verified for prod.

### PostHog (product analytics, ~20 min, free tier OK)

**Why:** Track which features couples actually use, where they drop off, what
themes are popular. Cheap to set up, easy to skip.

1. Sign up at https://posthog.com
2. Create a project
3. Copy the **Project API key**
4. Add to Vercel: `NEXT_PUBLIC_POSTHOG_KEY=<your key>` and `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` (or eu host)
5. Redeploy

Same as Sentry — let me know when you're ready and I'll wire `posthog-js` in.

### R2 file uploads — set the bucket CORS policy (~5 min, ONE-TIME, blocking)

**Status:** The upload UI is already shipped and live (`<FileUpload>` → the
`/api/upload` presigned-PUT route), and the R2 credentials are set in Vercel.
The one remaining step is the **bucket CORS policy** — without it, every
browser upload fails.

**Why:** Browser uploads go client → `/api/upload` (presign, same-origin) →
XHR `PUT` straight to the R2 bucket (CROSS-origin). R2 only adds the
`Access-Control-Allow-Origin` header when a bucket CORS rule matches the
request, so with no rule the browser masks even a clean upload as a network
error — the uploader shows *"Upload failed … Check your connection and retry."*
with no HTTP status. (A presign that succeeds but an upload that `onerror`s,
rather than "R2 rejected (status N)", is the tell-tale sign of missing CORS.)

> ⚠ R2 matches `AllowedOrigins` **exactly**. The live site is served from
> `https://www.setnayan.com`, so a policy listing only `https://setnayan.com`
> (no `www`) still blocks every upload. List both.

**Fastest path — run the checked-in script** (applies the policy to all 5
buckets, idempotent):

```bash
R2_ACCOUNT_ID=…  R2_ACCESS_KEY_ID=…  R2_SECRET_ACCESS_KEY=… \
  apps/web/scripts/r2-cors.sh
```

**Dashboard path** (no CLI): https://dash.cloudflare.com → R2 → for **each** of
the 5 buckets (`setnayan-media`, `setnayan-thread-files`,
`setnayan-vendor-contracts`, `setnayan-samples`, `setnayan-vendor-verification`)
→ **Settings → CORS Policy** → paste:

```json
[
  {
    "AllowedOrigins": [
      "https://www.setnayan.com",
      "https://setnayan.com",
      "https://*.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

CORS takes effect immediately — no redeploy. Hard-refresh the page (to drop a
cached failed preflight) and retry the upload.

The R2 env vars themselves (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, and optional `R2_PUBLIC_URL`) are already set in Vercel;
the bucket names are hardcoded in `apps/web/lib/r2.ts` (no per-bucket env vars).

### R2 media public host — edge-cache the homepage hero + fix vendor/profile photos (~10 min, recommended)

**Status:** Public media (homepage hero frames, vendor logos, profile photos)
is served today from R2's **private S3 API endpoint**
(`setnayan-media.<account>.r2.cloudflarestorage.com`) via short-lived **presigned
URLs**. The app already browser-caches the hero frames on this path (PR #1427),
but presigned URLs can't be cached at Cloudflare's edge and they expire, so:
returning visitors still re-download occasionally, and a plain `<img>` against
the raw S3 endpoint 400s (which is why some vendor/profile photos don't show).

**Why this is the better end-state:** point the **`setnayan-media`** bucket at a
real **public host** and every media object becomes a stable, plain URL that
Cloudflare caches at the **edge** AND the browser caches **permanently** — the
hero loads near-instantly on repeat visits worldwide, and vendor/profile photos
resolve directly. **No code change is needed** — `apps/web/lib/hero-video.ts`
and `lib/r2.ts` already auto-switch from presigned to public URLs the moment
`R2_PUBLIC_URL` is a real host instead of the S3 endpoint.

> ⚠ Only the **`setnayan-media`** bucket should be public. The other four
> (`setnayan-thread-files`, `setnayan-vendor-contracts`, `setnayan-samples`,
> `setnayan-vendor-verification`) hold private files and must STAY private —
> they keep using presigned URLs.

> 📌 **DNS reality (checked 2026-06-15):** `setnayan.com` DNS is on **GoDaddy**
> (nameservers `ns09/ns10.domaincontrol.com`; `www` → Vercel). R2 **custom
> domains require the zone to be managed by Cloudflare**, so `media.setnayan.com`
> is **NOT** a quick click today — it needs a full DNS migration of the domain to
> Cloudflare first (Path B). **Do Path A (r2.dev) now** for the immediate win;
> do Path B later for the production end-state. Both use the same `R2_PUBLIC_URL`
> step — only the host value differs.

#### Path A — r2.dev URL (do this now · ~5 min · no DNS work)

1. https://dash.cloudflare.com → R2 → **`setnayan-media`** → **Settings** →
   **Public access** → enable the **R2.dev subdomain** (accept the prompt).
2. Copy the URL it gives you — it looks like `https://pub-<hash>.r2.dev`.
3. Jump to **"Point the app at it"** below and use that URL.

r2.dev is **rate-limited and officially "not for production traffic"**, but
you're pre-public-launch with low traffic and the app browser-caches frames
(PR #1427), so it's a fine interim — fully reversible by disabling the subdomain.

#### Path B — custom domain `media.setnayan.com` (later · production end-state)

Requires the `setnayan.com` zone to live on Cloudflare. Because it's on GoDaddy
today, this is a **domain migration, not a one-off step**:

1. Add `setnayan.com` as a site in Cloudflare (free plan) → Cloudflare scans and
   imports the existing records.
2. **Verify every record came across** — especially the Vercel `www`/apex records
   (`cname.vercel-dns.com` / the A records), any email (MX/SPF/DKIM), and Supabase
   /verification TXT records. A missed record = that service goes dark when NS cut over.
3. At **GoDaddy**, change the nameservers to the two Cloudflare assigns. Propagation
   is minutes-to-hours.
4. Once the zone is active on Cloudflare: R2 → **`setnayan-media`** → **Settings** →
   **Public access** → **Connect Domain** → `media.setnayan.com`. Cloudflare
   provisions the cert + routing automatically.
5. Update `R2_PUBLIC_URL` to `https://media.setnayan.com` and redeploy.

This is worth doing eventually (real CDN caching, no rate limits, and the whole
stack benefits from Cloudflare), but it's not required for the speed win.

**Point the app at it.** Vercel → project → **Settings → Environment Variables**
→ set **`R2_PUBLIC_URL`** to your chosen host, with **no bucket segment and no
trailing slash**:

```
# Path A (now):
R2_PUBLIC_URL = https://pub-<hash>.r2.dev
# Path B (later):
R2_PUBLIC_URL = https://media.setnayan.com
```

(The code builds `${R2_PUBLIC_URL}/${key}` — the host must be bound to the media
bucket, so the key sits right at the root. Do NOT use the S3 endpoint here.)

**Redeploy.** Vercel → Deployments → redeploy latest (or push any commit). The
homepage is force-dynamic, so the next render emits public URLs.

**Verify:** hard-refresh `https://www.setnayan.com`, open DevTools → Network →
filter `media` — the hero frame requests should now point at your public host
(`pub-….r2.dev/...` or `media.setnayan.com/...`), return **200** with a
`cache-control` header, and show `(disk cache)` / `cf-cache-status: HIT` on a
second load. Vendor/profile photos elsewhere in the app should also render.

> 🧹 **Housekeeping (no rush, $0):** re-uploading the hero leaves the old frames
> orphaned in `setnayan-media` (the uploader writes new keys, never deletes old
> ones) — that's most of the bucket's ~1,600 objects / ~420 MB today. Harmless
> well under R2's 10 GB free tier; a one-shot cleanup script can sweep stale
> `hero-frames/` keys whenever you want to tidy up.

### Daily.co video (for vendor meetings, ~30 min, free tier limited)

**Why:** Iteration 0019 chat shipped without video. Adding Daily.co means
couples + vendors can hop into a video call from inside the chat thread.

1. Sign up at https://www.daily.co
2. Create a property (free tier = 4 participants, 30 min meetings)
3. Get API key
4. Add to Vercel: `DAILY_API_KEY=<key>`
5. Let me know — I'll wire it into the chat thread page (~2 hours)

### Code signing certs (~4-6 weeks for first issue, ~₱5,000-15,000/year)

**Why:** Tauri desktop builds (`.dmg` for Mac, `.msi` for Windows) currently
get quarantined by Gatekeeper / SmartScreen. Real cert removes the warning.

- **macOS**: enrol in [Apple Developer Program](https://developer.apple.com/programs/) (~$99/year, requires Apple ID with phone verification)
- **Windows**: buy a code-signing cert from DigiCert, Sectigo, etc. (~$200/year)

Once you have certs, update `.github/workflows/build-desktop.yml` with the
cert details. Skip this for now if web is the primary surface.

---

## Phase 7 — When you're ready to invite real users

Final checklist before sharing the URL with anyone:

- [ ] Phase 1 done — settings populated with real business info
- [ ] Phase 2 done — Resend wired + tested with a real signup
- [ ] Phase 3 done — `setnayan.com` resolves to the app
- [ ] Phase 4 done — verification path passed end-to-end
- [ ] Phase 5 done — spec corpus reconciled (or at least the critical iterations)
- [ ] Privacy + Terms reviewed by counsel (current versions are starter drafts)
- [ ] BIR registration confirmed (real TIN in settings, not placeholder)
- [ ] At least one real test order completed end-to-end (request → quote → pay → receipt)

When all of those are checked, you can confidently share `setnayan.com` with
your wedding cohort.

---

## Manual smoke test — day-of PWA offline shell (5 min, optional)

**Why:** Task #13 (2026-05-22) shipped ISR + day-of mode + guest preload on
the public guest invitation surface (`/{slug}`) so a guest at the venue with
weak WiFi still sees the invitation if they reload. This is a hand check —
the platform doesn't have Playwright wired yet, so we verify in DevTools.

1. Open a Chrome window in Incognito (so SW state is clean)
2. Navigate to `https://setnayan-platform-web.vercel.app/{test-couple-slug}`
   (replace with a real seeded couple slug from your dashboard)
3. **First visit (online):** confirm the page renders the monogram + greeting
   + QR card normally
4. Open DevTools → **Application** tab → **Service Workers** sidebar — confirm
   `sw.js` is registered and **Status: activated and is running**
5. Application → **Cache Storage** sidebar — expand `setnayan-v1` and confirm
   the `/{slug}` path appears (means SW cached the navigation HTML)
6. DevTools → **Network** tab → check the **Offline** dropdown (or set throttling
   to **Offline**)
7. Reload the page (Cmd+R / Ctrl+R)
8. **Pass:** page renders with monogram, "You are invited" heading, and at
   least the hero section visible — no "you're offline" Chrome error page,
   no blank screen
9. **Fail:** if you get the Chrome dinosaur or blank page, capture the
   Application → Service Workers state and ping back

**Day-of mode branches** — these are tied to the event's `event_date` column
so you'll need to either:

- Use a seeded event with `event_date` set to today (live phase: T-1h to T+8h)
- OR temporarily change a test event's date via Admin → Events → Edit
- OR test on a future event where the phase is `inactive` (default behavior)

When live, you should see a green "Live now" banner above the hero and the
day-of schedule pinned to the top of the article. When in post phase (T+8h
to T+24h past the event), you'll see a quiet "Thank you for celebrating"
banner instead.

V1.1 follow-up: per-guest table-assignment preload (the guest's seating chart
served from cache when offline) is intentionally deferred — see Task #9 audit
findings.

---

## If something breaks

1. Check `/admin/help` first — useful for reproducing issues users report
2. Open Vercel → Deployments → latest → **View Logs** to see server-side errors
3. Open Supabase → Logs → API Logs for database-level issues
4. As a last resort, ping back with the URL + error and I'll dig in

Good luck.
