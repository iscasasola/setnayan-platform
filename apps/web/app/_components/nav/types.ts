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
};

export type NavGroup = {
  /** Stable React key — survives label edits. */
  key: string;
  /** Section heading rendered as .m-label-mono uppercase eyebrow. */
  label: string;
  items: NavItem[];
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
