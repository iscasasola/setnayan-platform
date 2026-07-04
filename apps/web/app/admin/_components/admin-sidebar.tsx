'use client';

/**
 * AdminSidebar — admin doorway desktop nav (NavGroup[] source of truth).
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 locks the admin console. Originally 8
 * categories (0023 § 1), remapped 2026-06-04 to 6 topic-groups, and re-cut
 * 2026-06-08 by the ops-shaped nav redesign
 * (Admin_Console_Nav_Redesign_2026-06-08.md · owner conditionally signed
 * off 2026-06-08). The console is now grouped by the VERB an admin performs
 * — act / find / tune — instead of by topic, because admin is a work-queue
 * ops console (≈95% of sessions are "clear a queue").
 *
 * This file owns the NavGroup[] array consumed by SidebarShell +
 * SidebarSection + SidebarItem from @/app/_components/nav/*. It is the
 * single source of truth for admin nav structure on desktop. The 4-item
 * mobile BottomNav lives in admin-bottom-nav.tsx alongside this file.
 *
 * 6 MENUS — the owner's 2026-07-03 topic respine ("Overview · Accounts ·
 * Content · Marketing · Performance · System Settings"). The VERB insight
 * from the 2026-06-08 ops redesign survives INSIDE Overview: the owner
 * declared Overview the task inbox (vendor-home pattern) — the /admin
 * pulse PLUS every act-now queue (requests · approvals · transactions ·
 * reports · disputes), so clear-a-queue work still leads the console.
 *
 * Group KEYS are preserved wherever a group has a predecessor so the
 * setnayan.nav.section.<key>.open localStorage state survives the relabel:
 *   1. Overview (key 'queues' — the old Home + Work merged) — the /admin
 *                   pulse · All work · every act-now queue. (Social queue
 *                   moved to Marketing — it's the marketing task lane.)
 *   2. Accounts (key 'directory') — Users · Vendors · Demo vendors ·
 *                   Events · Venues. (Spotlight Awards + Journal
 *                   Spotlights moved to Marketing — featuring is a
 *                   marketing lever, not record look-up.)
 *   3. Content (key 'media') — Website · Hero video · Reveal Studio ·
 *                   Real Stories · Recaps · Patiktok · Songs ·
 *                   Moodboard library.
 *   4. Marketing (key 'marketing' · NEW — the 6th-HQ marketing module's
 *                   home) — Social queue · Spotlight Awards · Journal
 *                   Spotlights · Discount codes · Referrals.
 *   5. Performance (key 'funnels') — App Performance cockpit · Growth ·
 *                   Intelligence · Funnels · Operations & Hiring ·
 *                   Connection logs · Offline daemon.
 *   6. System Settings (key 'settings-group') — absorbs the dissolved
 *                   Monetization config lane (old key 'money': Pricing ·
 *                   Add-ons · Token bands · Price bands · Budget Planner ·
 *                   Receipts · Payment methods · Vendor recommendations)
 *                   + Data Structure (old key 'content': Menus & icons ·
 *                   Taxonomy · Event Types · Refinements · Onboarding ·
 *                   Wedding types · Wedding traditions · AI brain) +
 *                   Settings. The visit-least engine room, one collapsible.
 *
 * REQUIRED FOLLOW-UP (carried from 2026-06-08 sign-off): the Work view's
 * Money-lane filter (Payments + Payouts + Token sales surfaced together)
 * ships with the Work master-detail PR, so finance keeps a one-stop money
 * view. RBAC handler-lane scoping is a later, separate build.
 *
 * PAYMENT METHODS: lives with the money config inside System Settings (the
 * data IS money — vendor payouts + customer payment instructions both
 * consume it). Never duplicated.
 *
 * BRAND-LAYER RENAME 2026-05-28 V2 CUTOVER: Concierge abuse keeps its route
 * + DB table names (concierge_abuse_flags) for bookmark + audit continuity,
 * but the sidebar entry reads "Setnayan AI abuse" to match the V2 brand.
 */

import {
  Home,
  ListChecks,
  Activity,
  Banknote,
  Coins,
  Gauge,
  BadgeCheck,
  CheckCheck,
  Compass,
  Shield,
  AlertOctagon,
  Handshake,
  Star,
  LifeBuoy,
  Flag,
  MessageSquareWarning,
  PencilRuler,
  ScanSearch,
  ShieldCheck,
  Landmark,
  RefreshCw,
  UsersRound,
  Users,
  Briefcase,
  TestTube,
  Trophy,
  CalendarDays,
  MapPin,
  BookOpen,
  DollarSign,
  PiggyBank,
  Tag as TagIcon,
  Sparkles,
  Receipt,
  CreditCard,
  Brain,
  Palette,
  Shapes,
  Tag,
  Globe,
  Video,
  Music,
  TrendingUp,
  Bug,
  WifiOff,
  BarChart3,
  CircleUser,
  LineChart,
  Settings,
  Share2,
  Wallet,
  ShoppingBag,
  Bell,
  UserX,
  Newspaper,
  Images,
  Radar,
  Lightbulb,
  Film,
  Gift,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { SidebarSection } from '@/app/_components/nav/sidebar-section';
import { SidebarItem } from '@/app/_components/nav/sidebar-item';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { NavGroup } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type {
  AdminQueueCounts,
  AdminQueueDueState,
} from '@/lib/admin/queue-counts';

/**
 * Canonical admin NavGroup[] export. Mobile-overflow landing pages at
 * /admin/work + /admin/directory + /admin/more present the same surfaces
 * for the 4-tab BottomNav (Home · Work · Directory · More).
 *
 * Stable group/item `key` values mean label edits (Queues→Work, Money→Money
 * & Catalog, etc.) don't reset the per-section
 * setnayan.nav.section.<key>.open localStorage state.
 */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  // ── SPINE ─────────────────────────────────────────────────────────────
  {
    // OVERVIEW (key 'queues' kept for localStorage continuity) — the owner's
    // 2026-07-03 respine merges the old Home + Work groups: Overview IS the
    // task inbox (vendor-home pattern) — the /admin pulse plus every act-now
    // queue (requests · approvals · transactions · reports · disputes).
    // Social queue moved to Marketing. (Two-admin Approvals + Taxonomy-
    // requests join here once their dedicated surfaces ship.)
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
    // record-lookup. Spotlight Awards + Journal Spotlights moved to Marketing
    // (featuring is a marketing lever, not look-up) per the 2026-07-03 respine.
    key: 'directory',
    label: 'Accounts',
    items: [
      {
        key: 'users',
        label: 'Users',
        href: '/admin/users',
        icon: Users,
      },
      {
        key: 'vendors',
        label: 'Vendors',
        href: '/admin/vendors',
        icon: Briefcase,
        matchPrefix: '/admin/vendors',
      },
      {
        key: 'demo-vendors',
        label: 'Demo vendors',
        href: '/admin/demo-vendors',
        icon: TestTube,
        matchPrefix: '/admin/demo-vendors',
      },
      {
        key: 'events',
        label: 'Events',
        href: '/admin/events',
        icon: CalendarDays,
        matchPrefix: '/admin/events',
      },
      {
        key: 'venues',
        label: 'Venues',
        href: '/admin/venues',
        icon: MapPin,
        matchPrefix: '/admin/venues',
      },
    ],
  },
  {
    // CONTENT (key 'media' kept for localStorage continuity — was "Content &
    // Media"). Every couple-facing publishing surface + asset library.
    key: 'media',
    label: 'Content',
    defaultOpen: false,
    items: [
      {
        key: 'website',
        label: 'Website',
        href: '/admin/website',
        icon: Globe,
      },
      {
        key: 'hero-video',
        label: 'Hero video',
        href: '/admin/hero-video',
        icon: Video,
      },
      {
        key: 'reveal-studio',
        label: 'Reveal Studio',
        href: '/admin/reveal-studio',
        icon: Sparkles,
      },
      {
        // Real Stories featuring (PR D) — pin + order which consented wedding
        // editorials surface (and which is the hero) on the public /realstories
        // index. Curation on top of the RA 10173 consent gate.
        key: 'real-stories',
        label: 'Real Stories',
        href: '/admin/real-stories',
        icon: Newspaper,
        matchPrefix: '/admin/real-stories',
      },
      {
        // Auto-Recap oversight — every couple-published "living recap" (a
        // public page of guest photos + words) + the RA 10173 takedown lever.
        key: 'recaps',
        label: 'Recaps',
        href: '/admin/recaps',
        icon: Images,
        matchPrefix: '/admin/recaps',
      },
      {
        // Patiktok template-library oversight + render-job monitor (un-retired
        // 2026-07-01).
        key: 'patiktok',
        label: 'Patiktok',
        href: '/admin/patiktok',
        icon: Film,
        matchPrefix: '/admin/patiktok',
      },
      {
        key: 'songs',
        label: 'Songs',
        href: '/admin/songs',
        icon: Music,
        matchPrefix: '/admin/songs',
      },
      {
        key: 'moodboard-library',
        label: 'Moodboard library',
        href: '/admin/moodboard-library',
        icon: Palette,
      },
    ],
  },
  {
    // MARKETING (NEW key 'marketing' · 2026-07-03 respine) — the 6th-HQ
    // marketing module's nav home: the social publishing queue + the two
    // featuring levers + the growth incentives. Ads + campaign surfaces join
    // here when they ship (Ads blocked on Meta creds).
    key: 'marketing',
    label: 'Marketing',
    defaultOpen: false,
    items: [
      {
        // Social Sharing & Featuring Program queue (2026-06-12) — ready-to-
        // post couple creations + vendor verification features + take-downs.
        // Moved from Work: it's the marketing task lane. Its live count badge
        // follows the item key, not the group.
        key: 'social-queue',
        label: 'Social queue',
        href: '/admin/social-queue',
        icon: Share2,
        matchPrefix: '/admin/social-queue',
      },
      {
        key: 'spotlight-awards',
        label: 'Spotlight Awards',
        href: '/admin/spotlight-awards',
        icon: Trophy,
        matchPrefix: '/admin/spotlight-awards',
      },
      {
        key: 'journal-spotlights',
        label: 'Journal Spotlights',
        href: '/admin/journal-spotlights',
        icon: BookOpen,
        matchPrefix: '/admin/journal-spotlights',
      },
      {
        key: 'discount-codes',
        label: 'Discount codes',
        href: '/admin/discount-codes',
        icon: TagIcon,
        matchPrefix: '/admin/discount-codes',
      },
      {
        key: 'referrals',
        label: 'Referrals',
        href: '/admin/referrals',
        icon: Gift,
        matchPrefix: '/admin/referrals',
      },
    ],
  },
  // ── TUNE GROUPS (collapsible) ─────────────────────────────────────────
  {
    // PERFORMANCE (key 'funnels' kept for localStorage continuity) — owner
    // lock 2026-07-03: the App Performance cockpit (/admin/app-performance ·
    // plan: spec corpus 0023_admin_console/App_Performance_Plan_2026-07-03.md)
    // leads the group and the former Insights surfaces are its drill-downs.
    key: 'funnels',
    label: 'Performance',
    defaultOpen: false,
    items: [
      {
        key: 'app-performance',
        label: 'App Performance',
        href: '/admin/app-performance',
        icon: Activity,
        matchPrefix: '/admin/app-performance',
      },
      {
        key: 'growth',
        label: 'Growth',
        href: '/admin/growth',
        icon: LineChart,
        matchPrefix: '/admin/growth',
      },
      {
        key: 'intelligence',
        label: 'Intelligence',
        href: '/admin/intelligence',
        icon: Radar,
        matchPrefix: '/admin/intelligence',
      },
      {
        key: 'funnels',
        label: 'Funnels',
        href: '/admin/funnels',
        icon: BarChart3,
      },
      {
        key: 'operations-hiring',
        label: 'Operations & Hiring',
        href: '/admin/operations-hiring',
        icon: TrendingUp,
      },
      {
        key: 'connection-logs',
        label: 'Connection logs',
        href: '/admin/connection-logs',
        icon: Bug,
      },
      {
        key: 'offline',
        label: 'Offline daemon',
        href: '/admin/offline',
        icon: WifiOff,
      },
    ],
  },
  {
    // SYSTEM SETTINGS (key 'settings-group' kept for localStorage continuity)
    // — the 2026-07-03 respine's engine room: absorbs the dissolved
    // Monetization config lane (old key 'money' — act-now money QUEUES stay in
    // Overview; the Work Money-lane filter reunites them per the 2026-06-08
    // sign-off condition) and Data Structure (old key 'content'), plus system
    // + personal config. The visit-least bucket, one collapsible; ordered
    // system → money config → data structure → personal.
    key: 'settings-group',
    label: 'System Settings',
    defaultOpen: false,
    items: [
      {
        key: 'settings',
        label: 'Settings',
        href: '/admin/settings',
        icon: Settings,
        matchPrefix: '/admin/settings',
      },
      {
        key: 'notifications',
        label: 'Notifications',
        href: '/admin/notifications',
        icon: Bell,
      },
      {
        key: 'pricing',
        label: 'Pricing',
        href: '/admin/pricing',
        icon: DollarSign,
      },
      {
        // Custom-tier composer (VENDOR_TIERS §11) — dial a negotiated Custom
        // plan for a vendor org, apply a partner discount, send the quote for
        // apply-then-pay approval. Sits with the money config (its unit prices
        // ARE the /admin/pricing catalog).
        key: 'custom-plans',
        label: 'Custom plans',
        href: '/admin/custom-plans',
        icon: BadgeCheck,
        matchPrefix: '/admin/custom-plans',
      },
      {
        key: 'addons',
        label: 'Add-ons',
        href: '/admin/addons',
        icon: Sparkles,
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
        href: '/admin/token-bands',
        icon: Coins,
      },
      {
        key: 'price-bands',
        label: 'Price bands',
        href: '/admin/price-bands',
        icon: Gauge,
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
      {
        // Nav/icon/menu registry — the single source for the name + icon of
        // every menu across all account types (foundation 2026-06-16).
        key: 'menus',
        label: 'Menus & icons',
        href: '/admin/menus',
        icon: Shapes,
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
        href: '/admin/onboarding',
        icon: Compass,
      },
      // 'wedding-types' REMOVED 2026-07-03 — folded into the Taxonomy Studio's
      // Vocabularies → Faiths rail (/admin/taxonomy?view=vocab-faith). The
      // standalone page now redirects there.
      {
        key: 'wedding-traditions',
        label: 'Wedding traditions',
        href: '/admin/wedding-traditions',
        icon: BookOpen,
      },
      {
        key: 'brain',
        label: "Setnayan AI brain",
        href: '/admin/brain',
        icon: Brain,
      },
      {
        key: 'demo-mode',
        label: 'Demo mode',
        href: '/admin/settings/demo-mode',
        icon: Settings,
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

/**
 * AdminSidebar — renders the 6 admin nav groups using the shared
 * SidebarSection + SidebarItem primitives. Wraps with a brand header
 * (Wordmark) so the admin doorway reads as a separate context from
 * customer + vendor doorways.
 */
/**
 * Overlays admin nav-registry label + icon onto each sidebar item via its
 * `admin.sidebar.<key>` slot (item key matches the slot suffix 1:1). Fallback =
 * the item's hardcoded default; a hidden slot drops the item; no-op when
 * navSlots is absent (fails open). href/matchPrefix + group structure stay in
 * code. (Admin nav has no role-gating, so no pre-filter step.)
 */
function applyAdminRegistry(
  groups: NavGroup[],
  navSlots?: Record<string, NavSlotLite>,
): NavGroup[] {
  if (!navSlots) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.flatMap((item) => {
      const slot = navSlots[`admin.sidebar.${item.key}`];
      if (!slot) return [item];
      if (slot.isHidden) return [];
      return [{ ...item, label: slot.label, icon: navIconComponent(slot.icon) }];
    }),
  }));
}

// Badge tone tracks REAL urgency (oldest item vs the queue's SLA), not the
// queue's identity: red only when something is actually overdue, amber when
// approaching SLA, neutral for open-but-fine. So a queue screams red because
// work is late, never just because it's "important".
function badgeTone(state?: AdminQueueDueState): 'red' | 'amber' | 'neutral' {
  if (state === 'overdue') return 'red';
  if (state === 'due-soon') return 'amber';
  return 'neutral';
}

/**
 * Injects live open-work counts onto the matching Work items as a NavBadge,
 * toned by the queue's urgency (queueStates, keyed by nav-item key). Only a
 * positive count badges — a null count (queue unavailable) or 0 (clear) shows
 * nothing, and items absent from the map (Directory + config groups) are
 * untouched. Runs AFTER the registry overlay so an admin-renamed label keeps
 * its count.
 */
function applyQueueBadges(
  groups: NavGroup[],
  queueCounts?: AdminQueueCounts,
  queueStates?: Record<string, AdminQueueDueState>,
): NavGroup[] {
  if (!queueCounts) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const count = queueCounts[item.key];
      if (typeof count !== 'number' || count <= 0) return item;
      const state = queueStates?.[item.key];
      return {
        ...item,
        badge: {
          count,
          tone: badgeTone(state),
          label: state === 'overdue' ? `${count} overdue` : `${count} pending`,
        },
      };
    }),
  }));
}

export function AdminSidebar({
  navSlots,
  queueCounts,
  queueStates,
}: {
  navSlots?: Record<string, NavSlotLite>;
  queueCounts?: AdminQueueCounts;
  queueStates?: Record<string, AdminQueueDueState>;
}) {
  const pathname = usePathname() ?? '/admin';
  const groups = applyQueueBadges(
    applyAdminRegistry(ADMIN_NAV_GROUPS, navSlots),
    queueCounts,
    queueStates,
  );

  return (
    <>
      {groups.map((group) => (
        <SidebarSection key={group.key} group={group} pathname={pathname}>
          {group.items.map((item) => (
            <SidebarItem key={item.key} item={item} pathname={pathname} />
          ))}
        </SidebarSection>
      ))}
    </>
  );
}
