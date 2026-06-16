import 'server-only';

import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { NAV_SLOT_DEFAULTS } from './nav-registry-defaults';
import type {
  NavAccountScope,
  NavIconDescriptor,
  NavSlotDefault,
  NavSlotLite,
  NavSlotOverrideRow,
  ResolvedNavSlot,
} from './nav-registry-types';

/**
 * Nav / icon / menu registry RESOLVER (server-only).
 *
 * Two-layer source of truth:
 *   1. code defaults  — lib/nav-registry-defaults.ts (the route-meta successor)
 *   2. admin overrides — public.nav_slot_override (only the slots an admin changed)
 *
 * `getResolvedNavSlots()` merges the two (COALESCE(override, default)). Overrides
 * are read with the service-role client (cookie-free) so the read is cacheable
 * via unstable_cache + the NAV_REGISTRY_TAG; admin actions call
 * `revalidateTag(NAV_REGISTRY_TAG)` after every edit.
 *
 * As of the foundation PR (2026-06-16) the nav chrome does NOT consume this yet
 * — only /admin/menus does. The wiring PRs route customer → vendor → admin →
 * public nav through these helpers.
 */

export const NAV_REGISTRY_TAG = 'nav-registry';

const loadOverrides = unstable_cache(
  async (): Promise<Record<string, NavSlotOverrideRow>> => {
    // Fully defensive: any failure (table not migrated yet, env missing) falls
    // back to code defaults so the nav always renders.
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('nav_slot_override')
        .select('slot_key,label,icon_kind,lucide_name,custom_url,is_hidden');
      if (error || !data) return {};
      const map: Record<string, NavSlotOverrideRow> = {};
      for (const row of data as NavSlotOverrideRow[]) map[row.slot_key] = row;
      return map;
    } catch {
      return {};
    }
  },
  ['nav-slot-overrides'],
  { tags: [NAV_REGISTRY_TAG] },
);

function defaultIconOf(d: NavSlotDefault): NavIconDescriptor {
  return { kind: d.iconKind, lucideName: d.lucideName, customRef: d.customRef, customUrl: null };
}

function resolveOne(d: NavSlotDefault, o: NavSlotOverrideRow | undefined): ResolvedNavSlot {
  const baseIcon = defaultIconOf(d);
  const def = { label: d.label, icon: baseIcon };

  if (!o) {
    return {
      key: d.key,
      scope: d.scope,
      area: d.area,
      route: d.route,
      label: d.label,
      labelKind: d.labelKind,
      icon: baseIcon,
      isHidden: false,
      isOverridden: false,
      sortOrder: d.sortOrder,
      default: def,
    };
  }

  const label = o.label ?? d.label;

  let icon: NavIconDescriptor;
  if (o.icon_kind === 'custom' && o.custom_url) {
    icon = { kind: 'custom', lucideName: null, customRef: null, customUrl: o.custom_url };
  } else if (o.icon_kind === 'lucide' && o.lucide_name) {
    icon = { kind: 'lucide', lucideName: o.lucide_name, customRef: null, customUrl: null };
  } else if (o.icon_kind === 'none') {
    icon = { kind: 'none', lucideName: null, customRef: null, customUrl: null };
  } else {
    icon = baseIcon; // icon not overridden — keep the code default
  }

  const isOverridden = o.label != null || o.icon_kind != null || o.is_hidden === true;

  return {
    key: d.key,
    scope: d.scope,
    area: d.area,
    route: d.route,
    label,
    labelKind: d.labelKind,
    icon,
    isHidden: o.is_hidden === true,
    isOverridden,
    sortOrder: d.sortOrder,
    default: def,
  };
}

function bySortOrder(a: ResolvedNavSlot, b: ResolvedNavSlot): number {
  return (
    a.scope.localeCompare(b.scope) ||
    a.area.localeCompare(b.area) ||
    a.sortOrder - b.sortOrder ||
    a.key.localeCompare(b.key)
  );
}

/** Every slot, defaults merged with overrides. Includes hidden slots (admin view). */
export async function getResolvedNavSlots(): Promise<ResolvedNavSlot[]> {
  const overrides = await loadOverrides();
  return NAV_SLOT_DEFAULTS.map((d) => resolveOne(d, overrides[d.key])).sort(bySortOrder);
}

/** Visible slots for one surface (scope+area), hidden ones dropped — for consumers. */
export async function getNavArea(
  scope: NavAccountScope,
  area: string,
): Promise<ResolvedNavSlot[]> {
  return (await getResolvedNavSlots()).filter(
    (s) => s.scope === scope && s.area === area && !s.isHidden,
  );
}

/** One resolved slot by key, or null. */
export async function getNavSlot(key: string): Promise<ResolvedNavSlot | null> {
  const overrides = await loadOverrides();
  const d = NAV_SLOT_DEFAULTS.find((s) => s.key === key);
  return d ? resolveOne(d, overrides[d.key]) : null;
}

/**
 * Serializable slot_key → {label, icon, isHidden} map for passing from a server
 * component into client nav renderers (which look up their slots by key + keep
 * href/activeMatch in code). Cached via the same NAV_REGISTRY_TAG path.
 */
export async function getNavSlotMap(): Promise<Record<string, NavSlotLite>> {
  const slots = await getResolvedNavSlots();
  const map: Record<string, NavSlotLite> = {};
  for (const s of slots) {
    map[s.key] = { label: s.label, icon: s.icon, isHidden: s.isHidden };
  }
  return map;
}
