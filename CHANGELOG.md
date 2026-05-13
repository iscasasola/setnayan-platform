# Setnayan — Changelog

Append-only log of every meaningful code change. Newest at top. Each entry includes a `SPEC IMPACT` callout (even if "None") so spec-folder edits via Cowork are never missed.

---

## 2026-05-13 · 0021 transversal slice — themes, Lucide icons, new Home, Guided Planner

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — 4-theme system:** New CSS-variable theme blocks for Setnayan Default · Victorian · Classy · iOS in `apps/web/app/globals.css`. Tailwind `cream`, `ink`, and `terracotta` (incl. -600/-700) now resolve to `rgb(var(...) / <alpha-value>)`, so every `bg-cream/95`, `text-ink/40`, `border-terracotta` utility re-skins instantly. The dashboard layout reads `users.theme_preference` once per request and wraps its tree in `<div data-theme=…>`. Public invitation site at `/[slug]` stays on Setnayan Default (the theme picker is for the couple's admin chrome, not their guests' invitation).
- **Phase B — Lucide swap:** `lucide-react` added. BottomNav (Users / Briefcase / CalendarDays / Sparkles), Services launcher (Receipt / Palette / Camera / Tv / CloudUpload / Sparkles in tinted lockups), invitation slug status badges (Check / X / AlertTriangle / Loader2), and the guests-page Share/Clear chips now render Lucide strokes instead of emoji.
- **Phase C — New Home:** `/dashboard/[eventId]` was a redirect to `/guests`; it now renders a real home: warm welcome with time-of-day greeting + days-to-go, 6-stage strip (Dreaming → Booking → Inviting → Finalizing → Wedding Day → After) derived from event_date + guest count, NEXT UP card with branching logic (add first guests / set slug / send invites / lock seating / review), 8-tile nav grid (Guest List · Invitation · Vendors · Budget · Schedule · Seating · Services · Profile) with a guest-count counter on the Guest List tile, and a 6-row activity feed of recent guest additions.
- **Phase D — Guided Planner:** New migration `20260513070000_iteration_0021_planner.sql` adds `users.planner_mode` enum (`guided` | `diy`, default `guided`) and `event_journey_steps` table with Pattern B RLS (couple read + write via `current_couple_event_ids()`). New `apps/web/lib/planner.ts` defines 9 steps, derives 5 from existing event/guest state (date set, venue, guests, monogram/palette, slug), keeps 4 manual (send invites, book vendors, finalize seating, thank-yous), and exposes `resolveStepStatuses` + `plannerProgress`. New server action `toggleJourneyStep` upserts/deletes manual completions. New Checklist component on Home shows progress bar + 9 rows with hint text and links. Profile page gains a guided/DIY toggle that hides the checklist for couples who want to roam free.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0021_couple_dashboard_fully_purchased.md` — record the four-theme palette values (RGB triplets) and the 9-step planner key list since they will be referenced by iterations 0006 (Vendors), 0007 (Budget), 0008 (Seating), and 0025 (Profile Settings full surface). Specifically:
  - Theme palettes: Setnayan Default (`#FAF7F2 / #1A1A1A / #C97B4B`), Victorian (`#F5EBD9 / #2E1A1A / #8B1E3F`), Classy (`#F4F4F2 / #0F0F0F / #A38560`), iOS (`#F2F2F7 / #000000 / #007AFF`).
  - Planner step keys: `set_date`, `pick_venue`, `build_guests`, `customize_invite`, `set_slug` (all auto-derived), `send_invites`, `book_vendors`, `finalize_seating`, `after_event` (all manual).
  - Pattern B helper `current_couple_event_ids()` is now load-bearing for two surfaces; document in `02_Specifications/RLS_Policy_Pattern.md` § 5 mapping table as an established helper.

**Deferred (still gated on later iterations):**
- QR Hub, Gallery sub-page, Vendors / Budget / Schedule / Seating real surfaces — placeholder pages remain.
- Activity feed currently only shows guest additions; scan-event + RSVP-response items are a follow-on (data model exists, UI not yet wired).

---

## 2026-05-13 · 0002 deferral close-out — TBA onboarding, 6 widgets, limited +1 lock, real-time slug check

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — +1 TBA onboarding flow:**
  - New `/[slug]/welcome` route that captures a TBA +1's first + last name. Spec § +1 onboarding flow (lines 121–161).
  - Redeem handler detects TBA placeholders (`plus_one_of_guest_id IS NOT NULL && first_name='TBA' && plus_one_name_confirmed_at IS NULL`) and routes to `/welcome` instead of the personal invitation site.
  - Confirmation submit updates `guests.first_name`, `guests.last_name`, `guests.plus_one_name_confirmed_at = NOW()`, then records a scan_events row with `context.entry='plus_one_onboarded'` so the couple's admin can see the onboarding moment distinctly, then redirects to the standard personal invitation site.
  - "This isn't me" link clears the cookie via the existing sign-out flow.
  - `/[slug]` page also gates: if a guest re-arrives with an unconfirmed TBA cookie (clicked away mid-onboarding), they're re-routed to `/welcome`.
- **Phase B — 6 additional widgets** added to the personal invitation site:
  - **Countdown** (client component, ticks every second, auto-hides past the event date) — 4 boxes for D / H / M / S
  - **Venue** card with Google Maps deep-link "Get directions"
  - **Dress Code** with 5-swatch palette + Do/Don't grid using locked copy
  - **Photo Moments** 3-card grid (Bridal Walk · The Kiss · First Entrance) with locked spec copy
  - **Your Photos** placeholder + profile-photo card + "Add more via Shutter" (deferred to Phase 2)
  - **Public vs Registered tier comparison** with Sign-up free CTA
- **Phase C — Limited +1 full lock variant:**
  - When `plus_one_mode='limited'`, the tier comparison widget renders BOTH cards visually disabled (dashed borders, 55% opacity) and replaces the "Sign up free →" CTA with a "Learn more about Setnayan" link to the marketing site.
  - "Your photos" widget hides the "Add more via Shutter" card and replaces it with a "Your photos will be visible in your inviter's gallery" notice.
- **Phase D — Real-time slug availability check:**
  - New `/api/slugs/check` route handler returns `{ status: 'available' | 'taken' | 'current' | 'invalid_format' | 'reserved' }` with 3 suggested alternatives on `taken`.
  - New `SlugField` client component on the invitation admin uses 300ms debounce + `useTransition` for the save action. Visual states: `⋯` checking, `✓` available, `✗` taken, `⚠` invalid format. Suggestion chips populate inline; clicking one fills the field.
  - Save button is disabled until the current value is `available` AND differs from `initialSlug`.

**Build verification:** 6 new routes (`/[slug]/welcome`, `/api/slugs/check`, plus the previously-shipped 4) all compile and serve correctly.

**SPEC IMPACT:** None new this pass. The 2 spec impacts flagged in the previous 0002 entry remain pending Cowork update.

**Still deferred (genuinely blocked or out of V1 scope):**
- Branded QR with monogram-in-center compositing + 25-frame library (complex SVG work; not blocking)
- Per-role palette QR colors (waits on iteration 0010 palette finalization)
- 3-day photo retention enforcement for public guests (no photos yet)
- Post-download conversion screen (no photo download yet)
- Native-app scanning stubs (Phase 2/3 explicitly)
- Apple/Google Wallet pass generation (V1.5)
- Schedule widget (waits on iteration 0004 invitation widgets)

---

## 2026-05-13 · Iteration 0002 — QR Invitation System (MVP slice)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema migration `20260513050000_iteration_0002_invitation.sql`:**
  - `events.slug` + format CHECK + case-insensitive UNIQUE index; `events.palette_finalized_at`
  - `guests.profile_photo_url` + `profile_photo_set_at` + `profile_photo_segment`
  - `guests.plus_one_name_confirmed_at`, `guests.scan_tracking_opt_out`, `guests.download_completed_at`
  - `scan_events` table with `scan_source` enum; IP anonymized to first 3 octets per RA 10173
  - `slug_change_log` for 90-day SEO redirects
  - RLS: couples read their event's scan_events; guests read their own; service-role writes
- **Phase B — slug auto-generation** in `apps/web/lib/slugs.ts`. Wired into `createWeddingEvent` so every new event gets a unique slug on creation. Reserved-slug pool (admin, api, dashboard, login, etc.) blocked from claim.
- **Phase C — public guest invitation route at `/[slug]?invite=[token]`:**
  - Token validated via admin client (visitor isn't authed). On valid: signs HS256 JWT cookie (60-day expiry covers the 30-day post-event window), records a `scan_events` row, redirects to clean `/[slug]` URL.
  - Personal invitation site MVP: Hero with monogram placeholder · Greeting · QR card · RSVP form · Event details · sign-out
  - Limited +1 sees inline disclosure block (full Limited variant deferred)
  - Invalid token / wrong-event session → public landing with friendly message
- **Phase D — RSVP submission via `submitRsvp` server action** writes through admin client (visitor isn't authed). Sets `rsvp_responded_at` when status is attending or declined. Revalidates `/dashboard/[eventId]/guests` so couple sees changes immediately.
- **Phase E — Couple admin at `/dashboard/[eventId]/invitation`** (replaces 0000's placeholder):
  - Public-landing URL display + slug editor
  - Server-rendered QR thumbnails (qrcode npm, error correction level H, quiet zone 4)
  - Per-guest "Re-issue" button rotates `qr_token` (16 random bytes hex); old printed QRs become invalid immediately
  - Slug changes write to `slug_change_log` for the 90-day SEO redirect window
- **Phase F — Print sheet at `/dashboard/[eventId]/invitation/print`** with A4 `@page` rules + 3-column QR grid; direct-browser-print works.

**New libs:** `lib/slugs.ts`, `lib/qr.ts`, `lib/guest-session.ts` (JWT cookie helpers).
**New env var:** `GUEST_SESSION_SECRET` (32-byte hex). Falls back to `SUPABASE_SERVICE_ROLE_KEY` if unset.
**Backfill:** existing demo event `S89E-17VNTRAQD8` got slug `maria-and-juan` so the public route works against the seeded data.

**Deferred (logged for future polish):**
- Branded QR with monogram-in-center compositing + 25-frame library + simplified variants for QR-center
- Per-role palette QR colors (depends on iteration 0010)
- +1 TBA onboarding screen (column exists; UI deferred)
- Limited +1 invitation site full variant (currently inline banner only)
- 9 of 14 widgets: Countdown, Venue, Schedule, Dress Code, Photo Moments, Your Photos, Public vs Registered tier, Wallet save, Registered RSVP extras
- Real-time slug availability check with 300ms debounce + `/api/slugs/check` endpoint
- 3-day photo retention enforcement for public guests
- Post-download conversion screen
- Native-app scanning stubs (Phase 2/3)
- Apple/Google Wallet passes

**SPEC IMPACT — please update via Cowork:**
1. `0002_qr_invitation_system.md` line 888 (Notes for Claude Code) says "error correction level M"; locked structural rules at line 537 say level H. Implementation uses H. Fix the notes inconsistency.
2. `0002_qr_invitation_system.md` line 263 declares route `setnayan.com/dashboard/qr-codes` (couple admin); the actual implementation follows 0000's event-scoped pattern at `/dashboard/[event-id]/invitation`. Update the route declaration.

---

## 2026-05-13 · Iteration 0001 polish — detail/edit, plus-one UI, custom tags, invited-to blocks, CSV import

**Commits:** to be filled in once committed.

**What landed:**
- **`/dashboard/[eventId]/guests/[guestId]`** detail + edit page surfacing all 27 columns:
  - Identity, Categorization (side / group / role), RSVP & events (RSVP / meal / invited-to / dietary), Contact, Tags & notes, photo consent
  - **Soft delete** via `softDeleteGuest` server action — sets `deleted_at`, RLS-gated SELECT already filters it out
  - List rows + mobile cards now link to the detail page
- **Plus-one toggle** in the add-guest flow:
  - `<details>` progressive disclosure (no client JS — pure server-rendered)
  - Sub-block exposes first/last name (or blank for TBA) + Full/Limited mode radio
  - Server action creates the primary `guests` row, then a SECOND `guests` row with `plus_one_of_guest_id`, `plus_one_mode`, own auto-generated `qr_token` (per spec § Plus-one management)
  - TBA path: blank names persist a row with placeholder `first_name='TBA'` + `last_name='+1'` + display_name `"+ TBA · brought by {primary}"`
- **Custom tags** as comma-separated input on both add + edit forms — max 50 tags, persisted into `guests.custom_tags TEXT[]`
- **Invited-to schedule-block chips** on both add + edit — 5 blocks (ceremony · reception · cocktails · after_party · rehearsal_dinner). Ceremony + reception checked by default. Uses CSS `has-[:checked]` to style without client JS
- **`/dashboard/[eventId]/guests/import`** CSV import:
  - Paste-into-textarea flow (200-row cap)
  - Inline `parseCsv` helper in `lib/csv.ts` (quoted fields, escaped quotes, CRLF/LF/CR, empty cells)
  - Per-row validation against canonical enums; failed rows surface line-numbered errors; valid rows batch-insert in one statement
  - Returns to `/guests?imported=N&skipped=M`
  - Template + accepted-columns inline on the import page

**Deferred (not in this pass):**
- Households UI (the CSV importer stashes the household column into `guests.notes` as a placeholder until households UI ships)
- Address JSONB editor
- File-upload variant of CSV import (paste-only for now)
- Mobile-specific full-screen sheet variants of add/edit (responsive forms work cross-platform)
- Bulk-edit spreadsheet mode
- Resend-invitation action on detail page (depends on iteration 0028 email templates)
- Custom-tag chip input with autocomplete from existing tags (comma-separated input works for now)

**SPEC IMPACT:** None. All choices align with spec § Functional scope.

---

## 2026-05-13 · Hotfix — RLS infinite-recursion in event_members policies

**Commit:** `19242e4` · migration `20260513040000_fix_rls_infinite_recursion.sql`

**Symptom:**
Anyone signed in hitting `/dashboard` (or any page that queried event-scoped tables) got `Application error: a server-side exception has occurred`. Vercel runtime logs showed `Error: Failed to fetch events: infinite recursion detected in policy for relation "event_members"`.

**Root cause:**
Pattern B policies on `event_members`, `events`, `event_join_tokens`, `guests`, and `households` used inline subqueries like `event_id IN (SELECT event_id FROM event_members WHERE user_id = auth.uid() AND member_type = 'couple')`. When the outer query runs against `event_members`, the SELECT policy on `event_members` fires; the policy's USING clause issues that subquery; the subquery against `event_members` re-triggers the SELECT policy on `event_members`; Postgres aborts with the recursion error. This affected every page that read couple-scoped data through the user's JWT.

**Fix:**
Added two new SECURITY DEFINER helpers that bypass RLS for the lookup:
- `public.current_couple_event_ids()` — event_ids where the caller is `member_type='couple'`
- `public.current_user_guest_ids()` — guest_ids attached to caller's event_members rows

Rewrote 10 policies (4 on event_members, 2 on events, 1 on event_join_tokens, 2 on guests, 1 on households) to use the helpers instead of inline subqueries on event_members.

**Why this matters going forward:**
Every future Pattern B policy that needs "events where I'm a couple" must use `current_couple_event_ids()`. Inline `SELECT event_id FROM event_members WHERE ...` subqueries will recurse the same way.

**SPEC IMPACT — please update via Cowork:**
`02_Specifications/RLS_Policy_Pattern.md` currently documents 4 helpers (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`). Add the two new ones to that doc — `current_couple_event_ids` and `current_user_guest_ids` — so future iterations know to use them.

---

## 2026-05-13 · Iteration 0001-B — Seed sample guests + Join flow + next-redirect

**Commits:** to be filled in once committed.

**What changed:**
- **Migration `20260513020000_enable_pgcrypto.sql`** — enables pgcrypto in `extensions` schema (was needed for `gen_random_bytes` used by `event_join_tokens.token` and `guests.qr_token` defaults; Sprint 0 missed this).
- **Migration `20260513030000_fix_pgcrypto_qualification.sql`** — schema-qualifies all `gen_random_bytes()` calls (Supabase places pgcrypto in `extensions` schema; SECURITY DEFINER functions don't see it on the default search_path).
- **Seed** — inserted 15 canonical guests from the iteration 0001 fixtures into the owner's first event (Maria & Juan demo wedding). Done via one-off `/tmp/setnayan-seed/seed.mjs` using @supabase/supabase-js with service_role.
- **Join flow** (closes the iteration 0000 deferred work):
  - `/join/[eventId]?token=...` validates the event_join_tokens row via admin client, then asks unauthed visitors to sign in / create account, and shows the 18-role picker to authed visitors who aren't yet event members
  - `joinEventAction` server action: re-validates token, finds-or-creates a `guests` row by email match, inserts the `event_members` row via the user's own JWT (Pattern B's self-insert clause), then redirects to success page
  - `/join/[eventId]/success` confirmation page reachable by any event member, shows event name + role + dashboard CTA
- **`lib/supabase/admin.ts`** — service-role server client for operations that need to read or write data the current user can't see through RLS (e.g., validating an event-join token before the scanner has become an event_member). Strictly server-only.
- **`/login` and `/signup` actions honor `?next=/path`** so the join flow can round-trip through auth without losing the destination. Magic-link `emailRedirectTo` carries the `next` forward through `/auth/callback`. `safeNext()` validates relative-only paths to prevent open-redirect.

**SPEC IMPACT:** None. All choices align with the spec.

---

## 2026-05-13 · Iteration 0001 — Guest List (Phases A–C, MVP slice)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema migration `20260513010000_iteration_0001_guests.sql`:**
  - Enum `public.guest_role` with all 18 Filipino-wedding roles per spec § Role taxonomy
  - 5 supporting enums: `guest_side`, `guest_group_category`, `meal_preference`, `rsvp_status`, `plus_one_mode`
  - `public.households` table (no public_id surface — internal entity)
  - `public.guests` table with all 27 columns from the spec including `plus_one_*` columns, `photo_consent` (default TRUE per RA 10173), `invited_to_blocks` (default ceremony+reception), `custom_tags`, `qr_token` (auto-generated), `deleted_at` (soft delete)
  - `public_id` on guests follows `S89G-XXXXXXXXXX` canonical format
  - RLS Pattern B on both tables — event-scoped read, couple-write, admin override
  - Bonus policy: a registered guest can read their own row (for iteration 0002's invitation site rendering)
  - Retroactive FK: `event_members.guest_id → guests(guest_id) ON DELETE SET NULL`
- **Phase B — `/dashboard/[eventId]/guests` list view** (replaces the iteration 0000 placeholder):
  - Stats strip with 5 cards: Invited / Attending (emerald) / Pending (amber) / Declined (rose) / Plus-Ones (terracotta) — each card is a clickable filter
  - URL-based filter: `?rsvp=attending|pending|declined|maybe`
  - URL-based search: `?q=...` — fuzzy match on name + display name + email + custom tags
  - Desktop table (≥640px): avatar + name + plus-one hint + role + side pill + RSVP pill + contact
  - Mobile card list (<640px): avatar + name + role + RSVP pill
  - Empty states for both "no guests yet" and "no matches for filters"
  - Side-coded avatars (rose / sky / amber for bride / groom / both)
- **Phase C — `/dashboard/[eventId]/guests/new` add-guest form:**
  - 7-field MVP version: first/last name · side · group · role (all 18 options) · email · mobile · meal · RSVP · photo consent (default true) · notes
  - Server action `createGuest` with full validation against every enum value
  - On success → `revalidatePath` the list + redirect back to `/guests?added=1`
  - Plus-one model, address JSONB, custom tags, invited_to blocks UI — deferred to a follow-up
- `apps/web/lib/guests.ts` helper module — fetch/stats/labels/initials utilities + type unions for all enums

**Deferred from iteration 0001 (out of session scope):**
- Detail drawer (click row → side drawer with edit/delete)
- Plus-one toggle + TBA / Full / Limited modes UI (schema is ready, UI deferred)
- CSV import (200-row max)
- Households UI (create + assign)
- Custom-tag chips input with autocomplete
- Invited-to schedule-block toggles per guest
- Address JSONB editor
- Mobile-specific full-screen add-guest sheet (currently uses the same form)
- Bulk-edit spreadsheet mode

**SPEC IMPACT — please update via Cowork in `~/Documents/Claude/Projects/Setnayan/0001_creating_guest_list/`:**

1. **`0001_creating_guest_list.md` line 48** — declares route `setnayan.com/dashboard/guests`. Iteration 0000's locked URL pattern is `setnayan.com/dashboard/[event-id]/guests`. Update the route line to match.
2. **No retired-system references found** in the 0001 spec — good.

---

## 2026-05-13 · Iteration 0000 — App Shell & Navigation (Phases A–D)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema delta migration `20260513000000_iteration_0000_shell_schema.sql`:**
  - `users.phone`, `users.profile_photo_url`, `users.last_login_at`
  - `events.venue_name`, `events.venue_address`
  - `event_members.role` (free text for the 18-role taxonomy from 0001), `event_members.joined_via` enum (`qr_scan` / `invited` / `created_event` / `admin_added`)
  - `event_members.guest_id` + `event_members.vendor_id` nullable forward-compat columns (FKs added by iterations 0001 + 0022 respectively)
  - `public.generate_event_join_token()` + `public.handle_new_event()` trigger — auto-mints a 32-hex token when a new event is inserted
- **Phase B — `/dashboard` event picker:**
  - Auto-jump rule: 0 events → empty welcome state; 1 active event → server redirect; 2+ active events → picker with primary-first sort
  - `apps/web/lib/events.ts` — `fetchUserEvents()` helper + `EventRow` types + date formatting
  - `apps/web/app/dashboard/layout.tsx` — top-level chrome (brand + avatar + sign-out) outside event scope
  - Archived events collapsed under a `<details>` disclosure
- **Phase C — `/dashboard/create-event`:**
  - 6-tile event-type picker per spec § 2.5 — Weddings selectable, the other five visibly disabled with "Coming soon" badge
  - Wedding-only server action `createWeddingEvent` enforces `event_type='wedding'` (V1 lock)
  - Inserts: `events` row → trigger mints `event_join_tokens` row → also inserts `event_members` row with `member_type='couple'` and `joined_via='created_event'`
- **Phase D — inside-event shell `/dashboard/[eventId]/...`:**
  - Authorization check in layout: 404s if signed-in user isn't a `couple` member of the event
  - Sticky top chrome with event pill + back-to-events link + avatar
  - `BottomNav` client component with 4 tabs (Guest List · Vendors · Schedule · In-App Services) — fixed-bottom on mobile, inline on desktop, ≥44pt touch targets
  - Tab→URL mapping handles sub-pages (e.g., `/invitation` + `/seating` still highlight Guest List tab)
  - Placeholder pages for every tab (each names its owning iteration)
  - **Services launcher grid** with 6 cards — **NO wallet card** (per the Cowork update needed below). Cards: Orders (0034) · Mood Board (0010) · Papic (0012) · Panood (0011) · Photo Delivery (0009) · LED Background (0005)
  - `/dashboard/[eventId]/services/[service]` placeholder routes for each of the six
- **`/dashboard/profile`** — minimal V1 surface showing public_id, account_type, is_internal/team flags, locale, theme preference + sign-out. Full surface deferred to iteration 0025.
- **`/` landing page** — signed-in users redirect to `/dashboard`; unauthed see the existing sign-in / create-account CTAs

**Build / lint / typecheck:** all green. 14 routes compile (server-rendered, all dynamic since they read auth cookies). RLS audit query verified clean on the live database.

**Deferred from iteration 0000 (out of session scope):**
- Join flow at `/join/[event-id]?token=...` — needs the 18-role taxonomy from iteration 0001
- Unified Schedule view aggregating across `vendor_meetings`, `VendorLineItem.deadline_date`, and `invitation_widgets` — needs iterations 0006 + 0007 to ship first
- Vendor-side and admin-side role-router destinations — V1 focuses on customer surfaces (per spec § "Vendor accounts are a placeholder in V1")
- Inside-tab sub-pill row for Guest List (guests/invitation/seating) and Vendors (vendors/budget) — will land when 0001/0002/0008/0006/0007 ship real content

**SPEC IMPACT — please update via Cowork in `~/Documents/Claude/Projects/Setnayan/`:**

1. **`0000_app_shell_and_navigation/0000_app_shell_and_navigation.md`** — the token wallet is referenced at multiple points but was RETIRED 2026-05-11. Affected lines:
   - L21: "Wallet" listed as one of the In-App Services launcher tiles
   - L140: "Token wallet pill on the right (\"🪙 75,000\")" in the chrome
   - L197 / L213 / L220 / L387: "Wallet" / "Top up" / "0003 wallet panel"
   - Replace all with the apply-then-pay model from iteration 0034. The chrome no longer carries a wallet pill; the "Orders" entry in the Services launcher replaces the Wallet card.
2. **`0000_app_shell_and_navigation/fixtures.json`** vs **`.md`** — fixtures.json uses `users.primary_event_id` (FK on user) but the .md SQL declares `events.is_primary` (boolean on event). Sprint 0's base migration already shipped `events.is_primary`. Either reconcile fixtures to match (`is_primary` on the event row) or update the spec SQL to match fixtures (move it to users).

---

## 2026-05-12 · Sprint 0 — platform foundation

**Commits:** `394ded8` → `d93e900` (initial scaffold + 4 CI fixes + STATUS.md update).

**What landed:**
- Fresh greenfield Setnayan monorepo (full wipe of prior Tayo scaffold, rebuild from scratch).
- Next.js 15 App Router web app with `output: 'standalone'`, Tailwind locked breakpoints (sm 640 / md 768 / lg 1024 / xl 1280), ≥44 pt touch targets, brand palette (cream / ink / terracotta).
- Auth: email/password + magic-link via Supabase SSR — no OAuth popups (works in Tauri/webviews).
- `/health` route, login + signup pages responsive across the 4 canonical viewports.
- Supabase Postgres canonical schema migration `20260512000000_setnayan_base.sql`:
  - `public.generate_public_id(type_letter)` function (Crockford base 32, no I/L/O/U).
  - 5 enums (`account_type`, `event_type`, `member_type`, `locale_code`, `theme_preference`).
  - 4 base tables (`users`, `events`, `event_members`, `event_join_tokens`) with `S89X-` `public_id` defaults.
  - 4 RLS helpers (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`) — `SECURITY DEFINER STABLE`.
  - RLS Pattern A (per-user) on `users`; Pattern B (event-scoped) on the other three.
  - `on_auth_user_created` trigger — auto-provisions `public.users` and flags `iscasasolaii@gmail.com` as `is_internal=TRUE` per § 10a.
- `apps/web/scripts/rls-audit.sql` — the merge-floor verification query per RLS spec § 9.
- PWA: `manifest.json`, service worker (`sw.js`), maskable SVG icons (192 + 512).
- Tauri 2 desktop scaffold (`src-tauri/`): `Cargo.toml`, `tauri.conf.json`, `build.rs`, `src/main.rs` + `lib.rs`, master `icons/icon.svg`. Embedded `shell/index.html` redirects to live Vercel URL — Sprint 0 minimum viable.
- GitHub Actions: `ci.yml` (typecheck + lint on every push/PR), `build-desktop.yml` (macOS + Windows matrix on push to main), `lighthouse.yml` (Lighthouse CI on PRs).
- `packages/shared` — `PUBLIC_ID_PATTERN`, `isValidPublicId`, role/event/member type unions.
- Live services wired:
  - GitHub: `iscasasola/setnayan-platform` (private)
  - Supabase: project `njrupjnvkjkitfctetvi` in Singapore
  - Cloudflare R2: 4 buckets in APAC (`setnayan-media`, `setnayan-thread-files`, `setnayan-vendor-contracts`, `setnayan-samples`)
  - Vercel: `https://setnayan-platform-web.vercel.app`, auto-deploy on push to main
- CI fix commits resolved: pnpm version conflict (`pnpm/action-setup` no longer pins explicit version), phantom worktree gitlinks pruned from index, Tauri `frontendDist` pointed at embedded shell, desktop artifact upload glob corrected to include target subdirectory.

**Acceptance criteria:** all 7 provisioning steps + Phase 1A/1B/1C/1D green. Owner signed up (`S89U-KEMMF2ADCK`, `is_internal=TRUE`), PWA installed on one phone, both desktop artifacts (1.3 MB `.dmg` + 1.3 MB `.msi`) downloadable from Actions tab.

**SPEC IMPACT:** None. The scaffold mirrors the spec corpus 1:1. The Tauri prod URL strategy remains a known gap (documented in `STATUS.md`); if/when we pick a sidecar Node strategy vs static export, that's a spec impact and the owner must update `0013_platform_stack_and_sync` via Cowork.
