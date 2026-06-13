# Setnayan — Whole-Site Premium Redesign Plan

> Created 2026-06-13. Owner-directed. This is the canonical build plan for the
> "premium modern app" redesign across marketing + the three dashboards. Each
> phase ships as its own PR with auto-merge. Future sessions: execute from here,
> top to bottom, unless the owner reorders.

## Thesis — "One App, Less Drama" extends *inside* the product

The marketing site sells a calm, ~7-surface dashboard. The actual couple
dashboard ships ~20 nav items across 6 groups. The promise of simplicity stops
at the front door. This redesign makes the *inside* feel as calm as the outside:
a tight primary set with everything-else-on-demand, plus a polish pass so the
chrome reads "premium" without losing operational scannability.

## Locked decisions (owner, 2026-06-13)

1. **Design language = premium-calm** (NOT full editorial). Keep Source Sans
   (the 2026-06-10 "easy to read backend" lock) and the Clean Editorial palette
   the app chrome already uses. Level up the *chrome*: spacing scale,
   champagne-gold active states, mulberry primary CTAs, a consistent card
   system, calmer IA. Do **not** push Cormorant/serif marketing type into the
   dashboard — it overrides the readability lock and hurts scanning.
2. **Couple mobile bottom nav = 6 tabs**: Home · Guests · Services · Budget ·
   Wedding · More. Owner override of the conventional 5-tab cap (iOS caps at 5;
   Android 3–5). `Wedding` is the warmer label for the public wedding site
   (routes to `/site-editor/[eventId]`). **Validation requirement:** confirm the
   6-tab bar renders cleanly at 360–375px (icon-forward, 10px labels, even
   grid). Documented fallback if labels truncate: 5 tabs with one of
   Budget/Wedding demoted to More — but **default to the owner's 6**.
3. **Phase order is locked** (see Roadmap). Phase 1 (shared chrome) first
   because it's the high-leverage layer.
4. **"In-app services" umbrella + "Services"/"Vendors" rename** (owner-refined
   2026-06-13). Two different things were both called "Services": (a) the
   third-party **Vendors marketplace**, (b) **Setnayan's own in-app services**.
   Resolution:
   - **Vendors** = the marketplace of real-world suppliers you hire (renamed
     from today's "Services").
   - **In-app services** = Setnayan's own offerings — the umbrella concept,
     present on BOTH doorways:
     - **Customers** → media/experience services (Papic · Wedding website ·
       Panood · Thank-you video · Monogram · Save-the-Date · Mood board ·
       Pakanta…) — the discovery hub.
     - **Vendors** → **tokens + subscription** (today scattered under the vendor
       sidebar's Business/Grow groups; gets one clear home).
   - **Label nuance:** "In-app services" is the concept + the hub page header +
     the desktop side-tab section label. The mobile bottom-nav tab uses a SHORT
     label (16 chars can't fit 6 tabs); no collision now that the marketplace is
     "Vendors". Reverses the 2026-06-02 "Vendors→Services" rename.
   - ⚠ Consequence: the Vendors marketplace + Messages fall to "More" on mobile;
     mitigate with a "Your vendors" quick card pinned to mobile Home (build
     requirement). Full design in the In-app-services surface section below.

## Current state (as shipped on origin/main — grounded in code, not specs)

Navigation is already mature. There is a **shared nav-primitive layer**, so a
single chrome change propagates to all three doorways:

- `app/_components/nav/sidebar-shell.tsx` — desktop sidebar container + responsive split (collapsible, localStorage-persisted)
- `app/_components/nav/sidebar-section.tsx` — collapsible nav group (per-section open-state in localStorage)
- `app/_components/nav/sidebar-item.tsx` — nav link with active-state + badge + `matchPrefix`
- `app/_components/nav/bottom-nav.tsx` — generic mobile bottom strip (`lg:hidden`, safe-area insets, Lucide icons)
- `app/_components/nav/types.ts` — `NavGroup` / `NavItem` / `BottomNavItem` contract

**Breakpoint:** `lg` (1024px) swaps sidebar (`lg:flex`) ↔ bottom-nav (`lg:hidden`). No hamburger inside the app; marketing uses its own header + `_nav-mobile.tsx`.

**Tokens (`app/globals.css`):**
- `--m-*` — Clean Editorial, **marketing/guest surfaces only** (Cormorant + Manrope).
- `--color-*` — app chrome (dashboard / vendor / admin). Same Clean Editorial palette, different consumption.
- `.app-surface` — sets `--font-sans`/`--font-display` to Source Sans (the 2026-06-10 readability lock). Applied at each dashboard layout root.
- Theme is **light-locked** (2026-06-04). No dark mode toggle.

**Per-doorway nav (as built):**

| Doorway | Host | Side tab | Bottom nav |
|---|---|---|---|
| Couple | `/dashboard/[eventId]` | `customer-sidebar.tsx` + `customer-nav-config.ts` — 6 groups, ~20 items | `customer-bottom-nav.tsx` — 5 tabs (Home · Guests · Services · Website · More) |
| Vendor | `/vendor-dashboard` | `vendor-sidebar.tsx` — 4 groups (Home · Work · Grow · Business), 25 items | `vendor-bottom-nav.tsx` — 5 tabs (Home · Bookings · Messages · Earnings · More) |
| Admin (Setnayan HQ) | `/admin` | `admin-sidebar.tsx` — 6 groups, 50+ items | `admin-bottom-nav.tsx` — 4 tabs (Home · Work · Directory · More) |

## Proposed IA — couple dashboard

**Side tab — journey groups, collapse everything past "Book" by default**
so the at-rest view is ~9 calm items (Home + Plan + Book):

- **Home**
- **In-app services** — Setnayan's own offerings, the discovery hub (see surface section below)
- **Plan** — Guests · Seating · Schedule · Budget
- **Book** — Vendors *(renamed from "Services")* · Messages · Contracts
- **Design** *(collapsed)* — Wedding (website) · Mood board · Monogram
- **Day-of** *(collapsed)* — Live wall · Event QR
- **After** *(collapsed)* — Activity · Disputes
- **Settings** *(collapsed)* — Personalization · Hosts · Profile

Notes:
- `Find your date` demoted from a permanent sidebar slot to a Home card /
  contextual entry (it's a pre-booking utility).
- `Add-ons` (the SKU store) placement is a build-time decision: a Home surface,
  a "Design/Enhance" entry, or its own group. Not a primary slot.
- Group labels in sentence case ("Plan", "Book"…), champagne-gold active pill.

**Bottom nav — 6 tabs (owner-locked):**
`Home · Guests · Services · Budget · Wedding · More`
- `Services` (short tab label) → the in-app services hub (NOT the vendor
  marketplace — that's now "Vendors", reached via side-tab Book + a mobile Home
  quick card + More).
- `Wedding` → `/site-editor/[eventId]`. `Budget` → `/dashboard/[eventId]/budget`.
- Validate at 360–375px (see locked decision #2).

## Surface: In-app services — NEW, Phase 2 (customer hub + vendor menu)

> "In-app services" = Setnayan's own offerings, on both doorways. The CUSTOMER
> side is the discovery hub below. The VENDOR side is a single menu grouping
> **tokens + subscription** (see "Vendor in-app services" at the end of this
> section). Both are distinct from the **Vendors** marketplace (third-party
> suppliers).

### Customer in-app services (the discovery hub)

**Why.** Today the in-app services (Papic, Panood, Wedding website, Thank-you
video, Monogram, Save-the-Date, Mood board, Pakanta…) are scattered across a
store-style `/add-ons` poster grid, standalone routes (`/monogram`, `/live`,
`/site-editor`), and free tools in the sidebar. Couples can't see everything
Setnayan offers in one place, and discovery drives both free-tool usage and
paid-SKU revenue. This hub is the single "here's everything Setnayan can do for
your event" surface — benefit-first, with a deep link into each feature.

**Reuses what exists.** `/add-ons` (hub) + `/add-ons/[feature]` (detail routes)
already exist. We elevate them: store-grid → benefit-led discovery hub;
store-detail → benefit-led intro pages. Broaden to include the free tools +
standalone features, not just paid add-ons.

**Hub layout.** Grouped by job-to-be-done, NOT by price:
- *Capture the day* — Papic · Panood · Live wall · Camera bridge
- *Your website & story* — Wedding website · Save-the-Date · Monogram · Thank-you video
- *Plan & organize* (free) — Guest list · Seating · Budget · Mood board · Schedule
- *Music & extras* — Pakanta · Playlist · Patiktok · Pabati

**Card model.** icon + name + one-line problem-it-solves + status chip
(Free / Paid / Soon) + adaptive CTA:
- free, or paid-and-owned → **Open** (deep link straight to the live surface)
- paid, not owned → **Learn more** (→ intro page)
- coming soon → **Notify me**

**Intro page (per feature).** The `/add-ons/[feature]` route, rewritten
store-detail → benefit-led: the problem it solves · what it does · how it works
· a sample · price · primary Open / Add-to-your-event CTA.

**Feature → live-route map** (the deep links): Wedding website → `/site-editor`,
Monogram → `/monogram`, Live wall → `/live`, Mood board → `/add-ons/mood-board`,
Papic → its console, Budget → `/budget`, Seating → `/seating`, etc. Some paid
SKUs also exist as 1st-party marketplace listings (`is_setnayan_service`) per
the in-app-services-as-vendor-listings model — the hub is the discovery front
door over those, not a parallel catalog.

**Naming + nav (owner-locked, decision #4).** Hub page/section = "In-app
services"; bottom-nav tab uses a SHORT label; marketplace = "Vendors". ⚠ Build
requirement: pin a "Your vendors" quick card on mobile Home so the active
booking/chat workflow isn't buried under More.

**Build sub-steps (lands in Phase 2):**
1. Rename the marketplace label "Services" → "Vendors" across
   `customer-nav-config.ts` + `customer-bottom-nav.tsx` + `customer-sidebar.tsx`
   (label only; route `/vendors` unchanged). Add the new in-app-services hub nav
   item/tab.
2. Rebuild `/add-ons` into the grouped benefit-led hub (card + state model).
3. Rewrite `/add-ons/[feature]` intro pages (benefit-first).
4. Feature→route deep-link map + CTA-state logic (free / owned / buyable / soon).
5. Mobile Home "Your vendors" quick card.

### Vendor in-app services (tokens + subscription)

The same "In-app services" concept on the vendor doorway = **what the vendor buys
from Setnayan**. Today these are scattered across the vendor sidebar's
Business/Grow groups (`subscription`, `tokens`, `redeem-code`, plus `branches`,
`manpower`, `marketing`, `verify`). Consolidate into one **In-app services**
section/menu:
- **Core (owner-named):** Subscription (Pro / Enterprise) · Tokens (packs +
  redeem code).
- **Candidates to fold in (confirm during build):** Boosted ads / Marketing,
  Verification, Additional branches — they're also "things you buy from
  Setnayan." Manpower (team seats) is borderline — may stay in a Team group.
- Same card treatment as the customer hub (what it is · what it unlocks · price ·
  Open/Buy), so both doorways share one "In-app services" pattern.

## Proposed IA — vendor dashboard

- **Side tab:** keep the 4 groups; chrome polish only — EXCEPT consolidate the
  scattered paid items into one **In-app services** section (see above).
- **Bottom nav:** `Home · Bookings · Calendar · Messages · More`
  — swap **Calendar in for Earnings** (Earnings → More). Rationale: the vendor
  pitch is "the ultimate calendar that stops double-bookings"; burying Calendar
  in More contradicts the sell. Earnings is a periodic check, not a daily tab.

## Proposed IA — admin (Setnayan HQ)

- No IA change. 50+ items / 6 groups + 4-tab ops bottom nav is appropriate for
  an internal console. **Chrome polish only.**

## Phase 1 — the shared chrome system (high-leverage)

Tighten the shared primitives once; all three doorways lift together:

- Active state = consistent champagne-gold pill (`--color-terracotta` family).
- Mulberry (`--color-mulberry`) for primary CTAs.
- Spacing scale + group-label treatment + clearer collapse affordance.
- `bottom-nav.tsx`: support a 6-tab grid (couple) alongside 4/5-tab; keep
  safe-area insets; tune icon (20px) + 10px label for 360px.
- Card system: one raised-card token set reused across dashboard bodies.
- Stay light-locked.

## Roadmap

| Phase | Scope | Output |
|---|---|---|
| 0 ✅ | Marketing — homepage + `/for-vendors` premium redesign | PR #1334 |
| 1 | Shared chrome system (nav primitives) | 1 PR — lifts all 3 dashboards |
| 2 | Couple dashboard IA — journey side tab + collapse-by-default + 6-tab bottom nav **+ Services hub + Services→Vendors rename** | 1–2 PRs (the hub may warrant its own PR) |
| 3 | Vendor dashboard — Calendar into bottom nav + chrome | 1 PR |
| 4 | Auth + onboarding doorways (login / signup / create-event) | 1 PR |
| 5 | Admin polish (lightest) | 1 PR |
| ⟂ | `/weddings` editorial **harvest** surface — separate track, Dec-onward (see DECISION_LOG 2026-06-13 editorials row) | future |

## Open decisions deferred to build time

- ~~`Add-ons` placement~~ → RESOLVED: `/add-ons` becomes the Services hub.
- Whether `Find your date` becomes a Home card.
- Outcome of the 6-tab bottom-nav 360px validation.
- Final job-to-be-done grouping + per-feature benefit copy for the Services hub
  (draft in the surface section; refine with owner during Phase 2).

## Verification plan (per phase)

- `tsc --noEmit` + `next lint` + local `pnpm build`.
- Preview at 1280 / 768 / 375 — plus **360** for the couple 6-tab bottom nav.
- Screenshots batched at phase end (per the verification-economy rule).
- Each phase = its own PR with `gh pr merge --auto --merge`.
