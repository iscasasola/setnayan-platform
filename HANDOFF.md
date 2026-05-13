# Setnayan V1 — Pre-launch handoff

> Single document for taking over the project cold — whether that's a future
> Claude Code session, a teammate, or the owner returning after a break.
> If something here contradicts `STATUS.md`, this doc wins (and `STATUS.md`
> needs an update).

**Last touched:** 2026-05-13
**Owner's deadline anchor:** December 2026 wedding

---

## 1. What V1 is

Setnayan is the **Philippines-first life-events platform**. V1 surface is
weddings — three user personas, one Next.js codebase:

- **Couple** (`account_type='customer'`) — plans their wedding end-to-end
- **Vendor** (`account_type='vendor'`) — sells services to couples
- **Admin** (`is_internal=TRUE` / `is_team_member=TRUE`) — the Setnayan team

Multi-platform Day 1: web (Vercel) + desktop (Tauri macOS+Windows) +
installable PWA (iPhone, Android, iPad). Single codebase.

---

## 2. Live surfaces

### Marketing (public)

- `/` — hero + features + roadmap + footer (signed-out visitors)
- `/help` — 22 FAQ articles + contact form (anon + authenticated)
- `/login`, `/signup` (couple ↔ vendor radio choice on sign-up)

### Couple dashboard

| Path | Purpose |
|---|---|
| `/dashboard` | Event picker (auto-jumps to event home if exactly 1 active) |
| `/dashboard/[eventId]` | Home — welcome, 6-stage strip, NEXT UP, 9-step Guided Planner, 10-tile grid, activity feed |
| `/dashboard/[eventId]/guests` | Guest list — 18 Filipino roles, CSV import, plus-ones, role chips with palette dots |
| `/dashboard/[eventId]/guests/new` · `/[guestId]` · `/import` | Add / detail / CSV |
| `/dashboard/[eventId]/invitation` | Branded QR admin: monogram, slug, "Preview as guest", per-guest re-issue, print sheet |
| `/dashboard/[eventId]/invitation/print` | A4 QR sheet for printing |
| `/dashboard/[eventId]/vendors` | Couple's vendor tracker — 28 categories, 6-stage status |
| `/dashboard/[eventId]/budget` | Line items + payment log + .ics export |
| `/dashboard/[eventId]/messages` · `/[threadId]` | Chat with Setnayan vendors |
| `/dashboard/[eventId]/seating` | Tables + drag-place floor plan + per-table assignments |
| `/dashboard/[eventId]/orders` · `/new` · `/[orderId]` | Apply for Setnayan services + log payments |
| `/dashboard/[eventId]/schedule` | Day-of timeline (admin) |
| `/dashboard/[eventId]/services` | Service launcher (Mood Board, Save the Date, etc.) |
| `/dashboard/[eventId]/services/mood-board` | 9 palette groups (Venue / Couple / Roles) |
| `/dashboard/[eventId]/services/save-the-date` | 12-template gallery → orders flow |
| `/dashboard/notifications` | In-app feed with unread badge |
| `/dashboard/profile` | Personal info, theme, planner mode, RA 10173 export + soft-delete |
| `/dashboard/api-keys` | Create / list / revoke API tokens |

### Vendor dashboard

| Path | Purpose |
|---|---|
| `/vendor-dashboard` | Profile editor (business info, services checklist, contact) |
| `/vendor-dashboard/messages` · `/[threadId]` | Threads with couples (identity-masked) |
| `/vendor-dashboard/notifications` | In-app feed |

### Public invitation site

| Path | Purpose |
|---|---|
| `/[slug]` | Personal invitation site for guests with widgets: hero, RSVP, schedule, countdown, venue, dress code |
| `/[slug]/redeem?token=…` | Cookie-set route from a guest's personal link |
| `/[slug]/welcome` | TBA +1 first-name capture flow |

### Admin console

| Path | Purpose |
|---|---|
| `/admin` | Overview with 8 stat tiles |
| `/admin/users` | Filter, search, toggle team-pool, confirm email, restore deleted |
| `/admin/events` · `/admin/vendors` | Read-mostly tables with search + filter |
| `/admin/payments` | Reconciliation queue (approve / reject / quote) |
| `/admin/receipts` | Issued OR list with month filter + VAT totals |
| `/admin/help` | Help-inbox queue |

### Public API gateway

| Path | Auth | Returns |
|---|---|---|
| `GET /api/v1/health` | None | Liveness probe |
| `GET /api/v1/me` | Bearer `sk_live_…` | Caller's profile (whoami) |

### Tax + commerce

- `/receipts/[receiptId]` — auth-gated, print-friendly Official Receipt
- `/api/budget/[eventId]/ics` — auth-gated `.ics` export

---

## 3. Locked decisions

These are load-bearing — surface a question before changing them.

| Decision | Where it lives |
|---|---|
| **Token wallet retired (2026-05-11)** — apply-then-pay via 0034 orders + 0026 receipts | `CLAUDE.md` + 0034/0026 migrations |
| **Canonical entity IDs** — `S89<TYPE>-<10-char Crockford>` via `generate_public_id(letter)` | `20260512000000_setnayan_base.sql` |
| **RLS canonical patterns** — Pattern A (per-user) + Pattern B (event-scoped). Helpers: `is_admin`, `current_event_ids`, `current_couple_event_ids`, `current_user_guest_ids`, `current_vendor_profile_ids` | `02_Specifications/RLS_Policy_Pattern.md` |
| **28 vendor categories** locked — once couples have data referencing them, renaming is breaking | `vendor_category` enum |
| **6-stage vendor status** — considering → shortlisted → contracted → deposit_paid → delivered → complete | `vendor_status` enum |
| **9 planner step keys** — set_date, pick_venue, build_guests, customize_invite, set_slug (auto) + send_invites, book_vendors, finalize_seating, after_event (manual) | `apps/web/lib/planner.ts` |
| **4 theme palettes** — Setnayan Default / Victorian / Classy / iOS — RGB triplets in `globals.css` | `apps/web/app/globals.css` |
| **9 mood-board palette keys** in 3 families (Venue / Couple / Roles) | `apps/web/lib/mood-board.ts` |
| **Identity masking** in chat — vendors see `event.display_name + event_date` only, never couple email or personal name | enforced in `lib/chat.ts` queries + `lib/chat-actions.ts` |
| **Admin URL non-leakage** — `/admin` returns `notFound()` for non-staff, never redirects | `apps/web/app/admin/layout.tsx` |
| **Owner email auto-flag** — `iscasasolaii@gmail.com` gets `is_internal=TRUE` via the auth trigger | `20260512000000_setnayan_base.sql` |
| **VAT-inclusive pricing** — orders gross is what couples pay; receipt splits to pre-VAT + VAT (12%) | `lib/receipts.ts` + 0026 migration |
| **Auto-confirm signup** — V1 work-around; bypass when Resend wires | `apps/web/app/signup/actions.ts` |

---

## 4. Deferred, with what unblocks

### Owner-action-blocked (can't ship cold)

| Item | What unblocks it |
|---|---|
| **0032 Contract Intelligence** — AI vendor-contract parsing | Anthropic or OpenAI API key + R2 upload UI (own follow-on) |
| **0035 Observability** — Sentry / PostHog / Better Stack | Each requires owner-side account creation + key paste into env |
| **Real email delivery** (signup confirmations, vendor message alerts, payment notices) | Resend account, domain verification, paste SMTP creds into Supabase Auth |
| **Real BDO/GCash QR display** on order pages | Owner provides merchant QR images / account numbers |
| **BIR TIN + business name** on Official Receipts | Hard-coded `000-000-000-000` placeholder in `/receipts/[receiptId]/page.tsx` — replace before any real receipt is issued |
| **Daily.co video meetings** (0019 follow-on) | Daily.co account + API key |
| **Apple Developer + Windows code-signing cert** (Tauri builds) | Cert purchase; current builds are ad-hoc signed |
| **`setnayan.com` DNS** (custom Vercel domain, Resend domain verification) | Owner-side DNS records |

### V2-class (intentionally not in V1)

- Native iOS / Android binaries (web PWA covers V1)
- DSLR pairing (Phase 2)
- Full Remotion render pipeline for Save the Date (manual production via 0034 works for now)
- Real-time chat / push notifications via Supabase Realtime (V1 = page refresh)
- File upload UI to R2 (Logos, screenshots, photos all use URL strings for V1)
- Group threads / coordinator-join in chat
- Two-admin approval queue + audit log + impersonation in admin console
- Per-channel notification preferences

---

## 5. Verification path (cold start)

Three browser profiles minimum: **owner** (`iscasasolaii@gmail.com`),
**vendor-test** (a fresh account), **incognito guest**.

### Flow 1 — Couple basics
1. Sign in as owner → Home loads, NEXT UP card branches based on event state
2. Bottom nav: Home · Guests · Vendors · Budget · Services all reachable
3. Top bell: notifications page opens; unread badge accurate

### Flow 2 — Vendor sign-up + chat
1. Browser B: `/signup` → pick **Vendor** → enter email + password
2. Should auto-confirm (skip email) → land on `/login?ready=<email>`
3. Sign in → land on `/vendor-dashboard` → fill in Business name + **contact email** + Save
4. Browser A (couple): Home → Messages tile → type vendor's contact email → Start thread
5. Send "Hello!" → Browser B should see thread on `/vendor-dashboard/messages`
6. **Verify identity masking**: vendor's thread label shows event display_name (NOT couple's email)

### Flow 3 — Mood Board + guest list integration
1. `/dashboard/[eventId]/services/mood-board` → set Wedding Party palette (3+ colors), Bride palette
2. Save → go to `/dashboard/[eventId]/guests`
3. Guests with wedding-party roles show a colored dot beside their role chip matching palette

### Flow 4 — Seating drag-place
1. `/dashboard/[eventId]/seating` → add 3 tables
2. Drag one in the floor plan canvas
3. "1 unsaved move" appears → **Save layout** persists
4. Assign guests, capacity counter goes green at full, rose if overfilled

### Flow 5 — Orders + payments + receipts (end-to-end commerce)
1. As couple: Home → Orders tile → New order → fill description + budget → Submit
2. Reference code (e.g. `SNAB12CD34`) shows on order detail
3. As admin: `/admin/payments` → Orders needing quote → confirm total → couple gets notification
4. Couple: log a payment with channel "BDO" + the reference code in the reference field
5. Admin: Pending payments tab → **Reference matches** badge appears → Approve with "Also mark as paid" checked
6. Couple: gets two notifications (payment matched + order paid) + emerald "OR issued" banner on the order
7. Click **Open receipt** → new tab `/receipts/[id]` → press ⌘P → clean A4 PDF
8. Admin: `/admin/receipts` → see the OR in the list with VAT breakdown
9. Admin: filter by current month → totals strip updates

### Flow 6 — Notifications cross-action
- Send a chat message → other party gets `chat_message` notification
- Admin confirms quote → buyer gets `order_quoted`
- Admin rejects a payment → buyer gets `payment_rejected`
- All emit at `users.tour_completed_at IS NULL` time — also check the bell badge appears

### Flow 7 — Profile RA 10173
1. Profile → fill display name + phone → Save
2. **Download .json** → check JSON has profile + memberships + chat messages
3. Expand Delete account → type `DELETE` → confirm → land on `/login?error=Account+deleted`
4. Sign in as owner → `/admin/users` → filter Soft-deleted → **Restore** → sign back in

### Flow 8 — API gateway
```bash
curl https://setnayan-platform-web.vercel.app/api/v1/health
# 200: { "status": "ok", "api_version": "1", "timestamp": "…" }

# Create a key at /dashboard/api-keys, then:
curl https://setnayan-platform-web.vercel.app/api/v1/me \
  -H "Authorization: Bearer sk_live_…"
# 200: { "data": { user_id, email, display_name, … } }

# After revoking the key:
# 401: { "error": "revoked" }
```

### Flow 9 — Help center
1. Open `/help` in incognito → see 22 articles, sticky topic sidebar
2. Submit contact form → success banner with `S89M-…` ref
3. As owner: `/admin/help` → see the message → set status / add admin notes → Update

### Flow 10 — Guided tour
1. Profile → **Restart welcome tour**
2. Reload Home → 6-slide modal appears
3. Skip or Got it → modal dismisses → won't reappear until restart

---

## 6. Operational notes

### Database

- **Supabase project**: see Vercel env var `NEXT_PUBLIC_SUPABASE_URL` for the project ref. Region: Singapore.
- **Session pooler URL** (the working DB connection): not committed. Get it from the Supabase dashboard → Project Settings → Database → Connection string (Session pooler), or from the `SUPABASE_DB_URL` value in `apps/web/.env.local`. Format:
  `postgresql://postgres.<project_ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`
- **Migration path**: drop SQL into `supabase/migrations/<timestamp>_<name>.sql`, run
  `npx supabase db push --db-url "$SUPABASE_DB_URL"` from repo root
- 16 migrations applied as of this handoff

### Deployment

- **Web**: auto-deploys on push to `main` via Vercel
  → `https://setnayan-platform-web.vercel.app`
- **Desktop**: `.github/workflows/build-desktop.yml` builds `.dmg` + `.msi` on push to `main`
- **R2**: 4 buckets provisioned in APAC, none wired into the app yet

### Worktree workflow

You're working in a git worktree at `/Users/icecasasola/Setnayan-App/.claude/worktrees/funny-liskov-f9d95e`.
Commits to the worktree branch `claude/funny-liskov-f9d95e` get pushed
directly to `main` via `git push origin claude/funny-liskov-f9d95e:main`.
Worktree merges back into the main checkout automatically when complete.

### Env vars (in `apps/web/.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://njrupjnvkjkitfctetvi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
SUPABASE_SERVICE_ROLE_KEY=sb_secret_…
SUPABASE_DB_URL=postgresql://… (pooler)
NEXT_PUBLIC_APP_URL=https://setnayan-platform-web.vercel.app
```

Service-role key is in `.env.local` (gitignored). For Vercel, mirror these in
the project's Environment Variables panel.

### Files of note

- `apps/web/lib/supabase/admin.ts` — service-role client (bypasses RLS, server-only)
- `apps/web/lib/supabase/server.ts` — SSR client for server components / actions
- `apps/web/lib/supabase/client.ts` — anon client for browser
- `apps/web/lib/notification-emit.ts` — call `emitNotification(...)` from any server action
- `apps/web/lib/api-auth.ts` — `authenticateApiRequest(req)` for `/api/v1/*` route handlers

---

## 7. Owner action items (V1 → V1.0 launch)

In priority order:

### 🔴 Before launching to real users

1. **Configure Resend SMTP in Supabase Auth** so signup confirmations and password resets actually work.
   - Currently V1 auto-confirms via the admin client (bypass), but it's not real verification.
   - Steps: sign up at resend.com, verify a domain (use `setnayan.com` if owned, otherwise Resend's sandbox), paste SMTP creds into Supabase Dashboard → Project Settings → Auth → SMTP, flip "Confirm email" toggle on once SMTP works.
2. **Replace BIR TIN placeholder** in `apps/web/app/receipts/[receiptId]/page.tsx` with Setnayan's real TIN, registered business name, and address.
3. **Supply real merchant payment details** — BDO account / GCash number / QR images. Currently the order detail page says "details emailed once your order is confirmed" — owner emails manually for now; in-app QR display ships when assets are available.
4. **Walk the spec corpus** at `~/Documents/Claude/Projects/Setnayan/04_Iterations/` via Cowork and reconcile each affected file with the per-iteration SPEC IMPACT callouts in `CHANGELOG.md`.

### 🟡 V1.0 polish

5. **Wire Sentry / PostHog / Better Stack** for 0035 Observability — currently zero error tracking, zero analytics.
6. **Wire R2 upload UI** — unblocks: vendor logo upload (0022), screenshot upload on payments (0034), photo wall (0031), Save the Date clip handoff (0024).
7. **Daily.co integration** for video meetings (0019 follow-on).
8. **Replace 0030 guided-tour slide copy** with real product screenshots once design ships.
9. **`setnayan.com` DNS** — point CNAME to `setnayan-platform-web.vercel.app` so the app lives at a real domain.
10. **Apple Developer + Windows code-signing cert** so Tauri desktop builds don't trip Gatekeeper / SmartScreen.

### 🟠 V2 candidates

- 0032 Contract Intelligence (AI-powered)
- Marketplace surface (`/v/[slug]` vendor public pages)
- Hard-delete cascade for soft-deleted accounts (auto after 30 days)
- Customer TIN UI on Profile for B2B receipts
- Per-channel notification preferences + push (PWA)

---

## 8. Per-iteration spec-corpus sync checklist

Walk through each one in Cowork and update the spec doc to match what's shipped. See the consolidated SPEC IMPACT block at the top of `CHANGELOG.md` for the per-iteration deltas.

- [ ] 0006 Vendors Management
- [ ] 0007 Budget & Expenses
- [ ] 0008 Seating Chart Editor
- [ ] 0010 Mood Board
- [ ] 0015 Main Website
- [ ] 0019 Communications
- [ ] 0021 Couple Dashboard (Fully Purchased)
- [ ] 0022 Vendor Dashboard
- [ ] 0023 Admin Console
- [ ] 0024 Save the Date
- [ ] 0025 Profile Settings
- [ ] 0026 BIR Tax Compliance
- [ ] 0028 Email Notifications
- [ ] 0029 Help Center
- [ ] 0030 Guided Tour
- [ ] 0031 Day-of Guest
- [ ] 0033 Public API Foundation
- [ ] 0034 Payments & Cart

Plus locked-decision additions for `~/Documents/Claude/Projects/Setnayan/02_Specifications/`:
- [ ] `RLS_Policy_Pattern.md` § 4 — record `current_couple_event_ids`, `current_user_guest_ids`, `current_vendor_profile_ids` as canonical helpers
- [ ] Entity-ID type-letter registry — record `G` (guest), `T` (table), `V` (vendor entry), `B` (vendor profile), `H` (chat thread), `O` (order), `M` (help message), `K` (api key + schedule block)

---

## 9. Resuming from this handoff

1. `cd ~/Setnayan-App` (main checkout) or `cd .claude/worktrees/funny-liskov-f9d95e` (worktree)
2. `pnpm install`
3. Read this doc + `CLAUDE.md` + the spec corpus's `CLAUDE.md`
4. Run the **Verification path** above to confirm the state still matches
5. Pick from the **Owner action items** if launching V1, or pick the next iteration from `STATUS.md` if extending

Good luck.
