/**
 * apps/web/lib/papic-tier-copy.ts
 *
 * The ONE place every Papic capacity / price / cap CLAIM is derived.
 *
 * WHY THIS EXISTS (owner 2026-07-20 — "make every Papic price/capacity claim
 * honest and derived, never hardcoded"). Before this module, four public
 * surfaces carried hand-typed Papic promises that had drifted away from what
 * the code actually enforces:
 *   • /pricing advertised "Ltd ₱30 · 30 photos + 10 videos · first 5 free ·
 *     capped ₱9,000" — every one of those four claims was false.
 *   • the /pricing estimator hardcoded a ₱15,000 cap for BOTH tiers.
 *   • the studio guest-camera picker promised "30 photos + 10 clips each".
 * Enforcement, meanwhile, runs on capture POINTS resolved from the
 * admin-editable `public.papic_tier_config` table (migration 20270821110000 +
 * the RPCs in 20270821110100): 1 photo = 1 point · 1 five-second clip = 3
 * points, budget `points_per_day` per tier (NULL = unlimited).
 *
 * THE RULE this module enforces: a display surface must never spell a photo
 * count, a clip count, a free-camera count, or a cap peso figure as a literal.
 * It calls a helper here, which reads `papic_tier_config` (or falls back to the
 * migration seed, in ONE place, documented). `lib/papic-copy-guardrails.test.ts`
 * fails CI if any enumerated Papic surface re-grows a literal.
 *
 * Deliberately framed as "about N photos (fewer if you shoot clips)" — the
 * budget is ONE points purse, so an exact "N photos + M clips" promise is
 * unkeepable by construction: spending points on clips takes them from photos.
 *
 * Pure + client-safe: NOTHING server-only is imported here, so a client
 * component may import the helpers directly. The admin-client convenience
 * wrapper lives in `lib/papic-tier-config-read.ts` (server surfaces only).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PAPIC_FREE_CAMERA_COUNT,
  PAPIC_POINTS_PER_CLIP,
  PAPIC_POINTS_PER_PHOTO,
} from '@/lib/papic-cameras';

/** Tier vocabulary — mirrors the papic_tier_config.tier_code CHECK. */
export type PapicTierCode = 'free' | 'mini' | 'roll' | 'ltd' | 'unlimited';

export type PapicTierConfigRow = {
  tierCode: PapicTierCode;
  displayTitle: string;
  /** Daily capture-point budget per camera. NULL = unlimited. */
  pointsPerDay: number | null;
  /** platform_retail_catalog_v2 service_code carrying the per-camera-per-day rate. */
  rateServiceCode: string | null;
  /** Free-of-charge seats provisioned per event (only the free tier has these). */
  seatsPerEvent: number | null;
  /** WEDDING-only per-event order-total cap default. NULL = no cap. */
  weddingCapPhp: number | null;
  sortOrder: number;
  isActive: boolean;
};

/**
 * LAST-RESORT fallback — a byte-for-byte mirror of the migration seed
 * (20270821110000). Live values come from the table; this only renders on a
 * pre-bootstrap / service-key-less build so a marketing page never 500s.
 *
 * This is the ONE file allowed to carry these literals. Every display surface
 * must read them through the helpers below.
 */
export const PAPIC_TIER_CONFIG_FALLBACK: Record<PapicTierCode, PapicTierConfigRow> = {
  free: {
    tierCode: 'free',
    displayTitle: 'Free',
    pointsPerDay: 20,
    rateServiceCode: null,
    seatsPerEvent: PAPIC_FREE_CAMERA_COUNT,
    weddingCapPhp: null,
    sortOrder: 0,
    isActive: true,
  },
  mini: {
    tierCode: 'mini',
    // Renamed 'Papic Mini' → 'Papic One' by the 2026-07-22 naming lock
    // (migration 20270830568357). "Papic One" = the dedicated per-camera
    // product. Mirrors the live `papic_tier_config.display_title` DB value.
    displayTitle: 'Papic One',
    pointsPerDay: 20,
    rateServiceCode: 'PAPIC_CAMERA_MINI_DAY',
    seatsPerEvent: 0,
    weddingCapPhp: 6000,
    sortOrder: 1,
    isActive: true,
  },
  // Legacy ₱30 rung — aliases to Mini economics. Kept for prod rows + the
  // guest-list "Limited" path (never-rename-technical-ids lock). RETIRED as a
  // live meter by the 2026-07-22 rename (migration 20270830568357): a per-day
  // 'roll' meter under the flat "Papic One" name would contradict the flat
  // promise, so it is deactivated (also hidden from the public ladder anyway).
  roll: {
    tierCode: 'roll',
    displayTitle: 'Papic Mini (legacy roll)',
    pointsPerDay: 20,
    rateServiceCode: 'PAPIC_CAMERA_ROLL_DAY',
    seatsPerEvent: 0,
    weddingCapPhp: 6000,
    sortOrder: 1,
    isActive: false,
  },
  ltd: {
    tierCode: 'ltd',
    displayTitle: 'Papic Ltd',
    pointsPerDay: 70,
    rateServiceCode: 'PAPIC_CAMERA_LTD_DAY',
    seatsPerEvent: 0,
    weddingCapPhp: 10000,
    sortOrder: 2,
    isActive: true,
  },
  // "Papic Max" (formerly "Papic Unli") — RETIRED by the 2026-07-22 naming lock
  // (migration 20270830568357 deactivates the 'unlimited' tier). Row kept for
  // lineage; isActive=false drops it from every public ladder.
  unlimited: {
    tierCode: 'unlimited',
    displayTitle: 'Papic Unli',
    pointsPerDay: null,
    rateServiceCode: 'PAPIC_CAMERA_UNLIMITED_DAY',
    seatsPerEvent: 0,
    weddingCapPhp: 15000,
    sortOrder: 3,
    isActive: false,
  },
};

export type PapicTierConfig = Record<PapicTierCode, PapicTierConfigRow>;

const TIER_CODES: readonly PapicTierCode[] = ['free', 'mini', 'roll', 'ltd', 'unlimited'];

function isTierCode(v: unknown): v is PapicTierCode {
  return typeof v === 'string' && (TIER_CODES as readonly string[]).includes(v);
}

/**
 * Read the admin-editable tier config. Graceful-degrade to the seed mirror on a
 * missing table / unreadable env (marketing pages must render regardless) —
 * NEVER throws. Takes the caller's client (the table is public-SELECT under
 * RLS, so a request-scoped client is enough); server surfaces without one call
 * `readPapicTierConfig()` from `lib/papic-tier-config-read.ts`.
 */
export async function fetchPapicTierConfig(
  supabase: SupabaseClient,
): Promise<PapicTierConfig> {
  try {
    const { data, error } = await supabase
      .from('papic_tier_config')
      .select(
        'tier_code, display_title, points_per_day, rate_service_code, seats_per_event, wedding_day_cap_php, sort_order, is_active',
      );
    if (error || !data) return { ...PAPIC_TIER_CONFIG_FALLBACK };
    const out: PapicTierConfig = { ...PAPIC_TIER_CONFIG_FALLBACK };
    for (const raw of data as Array<Record<string, unknown>>) {
      const code = raw.tier_code;
      if (!isTierCode(code)) continue;
      const pts = raw.points_per_day;
      const cap = raw.wedding_day_cap_php;
      const seats = raw.seats_per_event;
      out[code] = {
        tierCode: code,
        displayTitle:
          typeof raw.display_title === 'string' && raw.display_title
            ? raw.display_title
            : PAPIC_TIER_CONFIG_FALLBACK[code].displayTitle,
        pointsPerDay: pts == null ? null : Number(pts),
        rateServiceCode:
          typeof raw.rate_service_code === 'string' ? raw.rate_service_code : null,
        seatsPerEvent: seats == null ? null : Number(seats),
        weddingCapPhp: cap == null ? null : Number(cap),
        sortOrder: Number(raw.sort_order ?? PAPIC_TIER_CONFIG_FALLBACK[code].sortOrder),
        isActive: raw.is_active !== false,
      };
    }
    return out;
  } catch {
    return { ...PAPIC_TIER_CONFIG_FALLBACK };
  }
}

// ── pure copy helpers (the ONLY sanctioned way to render a Papic claim) ──────

/**
 * The PUBLIC ladder — the rungs a couple can actually pick, in sort order.
 * Excludes `free` (not a purchasable rung) and `roll` (the legacy alias of
 * Mini: same ₱30, same 20 points — showing both would read as two products).
 * Inactive rows drop out, so an admin deactivating a tier removes it from every
 * surface at once.
 */
export function publicPapicLadder(config: PapicTierConfig): PapicTierConfigRow[] {
  return TIER_CODES.map((c) => config[c])
    .filter((r) => r.isActive && r.tierCode !== 'free' && r.tierCode !== 'roll')
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** How many free cameras every event gets — from config, never a literal. */
export function papicFreeCameraCount(config: PapicTierConfig): number {
  const seats = config.free.seatsPerEvent;
  return seats != null && seats >= 0 ? seats : PAPIC_FREE_CAMERA_COUNT;
}

/**
 * Papic Free = the ONE shared event pool capped at this many points (owner
 * 2026-07-22 · "Free is Papic pool with just 50 points"). The live value is the
 * admin-editable `papic_event_pool_config.free_grant_points`; this helper reads
 * it off the config object when present and falls back to the seed literal in
 * ONE place, so no display surface ever hardcodes "50". Mirrors the
 * papicFreeCameraCount pattern.
 */
export const PAPIC_FREE_GRANT_POINTS_FALLBACK = 50;
export function papicFreeGrantPoints(config: PapicTierConfig): number {
  const n = (config as unknown as { freeGrantPoints?: number }).freeGrantPoints;
  return typeof n === 'number' && n > 0 ? n : PAPIC_FREE_GRANT_POINTS_FALLBACK;
}

/**
 * The honest capacity sentence for a points budget.
 *
 * NOT "N photos + M clips" — the budget is one purse, so clips eat into the
 * photo count. "about N photos a day, or fewer if you shoot clips — a 10-second
 * clip counts as 7" is the true shape, and it stays true whether the budget is
 * 20 points or 60.
 */
export function papicCapacityPhrase(pointsPerDay: number | null): string {
  if (pointsPerDay == null) return 'unlimited photos and 10-second clips, every day';
  const photos = Math.floor(pointsPerDay / PAPIC_POINTS_PER_PHOTO);
  return (
    `about ${photos} photo${photos === 1 ? '' : 's'} a day — fewer if you shoot ` +
    `clips, since one 10-second clip counts as ${PAPIC_POINTS_PER_CLIP}`
  );
}

/** Terse variant for tight UI (chips, list rows). Same derivation. */
export function papicCapacityShort(pointsPerDay: number | null): string {
  if (pointsPerDay == null) return 'unlimited shots per day';
  const photos = Math.floor(pointsPerDay / PAPIC_POINTS_PER_PHOTO);
  const clips = Math.floor(pointsPerDay / PAPIC_POINTS_PER_CLIP);
  return `~${photos} photos/day, or ~${clips} ten-second clips`;
}

/** Peso formatter local to this module (avoids importing the catalog reader). */
function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString('en-PH')}`;
}

/**
 * The honest cap sentence. Caps are WEDDINGS-ONLY (owner 2026-07-17 · mirrored
 * in `isPapicUncapped`) and clamp the tier's whole booking total — not a
 * per-day figure, and not the add-ons.
 */
export function papicCapPhrase(weddingCapPhp: number | null): string {
  if (weddingCapPhp == null || !(weddingCapPhp > 0)) return 'no cap';
  return `${peso(weddingCapPhp)} max for a wedding`;
}

/** "Mini ₱6,000 · Ltd ₱10,000 · Unli ₱15,000" — derived, in ladder order. */
export function papicCapLadderPhrase(config: PapicTierConfig): string {
  return publicPapicLadder(config)
    .filter((r) => r.weddingCapPhp != null && r.weddingCapPhp > 0)
    .map((r) => `${r.displayTitle} ${peso(r.weddingCapPhp as number)}`)
    .join(' · ');
}

/**
 * One rung, fully derived: title, rate, capacity, cap.
 * `ratePhp` comes from the live catalog (the caller resolves the tier's
 * `rateServiceCode`) so the price and the capacity can never disagree.
 */
export function papicTierSummary(
  row: PapicTierConfigRow,
  ratePhp: number | null,
): string {
  const price = ratePhp != null && ratePhp > 0 ? `${peso(ratePhp)} per camera, per day` : 'free';
  return `${row.displayTitle} — ${price} · ${papicCapacityPhrase(row.pointsPerDay)}`;
}
