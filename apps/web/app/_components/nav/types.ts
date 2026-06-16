/**
 * Shared nav type contracts — v2.1 Navigation Refactor Phase 0.
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 template package adoption"
 * locked the burnt-sienna `--m-*` palette + Saira Condensed display
 * register + the visual treatment for sidebars across the 3 doorways
 * (customer · vendor · admin). The 14th 2026-05-28 row System Wiring
 * Map audit confirmed each doorway re-implements its own nav primitives
 * (apps/web/app/dashboard/[eventId]/_components/bottom-nav.tsx ·
 * apps/web/app/admin/_components/admin-nav.tsx + the 14 vendor-dashboard
 * tab strip) so a coherent v2.1 sidebar treatment requires composable
 * primitives that all three can lean on. This file is THE contract.
 *
 * SCOPE Phase 0 (this file is one of 6 sibling files): just the types.
 * Phases 1-3 will adopt these primitives separately per doorway. The
 * audit in the 14th 2026-05-28 row + the [[feedback_setnayan_orphan_prevention]]
 * memory rule both require explicit entry-point inventory before any
 * surface change — Phases 1-3 will execute that walk per-doorway.
 *
 * USAGE:
 *   import type { NavGroup, NavItem, BottomNavItem } from '@/app/_components/nav/types';
 *
 *   const groups: NavGroup[] = [
 *     {
 *       key: 'queues',
 *       label: 'Queues',
 *       items: [
 *         { key: 'verify', label: 'Verification', href: '/admin/verify', icon: ShieldCheck },
 *         { key: 'payments', label: 'Payments', href: '/admin/payments', icon: Wallet,
 *           badge: { count: 3, tone: 'amber' } },
 *       ],
 *     },
 *   ];
 *
 * Active-detection rule: `matchPrefix` defaults to `href` and is matched
 * via `pathname === href || pathname.startsWith(matchPrefix + '/')`. The
 * trailing slash is load-bearing — without it `/budget` matches `/budgets`
 * silently. Caller can override matchPrefix when an umbrella of sub-routes
 * should bucket under a single entry (e.g., guests-umbrella from the
 * existing bottom-nav.tsx GUESTS_UMBRELLA list).
 *
 * NavBadgeTone palette:
 *   - 'neutral' — stone tint, generic count
 *   - 'amber'   — warning (e.g., pending review queue, soft-hold breaches)
 *   - 'red'     — error / urgent (e.g., disputes past SLA)
 *   - 'orange'  — brand accent (e.g., "new" highlight) — uses --m-orange
 *
 * Sized for the v2.1 surface: badge.label is an optional sr-only override
 * when count alone reads ambiguously (e.g., "3 unread messages" beats "3").
 */

import type { LucideIcon } from 'lucide-react';

export type NavBadgeTone = 'neutral' | 'amber' | 'red' | 'orange';

export type NavBadge = {
  count: number;
  tone: NavBadgeTone;
  /** Optional sr-only label override when count alone is ambiguous. */
  label?: string;
};

export type NavItem = {
  /** Stable React key — survives label/href edits. */
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: NavBadge;
  /** Optional secondary copy (e.g., tooltip on collapsed sidebar). */
  description?: string;
  /**
   * Path-prefix for active detection. Defaults to `href`. Use when a
   * single nav item should claim multiple sub-routes — e.g., set
   * matchPrefix='/admin/payments' on a single "Payments" entry so
   * /admin/payments/<orderId> lights it up.
   */
  matchPrefix?: string;
  /**
   * Render the row dimmed — a "not yet" state for an item that's present
   * but not actionable right now (e.g. a time-gated guest-journey Day-of
   * stage before the event). Stays a live link; only its opacity drops. The
   * active item is never muted. Mirrors SubNavItem.muted so the desktop
   * sidebar and the mobile <SubNav> read the same gating.
   */
  muted?: boolean;
  /**
   * Optional nested sub-items — the DESKTOP-sidebar equivalent of the
   * mobile <SubNav> pill (owner 2026-06-17 "let the subnav expand from the
   * side nav … when there is a sidenav, all will be under the side nav").
   * When present, the item becomes an expandable PARENT: <SidebarItem>
   * renders the children as an indented sub-list that auto-expands while the
   * active route is inside the section (the parent OR any child matches).
   * ONE level only — children's own `children` are not rendered. On mobile
   * the same sub-section set is rendered by <SubNav> instead; this field is
   * inert for the bottom-nav / accordion builders (they don't read it).
   */
  children?: NavItem[];
};

export type NavGroup = {
  /** Stable React key — survives label edits. */
  key: string;
  /** Section heading rendered as .m-label-mono uppercase eyebrow. */
  label: string;
  items: NavItem[];
  /**
   * Optional menu icon for the mobile bottom-nav accordion. When the bottom
   * nav is built FROM NavGroup[] (the customer journey-group model), each
   * top-level menu carries this icon. The desktop sidebar renders section
   * HEADINGS as text only, so it ignores this field — it exists purely so the
   * accordion's top-level menus can show a glyph. (Optional for back-compat
   * with admin/vendor NavGroup[] that don't drive an accordion.)
   */
  icon?: LucideIcon;
  /**
   * Initial open-state when no localStorage value exists. Defaults to true
   * (sections start expanded). Set false for low-priority groups.
   */
  defaultOpen?: boolean;
};

export type BottomNavItem = {
  /** Stable React key — survives label/href edits. */
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Path prefix or list of prefixes for active detection. Use a single
   * string for simple cases or string[] when one bottom-nav tab claims
   * an umbrella of sub-routes (mirrors GUESTS_UMBRELLA / SERVICES_UMBRELLA
   * pattern from the existing bottom-nav.tsx).
   *
   * Match semantics: `pathname === prefix || pathname.startsWith(prefix + '/')`.
   * Set `activeMatchExact: true` to suppress the startsWith branch — useful
   * when one tab represents an exact route that is the prefix of every other
   * tab's routes (e.g., Home `/admin` would otherwise startsWith-match every
   * `/admin/*` route and stay perpetually active).
   */
  activeMatch: string | string[];
  /**
   * When true, active detection uses exact-match only (no startsWith
   * branch). Mirrors the pattern from
   * apps/web/app/dashboard/[eventId]/_components/bottom-nav.tsx where the
   * Home tab needs exact `/dashboard/[id]` match because every other tab's
   * route also begins with `/dashboard/[id]/`.
   *
   * Defaults to false (prefix match active — backwards compatible with
   * Phase 0 baseline behavior).
   */
  activeMatchExact?: boolean;
  badge?: NavBadge;
};

/**
 * BottomNavMenu — a top-level bottom-nav menu that may EXTRACT an inline
 * accordion of children (0021 ADDENDUM · accordion bottom nav · owner-locked
 * 2026-06-15).
 *
 * A `BottomNavMenu` is a `BottomNavItem` (so the canonical flat machinery —
 * the traveling pill, press-light bloom, icon-grow — applies verbatim) plus
 * an optional `children` array (≤5):
 *   - WITH children → tapping the menu EXTRACTS the accordion in place: the
 *     menu glides to the far-left corner (back-hinge), the other menus clear,
 *     and the children cascade out from behind the corner. `href` is then a
 *     fallback only (the menu's primary action is "open the section"; the
 *     default landing on expand is the FIRST child per the spec §5.5).
 *   - WITHOUT children → it just navigates to `href` (Home, Budget).
 *
 * The accordion is rendered ONLY when <BottomNav menus={...}> is given. The
 * legacy <BottomNav items={...}> flat path (vendor + admin doorways) is
 * unchanged — `menus` is a strictly-additive, customer-first opt-in.
 *
 * Children cap = 5 (spec §5.4). The bar surfaces a dev warning beyond that.
 */
export type BottomNavMenu = BottomNavItem & {
  /**
   * Inline accordion children (≤5). When present, the menu extracts the
   * accordion on tap instead of navigating. When absent/empty, the menu
   * navigates to its own `href`.
   */
  children?: BottomNavItem[];
};
