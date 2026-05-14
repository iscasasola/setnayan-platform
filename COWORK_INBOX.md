# Cowork Inbox — Pending Spec Updates

> Worklist of spec-corpus updates the owner needs to apply via Cowork.
>
> **Read this** at the start of any Cowork session. **Action** each `[PENDING]` item by editing the indicated spec file at `~/Documents/Claude/Projects/Setnayan/`. When done, change `[PENDING]` to `[DONE <YYYY-MM-DD>]` (or delete the entry if you'd rather keep the file short).
>
> **Maintained by:** Claude Code sessions append new `[PENDING]` items here whenever a code change has spec impact. This is the single bridge between repo work and the spec corpus — `CHANGELOG.md` is the full history; this file is the active worklist.

---

## [PENDING] 2026-05-14 — Iteration 0042: Industry Events & B2B Vendor Marketing

**Spec doc CREATED at:** `~/Documents/Claude/Projects/Setnayan/0042_industry_events_b2b/0042_industry_events_b2b.md`

This is a **NEW B2B layer** on top of Setnayan's existing consumer marketplace. Owner spotted today that wedding fairs (GMBF at SMX Manila, ~134 exhibitors), vendor expos, and industry networking events have no good aggregator platform in PH — Setnayan can fill that distribution gap AND turn it into a revenue surface.

**What's LOCKED:**
- Industry events are a **SEPARATE concept from consumer events** in 0041 — different audience (vendors, not couples), different schema (`industry_events` table, not `events`), different RLS, different monetization
- **7 industry event types:** bridal_fair, wedding_expo, vendor_networking, industry_conference, certification_workshop, trade_show, setnayan_event
- **Wedding fair organizers = special vendors** with `is_industry_event_organizer = TRUE` flag (admin-verified)
- **3 surfaces:** public `/industry-events`, vendor `/vendor-dashboard/opportunities`, organizer-side event management
- **Setnayan as organizer:** Setnayan can host its own Wedding Connect-style events (à la Bridestory Singapore)

**Real-world precedent (from research):**
- Bridestory hosted "Wedding Connect Singapore" — 300+ vendors at one networking event
- Getting Married Bridal Fair (GMBF) — recurring at SMX Convention Center Manila
- US wedding-expo industry has proven monetization model (Jenks Productions, Florida Wedding Expo): tiered booth packages with premiums 2-5x base fees
- B2B event tech moving to AI matchmaking (Bizzabo 2025)

**Spec corpus updates owner should walk via Cowork:**
- Read `~/Documents/Claude/Projects/Setnayan/0042_industry_events_b2b/0042_industry_events_b2b.md` end-to-end
- Resolve the 10 open questions in spec § 9 (audience question § 9.1 is blocking; Phase 3 commission model still affects this too)
- Decide: pursue GMBF partnership as launch deal? (spec § 9.4)
- Decide: Setnayan-organized event at launch? (spec § 9.2 — recommended yes)

**Strategic context:** When 0040 + 0041 + 0042 all ship, Setnayan becomes the only PH platform doing all five: couples plan any life event · vendors serve multiple event types · vendors discover business opportunities · fair organizers reach curated vendors · Setnayan organizes its own marketplace events. Real moat against TheKnot, HoneyBook, Bridestory, Eventbrite.

**Once spec is refined and ready to implement, tell Claude Code:** "Iteration 0042 spec is locked — sweep the implementation against `tests.md` and spawn parallel agents per the resume checklist in spec § 10."

---

## [PENDING] 2026-05-14 — Iteration 0041: Multi-Event Vendor Catalog (LOCKED architecture)

**Spec doc CREATED at:** `~/Documents/Claude/Projects/Setnayan/0041_multi_event_support/0041_multi_event_support.md`

This is a **major V1.5 expansion** that lifts Setnayan from wedding-only to all Filipino life events (baptism, debut, birthday, anniversary, corporate, religious gatherings). Owner reviewed competitive research (Toast, Square, Thumbtack, WeddingWire, TheKnot, Zola, Shopify, Google Product Taxonomy) and locked the architecture this session.

**What's LOCKED:**
- **Architecture:** Hybrid 3-layer hierarchy + cross-cutting tags. Layer 1: Cluster (8). Layer 2: Category (38). Layer 3: Service (vendor-defined free naming). Cross-cutting tags handle event_types, settings, delivery_type, pricing_model, synonyms, specializations, languages, travel_zones.
- **8 clusters:** Reception & Foundation · Ceremony & Religious · Media & Documentation · Music & Entertainment · Decor & Production · Attire & Beauty · Logistics & Support · Print & Gifts
- **38 categories** (29 → 38; +9 new, 7 renamed/relabeled, 1 cross-listed, 1 deprecated). Full table in the spec doc § 5.
- **7 event types for V1.5:** wedding, baptism, debut, birthday, anniversary, corporate, religious_event. Funeral deferred to V2 (sensitive marketing).
- **2-step vendor service creation UX:** Choose Cluster → Identify Service → Configure (Step 3 hands off to iteration 0040 Catalog Studio).

**Spec corpus updates owner should walk via Cowork:**
- Read `~/Documents/Claude/Projects/Setnayan/0041_multi_event_support/0041_multi_event_support.md` end-to-end and refine wording, especially the 11 sections
- The "28 canonical categories" locked decision in HANDOFF.md is now superseded — 38 categories
- Resolve the 9 open questions in spec § 10 (Phase 3 commission model is the BLOCKING one)
- Confirm or push back on the per-category event-types assignments in § 5
- Confirm the bartending/bar-equipment split with 3-5 real Filipino bar vendors before implementation (spec § 10.5)

**Why this is a [PENDING] not [DONE]:**
The spec is drafted but unrefined. Implementation has NOT started. Spec lives in the corpus; owner refines via Cowork; then implementation iteration begins.

**Once spec is refined and ready to implement, tell Claude Code:** "Iteration 0041 spec is locked — sweep the implementation against `tests.md` and spawn parallel agents per the resume checklist in spec § 11."

---

## [PENDING] 2026-05-14 — Iteration 0006: vendor marketplace + reviews system

**Spec target — owner should update:**
- `~/Documents/Claude/Projects/Setnayan/03_Iterations/0006_vendors_management/` — capture the new `/vendors` public marketplace surface (category/city filters, search, sort by most_reviews/highest_rated/newest, paginated grid).
- Same iteration — capture the reviews subsystem on the existing public vendor landing page `/v/[slug]`: 5-category-star aggregate + paginated review list with one-time vendor reply per review.

**Schema (migration `20260514100000_vendor_reviews.sql`):**
- New `vendor_reviews` table (event_vendor_id → event_vendors, couple_user_id → users, 5 category star ratings 1–5, free-text body, vendor_reply, created_at, replied_at)
- Materialized `vendor_review_stats` view (per vendor_profile_id: review_count, avg_overall, avg per category)
- RLS: public read, couple INSERT only after `event_vendors.status` is `delivered` or `complete`, vendor one-time UPDATE for `vendor_reply`
- New notification type `review_request` — fires from `emitNotification` when admin flips `event_vendors.status` to delivered (in-app row + Resend email)

**New routes:**
- `/vendors` — public marketplace
- `/dashboard/[eventId]/vendors/[eventVendorId]/review` — couple review form (5 category stars + free-text body)
- `/vendor-dashboard/reviews` — vendor sees their reviews + one-time reply form per review
- `/v/[slug]` — new Reviews section appended to the existing public vendor landing page (avg/count/star breakdown + paginated list)

---

## [PENDING] 2026-05-14 — Iteration 0022: vendor dashboard expansion (services + bookings + team + earnings)

**Spec target — owner should update:**
- `~/Documents/Claude/Projects/Setnayan/03_Iterations/0022_vendor_dashboard/` — extend with the 4 new tabs that replaced the Phase 1 placeholders.

**4 new surfaces under `/vendor-dashboard/*`:**

| Surface | What |
|---|---|
| **Services editor** | Vendor picks from the locked 28 categories, sets starting price, crew size, crew meal required. Toggle `is_active` to hide without losing pricing history. |
| **Bookings inbox** | List existing chat threads from couples, prioritized by `event_date` proximity, read/unread + stale flags. Routes through to the existing `/messages/[threadId]`. |
| **Team** | 4 role tiers (Owner / Admin / Agent / Viewer) via new `vendor_team_members` table. RLS scopes reads/writes to Owner+Admin. Self-invites disabled. |
| **Earnings** | Read-only paid-order rollup, monthly subtotals, year-to-date running total, 3% Setnayan Pay convenience fee line per row. |

**Schema (migration `20260514010000_iteration_0022_vendor_dashboard_expansion.sql`):**
- New columns on existing `vendor_services` table: `starting_price_php BIGINT`, `is_active BOOLEAN DEFAULT TRUE`
- New `vendor_team_members` table (vendor_profile_id, user_id, role enum)
- RLS on team table: Owner+Admin read/write; Agent/Viewer scoped to own row

---

## [PENDING] 2026-05-14 — Iteration 0019: force-majeure flow + admin queues + funnel analytics

**Spec target — owner picks one:**
- Add a **§ Force Majeure Flow** subsection inside `~/Documents/Claude/Projects/Setnayan/03_Iterations/0019_communications/` (since disputes ride on chat-thread context), OR
- Create new mini-iteration folder `~/Documents/Claude/Projects/Setnayan/03_Iterations/0019b_force_majeure/` if force-majeure should be its own spec doc.

**Schema (migration `20260514110000_force_majeure_flags.sql`):**
- New `force_majeure_flags` table (5 flag types · 8 statuses · evidence URL array · 7-day auto-resolve timer · admin handler `user_id`)
- RLS: couple-scoped to their own event flags; admin sees all
- `updated_at` trigger on the new table

**Couple side `/dashboard/[eventId]/disputes`:**
- File a flag with type, description, optional vendor scope, evidence file upload (multi-file → R2 via existing `uploadPublicAsset`)
- List existing flags with status timeline

**Admin side `/admin/force-majeure`:**
- Filterable queue, take-ownership flow, 6 resolution paths, notifications back to couple on resolve

**Funnel analytics `/admin/funnels`** (new admin surface, separate from force-majeure but landed in same PR):
- 3 Supabase-side funnels: signups → first event → first paid order; vendor signups → profile complete → first booking; week-over-week
- 4 PostHog-side funnels linked out: Save-the-Date, Papic, Pro upgrade, Guided Planner adoption

---

## [PENDING] 2026-05-14 — Iteration 0033: read-only public API (V1 Phase A + C)

**Spec target — owner should update:**
- `~/Documents/Claude/Projects/Setnayan/03_Iterations/0033_public_api/` — capture the read-only endpoints + scope model that shipped in V1. Note that rate limiting and the developer portal styling are deferred to V1.5+.

**Endpoints:**

| Method | Path | Auth | Scope |
|---|---|---|---|
| GET | `/api/v1/events` | Bearer `sk_live_*` | `events.read` |
| GET | `/api/v1/events/:id` | Bearer `sk_live_*` | `events.read` |
| GET | `/api/v1/events/:id/guests` | Bearer `sk_live_*` | `guests.read` |
| GET | `/api/v1/vendors` | public (no auth) | — (filter by category/city/q, paginated) |
| GET | `/api/v1/vendors/:id` | public (no auth) | — (single profile by `public_id`) |

**Schema (migration `20260514010000_iteration_0033_api_scopes.sql`):**
- New `api_keys.scopes TEXT[] NOT NULL DEFAULT ARRAY['me.read']` column (additive `ALTER` — default avoids the NOT-NULL backfill issue)
- New public-read RLS policy on `vendor_profiles` for the unauth marketplace endpoints

**Scope wiring:**
- `lib/api-keys.ts` recognizes `events.read` / `guests.read` / `vendors.read` in addition to the existing `me.read`
- `/dashboard/api-keys` form gets opt-in scope checkboxes per key
- `lib/api-auth.ts`: new `requireScope()` helper

**Docs surface:** new `/api/v1` page lists endpoints + example curls. Rate limiting deferred to V1.5 — flagged on the docs page.

---

## [PENDING] 2026-05-14 — Iteration 0025: EN/TL locale toggle landed

**Spec target — owner should update:**
- `~/Documents/Claude/Projects/Setnayan/03_Iterations/0025_profile_settings/` — capture the new "Display language" row in the Appearance tab. EN / TL only (the DB enum `locale_code` still has 'ceb' reserved for a future Cebuano dictionary).
- `~/Documents/Claude/Projects/Setnayan/02_Specifications/Brand_Voice.md` (or wherever the i18n strategy lives) — note that V1 ships dashboard CHROME ONLY in Tagalog (nav labels, common CTAs, status pills, time-of-day greetings, section headings). Guest-entered, vendor-entered, and marketing/landing content stay in whatever language they were authored in.

**Locked set of ~31 strings translated (see `apps/web/lib/i18n/dashboard.tl.json`):**

| Key | EN | TL |
|---|---|---|
| nav.guests | Guests | Mga Bisita |
| nav.vendors | Vendors | Mga Vendor |
| nav.budget | Budget | Budget |
| nav.messages | Messages | Mga Mensahe |
| nav.seating | Seating | Pagkakaupuan |
| nav.add_ons | Add-ons | Mga Karagdagan |
| nav.notifications | Notifications | Mga Abiso |
| cta.save | Save | I-save |
| cta.cancel | Cancel | Kanselahin |
| cta.add | Add | Magdagdag |
| cta.remove | Remove | Tanggalin |
| cta.sign_out | Sign out | Mag-sign out |
| status.pending | Pending | Naghihintay |
| status.done | Done | Tapos na |
| status.coming_soon | Coming soon | Malapit na |
| greeting.morning | Good morning | Magandang umaga |
| greeting.afternoon | Good afternoon | Magandang hapon |
| greeting.evening | Good evening | Magandang gabi |
| common.help | Help & support | Tulong at suporta |

**Storage:** Re-uses the existing `users.locale` `public.locale_code` column (no new migration). The toggle constrains the UI surface to `('en','tl')`; the DB enum's `'ceb'` value is preserved for a future Cebuano addition.

---

## [PENDING] 2026-05-14 — Iteration 0028: two more transactional email events

**Spec target — owner should update:**
- `~/Documents/Claude/Projects/Setnayan/03_Iterations/0028_email_notifications/0028_email_notifications.md` — extend the event-wired table from 7 to 9 entries.

**New events:**

| Type | Trigger | Recipient | Title | relatedUrl |
|---|---|---|---|---|
| `help_ticket_replied` | Admin saves a substantive `admin_notes` reply on `/admin/help` (content changed, non-empty) | Signed-in help-ticket owner (anonymous submitters have `user_id` NULL and are skipped) | "Setnayan replied to your help ticket" | `/help` |
| `vendor_inquiry_received` | Couple sends the FIRST message in a chat thread (message count was zero pre-insert) | Vendor user attached to the thread's `vendor_profile_id` | "New booking inquiry from <event display name>" | `/vendor-dashboard/messages/<threadId>` |

**Email path:** Both fire through the existing `emitNotification` helper — in-app notification row + Resend transactional email (subject = title, body = title + first-200-chars of source + Open-Setnayan link). The fire-and-forget pattern is preserved; failures never roll back the primary write.

**DB migration:** `supabase/migrations/20260514010000_notification_type_additions.sql` adds the two new enum values via `ALTER TYPE … ADD VALUE IF NOT EXISTS`. The migration also lazily adds `rsvp_received` — that value was being emitted by `apps/web/app/[slug]/actions.ts` since the RSVP feature shipped but had never been added to the DB enum, so the inserts were failing silently inside `emitNotification`'s try/catch.

---

## [PENDING] 2026-05-14 — Iteration 0036: Event-Day Pre-Load (couple + vendor)

**Spec target — owner should create:** new iteration folder
`~/Documents/Claude/Projects/Setnayan/03_Iterations/0036_event_day_preload/` with
the standard five files (`0036_event_day_preload.md`, `.html`, `.docx`,
`tests.md`, `fixtures.json`). Sits alongside the caching-strategy entry below —
the caching foundation is the platform infra, 0036 is the first feature on top
of it.

**Scope to capture (Locked 2026-05-14):**

> **Goal.** Day-of resilience for both couple and vendor against bad venue WiFi.
> Proactively pre-load the full event bundle into the client cache so every
> screen serves from local storage and revalidates in the background.
>
> **Visibility window — couple.** "Prepare for event day" banner CTA visible
> T-3 days through T+1 day on the dashboard home. Auto-preload (silent, no UI)
> fires inside T-24h to T+12h, deduped to once per 60 minutes via localStorage.
>
> **Visibility window — vendor.** Same T-3 / T+1 visibility window, per chat
> thread the vendor has with an upcoming event. One CTA card per upcoming
> event on the vendor dashboard.
>
> **Couple bundle contents (under TanStack-Query keys).** Event meta · guest
> list with RSVP + role + table assignment · tables + seat assignments ·
> schedule blocks · vendors · budget snapshot (line items + payments) · mood
> board palette · last 50 messages per open chat thread · asset URLs handed
> to the SW for cache warm-up.
>
> **Vendor bundle contents.** Their service slot in the schedule · masked
> couple contact (event display name + date) · last 50 messages with the
> couple.
>
> **Service worker contract.** Page posts `{ type: 'PRELOAD_ASSETS', urls: [...] }`
> to the active SW. SW fetches each URL with `mode: 'no-cors'` and stashes the
> response in the shell cache. Unknown message types are silently ignored.
>
> **RLS scoping.** No new policies — the existing couple-read + vendor-read
> policies already gate the underlying fetches. The server action runs under
> the user's session.
>
> **Out of scope for V1.** Native iOS/Android offline. Photo gallery archive
> downloads. Pre-load of guest invitation sites (those have their own
> per-guest offline path via the QR token).

**Why this is a spec change:** new feature not currently in any iteration spec. Implementation has landed in the repo (PR `claude/event-day-preload`) and depends on the parallel caching-foundation PR (`claude/caching-foundation`).

**Once the spec is created, tell Claude Code:** "Iteration 0036 spec is locked — sweep the implementation against `tests.md`."

---

## [PENDING] 2026-05-14 — Caching & Offline Strategy (new cross-cutting infra)

**Spec target — owner picks one:**

- **Option A (recommended, lighter):** Add a new section **§ Caching & Offline Strategy** inside the existing platform-foundation spec at `~/Documents/Claude/Projects/Setnayan/02_Specifications/` (whichever file holds the foundation decisions — e.g. `Platform_Foundation.md` or equivalent).
- **Option B (heavier):** Create a new mini-iteration folder `~/Documents/Claude/Projects/Setnayan/03_Iterations/0036_caching_strategy/` with just `0036_caching_strategy.md` + `tests.md`. Skip `.html`, `.docx`, `fixtures.json` since there's no UI prototype.

**Section content to drop in (Locked 2026-05-14):**

> **Goal.** Fast perceived load and tappable-instantly UI on return visits, without consuming user device storage unbounded.
>
> **Storage budget.** **100 MB total per user / per install**, gated by `navigator.storage.estimate()` at startup. If the browser reports < 100 MB headroom, the budget drops to 50% of available. Allocation inside the 100 MB:
> - **~75 MB images** (cover photos, vendor portraits, mood-board thumbnails, save-the-date previews, monograms)
> - **~20 MB JSON/data** (guest lists, vendor profiles, schedule, budget, mood board metadata)
> - **~5 MB headroom**
> - Splits are soft — whichever layer fills first triggers LRU eviction in *that* layer.
>
> **Two-layer architecture.**
> - **Data layer.** TanStack Query + `persistQueryClient` to IndexedDB. Stale-while-revalidate. Per-query TTL. Hard `maxAge` + buster key prevents the persisted blob from growing unbounded across schema changes.
> - **Asset layer.** Service worker (`apps/web/public/sw.js`) extended with route-scoped `CacheExpiration` (`maxEntries`, `maxAgeSeconds`) for images, JS chunks, fonts.
>
> **What MUST be cached.** App shell, JS chunks, fonts, public-read data (events list, guest list, vendor profiles, mood board, schedule, budget, save-the-date assets).
>
> **What MUST NEVER be cached.** Auth tokens, Supabase session, payment intents, BIR receipts, contract files (sensitive), API gateway responses bound to a per-request key, live chat messages (use Supabase realtime, never the cache).
>
> **Cache invalidation discipline.** Every mutation MUST invalidate its query key. Enforced via a thin wrapper around `useMutation` so it's hard to bypass.
>
> **Stale-time defaults** (overridable per query):
> - Hot lists (guests, schedule on day-of): 60 s
> - Warm data (vendor profiles, mood board): 5 min
> - Cold/immutable (BIR receipts metadata, finalized invitation themes): 1 hr
>
> **Eviction policy.** LRU within each layer. Asset layer evicts oldest images first. Data layer evicts queries by `dataUpdatedAt`.
>
> **Out of scope for this section.** Native iOS/Android offline (Phase 2). Photo gallery archive downloads (handled by 0009 photo-delivery via direct R2 + native share, not the PWA cache).

**Why this is a spec change:** New cross-cutting architectural decision touching the platform foundation. Not currently in any iteration spec. Affects how all future iterations think about data freshness and offline behavior.

**Once the spec is updated, tell Claude Code:** "Caching strategy is locked in the spec — proceed with implementation plan." Claude will then write the implementation plan, get your approval, and only then touch code.
