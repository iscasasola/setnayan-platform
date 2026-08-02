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
  RadioTower,
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
  Crown,
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
  KeyRound,
  Landmark,
  LifeBuoy,
  Lightbulb,
  LineChart,
  ListChecks,
  MapPin,
  MessageSquareWarning,
  Music,
  Network,
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
      // Live Studio channel pool (WAVE 9 · Live_Studio_Unified_Spec § 4h) — the
      // Setnayan-owned YouTube channels every event streams on, so couples never
      // connect a Google account. CONDITIONAL on the Live Studio flag, deliberately:
      // the route itself notFound()s when the flag is off, and a nav row pointing at
      // a 404 is worse than no row. Flag off ⇒ this surface does not exist at all.
      // Uses the inlined NEXT_PUBLIC_ literal rather than lib/live-studio-roam's
      // helper because this module is imported by the 'use client' sidebar.
      ...(process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED === 'true'
        ? [
            {
              key: 'live-studio-channels',
              label: 'Live Studio channels',
              href: '/admin/live-studio-channels',
              icon: RadioTower,
              matchPrefix: '/admin/live-studio-channels',
            },
          ]
        : []),
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
        // Website media — the READ side of the media bucket, sitting next to the
        // upload tools it audits. Those tools repoint a row without deleting the
        // object they replaced, so left-over files are invisible everywhere else.
        key: 'website-media',
        label: 'Website media',
        href: '/admin/website-media',
        icon: Images,
        matchPrefix: '/admin/website-media',
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
      {
        // Ugat entity map — the live console (slice 1 · PR #2788): the nine
        // platform entity types as nodes on a dark canvas, the schema-audited
        // connections as clickable joints, the 2026-07-05 audit's health
        // findings as an overlay. A STANDALONE full-viewport route (not a
        // ?tab= surface — it has its own topbar + fixed side-card overlays),
        // linked from the Ugat Studio's section strip. Item key 'ugat' matches
        // the admin.sidebar.ugat registry slot 1:1.
        key: 'ugat',
        label: 'Entity map',
        href: '/admin/ugat/map',
        icon: Network,
        matchPrefix: '/admin/ugat/map',
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
    // MONEY & SETTINGS (key 'settings-group' kept for localStorage continuity ·
    // label "System Settings" → "Money" 2026-07-04 → "Money & Settings"
    // 2026-07-25) — the money-config lane FIRST (act-now money QUEUES stay in
    // Overview; the Work Money-lane filter reunites them per the 2026-06-08
    // sign-off condition), then the settings tail at the bottom. The Data
    // Structure lane carved out to the Ugat Console. The visit-least bucket,
    // one collapsible; ordered money config → settings tail.
    //
    // The label carries "& Settings" again because the tail is now 6 items long
    // (Compliance · Notifications · Demo mode · Integrations · Secrets &
    // Rotation · Account security) and NONE of them are money. The owner went
    // looking for Secrets & Rotation and could not find it — a group labelled
    // "Money" is not somewhere anyone hunts for a credential. Renaming beats
    // moving: these are genuinely the visit-least settings, and splitting the
    // tail into a seventh top-level group would trade one wayfinding problem
    // for a longer sidebar.
    key: 'settings-group',
    label: 'Money & Settings',
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
        // Secrets & Rotation — every platform key in one place with an age
        // alarm, a per-key runbook, in-app writes to the Vercel env, and the
        // dual-key ENCRYPTION_KEY procedure. Sits directly beside Integrations
        // (the two are halves of the same job: Integrations turns a service ON,
        // this one keeps its credential fresh) and cross-links to it for the
        // DB-stored secrets. A page ships with its doorway — 2026-07-25.
        key: 'secrets',
        label: 'Secrets & Rotation',
        href: '/admin/secrets',
        icon: KeyRound,
        matchPrefix: '/admin/secrets',
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
