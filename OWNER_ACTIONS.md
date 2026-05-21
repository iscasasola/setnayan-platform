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

## Phase 1 — Fill in business info (15 min, no signups required)

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

1. Sign up at https://sentry.io
2. Create a new project → choose **Next.js** as the platform
3. Sentry gives you a DSN string (looks like `https://abc123@sentry.io/456`)
4. Add to Vercel env vars: `SENTRY_DSN=<your DSN>`
5. Redeploy

The wiring code isn't in the repo yet because the SDK choice depends on which
features you want (replays, performance, etc.). When you're ready, I can ship
a follow-on that adds `@sentry/nextjs` and wires the DSN through.

### PostHog (product analytics, ~20 min, free tier OK)

**Why:** Track which features couples actually use, where they drop off, what
themes are popular. Cheap to set up, easy to skip.

1. Sign up at https://posthog.com
2. Create a project
3. Copy the **Project API key**
4. Add to Vercel: `NEXT_PUBLIC_POSTHOG_KEY=<your key>` and `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` (or eu host)
5. Redeploy

Same as Sentry — let me know when you're ready and I'll wire `posthog-js` in.

### R2 file uploads (~2 hours, no signup if your R2 buckets are already provisioned)

**Why:** Right now vendor logos, payment screenshots, profile photos all
accept URL strings only. Couples have to host their files elsewhere (Drive,
Imgur). Wiring R2 lets them upload directly from the form.

1. Open https://dash.cloudflare.com → R2
2. Confirm the 4 Setnayan buckets exist
3. For each bucket, **Settings** → **CORS Policy** — allow PUT from `setnayan.com`
4. Get an R2 access key (R2 → Manage R2 API Tokens → Create Token)
5. Add to Vercel:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_LOGOS`
   - `R2_BUCKET_SCREENSHOTS`
6. Let me know — I'll ship the upload UI as a follow-on (signed PUT URL pattern, ~2 hours of work)

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
