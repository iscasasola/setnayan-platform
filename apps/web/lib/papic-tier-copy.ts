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
 * the RPCs in 20270821110100): 1 photo = 1 point · 1 ten-second clip = 8
 * points, budget `points_per_day` per tier (NULL = unlimited).
 *
 * THE RULE this module enforces: a display surface must never spell a photo
 * count, a clip count, a free-camera count, or a cap peso figure as a literal.
 * It calls a helper here, which reads `papic_tier_config` (or falls back to the
 * migration seed, in ONE place, documented). `lib/papic-copy-guardrails.test.ts`
 * fails CI if any enumerated Papic surface re-grows a literal.
 *
 * TWO-TYPE MODEL (owner-locked 2026-07-29). Papic is now Papic POOL (unlimited
 * cameras, SHARED shots, additive top-ups) and Papic ONE (one camera, its own
 * QR, its own UNSHARED shots). The rung phrases for both live at the bottom of
 * this file and take their numbers as ARGUMENTS — points from papic_pass_tiers /
 * papic_one_tiers, price from platform_retail_catalog_v2. The clip weight moved
 * with that lock: one 10-second clip is 8 points, not 7, and it is written in
 * exactly one place (PAPIC_POINTS_PER_CLIP in lib/papic-cameras-pure.ts), which is why
 * every sentence below interpolates it instead of spelling it.
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
} from '@/lib/papic-cameras-pure';

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
    // ⚠ THE OLD COMMENT HERE CLAIMED TO MIRROR THE DATABASE. IT DID NOT, AND
    // THAT CLAIM IS WHAT KEPT A RETIRED NAME ALIVE. It said this mirrored
    // `papic_tier_config.display_title` and read 'Papic One'; the live row
    // reads 'Dedicated camera (legacy)' with `is_active = false`.
    //
    // Owner 2026-08-11, restated 2026-08-26: *"we do not have papic one or
    // papic pool. no 2 ways of papic service. just 1."* And on what this
    // actually is: *"they just alot some photos for a specific Papic. so for
    // example they get 3000 photos. and then they can assign the 500 photos to
    // 1 papic."* So it is a FEATURE of the one Papic, and the title now says
    // that instead of naming a second product.
    //
    // 🔑 DELIBERATELY NOT THE DB STRING — 'Dedicated camera (legacy)' is an
    // operator's word. This title can reach a public card (the synthetic
    // PAPIC_CAMERAS row on /pricing), and "legacy" is not a word to sell with.
    // It renders only while a rung is active; today none is.
    displayTitle: 'A camera with its own credits',
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
//
// ⚠ THE PER-DAY LADDER HELPERS ARE GONE (deleted 2026-07-30). `publicPapicLadder`,
// `papicCapacityShort`, `papicCapLadderPhrase` and `papicTierSummary` all rendered
// `papic_tier_config` as a ladder of per-camera-per-DAY rungs with wedding caps —
// the model the two-type lock retired (owner 2026-07-29). Their last consumer was
// the dead homepage pricing payload, which is exactly where they were still
// printing "unlimited shots per day" and "₱50/guest·day" for products that are now
// a shared pool and a flat per-camera bucket. A ladder is derived from the RUNG
// tables now — `papic_pass_tiers` (Pool) and `papic_one_tiers` (One), priced from
// the live catalog, phrased through `papicPoolRungPhrase` / `papicOneRungPhrase` at
// the bottom of this file. `app/pricing/page.tsx` is the reference implementation.
//
// What survives here is what a per-CAMERA surface still legitimately needs:
// `papicCapacityPhrase` (the studio's guest-camera picker), the free-seat count,
// and the cap sentence.

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
 * The LIVE free-pool allowance, straight from the admin-editable column.
 *
 * WHY THIS EXISTS (2026-07-28). The doc above always claimed the live value was
 * `papic_event_pool_config.free_grant_points` — but nothing ever read it.
 * `fetchPapicTierConfig` queries a DIFFERENT table (`papic_tier_config`) and
 * never sets `freeGrantPoints`, so `papicFreeGrantPoints()` could only ever
 * return the fallback literal. The admin column was decorative.
 *
 * That was harmless while the free pool was unarmed and nothing displayed it.
 * It stopped being harmless the moment the pool was armed (PR #3847/#3848): the
 * GRANT writes a number, copy renders a number, and if an admin edits the column
 * those two must not drift apart. An admin who sets the allowance to 90 and sees
 * "about 90 photos" on the card while the meter still hands out 50 has been lied
 * to by their own control.
 *
 * So this is the single live reader, and BOTH halves — the grant amount
 * (lib/papic-free-grant.ts) and the display phrase — resolve through it.
 * Falls back to PAPIC_FREE_GRANT_POINTS_FALLBACK in ONE place, as before.
 */
export async function fetchPapicFreeGrantPoints(
  supabase: SupabaseClient,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('papic_event_pool_config')
      .select('free_grant_points')
      .eq('config_key', 'default')
      .maybeSingle();
    if (error || !data) return PAPIC_FREE_GRANT_POINTS_FALLBACK;
    const n = Number((data as { free_grant_points?: unknown }).free_grant_points);
    // A non-positive or unparseable value must never mint a 0-point (or
    // negative) grant — papic_event_point_grants CHECKs points > 0, so a bad
    // config row would turn every event-creation arm into a silent failure and
    // put us straight back to the unmetered state this whole line of work fixed.
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : PAPIC_FREE_GRANT_POINTS_FALLBACK;
  } catch {
    return PAPIC_FREE_GRANT_POINTS_FALLBACK;
  }
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

// ── the TWO-TYPE model (owner-locked 2026-07-29) ────────────────────────────
//
// Papic POOL — unlimited cameras, SHARED shots, top-ups that stack.
// Papic ONE  — one camera, its own QR, its own UNSHARED shots.
//
// Both phrases below take their numbers as ARGUMENTS: points from the rung
// tables (papic_pass_tiers / papic_one_tiers), price from
// platform_retail_catalog_v2. Neither is written here, for the reason this whole
// module exists — the moment a surface hardcodes "₱100 = 250 credits" it starts
// drifting from what the meter actually hands out, and the couple is the one who
// finds out.

/**
 * A Papic POOL top-up rung, as a couple should read it. "Adds", not "gives" —
 * every rung stacks onto whatever the event already holds, including the free
 * pool, and saying so is the difference between a top-up and a replacement.
 */
/**
 * The regular price of a rung: ₱1 buys one shot (owner 2026-08-26). It is NOT a
 * stored column and must never become one — the whole ladder is defined against
 * this rate, and a stored second copy of a rule is how prices drift.
 */
export const PAPIC_PESO_PER_CREDIT = 1;

/** How much of the regular price this rung saves, as a whole percent. */
export function papicRungDiscountPercent(points: number, pricePhp: number): number | null {
  const regular = points * PAPIC_PESO_PER_CREDIT;
  if (!(regular > 0) || !(pricePhp > 0) || pricePhp >= regular) return null;
  return Math.round((1 - pricePhp / regular) * 100);
}

export function papicPoolRungPhrase(points: number, pricePhp: number): string {
  const base = `${peso(pricePhp)} — adds ${points.toLocaleString('en-PH')} credits to your shared pool`;
  // ⚠ The saving is DERIVED and only shown when it is real. A rung priced at or
  // above ₱1 a shot says nothing rather than printing "0% off" or a negative.
  const off = papicRungDiscountPercent(points, pricePhp);
  return off == null ? base : `${base} · ${off}% off ${peso(points * PAPIC_PESO_PER_CREDIT)}`;
}

/**
 * A Papic ONE rung. "That camera's own" is the load-bearing half: the entire
 * difference between One and Pool is that these shots cannot be spent by anyone
 * else, and a phrase that only quotes a number would sell the two as the same
 * product at different prices.
 */
export function papicOneRungPhrase(points: number, pricePhp: number): string {
  return `${peso(pricePhp)} — ${points.toLocaleString('en-PH')} credits, that camera's own`;
}

/**
 * The point CURRENCY, as two short terms a couple can read side by side.
 *
 * This is the one sentence that makes every other Papic number legible: without
 * it "50 credits" and "8" are unrelated figures. Both weights interpolate the
 * constants in lib/papic-cameras-pure.ts, so the 7 → 8 clip reprice (owner-locked
 * 2026-07-29) moved this line without anyone editing a surface — which is the
 * entire reason it lives here and not in the card.
 */
export function papicPointCurrencyTerms(): readonly [string, string] {
  return [
    `1 photo = ${PAPIC_POINTS_PER_PHOTO} credit`,
    `a Snippet (10-second video) = ${PAPIC_POINTS_PER_CLIP} credits`,
  ];
}

/**
 * The honest capacity sentence for a LIFETIME bucket of points (a Papic One
 * camera, or the shared pool) as opposed to a per-day budget.
 *
 * Same "one purse" honesty as papicCapacityPhrase: an exact "N photos + M clips"
 * promise is unkeepable, because spending points on clips takes them from photos.
 */
export function papicBucketPhrase(points: number): string {
  const photos = Math.floor(points / PAPIC_POINTS_PER_PHOTO);
  return (
    `about ${photos.toLocaleString('en-PH')} photograph${photos === 1 ? '' : 's'} — fewer if ` +
    `you shoot video, since a Snippet counts as ${PAPIC_POINTS_PER_CLIP}`
  );
}
