/**
 * admin-nav-groups — server-safe data module.
 *
 * Holds ADMIN_NAV_GROUPS so Server Component admin landings (money/more/
 * directory/studio/accounts/app-performance) can import the REAL array
 * instead of a client-reference proxy from the 'use client' sidebar. When a
 * Server Component imports a value from a 'use client' module, React RSC
 * replaces it with a client-reference proxy — so ADMIN_NAV_GROUPS was not a
 * real array server-side and `.find()` threw. Owner-reported /admin/money
 * crash, 2026-07-12.
 *
 * NO 'use client' directive here — this file must stay server-importable.
 */

import {
  Clapperboard,
  Activity,
  AlertOctagon,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Briefcase,
  Bug,
  CalendarDays,
  CheckCheck,
  CircleUser,
  Coins,
  Compass,
  CreditCard,
  DollarSign,
  Film,
  Flag,
  Gauge,
  Gift,
  Globe,
  Handshake,
  Home,
  Images,
  Landmark,
  LifeBuoy,
  Lightbulb,
  LineChart,
  ListChecks,
  MapPin,
  MessageSquareWarning,
  Music,
  Newspaper,
  Palette,
  PencilRuler,
  PiggyBank,
  Plug,
  Radar,
  Receipt,
  RefreshCw,
  ScanSearch,
  Settings,
  Shapes,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Signal,
  Sparkles,
  Star,
  Tag,
  Tag as TagIcon,
  TestTube,
  TrendingUp,
  Trophy,
  UserX,
  Users,
  UsersRound,
  Video,
  Wallet,
  WifiOff,
} from 'lucide-react';

import type { NavGroup } from '@/app/_components/nav/types';

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  // ── SPINE ─────────────────────────────────────────────────────────────
  {
    // OVERVIEW (key 'queues' kept for localStorage continuity) — the decision/
    // task inbox (vendor-dashboard home pattern): the /admin pulse plus every
    // act-now queue (requests · approvals · transactions · reports · disputes).
    // UNCHANGED by the 2026-07-04 respine. (Social queue lives in Studio; two-
    // admin Approvals + Taxonomy-requests join here once their surfaces ship.)
    key: 'queues',
    label: 'Overview',
    items: [
      {
        key: 'overview',
        label: 'Overview',
        href: '/admin',
        icon: Home,
      },
      {
        // All work — the command-center worklist: every act-now queue ranked
        // most-urgent-first (overdue → due-soon → busiest) in one view. This is
        // the desktop entry to the /admin/work feed the mobile Work tab already
        // lands on. Unbadged on purpose — the per-queue rows below carry counts.
        key: 'work-home',
        label: 'All work',
        href: '/admin/work',
        icon: ListChecks,
        matchPrefix: '/admin/work',
      },
      {
        key: 'verify',
        label: 'Verify',
        href: '/admin/verify',
        icon: BadgeCheck,
        matchPrefix: '/admin/verify',
      },
      {
        // Vendor Partnerships — two-admin verification queue for vendor-to-vendor
        // commercial relationships (accredited / sponsored / general). Badges are
        // invisible until a second admin confirms. Vendor-side stub at
        // /vendor-dashboard/partnerships lets vendors submit claims.
        key: 'vendor-partnerships',
        label: 'Partnerships',
        href: '/admin/vendor-partnerships',
        icon: Handshake,
        matchPrefix: '/admin/vendor-partnerships',
      },
      {
        key: 'payments',
        label: 'Payments',
        href: '/admin/payments',
        icon: Banknote,
        matchPrefix: '/admin/payments',
      },
      {
        // Money queue — vendor payout release (was in Money group).
        key: 'payouts',
        label: 'Payouts',
        href: '/admin/payouts',
        icon: Wallet,
      },
      {
        // Money queue — vendor token-pack purchase reconcile (was in Money).
        key: 'token-purchases',
        label: 'Token sales',
        href: '/admin/token-purchases',
        icon: ShoppingBag,
        matchPrefix: '/admin/token-purchases',
      },
      {
        // Money queue — vendor Pro/Enterprise subscription reconcile (Phase D).
        key: 'subscriptions',
        label: 'Subscriptions',
        href: '/admin/subscriptions',
        icon: RefreshCw,
        matchPrefix: '/admin/subscriptions',
      },
      {
        key: 'payment-options',
        label: 'Payment options',
        href: '/admin/payment-options',
        icon: CreditCard,
        matchPrefix: '/admin/payment-options',
      },
      {
        key: 'disputes',
        label: 'Disputes',
        href: '/admin/disputes',
        icon: Shield,
        matchPrefix: '/admin/disputes',
      },
      {
        key: 'pax-changes',
        label: 'Pax changes',
        href: '/admin/pax-changes',
        icon: UsersRound,
        matchPrefix: '/admin/pax-changes',
      },
      {
        key: 'force-majeure',
        label: 'Force majeure',
        href: '/admin/force-majeure',
        icon: AlertOctagon,
        matchPrefix: '/admin/force-majeure',
      },
      {
        key: 'completions',
        label: 'Completions',
        href: '/admin/completions',
        icon: Handshake,
        matchPrefix: '/admin/completions',
      },
      {
        key: 'reviews',
        label: 'Reviews',
        href: '/admin/reviews',
        icon: Star,
      },
      {
        key: 'concierge-abuse',
        label: "Setnayan AI abuse",
        href: '/admin/concierge-abuse',
        icon: Flag,
      },
      {
        // Self-serve account-deletion request queue (App Store 5.1.1(v) /
        // Google Play data-deletion). Couples + vendors file deletion requests
        // from Profile → Privacy & data; an admin approves (runs the existing
        // hard-delete / blacklist) or rejects within 24h.
        key: 'account-deletions',
        label: 'Account deletions',
        href: '/admin/account-deletions',
        icon: UserX,
        matchPrefix: '/admin/account-deletions',
      },
      {
        // UGC report queue (Apple 1.2 / Google Play UGC). Reports filed against
        // Papic guest gallery content land here for moderator review.
        key: 'user-reports',
        label: 'User reports',
        href: '/admin/user-reports',
        icon: MessageSquareWarning,
        matchPrefix: '/admin/user-reports',
      },
      {
        // Reverse-image repost-watch queue. Cross-vendor perceptual-hash matches
        // (a vendor's new upload matching an older image owned by a DIFFERENT,
        // non-demo vendor). Detect-and-review only — never auto-takes-down.
        key: 'repost-watch',
        label: 'Repost watch',
        href: '/admin/repost-watch',
        icon: ScanSearch,
        matchPrefix: '/admin/repost-watch',
      },
      {
        // Request-a-correction queue (verified-profile lock, owner 2026-07-02).
        // Verified shops can't edit their 8 identity fields directly; they file
        // a correction request that an admin applies or declines here.
        key: 'corrections',
        label: 'Profile corrections',
        href: '/admin/corrections',
        icon: PencilRuler,
        matchPrefix: '/admin/corrections',
      },
      {
        // Data Privacy control board (RA 10173). One approval switch per
        // privacy-sensitive capability (vendor guest capture, biometrics, geo,
        // cross-event linkage, minors, faith). Approving records who/when — the
        // audit trail for the NPC filing; feature gates read status='active'.
        key: 'data-privacy',
        label: 'Data Privacy',
        href: '/admin/data-privacy',
        icon: ShieldCheck,
        matchPrefix: '/admin/data-privacy',
      },
      {
        // Review-fraud + ghost-listing screener queue (No fake reviews, no ghost
        // listings). Deterministic scoring of submitted reviews (velocity/burst,
        // rating anomaly, shared-device reviewer clusters) + placeholder /
        // abandoned / duplicate marketplace listings. Detect-and-review only —
        // never auto-deletes a review or hides a listing without an admin click.
        key: 'integrity-watch',
        label: 'Integrity watch',
        href: '/admin/integrity-watch',
        icon: ShieldCheck,
        matchPrefix: '/admin/integrity-watch',
      },
      {
        // Anti-fraud Phase 4 (§ 5) — per-VENDOR fraud queue + enforcement. The
        // continuous fake-results hunt scores whole vendors (ring / velocity /
        // graph / import / rating-shape); this surface reviews them and runs the
        // two-stage enforcement (reversible auto-suspend + admin-confirmed
        // wipe+ban). Distinct from integrity-watch (per-review/per-listing).
        key: 'fraud',
        label: 'Fraud queue',
        href: '/admin/fraud',
        icon: ShieldAlert,
        matchPrefix: '/admin/fraud',
      },
      {
        // Two-admin (four-eyes) approval queue — §9.1. A different admin
        // approves a major decision before it executes.
        key: 'approvals',
        label: 'Approvals',
        href: '/admin/approvals',
        icon: CheckCheck,
      },
      {
        // Pakanta songwriting queue — each couple's custom-song brief, auto-
        // composed from their onboarding love story + Pakanta music prefs
        // (lib/pakanta-brief.ts). The music team writes the song from it.
        key: 'pakanta',
        label: 'Pakanta queue',
        href: '/admin/pakanta',
        icon: Music,
        matchPrefix: '/admin/pakanta',
      },
      {
        key: 'editorial-review',
        label: 'Editorial review',
        href: '/admin/editorial-review',
        icon: Newspaper,
        matchPrefix: '/admin/editorial-review',
      },
      {
        key: 'help',
        label: 'Help',
        href: '/admin/help',
        icon: LifeBuoy,
      },
    ],
  },
  {
    // ACCOUNTS (key 'directory' kept for localStorage continuity) — pure
    // record-lookup. UNCHANGED items. (Spotlight Awards + Journal Spotlights
    // live in Studio — featuring is a curation/publishing lever, not look-up.)
    key: 'directory',
    label: 'Accounts',
    items: [
      {
        // Repointed to the Accounts Studio Users tab (slice 1). matchPrefix
        // keeps this item lit on the legacy /admin/users path + any future
        // /admin/users/[id] detail route (which stays standalone).
        key: 'users',
        label: 'Users',
        href: '/admin/accounts?tab=users',
        icon: Users,
        matchPrefix: '/admin/users',
      },
      {
        // Repointed to the Accounts Studio Vendors tab (slice 3). matchPrefix
        // keeps this item lit on the legacy /admin/vendors path + the
        // standalone /admin/vendors/[id]/edit + /tokens + /team detail routes
        // (which stay standalone).
        key: 'vendors',
        label: 'Vendors',
        href: '/admin/accounts?tab=vendors',
        icon: Briefcase,
        matchPrefix: '/admin/vendors',
      },
      {
        // Repointed to the Accounts Studio Demo vendors tab (slice 4, final).
        // matchPrefix keeps this item lit on the legacy /admin/demo-vendors
        // path + the standalone /admin/demo-vendors/inquiries +
        // inquiries/[threadId] flows (which stay standalone).
        key: 'demo-vendors',
        label: 'Demo vendors',
        href: '/admin/accounts?tab=demo-vendors',
        icon: TestTube,
        matchPrefix: '/admin/demo-vendors',
      },
      {
        // Repointed to the Accounts Studio Events tab (slice 1). matchPrefix
        // keeps this item lit on the legacy /admin/events path.
        key: 'events',
        label: 'Events',
        href: '/admin/accounts?tab=events',
        icon: CalendarDays,
        matchPrefix: '/admin/events',
      },
      {
        // Repointed to the Accounts Studio Venues tab (slice 2). matchPrefix
        // keeps this item lit on the legacy /admin/venues path + the standalone
        // /admin/venues/[id] detail + /admin/venues/new create routes (which
        // stay standalone).
        key: 'venues',
        label: 'Venues',
        href: '/admin/accounts?tab=venues',
        icon: MapPin,
        matchPrefix: '/admin/venues',
      },
    ],
  },
  {
    // STUDIO (key 'media' kept for localStorage continuity — was "Content").
    // Everything an admin CURATES or PUBLISHES: the old Content publishing/
    // asset lane FIRST, then the old Marketing lane (the retired 'marketing'
    // group folded in here 2026-07-04 — item keys/icons unchanged).
    key: 'media',
    label: 'Studio',
    defaultOpen: false,
    items: [
      {
        // Repointed to the Studio Studio Website tab (slice 1). matchPrefix
        // keeps this item lit on the legacy /admin/website path (which now
        // redirects in).
        key: 'website',
        label: 'Website',
        href: '/admin/studio?tab=website',
        icon: Globe,
        matchPrefix: '/admin/website',
      },
      {
        // Repointed to the Studio Studio Hero video tab (slice 1). matchPrefix
        // keeps this item lit on the legacy /admin/hero-video path (redirects in).
        key: 'hero-video',
        label: 'Hero video',
        href: '/admin/studio?tab=hero-video',
        icon: Video,
        matchPrefix: '/admin/hero-video',
      },
      {
        // Background videos — the LIVE upload tool feeding the production
        // homepage hero + pillar loop videos (lib/background-videos.ts →
        // app/page.tsx → HomeReskin). Re-linked per the 2026-07-12 page-layer
        // audit (owner decision #3 — additive only, surface untouched).
        key: 'background-videos',
        label: 'Background videos',
        href: '/admin/background-videos',
        icon: Clapperboard,
        matchPrefix: '/admin/background-videos',
      },
      {
        // Repointed to the Studio Studio Reveal Studio tab (slice 1).
        // matchPrefix keeps this item lit on the legacy /admin/reveal-studio
        // path (redirects in). NB /admin/studio and /admin/reveal-studio are
        // DISTINCT routes — no collision.
        key: 'reveal-studio',
        label: 'Reveal Studio',
        href: '/admin/studio?tab=reveal-studio',
        icon: Sparkles,
        matchPrefix: '/admin/reveal-studio',
      },
      {
        // Real Stories featuring (PR D) — pin + order which consented wedding
        // editorials surface (and which is the hero) on the public /realstories
        // index. Curation on top of the RA 10173 consent gate. Repointed to the
        // Studio Studio Real Stories tab (slice 2). matchPrefix keeps this item
        // lit on the legacy /admin/real-stories path (which now redirects in).
        key: 'real-stories',
        label: 'Real Stories',
        href: '/admin/studio?tab=real-stories',
        icon: Newspaper,
        matchPrefix: '/admin/real-stories',
      },
      {
        // Auto-Recap oversight — every couple-published "living recap" (a
        // public page of guest photos + words) + the RA 10173 takedown lever.
        // Repointed to the Studio Studio Recaps tab (slice 1). matchPrefix
        // (already present) keeps this item lit on the legacy /admin/recaps
        // path (which now redirects in).
        key: 'recaps',
        label: 'Recaps',
        href: '/admin/studio?tab=recaps',
        icon: Images,
        matchPrefix: '/admin/recaps',
      },
      {
        // Patiktok template-library oversight + render-job monitor (un-retired
        // 2026-07-01). Repointed to the Studio Studio Patiktok tab (slice 2).
        // matchPrefix keeps this item lit on the legacy /admin/patiktok path
        // (which now redirects in).
        key: 'patiktok',
        label: 'Patiktok',
        href: '/admin/studio?tab=patiktok',
        icon: Film,
        matchPrefix: '/admin/patiktok',
      },
      {
        // Repointed to the Studio Studio Songs tab (slice 2). matchPrefix keeps
        // this item lit on the legacy /admin/songs path (which now redirects in).
        key: 'songs',
        label: 'Songs',
        href: '/admin/studio?tab=songs',
        icon: Music,
        matchPrefix: '/admin/songs',
      },
      {
        // Repointed to the Studio Studio Moodboard library tab (slice 2).
        // matchPrefix keeps this item lit on the legacy /admin/moodboard-library
        // path (which now redirects in).
        key: 'moodboard-library',
        label: 'Moodboard library',
        href: '/admin/studio?tab=moodboard-library',
        icon: Palette,
        matchPrefix: '/admin/moodboard-library',
      },
      // ── old MARKETING lane (retired 'marketing' group · folded in 2026-07-04)
      // — the social publishing queue + the two featuring levers + the growth
      // incentives, appended after the Content lane. Item keys/icons unchanged.
      {
        // Repointed to the Studio Studio Social queue tab (slice 4 · final).
        // matchPrefix keeps this item lit on the legacy /admin/social-queue
        // path (which now redirects in). Its live count badge follows the item
        // key ('social-queue', unchanged), not the group, so the badge still
        // works after the repoint.
        key: 'social-queue',
        label: 'Social queue',
        href: '/admin/studio?tab=social-queue',
        icon: Share2,
        matchPrefix: '/admin/social-queue',
      },
      {
        // Repointed to the Studio Studio Spotlight Awards tab (slice 3).
        // matchPrefix keeps this item lit on the legacy /admin/spotlight-awards
        // path (which now redirects in).
        key: 'spotlight-awards',
        label: 'Spotlight Awards',
        href: '/admin/studio?tab=spotlight-awards',
        icon: Trophy,
        matchPrefix: '/admin/spotlight-awards',
      },
      {
        // Repointed to the Studio Studio Journal Spotlights tab (slice 3).
        // matchPrefix keeps this item lit on the legacy
        // /admin/journal-spotlights path (which now redirects in).
        key: 'journal-spotlights',
        label: 'Journal Spotlights',
        href: '/admin/studio?tab=journal-spotlights',
        icon: BookOpen,
        matchPrefix: '/admin/journal-spotlights',
      },
      {
        // Repointed to the Studio Studio Discount codes tab (slice 3). matchPrefix
        // keeps this item lit on the legacy /admin/discount-codes path AND its
        // standalone /new + /[id]/edit sub-routes (list redirects in; the CRUD
        // sub-routes stay standalone).
        key: 'discount-codes',
        label: 'Discount codes',
        href: '/admin/studio?tab=discount-codes',
        icon: TagIcon,
        matchPrefix: '/admin/discount-codes',
      },
      {
        // Repointed to the Studio Studio Referrals tab (slice 3). matchPrefix
        // keeps this item lit on the legacy /admin/referrals path (which now
        // redirects in).
        key: 'referrals',
        label: 'Referrals',
        href: '/admin/studio?tab=referrals',
        icon: Gift,
        matchPrefix: '/admin/referrals',
      },
    ],
  },
  // ── ENGINE ROOMS (collapsible) ────────────────────────────────────────
  {
    // UGAT CONSOLE (NEW key 'ugat' · 2026-07-04 respine) — the data-structure /
    // mapping wing carved OUT of System Settings, anchored by the Taxonomy
    // Studio. Every item that configures the platform's data structures and
    // mappings: Menus & icons · Taxonomy · Onboarding · Wedding traditions ·
    // Setnayan AI brain. (Event Types · Refinements · Wedding types already
    // folded into the Taxonomy Studio 2026-07-03 — no standalone items to
    // carry.) The first PR of the HQ studio-consolidation program will turn
    // these into Taxonomy-Studio-style surfaces.
    key: 'ugat',
    label: 'Ugat Console',
    defaultOpen: false,
    items: [
      {
        // Nav/icon/menu registry — the single source for the name + icon of
        // every menu across all account types (foundation 2026-06-16).
        // Ugat Studio default tab (fold 2026-07-10). NORMAL matchPrefix on the
        // legacy path — /admin/ugat != /admin/menus so no shell-path collision.
        key: 'menus',
        label: 'Menus & icons',
        href: '/admin/ugat?tab=menus',
        icon: Shapes,
        matchPrefix: '/admin/menus',
      },
      {
        key: 'taxonomy',
        label: 'Taxonomy',
        href: '/admin/taxonomy',
        icon: Tag,
      },
      // 'event-types' REMOVED 2026-07-03 — folded into the Taxonomy Studio's
      // Vocabularies → Event types rail (/admin/taxonomy?view=vocab-event), where
      // the event-type roster (couple-launch `enabled` lever + picker-card
      // presentation + retire/un-retire) now lives beside the category-scoping
      // controls. The standalone page redirects there.
      // 'refinements' sidebar item REMOVED 2026-07-03 — /admin/refinements was
      // retired to a redirect(/admin/taxonomy); refinements are now edited in the
      // Taxonomy Studio inspector's Refinements tab (reachable via the Taxonomy
      // item above). Dedicated nav item dropped so it stops surfacing here + in
      // /admin/menus. The redirect page stays for old bookmarks.
      {
        // Onboarding-flow config (background music + future per-flow knobs),
        // grouped by onboarding type. Scales as new event-type onboardings ship.
        key: 'onboarding',
        label: 'Onboarding',
        href: '/admin/ugat?tab=onboarding',
        icon: Compass,
        matchPrefix: '/admin/onboarding',
      },
      // 'wedding-types' REMOVED 2026-07-03 — folded into the Taxonomy Studio's
      // Vocabularies → Faiths rail (/admin/taxonomy?view=vocab-faith). The
      // standalone page now redirects there.
      {
        key: 'wedding-traditions',
        label: 'Wedding traditions',
        href: '/admin/ugat?tab=wedding-traditions',
        icon: BookOpen,
        matchPrefix: '/admin/wedding-traditions',
      },
      {
        key: 'brain',
        label: "Setnayan AI brain",
        href: '/admin/ugat?tab=brain',
        icon: Brain,
        matchPrefix: '/admin/brain',
      },
    ],
  },
  {
    // APP PERFORMANCE (key 'funnels' kept for localStorage continuity · label
    // "Performance" → "App Performance" 2026-07-04) — growth + stats. Owner
    // lock 2026-07-03: the App Performance cockpit (/admin/app-performance ·
    // plan: spec corpus 0023_admin_console/App_Performance_Plan_2026-07-03.md)
    // leads the group and the former Insights surfaces are its drill-downs.
    // NB the first ITEM below is also labeled "App Performance" — the label
    // collision with the group label is accepted for now (owner). Items
    // UNCHANGED by the 2026-07-04 respine.
    key: 'funnels',
    label: 'App Performance',
    defaultOpen: false,
    items: [
      {
        key: 'app-performance',
        label: 'App Performance',
        href: '/admin/app-performance',
        icon: Activity,
        matchPrefix: '/admin/app-performance',
      },
      // Insights Studio tabs (2026-07-10) — repointed to /admin/app-performance
      // ?tab=<key>; matchPrefix keeps each item lit on its legacy /admin/<x>
      // path (which now redirects into the studio) + its detail routes.
      {
        key: 'growth',
        label: 'Growth',
        href: '/admin/app-performance?tab=growth',
        icon: LineChart,
        matchPrefix: '/admin/growth',
      },
      {
        key: 'intelligence',
        label: 'Intelligence',
        href: '/admin/app-performance?tab=intelligence',
        icon: Radar,
        matchPrefix: '/admin/intelligence',
      },
      {
        // Demand Radar — the all-markets demand read (month heat · top regions
        // · hot looks · event types) behind the vendor Market Intel feature
        // (Pro-and-up, owner-locked 2026-07-11). Built with its own route but
        // never menued; wired here by the page-layer hygiene pass 2026-07-12.
        key: 'demand',
        label: 'Demand Radar',
        href: '/admin/demand',
        icon: Signal,
        matchPrefix: '/admin/demand',
      },
      {
        // SEO & GEO — the daily search + AI-answer-engine audit (owner Q
        // 2026-07-10). Diffs the served llms.txt against the live catalog +
        // checks route/token coverage nightly; pulls Search Console.
        key: 'seo',
        label: 'SEO & GEO',
        href: '/admin/app-performance?tab=seo',
        icon: Globe,
        matchPrefix: '/admin/seo',
      },
      {
        key: 'funnels',
        label: 'Funnels',
        href: '/admin/app-performance?tab=funnels',
        icon: BarChart3,
        matchPrefix: '/admin/funnels',
      },
      {
        key: 'operations-hiring',
        label: 'Operations & Hiring',
        href: '/admin/app-performance?tab=operations',
        icon: TrendingUp,
        matchPrefix: '/admin/operations-hiring',
      },
      {
        key: 'connection-logs',
        label: 'Connection logs',
        href: '/admin/app-performance?tab=connection-logs',
        icon: Bug,
        matchPrefix: '/admin/connection-logs',
      },
      {
        key: 'offline',
        label: 'Offline daemon',
        href: '/admin/app-performance?tab=offline',
        icon: WifiOff,
        matchPrefix: '/admin/offline',
      },
    ],
  },
  {
    // MONEY (key 'settings-group' kept for localStorage continuity · label
    // "System Settings" → "Money" 2026-07-04) — the money-config lane FIRST
    // (act-now money QUEUES stay in Overview; the Work Money-lane filter
    // reunites them per the 2026-06-08 sign-off condition), then the small
    // settings tail at the bottom. The Data Structure lane carved out to the
    // Ugat Console. The visit-least bucket, one collapsible; ordered money
    // config → settings tail.
    key: 'settings-group',
    label: 'Money',
    defaultOpen: false,
    items: [
      {
        // Catalog Studio shell + first tab (Money split 2026-07-10). The shell
        // path /admin/pricing equals this tab's own legacy route, so the
        // active-state needs care: matchesPath defaults an ABSENT matchPrefix
        // to the href's PATHNAME (/admin/pricing), which then prefix-matches
        // every ?tab sibling and steals their highlight. Setting matchPrefix to
        // the full QUERY href defeats that — a matchPrefix with '?' can never
        // prefix-match a query-less pathname, so only the query-aware hrefMatch
        // (tab===pricing) lights this row. (Verified by the Money-split
        // adversarial review; the earlier "drop the matchPrefix" note was wrong.)
        key: 'pricing',
        label: 'Pricing',
        href: '/admin/pricing?tab=pricing',
        icon: DollarSign,
        matchPrefix: '/admin/pricing?tab=pricing',
      },
      {
        // Custom-tier composer (VENDOR_TIERS §11) — dial a negotiated Custom
        // plan for a vendor org, apply a partner discount, send the quote for
        // apply-then-pay approval. Sits with the money config (its unit prices
        // ARE the /admin/pricing catalog).
        key: 'custom-plans',
        label: 'Custom plans',
        href: '/admin/pricing?tab=custom-plans',
        icon: BadgeCheck,
        matchPrefix: '/admin/custom-plans',
      },
      {
        key: 'addons',
        label: 'Add-ons',
        href: '/admin/pricing?tab=addons',
        icon: Sparkles,
        matchPrefix: '/admin/addons',
      },
      {
        // Papic storage telemetry (owner 2026-07-11) — the real web-copy ratio +
        // per-event web-copy GB vs the 40 GB ceiling, to lock the provisional
        // storage numbers from measured data before hard-coding them.
        key: 'papic-storage',
        label: 'Papic storage',
        href: '/admin/papic-storage',
        icon: BarChart3,
        matchPrefix: '/admin/papic-storage',
      },
      {
        // Vendor "recommend to your couples" map — the admin-editable vendor-leaf
        // → recommendable-SKU table + the two-way curation review queue.
        key: 'vendor-recommendations',
        label: 'Vendor recommendations',
        href: '/admin/vendor-recommendations',
        icon: Lightbulb,
        matchPrefix: '/admin/vendor-recommendations',
      },
      {
        key: 'token-bands',
        label: 'Token bands',
        href: '/admin/pricing?tab=token-bands',
        icon: Coins,
        matchPrefix: '/admin/token-bands',
      },
      {
        key: 'price-bands',
        label: 'Price bands',
        href: '/admin/pricing?tab=price-bands',
        icon: Gauge,
        matchPrefix: '/admin/price-bands',
      },
      {
        key: 'budget-planner',
        label: 'Budget Planner',
        href: '/admin/budget-planner',
        icon: PiggyBank,
      },
      {
        key: 'receipts',
        label: 'Receipts',
        href: '/admin/receipts',
        icon: Receipt,
      },
      {
        // Canonical home stays with money config (the data IS money — vendor
        // payouts + customer payment instructions both consume it).
        key: 'payment-methods',
        label: 'Payment methods',
        href: '/admin/settings/payment-methods',
        icon: Landmark,
      },
      // ── SETTINGS TAIL — system + personal config, bottom of the collapsible.
      {
        // Settings Studio shell + first tab (Money split 2026-07-10). Same
        // active-state subtlety as the Pricing row: an ABSENT matchPrefix would
        // default to the pathname /admin/settings and steal every ?tab sibling
        // (and over-claim the standalone /admin/settings/payment-methods +
        // demo-mode routes via the startsWith arm). The full QUERY matchPrefix
        // can't prefix-match a query-less pathname, so only the query-aware
        // hrefMatch (tab===settings) lights this row. (Money-split review.)
        key: 'settings',
        label: 'Settings',
        href: '/admin/settings?tab=settings',
        icon: Settings,
        matchPrefix: '/admin/settings?tab=settings',
      },
      {
        // Compliance — the RA 10173 / NPC registration facts (PIC identity, DPO
        // designation, breach plan, sub-processors, processing declarations).
        // Sits in the settings tail beside Settings: it's platform-config the
        // owner sets once. The sensitive identifiers (BIR TIN, address, DPO
        // phone) live only in the DB behind admin-only RLS, never in the repo.
        key: 'compliance',
        label: 'Compliance',
        href: '/admin/settings?tab=compliance',
        icon: ShieldCheck,
        matchPrefix: '/admin/compliance',
      },
      {
        key: 'notifications',
        label: 'Notifications',
        href: '/admin/settings?tab=notifications',
        icon: Bell,
        matchPrefix: '/admin/notifications',
      },
      {
        key: 'demo-mode',
        label: 'Demo mode',
        href: '/admin/settings?tab=demo-mode',
        icon: Settings,
        matchPrefix: '/admin/settings/demo-mode',
      },
      {
        // Integration Activation Console — the one place the solo operator flips
        // every external-service switch (Resend email · OpenAI · Maya/GCash pay)
        // and the AI-paywall flag. Sits in the settings tail beside Compliance /
        // Notifications / Demo-mode: it's platform-config the owner sets once. A
        // STANDALONE page (mirrors Papic storage above), not a Settings-studio
        // tab, so the matchPrefix is the plain pathname. Wayfinding 2026-07-15 —
        // previously reachable only from a tile on the /admin dashboard.
        key: 'integrations',
        label: 'Integrations',
        href: '/admin/integrations',
        icon: Plug,
        matchPrefix: '/admin/integrations',
      },
      {
        // Personal account security — admins use the shared /dashboard/profile
        // surface (the /dashboard layout only redirects vendors). Without this
        // entry the admin doorway had NO path to change-password / sign-out-
        // other-devices except detouring through the customer role pill.
        // Account-security suite 2026-06-11.
        key: 'my-account',
        label: 'My account',
        href: '/dashboard/profile',
        icon: CircleUser,
      },
    ],
  },
];
