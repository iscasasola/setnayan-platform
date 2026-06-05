/**
 * Budget Planner — server-side resolver that bridges the pure engine
 * (lib/budget-allocation.ts) to real data.
 *
 * Design: Budget_Planner_Allocation_Engine_2026-06-05.md (spec corpus).
 *
 * The engine is PURE, so the split is deliberate:
 *   • THIS module (server) fetches the INPUTS once — the couple's budget, the
 *     admin-seeded benchmarks + config, and the (thin) market medians from solo
 *     vendor prices — and hands them to the client.
 *   • The CLIENT imports `computeBudgetAllocation` directly and re-runs it on
 *     every tilt (instant, no round-trip); it only calls the server to SAVE a
 *     snapshot (the behavioral capture).
 *
 * No prices are invented here: benchmarks are admin-set, medians come from real
 * vendor_services rows, and everything else is a proportion of the couple's own
 * budget.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LeafInput, AllocationConfig } from './budget-allocation';

/** Map each benchmark leaf (plan_group_id) to the vendor `canonical_service`
 *  keys whose solo prices feed its median. Mirrors
 *  VENDOR_PICK_TASK_CANONICAL_SERVICES (kept local to avoid the heavier import
 *  chain). Leaves absent here simply get no market median → benchmark-only. */
const LEAF_CANONICAL_SERVICES: Record<string, readonly string[]> = {
  reception_venue: ['venue'],
  ceremony_venue: ['religious_venue'],
  catering: ['catering'],
  photography: ['photographer', 'videographer'],
  coordinator: ['coordinator'],
  officiant: ['officiant'],
  hair_makeup: ['makeup_artist', 'hair_stylist'],
  attire: ['gown_designer', 'suit_designer'],
  florals_decor: ['florist', 'reception_decor'],
  stylist: ['reception_decor', 'florist'],
  live_band: ['band_dj'],
  music_entertainment: ['band_dj', 'choir', 'string_quartet'],
  host_mc: ['host_emcee'],
  lights_sound: ['lights_and_sound', 'led_screens'],
  led_background: ['led_screens'],
  cake: ['cake_maker'],
  cocktail_booths: ['cocktail_booths'],
  photobooth: ['photobooth'],
  bridal_car: ['transportation'],
  accommodation: ['accommodation'],
};

export type BenchmarkRow = {
  plan_group_id: string;
  label: string;
  benchmark_php: number | null;
  floor_php: number | null;
  p25_php: number | null;
  p75_php: number | null;
  is_active: boolean;
  sort_order: number;
};

export type PlannerLeafInput = LeafInput & { label: string };

export type AllocationInputs = {
  /** Couple's budget in PHP (estimated_budget_centavos / 100). Null = not set. */
  budgetPhp: number | null;
  /** One per active benchmark leaf, ready for computeBudgetAllocation. */
  leaves: PlannerLeafInput[];
  /** Engine knobs (admin-tunable). */
  config: Partial<AllocationConfig>;
  /** Couple's guest count — surfaced for context (pax-axis normalization is a
   *  follow-on; benchmarks are flat per-leaf in V1). */
  pax: number | null;
};

const DEFAULT_CONFIG_FALLBACK: Partial<AllocationConfig> = {
  minSampleN: 3,
  highConfidenceN: 8,
  medConfidenceN: 3,
  bandPct: 0.15,
  surplusMode: 'park',
};

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/** Read the admin engine config (singleton) → engine config shape. Falls back to
 *  the engine defaults if the row/table is absent. */
export async function fetchAllocationConfig(
  client: SupabaseClient,
): Promise<Partial<AllocationConfig>> {
  try {
    const { data, error } = await client
      .from('budget_allocation_config')
      .select('min_sample_n, high_confidence_n, med_confidence_n, band_pct, surplus_mode')
      .eq('config_key', 'default')
      .maybeSingle();
    if (error || !data) return DEFAULT_CONFIG_FALLBACK;
    const r = data as {
      min_sample_n: number;
      high_confidence_n: number;
      med_confidence_n: number;
      band_pct: number;
      surplus_mode: string;
    };
    return {
      minSampleN: r.min_sample_n,
      highConfidenceN: r.high_confidence_n,
      medConfidenceN: r.med_confidence_n,
      bandPct: Number(r.band_pct),
      surplusMode: r.surplus_mode === 'distribute' ? 'distribute' : 'park',
    };
  } catch {
    return DEFAULT_CONFIG_FALLBACK;
  }
}

/** All active benchmark leaves (admin-curated set + labels + seeded prices). */
export async function fetchActiveBenchmarks(client: SupabaseClient): Promise<BenchmarkRow[]> {
  try {
    const { data, error } = await client
      .from('budget_leaf_benchmarks')
      .select('plan_group_id, label, benchmark_php, floor_php, p25_php, p75_php, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return data as BenchmarkRow[];
  } catch {
    return [];
  }
}

/** Median + sample count of SOLO vendor prices per leaf, from active
 *  vendor_services rows with a starting price. One query, grouped in JS. */
async function fetchLeafMedians(
  client: SupabaseClient,
  leafIds: string[],
): Promise<Map<string, { median: number; count: number }>> {
  const out = new Map<string, { median: number; count: number }>();
  // canonical_service -> leaf reverse index for the leaves we care about.
  const canonToLeaf = new Map<string, string>();
  const allCanon: string[] = [];
  for (const leaf of leafIds) {
    for (const c of LEAF_CANONICAL_SERVICES[leaf] ?? []) {
      if (!canonToLeaf.has(c)) {
        canonToLeaf.set(c, leaf);
        allCanon.push(c);
      }
    }
  }
  if (allCanon.length === 0) return out;
  try {
    const { data, error } = await client
      .from('vendor_services')
      .select('canonical_service, starting_price_php, is_active')
      .in('canonical_service', allCanon)
      .eq('is_active', true)
      .not('starting_price_php', 'is', null);
    if (error || !data) return out;
    const byLeaf = new Map<string, number[]>();
    for (const row of data as Array<{ canonical_service: string | null; starting_price_php: number | null }>) {
      if (row.canonical_service == null || row.starting_price_php == null) continue;
      const leaf = canonToLeaf.get(row.canonical_service);
      if (!leaf) continue;
      const price = Number(row.starting_price_php);
      if (!Number.isFinite(price) || price <= 0) continue;
      const arr = byLeaf.get(leaf) ?? [];
      arr.push(price);
      byLeaf.set(leaf, arr);
    }
    for (const [leaf, prices] of byLeaf) {
      const m = median(prices);
      if (m != null) out.set(leaf, { median: m, count: prices.length });
    }
  } catch {
    /* graceful — no medians, benchmarks carry the load */
  }
  return out;
}

/**
 * Resolve everything the client planner needs for one event: the budget, the
 * per-leaf inputs (benchmark + market median fused), and the engine config.
 * The client runs computeBudgetAllocation on these and re-runs on every tilt.
 */
export async function resolveAllocationInputs(
  client: SupabaseClient,
  eventId: string,
): Promise<AllocationInputs> {
  const [eventRes, benchmarks, config] = await Promise.all([
    client
      .from('events')
      .select('event_id, estimated_budget_centavos, estimated_pax')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchActiveBenchmarks(client),
    fetchAllocationConfig(client),
  ]);

  const ev = eventRes.data as
    | { estimated_budget_centavos?: number | null; estimated_pax?: number | null }
    | null;
  const budgetPhp =
    ev?.estimated_budget_centavos != null ? Math.round(Number(ev.estimated_budget_centavos) / 100) : null;
  const pax = ev?.estimated_pax != null ? Number(ev.estimated_pax) : null;

  const medians = await fetchLeafMedians(client, benchmarks.map((b) => b.plan_group_id));

  const leaves: PlannerLeafInput[] = benchmarks.map((b) => {
    const mk = medians.get(b.plan_group_id);
    return {
      canonicalService: b.plan_group_id,
      label: b.label,
      medianPhp: mk?.median ?? null,
      sampleCount: mk?.count ?? 0,
      benchmarkPhp: b.benchmark_php,
      floorPhp: b.floor_php,
      p25Php: b.p25_php,
      p75Php: b.p75_php,
      // fixedPhp (Setnayan-SKU carve-out) + pinnedAmountPhp are wired in a
      // follow-on; V1 returns the default (benchmark/median-derived) allocation.
      fixedPhp: null,
      pinnedAmountPhp: null,
    };
  });

  return { budgetPhp, leaves, config, pax };
}

// ── Admin aggregates (de-identified, min-N gated) ────────────────────────────

export type LeafAggregate = {
  planGroupId: string;
  /** How many couples' snapshots contributed (>= minN only). */
  coupleCount: number;
  /** Mean final share across couples, in basis points. */
  avgShareBp: number;
  /** Mean final ₱ across couples. */
  avgFinalPhp: number;
  /** How often this leaf was the FIRST one a couple pinned (priority signal). */
  firstPinRate: number;
};

/**
 * De-identified aggregate of saved snapshots, for the admin dashboard. Reads via
 * the ADMIN (service-role) client — couples-own RLS blocks the authed admin from
 * raw rows by design — and returns ONLY leaves with >= minN distinct events
 * (k-anonymity). Returns [] until enough couples have used the planner.
 */
export async function fetchAllocationAggregates(
  adminClient: SupabaseClient,
  minN = 5,
): Promise<{ aggregates: LeafAggregate[]; totalEvents: number; suppressedBelowMinN: boolean }> {
  try {
    const { data, error } = await adminClient
      .from('budget_allocation_decisions')
      .select('event_id, canonical_service, final_share_bp, final_amount_php, was_pinned, pin_order');
    if (error || !data) return { aggregates: [], totalEvents: 0, suppressedBelowMinN: false };

    type Row = {
      event_id: string;
      canonical_service: string;
      final_share_bp: number | null;
      final_amount_php: number | null;
      was_pinned: boolean | null;
      pin_order: number | null;
    };
    const rows = data as Row[];
    const events = new Set(rows.map((r) => r.event_id));

    type Acc = { events: Set<string>; shareSum: number; shareN: number; phpSum: number; phpN: number; firstPin: number };
    const byLeaf = new Map<string, Acc>();
    for (const r of rows) {
      const a = byLeaf.get(r.canonical_service) ?? { events: new Set(), shareSum: 0, shareN: 0, phpSum: 0, phpN: 0, firstPin: 0 };
      a.events.add(r.event_id);
      if (r.final_share_bp != null) { a.shareSum += r.final_share_bp; a.shareN += 1; }
      if (r.final_amount_php != null) { a.phpSum += Number(r.final_amount_php); a.phpN += 1; }
      if (r.pin_order === 1) a.firstPin += 1;
      byLeaf.set(r.canonical_service, a);
    }

    let suppressed = false;
    const aggregates: LeafAggregate[] = [];
    for (const [leaf, a] of byLeaf) {
      const n = a.events.size;
      if (n < minN) { suppressed = true; continue; } // k-anonymity gate
      aggregates.push({
        planGroupId: leaf,
        coupleCount: n,
        avgShareBp: a.shareN ? Math.round(a.shareSum / a.shareN) : 0,
        avgFinalPhp: a.phpN ? Math.round(a.phpSum / a.phpN) : 0,
        firstPinRate: n ? a.firstPin / n : 0,
      });
    }
    aggregates.sort((x, y) => y.avgShareBp - x.avgShareBp);
    return { aggregates, totalEvents: events.size, suppressedBelowMinN: suppressed };
  } catch {
    return { aggregates: [], totalEvents: 0, suppressedBelowMinN: false };
  }
}
