/**
 * WHAT YOU CHANGE — the live counts behind the six tiles on the admin Overview.
 *
 * WHY THIS FILE EXISTS. The tiles used to print a FROZEN snapshot of the owner's
 * audit log ("34 changes · 52%", measured 20 May – 8 Aug 2026) as if it were
 * live, and fixed bar widths beside it. It was already wrong the next time he
 * changed anything. The numbers now come from `admin_audit_log` itself — the
 * very table the tiles describe — counted over the trailing window below.
 *
 * 🔑 A FAILED READ IS NOT A ZERO. If a count cannot be read the tile prints NO
 * number at all (`null`), never "0 changes" — a refused read that renders as
 * "nothing changed" is the same lie as a frozen figure, in the other direction.
 *
 * ⚖ The buckets are action-code PREFIXES, kept next to each other here so the
 * mapping is one reviewable list. An action that matches none of them still
 * counts toward the total the percentage is taken against, so the six shares
 * never add up to more than 100.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { logQueryError } from '@/lib/supabase/error-detect';

/** The trailing window the tiles describe. Shown on the Overview so it is never implicit. */
export const WHAT_YOU_CHANGE_WINDOW_DAYS = 90;

/**
 * `admin_audit_log.action` prefixes per tile, keyed by the ADMIN_NAV_GROUPS key
 * the tile links to. Matched with SQL `LIKE '<prefix>%'`.
 */
export const WHAT_YOU_CHANGE_PREFIXES: Readonly<Record<string, readonly string[]>> = {
  // Prices & what we sell
  pricing: [
    'v2_',
    'ai_band_',
    'booking_fee_schedule_',
    'family_signup_discount_',
    'papic_ladder_',
    'papic_product_price_',
    'papic_event_type_sizing_',
    'discount_code_',
    'promo_free_window_',
  ],
  // Categories
  taxonomy: ['taxonomy.', 'taxonomy_', 'event_types.'],
  // Test data
  'demo-vendors': ['demo_vendors_'],
  // Shops
  verify: ['vendor_verification_', 'vendor_visibility_', 'vendor_partnership_', 'vendor_tier_'],
  // The website
  website: ['site_widgets_', 'journal_spotlight_', 'real_stories.', 'storytellers.', 'recap.'],
  // Your team
  users: ['user_', 'founder_seat_'],
};

export type WhatYouChangeCount = {
  /** Changes in the window; `null` when the read failed — never a typed zero. */
  count: number | null;
  /** Share of ALL admin actions in the window, 0–100; `null` when unknown. */
  percent: number | null;
};

export type WhatYouChangeCounts = {
  /** Keyed by tile key. */
  byKey: Readonly<Record<string, WhatYouChangeCount>>;
  /** All admin actions in the window; `null` when that read failed. */
  total: number | null;
};

/** PostgREST `.or()` filter for one bucket. `_` is a LIKE wildcard; harmless for a prefix. */
export function prefixFilter(prefixes: readonly string[]): string {
  return prefixes.map((p) => `action.like.${p}*`).join(',');
}

/** The ISO instant the window opens at. */
export function windowStart(nowMs: number): string {
  return new Date(nowMs - WHAT_YOU_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Pure: the percentage of the total, or null when either side is unknown or the total is 0. */
export function sharePercent(count: number | null, total: number | null): number | null {
  if (count === null || total === null || total <= 0) return null;
  return Math.round((count / total) * 100);
}

export async function fetchWhatYouChange(
  admin: SupabaseClient,
  nowMs: number = Date.now(),
): Promise<WhatYouChangeCounts> {
  const since = windowStart(nowMs);
  const head = { count: 'exact', head: true } as const;
  const keys = Object.keys(WHAT_YOU_CHANGE_PREFIXES);

  const countFor = async (label: string, prefixes: readonly string[] | null) => {
    let q = admin.from('admin_audit_log').select('*', head).gte('created_at', since);
    if (prefixes) q = q.or(prefixFilter(prefixes));
    const { count, error } = await q;
    if (error) {
      logQueryError(`AdminOverview whatYouChange (${label})`, error, {}, 'graceful_degrade');
      return null;
    }
    return typeof count === 'number' ? count : null;
  };

  const [total, ...counts] = await Promise.all([
    countFor('total', null),
    ...keys.map((k) => countFor(k, WHAT_YOU_CHANGE_PREFIXES[k]!)),
  ]);

  const byKey: Record<string, WhatYouChangeCount> = {};
  keys.forEach((k, i) => {
    const count = counts[i] ?? null;
    byKey[k] = { count, percent: sharePercent(count, total) };
  });
  return { byKey, total };
}
