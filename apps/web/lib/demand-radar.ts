/**
 * Demand Radar (Wave 6 vendor "Soon" benefit) — server-side assembly.
 *
 * "Where should I focus?" — a first-party, de-identified read of couple demand
 * that tells a vendor which months / areas / looks are heating up, WITHOUT ever
 * exposing a single couple. The hard privacy contract lives in SQL (migration
 * 20270324631500_demand_radar_rollups):
 *
 *   • Every aggregate is a (region, month-bucket, event_type, style) → COUNTS
 *     bucket. No user_id, no event_id, no names, no single identifiable plan.
 *   • A bucket only surfaces if its total demand signal clears the admin-managed
 *     min-N floor (platform_settings.radar_min_n_floor) via public.min_n_ok().
 *     The two read RPCs (demand_radar_for_vendor / demand_radar_admin) apply
 *     that gate; the rollup TABLE itself is RLS-locked with zero policies, so
 *     there is no path to the un-suppressed rows from the client.
 *   • Cron-free recompute: refreshDemandRadar() (admin "Run now") +
 *     maybeRefreshDemandRadar() (Next 15 after() piggyback, throttled). NO
 *     poller, NO pg_cron — mirrors lib/spotlight-awards.ts.
 *
 * Founder-only marketplace today → most cells are below floor and get
 * suppressed. assembleRadar() handles that honestly: an empty/suppressed radar
 * renders a truthful "not enough demand data yet" state — it never fabricates.
 *
 * This module is server-only (it can construct the service-role client). Import
 * it from server components / server actions, never from a client component.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { regionLabel as resolveRegionLabel } from '@/lib/region-source';
import { PAPIC_STYLES, type PapicStyle } from '@/lib/papic-photo-styles';

// ---------------------------------------------------------------------------
// Row shapes (mirror the SQL RETURNS TABLE of the two read RPCs)
// ---------------------------------------------------------------------------

/** One de-identified rollup bucket as returned by the read RPCs. Counts only. */
export type DemandRadarBucket = {
  region: string;
  /** First-of-month ISO date string ('2026-07-01'). */
  month_bucket: string;
  event_type: string;
  style: string;
  inquiry_count: number;
  unlock_count: number;
  booking_count: number;
};

/** A month's heat = summed demand across its buckets, for the month strip. */
export type MonthHeat = {
  /** First-of-month ISO ('2026-07-01'). */
  month: string;
  label: string;
  inquiries: number;
  unlocks: number;
  bookings: number;
  /** inquiries + unlocks + bookings — the single "heat" number. */
  total: number;
};

/** A region's rolled-up demand (admin radar; the vendor radar is single-region). */
export type RegionHeat = {
  region: string;
  label: string;
  inquiries: number;
  unlocks: number;
  bookings: number;
  total: number;
};

/** A look/style's rolled-up demand. */
export type LookHeat = {
  style: string;
  label: string;
  inquiries: number;
  unlocks: number;
  bookings: number;
  total: number;
};

/** An event-type's rolled-up demand (admin radar). */
export type EventTypeHeat = {
  eventType: string;
  label: string;
  total: number;
};

/** The assembled radar handed to the surfaces. */
export type DemandRadar = {
  /** True when there is at least one bucket that cleared min-N. */
  hasData: boolean;
  /** Total demand signal across every surfaced bucket. */
  totalSignal: number;
  /** Distinct (suppressed-clear) buckets that contributed. */
  bucketCount: number;
  /** Months sorted most-recent-first (the heat strip). */
  months: MonthHeat[];
  /** Regions sorted by total desc (admin radar; one entry for the vendor radar). */
  regions: RegionHeat[];
  /** Looks/styles sorted by total desc. */
  looks: LookHeat[];
  /** Event types sorted by total desc (admin radar). */
  eventTypes: EventTypeHeat[];
};

// ---------------------------------------------------------------------------
// Label helpers (self-contained — no coupling to admin-only label modules)
// ---------------------------------------------------------------------------

const MONTH_FMT = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** 'Jul 2026' for a first-of-month ISO date string. Falls back to the raw value. */
export function monthLabel(monthIso: string): string {
  const d = new Date(`${monthIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return monthIso;
  return MONTH_FMT.format(d);
}

/** Friendly region label via the canonical resolver; '' / unknown → 'Unspecified'. */
export function radarRegionLabel(slug: string): string {
  if (!slug || slug.trim() === '') return 'Unspecified';
  return resolveRegionLabel(slug) ?? slug.toUpperCase();
}

const STYLE_LABELS: Record<string, string> = Object.fromEntries(
  PAPIC_STYLES.map((s) => [s.id, s.label]),
);

/** Friendly Papic-look label ('Cine'); unknown codes pass through. */
export function lookLabel(style: string): string {
  return STYLE_LABELS[style as PapicStyle] ?? style;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  debut: 'Debut',
  christening: 'Christening',
  anniversary: 'Anniversary',
  reunion: 'Reunion',
  corporate: 'Corporate',
  graduation: 'Graduation',
  unspecified: 'Unspecified',
};

/** Friendly event-type label; unknown slugs are humanized (underscores→spaces). */
export function eventTypeLabel(slug: string): string {
  return (
    EVENT_TYPE_LABELS[slug] ??
    slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ---------------------------------------------------------------------------
// Assembly — fold a flat bucket list into the radar shape
// ---------------------------------------------------------------------------

function bucketTotal(b: DemandRadarBucket): number {
  return (
    (b.inquiry_count || 0) + (b.unlock_count || 0) + (b.booking_count || 0)
  );
}

/**
 * Fold the (already min-N suppressed) buckets into the radar projections.
 * Pure + total-driven; safe to call with [] (the empty radar). The caller is
 * responsible for ensuring `buckets` is the RPC output — this never re-derives
 * suppression (that's the SQL's job) and never invents data.
 */
export function assembleRadar(buckets: DemandRadarBucket[]): DemandRadar {
  const months = new Map<string, MonthHeat>();
  const regions = new Map<string, RegionHeat>();
  const looks = new Map<string, LookHeat>();
  const eventTypes = new Map<string, EventTypeHeat>();
  let totalSignal = 0;

  for (const b of buckets) {
    const inq = b.inquiry_count || 0;
    const unl = b.unlock_count || 0;
    const bok = b.booking_count || 0;
    const t = inq + unl + bok;
    totalSignal += t;

    const m = months.get(b.month_bucket) ?? {
      month: b.month_bucket,
      label: monthLabel(b.month_bucket),
      inquiries: 0,
      unlocks: 0,
      bookings: 0,
      total: 0,
    };
    m.inquiries += inq;
    m.unlocks += unl;
    m.bookings += bok;
    m.total += t;
    months.set(b.month_bucket, m);

    const r = regions.get(b.region) ?? {
      region: b.region,
      label: radarRegionLabel(b.region),
      inquiries: 0,
      unlocks: 0,
      bookings: 0,
      total: 0,
    };
    r.inquiries += inq;
    r.unlocks += unl;
    r.bookings += bok;
    r.total += t;
    regions.set(b.region, r);

    const l = looks.get(b.style) ?? {
      style: b.style,
      label: lookLabel(b.style),
      inquiries: 0,
      unlocks: 0,
      bookings: 0,
      total: 0,
    };
    l.inquiries += inq;
    l.unlocks += unl;
    l.bookings += bok;
    l.total += t;
    looks.set(b.style, l);

    const et = eventTypes.get(b.event_type) ?? {
      eventType: b.event_type,
      label: eventTypeLabel(b.event_type),
      total: 0,
    };
    et.total += t;
    eventTypes.set(b.event_type, et);
  }

  return {
    hasData: buckets.length > 0,
    totalSignal,
    bucketCount: buckets.length,
    months: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)),
    regions: [...regions.values()].sort((a, b) => b.total - a.total),
    looks: [...looks.values()].sort((a, b) => b.total - a.total),
    eventTypes: [...eventTypes.values()].sort((a, b) => b.total - a.total),
  };
}

/** The honest empty radar — used when suppressed/founder-only/errored. */
export const EMPTY_RADAR: DemandRadar = {
  hasData: false,
  totalSignal: 0,
  bucketCount: 0,
  months: [],
  regions: [],
  looks: [],
  eventTypes: [],
};

// ---------------------------------------------------------------------------
// Read paths — vendor + admin
// ---------------------------------------------------------------------------

/**
 * Vendor-facing radar, scoped to the caller's OWN vendor profile (the RPC
 * enforces ownership + region scope + min-N + the radar_enabled toggle). Any
 * RPC error degrades to the empty radar so the card stays calm — never throws
 * into the page.
 */
export async function getVendorDemandRadar(
  client: SupabaseClient,
  vendorProfileId: string,
): Promise<DemandRadar> {
  const { data, error } = await client.rpc('demand_radar_for_vendor', {
    p_vendor_profile_id: vendorProfileId,
  });
  if (error || !Array.isArray(data)) return EMPTY_RADAR;
  return assembleRadar(data as DemandRadarBucket[]);
}

/**
 * Admin-facing radar across ALL markets (the RPC enforces is_console_admin() +
 * min-N). Degrades to the empty radar on error.
 */
export async function getAdminDemandRadar(
  client: SupabaseClient,
): Promise<DemandRadar> {
  const { data, error } = await client.rpc('demand_radar_admin');
  if (error || !Array.isArray(data)) return EMPTY_RADAR;
  return assembleRadar(data as DemandRadarBucket[]);
}

// ---------------------------------------------------------------------------
// Cron-free recompute (mirrors lib/spotlight-awards.ts)
// ---------------------------------------------------------------------------

/**
 * Run the rollup rebuild via the service-role admin client (bypasses RLS; the
 * SQL fn still re-gates to admin/service_role). Returns rows written, or null
 * on failure (swallowed — recompute is best-effort). Callers MUST be in a
 * trusted server context (admin "Run now" / after() hook).
 */
export async function refreshDemandRadar(): Promise<number | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('refresh_demand_radar_rollups');
    if (error) {
      console.error('[demand-radar] refresh failed', error);
      return null;
    }
    return typeof data === 'number' ? data : 0;
  } catch (err) {
    console.error('[demand-radar] refresh threw', err);
    return null;
  }
}

/**
 * In-process throttle so the after()-driven refresh fires AT MOST once per
 * window per server instance. Best-effort on top of the idempotent full
 * rebuild — a re-run is just a slightly heavier no-op. Reset on deploy (module
 * reload), which is fine: at most one extra rebuild per deploy.
 */
const REFRESH_WINDOW_MS = 60 * 60 * 1000; // 1 hour
let lastAutoRefreshMs = 0;

/**
 * Cron-free opportunistic refresh. Call inside a Next 15 `after()` on a
 * vendor/admin server surface. Runs the rebuild at most once per window per
 * instance, then short-circuits. Never throws (swallows + logs) so it can't
 * break the request it piggybacks on. The admin "Run now" button is always the
 * manual fallback when no one visits.
 */
export async function maybeRefreshDemandRadar(now: number = Date.now()): Promise<void> {
  if (now - lastAutoRefreshMs < REFRESH_WINDOW_MS) return;
  lastAutoRefreshMs = now;
  const result = await refreshDemandRadar();
  if (result === null) {
    // Reset so a transient failure can retry on the next eligible request.
    lastAutoRefreshMs = 0;
  }
}
