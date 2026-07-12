'use client';

/**
 * AdminSidebar — admin doorway desktop nav (NavGroup[] source of truth).
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 locks the admin console. Originally 8
 * categories (0023 § 1), remapped 2026-06-04 to 6 topic-groups, re-cut
 * 2026-06-08 by the ops-shaped VERB redesign (act / find / tune ·
 * Admin_Console_Nav_Redesign_2026-06-08.md), respun 2026-07-03 into 6 topic
 * menus (Overview · Accounts · Content · Marketing · Performance · System
 * Settings), and re-cut AGAIN 2026-07-04 by this owner respine below.
 *
 * This file owns the NavGroup[] array consumed by SidebarShell +
 * SidebarSection + SidebarItem from @/app/_components/nav/*. It is the
 * single source of truth for admin nav structure on desktop. The mobile
 * BottomNav lives in admin-bottom-nav.tsx alongside this file (a SEPARATE
 * ≤5-tab mobile IA — it does NOT mirror these groups 1:1 and is untouched by
 * this re-cut).
 *
 * 6 MENUS — the owner's 2026-07-04 respine (supersedes the 2026-07-03
 * 6-topic layout). This is the first PR of the HQ studio-consolidation
 * program; follow-up waves turn these menus into Taxonomy-Studio-style
 * surfaces. The layout, task-inbox-first → engine-rooms-last:
 *   1. Overview (key 'queues') — the decision/task inbox (vendor-dashboard
 *                   home pattern): the /admin pulse · All work · every
 *                   act-now queue (requests · approvals · transactions ·
 *                   reports · disputes). UNCHANGED items.
 *   2. Accounts (key 'directory') — pure record look-up: Users · Vendors ·
 *                   Demo vendors · Events · Venues. UNCHANGED items.
 *   3. Studio (key 'media') — everything an admin CURATES or PUBLISHES:
 *                   the old Content lane (Website · Hero video · Reveal
 *                   Studio · Real Stories · Recaps · Patiktok · Songs ·
 *                   Moodboard library) FOLLOWED BY the old Marketing lane
 *                   (Social queue · Spotlight Awards · Journal Spotlights ·
 *                   Discount codes · Referrals). The retired 'marketing'
 *                   group folds in here; its items keep their keys/icons.
 *   4. Ugat Console (key 'ugat' · NEW) — the data-structure / mapping wing
 *                   carved OUT of System Settings, anchored by the Taxonomy
 *                   Studio: Menus & icons · Taxonomy · Onboarding · Wedding
 *                   traditions · Setnayan AI brain. (Event Types ·
 *                   Refinements · Wedding types already folded into the
 *                   Taxonomy Studio 2026-07-03 — no standalone items.)
 *   5. App Performance (key 'funnels') — growth + stats: the App Performance
 *                   cockpit · Growth · Intelligence · Funnels · Operations &
 *                   Hiring · Connection logs · Offline daemon. UNCHANGED
 *                   items; group label "Performance" → "App Performance".
 *                   (The first ITEM is also labeled "App Performance" — the
 *                   label collision is accepted for now.)
 *   6. Money (key 'settings-group') — the money-config lane (Pricing ·
 *                   Add-ons · Vendor recommendations · Token bands · Price
 *                   bands · Budget Planner · Receipts · Payment methods)
 *                   FIRST, then the small settings tail (Settings ·
 *                   Notifications · Demo mode · My account).
 *
 * Group KEYS are preserved for setnayan.nav.section.<key>.open localStorage
 * continuity — 'queues' · 'directory' · 'media' · 'funnels' ·
 * 'settings-group' all survive; 'ugat' is new (defaults apply); the old
 * 'marketing' group key RETIRES (its items live in 'media' now).
 *
 * REQUIRED FOLLOW-UP (carried from 2026-06-08 sign-off): the Work view's
 * Money-lane filter (Payments + Payouts + Token sales surfaced together)
 * ships with the Work master-detail PR, so finance keeps a one-stop money
 * view. RBAC handler-lane scoping is a later, separate build.
 *
 * PAYMENT METHODS: lives with the money config inside Money (the data IS
 * money — vendor payouts + customer payment instructions both consume it).
 * Never duplicated.
 *
 * BRAND-LAYER RENAME 2026-05-28 V2 CUTOVER: Concierge abuse keeps its route
 * + DB table names (concierge_abuse_flags) for bookmark + audit continuity,
 * but the sidebar entry reads "Setnayan AI abuse" to match the V2 brand.
 *
 * ── 6-MENU RESPINE 2026-07-09 (owner: "integrate different pages, make it
 * up to 6 menus only") ──────────────────────────────────────────────────
 * The sidebar now renders exactly SIX menu rows — one expandable parent per
 * group — instead of six always-open sections (~69 visible links). Each
 * parent links to that menu's INTEGRATED hub surface and auto-expands its
 * children only while the active route is inside the section (the shipped
 * owner-approved "subnav expands from the side nav" SidebarItem pattern):
 *   Overview        → /admin            (queue tiles + work list live there)
 *   Accounts        → /admin/accounts   (tabbed Accounts Studio, shipped)
 *   Studio          → /admin/studio     (tabbed Studio Studio, shipped)
 *   Ugat Console    → /admin/ugat       (hub landing, NEW this respine)
 *   App Performance → /admin/app-performance (the cockpit)
 *   Money           → /admin/money      (hub landing, promoted to desktop)
 * ADMIN_NAV_GROUPS below is UNCHANGED and stays the single source of truth —
 * the parents are DERIVED from it (deriveSixMenus), so /admin/more, the hub
 * landings, and the registry overlay all keep reading the same structure.
 * Live queue counts aggregate onto the Overview parent (worst-urgency tone)
 * so collapsing the queue links never hides SLA pressure.
 *
 * ── DECLUTTER 2026-07-10 (owner: "this is the admin?") ────────────────────
 * The 6-menu respine rendered each parent via the SHARED <SidebarItem>, whose
 * sub-list auto-expands whenever the active route is inside the section. But
 * the admin LANDS on /admin — the Overview ('queues') menu's own hub — so
 * Overview matched on arrival and auto-exploded its ~18 queue children, and the
 * clean six-menu rail read as a long cluttered list duplicating the /admin
 * queue TILES. Fix: render the six via the admin-local <AdminSidebarMenu>
 * (below), which keeps the SidebarItem look + the aggregated parent badge but
 * (a) makes the chevron a real toggle persisted under the same
 * setnayan.nav.section.<key>.open key, and (b) DEFAULTS the Overview menu
 * COLLAPSED even when active (collapsedWhenActive). The other five keep the
 * auto-expand-on-active default. No route/tile/ADMIN_NAV_GROUPS entry removed —
 * purely a default-expand-state change. (The mobile admin-bottom-nav is a flat
 * ≤5-tab strip with no expand logic, and admin-nav-fab is a single action —
 * neither replicates the expand behavior, so neither needed a mirror change.)
 */

import {
  Home,
  Activity,
  Banknote,
  Users,
  Clapperboard,
  Network,
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import { AdminSidebarMenu } from './admin-sidebar-menu';
import type {
  NavGroup,
  NavItem,
  NavBadge,
  NavBadgeTone,
} from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type {
  AdminQueueCounts,
  AdminQueueDueState,
} from '@/lib/admin/queue-counts';

import { ADMIN_NAV_GROUPS } from './admin-nav-groups';

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

/**
 * Per-menu hub metadata for the 6-menu respine (2026-07-09). `href` is the
 * INTEGRATED surface the parent row lands on; `matchPrefix` (Overview only)
 * narrows the parent's own prefix match so `/admin` doesn't startsWith-claim
 * every `/admin/*` route — queue routes light the parent through its CHILDREN
 * instead (SidebarItem's in-section rule), and `/admin/work/*` stays claimed
 * here because the work list has no child row of its own after derivation.
 */
const MENU_HUBS: Record<
  string,
  { href: string; icon: LucideIcon; matchPrefix?: string; description: string }
> = {
  queues: {
    href: '/admin',
    icon: Home,
    matchPrefix: '/admin/work',
    description: 'The admin pulse — every act-now queue at a glance.',
  },
  directory: {
    href: '/admin/accounts',
    icon: Users,
    description: 'Users, vendors, events, and venues — pure record look-up.',
  },
  media: {
    href: '/admin/studio',
    icon: Clapperboard,
    description: 'Everything you curate or publish — content and marketing.',
  },
  ugat: {
    href: '/admin/ugat',
    icon: Network,
    description: 'The data-structure wing — taxonomy, menus, onboarding, AI brain.',
  },
  funnels: {
    href: '/admin/app-performance',
    icon: Activity,
    description: 'Growth, health, and where to focus next.',
  },
  'settings-group': {
    href: '/admin/money',
    icon: Banknote,
    description: 'Pricing and money config, plus the settings tail.',
  },
};

/**
 * Derive the 6 expandable parent rows from the canonical groups. A group item
 * whose href IS the hub itself (Overview's "Overview" row · App Performance's
 * cockpit row) is dropped from the children — the parent row already links
 * there, so keeping it would render a duplicate label directly under itself.
 */
function deriveSixMenus(groups: NavGroup[]): NavItem[] {
  return groups.map((group) => {
    const hub = MENU_HUBS[group.key];
    const href = hub?.href ?? group.items[0]?.href ?? '/admin';
    return {
      key: group.key,
      label: group.label,
      href,
      icon: hub?.icon ?? Home,
      matchPrefix: hub?.matchPrefix,
      description: hub?.description,
      children: group.items.filter((item) => item.href !== href),
    };
  });
}

/**
 * Roll the children's queue badges up onto the parent menu row: total open
 * count, toned by the WORST child urgency (red beats amber beats neutral).
 * This is what keeps SLA pressure visible while the queue links are folded
 * behind the Overview menu.
 */
function aggregateParentBadge(children: NavItem[]): NavBadge | undefined {
  let count = 0;
  let tone: NavBadgeTone = 'neutral';
  let overdue = false;
  for (const child of children) {
    if (!child.badge) continue;
    count += child.badge.count;
    if (child.badge.tone === 'red') {
      tone = 'red';
      overdue = true;
    } else if (child.badge.tone === 'amber' && tone !== 'red') {
      tone = 'amber';
    }
  }
  if (count <= 0) return undefined;
  return {
    count,
    tone,
    label: overdue ? `${count} open, some overdue` : `${count} open`,
  };
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
  const menus = deriveSixMenus(groups).map((menu) => ({
    ...menu,
    badge: aggregateParentBadge(menu.children ?? []),
  }));

  return (
    <section className="px-2 pb-2" aria-label="Admin menu">
      <ul className="flex flex-col gap-0.5">
        {menus.map((item) => (
          <AdminSidebarMenu
            key={item.key}
            menu={item}
            pathname={pathname}
            // DECLUTTER (owner 2026-07-10): the Overview ('queues') menu is the
            // /admin landing's own hub, so the shipped auto-expand-on-active rule
            // exploded its ~18 queue children on arrival. Default it collapsed
            // even when active — the queues stay reachable via the page tiles +
            // the work list, and the toggle (persisted) reopens the section. The
            // other five keep the auto-expand-on-active default.
            collapsedWhenActive={item.key === 'queues'}
          />
        ))}
      </ul>
    </section>
  );
}
