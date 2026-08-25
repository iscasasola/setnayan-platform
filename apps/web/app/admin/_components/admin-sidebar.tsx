'use client';

/**
 * admin-sidebar.tsx — the admin nav DERIVATION (NavGroup[] source of truth).
 *
 * ─── 2026-08-14 · THIS FILE NO LONGER RENDERS ANYTHING ────────────────────
 * One Shell slice 3. The `<AdminSidebar>` component that used to live at the
 * bottom of this file is GONE, and so is its `<AdminSidebarMenu>` row: the
 * admin console now wears the SHARED rail (`AppRailShell` →
 * `_components/frontdoor/front-door-shell.tsx`, variant `app`), and its six
 * menus render as rail rows in `admin-rail-context.tsx`. Owner, 2026-08-13:
 * *"the sidebar should stay… what you did was jumping back to the old
 * dashboards."* `DECISION_LOG.md` 2026-08-13 · `ONE_SHELL_PLAN_2026-08-13.md`.
 *
 * 🔑 WHAT SURVIVES HERE IS THE PART THAT WAS NEVER ABOUT PIXELS: the six
 * groups, their hubs, the registry overlay, the queue badges, the roll-up and
 * the active-row rule. Copying any of it into the new component would have
 * been a second answer to one question — the exact failure this repo keeps
 * paying for. The renderer changed; the derivation did not move.
 *
 * 🪤 AND THE FILENAME IS LOAD-BEARING. `admin-nav-groups.test.ts` reads
 * `MENU_HUBS` OUT OF THIS FILE BY PATH (`admin-sidebar.tsx`) as text, because
 * it is the one source that survived the 2026-08-02 deletion of two whole nav
 * groups. Renaming or moving this file blinds that guard while every test
 * stays green. Leave the name alone.
 *
 * The historical notes below are kept deliberately: they explain why the six
 * groups are the six groups, and why they are FLAT. That reasoning still
 * governs — only the element the rows are drawn with has changed.
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
 * ── FLATTEN 2026-07-15 (owner: "solid menu with no submenus") ─────────────
 * The six menu rows are now PLAIN DOORWAYS — no chevron, no inline children.
 * The owner locked every desktop sidebar to a flat list of top-level
 * destinations; sub-navigation lives INSIDE each hub (the tabbed studios, the
 * /admin/work worklist, and each group LANDING enumerates its children as
 * tiles/cards). ADMIN_NAV_GROUPS is UNCHANGED and still the single source of
 * truth — the six parents are still DERIVED from it (deriveSixMenus), and each
 * parent still carries its group's items as the active-detection + badge-rollup
 * input, but <AdminSidebarMenu> renders them as a flat row (the children never
 * become a sub-list). Child routes still light their parent (the group items
 * feed active-state, since they live on disjoint path roots the hub matchPrefix
 * can't cover) and the aggregated queue badge still shows. This extends the
 * vendor 5-page IA (2026-07-12) + the couple plain-leaf decision (2026-07-10).
 *
 * ── 6-MENU RESPINE 2026-07-09 (owner: "integrate different pages, make it
 * up to 6 menus only") · SUPERSEDED-IN-PART by the 2026-07-15 flatten above ──
 * The sidebar renders exactly SIX menu rows instead of six always-open sections
 * (~69 visible links). Each parent links to that menu's INTEGRATED hub surface.
 * (Historically each parent AUTO-EXPANDED its children while the active route was
 * inside the section — that expand behavior was REMOVED by the flatten above.):
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
 * ── DECLUTTER 2026-07-10 (owner: "this is the admin?") · SUPERSEDED by the
 * 2026-07-15 flatten above ────────────────────────────────────────────────
 * The 2026-07-10 pass kept the expandable menus but defaulted the Overview menu
 * COLLAPSED even when active (a `collapsedWhenActive` flag on <AdminSidebarMenu>)
 * so the rail didn't explode its ~18 queue children on arrival at /admin. The
 * 2026-07-15 flatten removed expansion entirely, so that flag + its persisted
 * toggle are gone — there is no longer any inline sub-list to collapse. (The
 * mobile admin-bottom-nav is a flat ≤5-tab strip with no expand logic, and
 * admin-nav-fab is a single action — neither ever replicated the expand
 * behavior, so neither needed a change.)
 */

import {
  Home,
  Activity,
  Banknote,
  Users,
  Clapperboard,
  Network,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import { matchesPath, type ParamGetter } from '@/app/_components/nav/match-path';
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
export function applyAdminRegistry(
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
export function applyQueueBadges(
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
    description: 'Everything waiting on a decision, most urgent first.',
  },
  directory: {
    href: '/admin/accounts',
    icon: Users,
    description: 'Shops and the people behind them — checking, verifying, looking up.',
  },
  media: {
    href: '/admin/studio',
    icon: Clapperboard,
    description: 'Everything you make — the website, films, songs, mood boards.',
  },
  ugat: {
    href: '/admin/ugat',
    icon: Network,
    description: 'How Setnayan is put together — categories, onboarding, settings, test data.',
  },
  funnels: {
    href: '/admin/app-performance',
    icon: Activity,
    description: 'How the site is doing — traffic, growth, search, errors.',
  },
  'settings-group': {
    href: '/admin/money',
    icon: Banknote,
    description: 'Money in and money out — payments, fees, payouts, and what you charge.',
  },
};

/**
 * Derive the 6 expandable parent rows from the canonical groups. A group item
 * whose href IS the hub itself (Overview's "Overview" row · App Performance's
 * cockpit row) is dropped from the children — the parent row already links
 * there, so keeping it would render a duplicate label directly under itself.
 */
export function deriveSixMenus(groups: NavGroup[]): NavItem[] {
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
export function aggregateParentBadge(children: NavItem[]): NavBadge | undefined {
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

/**
 * ALL SURFACES — the whole map, and the reason the six rows can stay short.
 * The 2026-07-15 flatten turned each menu into a plain doorway, which left 108
 * admin pages with no single browsable index on desktop; /admin/more had one
 * the entire time, hidden behind an lg:hidden on the premise that "the sidebar
 * handles overflow", which the flatten had already stopped being true.
 *
 * 🔒 DELIBERATELY NOT A SEVENTH ENTRY IN `ADMIN_NAV_GROUPS`: it is a link to a
 * page, not a group of items, and adding it there would break the
 * groups-to-MENU_HUBS parity that `admin-nav-groups.test.ts` asserts — the
 * guard written after a cleanup commit silently deleted two whole groups. It
 * is appended to the RENDER list here, exactly as it was appended to the old
 * sidebar's <ul>, and `admin-rail-context.test.ts` pins both halves of that:
 * present in the rail, absent from the groups.
 */
export const ALL_SURFACES_MENU: NavItem = {
  key: 'all-surfaces',
  label: 'All surfaces',
  href: '/admin/more',
  icon: LayoutGrid,
  description: 'Every admin page, grouped and searchable.',
};

/**
 * The rows the admin rail draws, in order: the six derived menus, then All
 * surfaces.
 *
 * This is the WHOLE of what the old `<AdminSidebar>` computed — registry
 * overlay, then queue badges, then the six hubs, then the roll-up. It is a
 * function rather than inline in the component so a test can call the REAL
 * list instead of a copy of it: on 2026-08-13 a rail test declared its own row
 * list and a mutation that deleted `exact: true` from the real one passed
 * every behaviour assertion. Testing the primitive is not testing the caller.
 */
export function adminRailMenus({
  navSlots,
  queueCounts,
  queueStates,
}: {
  navSlots?: Record<string, NavSlotLite>;
  queueCounts?: AdminQueueCounts;
  queueStates?: Record<string, AdminQueueDueState>;
}): NavItem[] {
  const groups = applyQueueBadges(
    applyAdminRegistry(ADMIN_NAV_GROUPS, navSlots),
    queueCounts,
    queueStates,
  );
  const menus = deriveSixMenus(groups).map((menu) => ({
    ...menu,
    badge: aggregateParentBadge(menu.children ?? []),
  }));
  return [...menus, ALL_SURFACES_MENU];
}

/**
 * Does this menu own the current URL?
 *
 * THE RULE IS THE SHIPPED ONE, MOVED NOT REWRITTEN (it was `AdminSidebarMenu`'s
 * `inSection`): a menu lights when its own hub matches OR when ANY of its
 * group's child routes matches. The children live on DISJOINT path roots
 * (Money's landing is /admin/money, its children are /admin/pricing,
 * /admin/settings, /admin/token-purchases …), so a single `matchPrefix` on the
 * hub cannot cover them. That is what keeps /admin/pricing?tab=token-bands
 * lighting "Money" and /admin/verify lighting "Overview".
 *
 * The `children` array exists ONLY as this input and as the badge-rollup
 * input. It is never rendered as a sub-list — that is the whole point of the
 * 2026-07-15 flatten.
 */
function menuOwnsUrl(
  menu: NavItem,
  pathname: string,
  currentParams?: ParamGetter | null,
): boolean {
  return (
    matchesPath(menu, pathname, currentParams) ||
    (menu.children ?? []).some((child) => matchesPath(child, pathname, currentParams))
  );
}

/**
 * The key of the ONE menu that should read as active, or `null`.
 *
 * ⚠ WHY A "WHICH ONE" FUNCTION AND NOT A PER-ROW BOOLEAN — the same lesson
 * `rail-active.ts` records for the shared rows. The old sidebar asked each row
 * "are you active?" independently, which is safe only while no two menus can
 * match one URL; the matcher is prefix-based, so that is a property of today's
 * route table, not a guarantee. Two lit rows is not a smaller bug than zero —
 * it tells the reader they are in two places at once. So among every menu that
 * matches, the LONGEST matched href path wins.
 *
 * 🔑 THIS CANNOT LIGHT A MENU THE SHIPPED PREDICATE WOULD NOT HAVE LIT. The
 * membership test is unchanged (`menuOwnsUrl`); only the tie-break is new. A
 * URL that lit exactly one menu before lights exactly that menu now.
 *
 * `null` IS A REAL ANSWER and must render as "no row lit" — never as a
 * fallback to the first row.
 */
export function activeAdminMenuKey(
  menus: ReadonlyArray<NavItem>,
  pathname: string,
  currentParams?: ParamGetter | null,
): string | null {
  let bestKey: string | null = null;
  let bestScore = -1;

  for (const menu of menus) {
    if (!menuOwnsUrl(menu, pathname, currentParams)) continue;
    // The most specific thing that matched: the hub when the hub matched,
    // otherwise the longest matching child. Path length only — no admin menu
    // hub declares a query.
    const hubPath = menu.href.split('?')[0] ?? menu.href;
    const own = matchesPath(menu, pathname, currentParams) ? hubPath.length : -1;
    const viaChild = (menu.children ?? [])
      .filter((child) => matchesPath(child, pathname, currentParams))
      .reduce((max, child) => Math.max(max, (child.href.split('?')[0] ?? '').length), -1);
    const score = Math.max(own, viaChild);
    if (score > bestScore) {
      bestScore = score;
      bestKey = menu.key;
    }
  }

  return bestKey;
}
