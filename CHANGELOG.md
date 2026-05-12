# Setnayan — Changelog

Append-only log of every meaningful code change. Newest at top. Each entry includes a `SPEC IMPACT` callout (even if "None") so spec-folder edits via Cowork are never missed.

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
