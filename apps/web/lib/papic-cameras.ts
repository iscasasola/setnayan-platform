import type { SupabaseClient } from '@supabase/supabase-js';
import { generateSeatClaimToken } from '@/lib/papic-seats';
import { eventSkuActive } from '@/lib/entitlements';
import { PAPIC_FREE_CAMERA_COUNT, papicCaptureCost, type PapicCaptureSource } from '@/lib/papic-cameras-pure';
import { formatCount } from '@/lib/format-number';

/**
 * ⚠ THE POINT WEIGHTS AND THE FREE-CAMERA ALLOWANCE ARE NOT IN THIS FILE — they
 * are in `./papic-cameras-pure`, because the unlock gates below reach
 * `eventSkuActive` → the service-role client, and the pickers, the gallery grid
 * and `papic-tier-copy.ts` all need the prices without it. Re-exported here, so
 * `@/lib/papic-cameras` still resolves every symbol it always did.
 */
export * from '@/lib/papic-cameras-pure';

/**
 * The "Unlock all of Papic" umbrella bundle (owner 2026-06-26 ·
 * platform_package_catalog 'PAPIC_UNLOCK'). Owning it makes the UNLIMITED (Unli)
 * camera tier free + uncapped for the whole event — both the per-camera paid-gate
 * (capture stays blocked until paid) and the picker's Unli price collapse to ₱0.
 * Roll (Ltd) cameras are NOT freed — the umbrella covers Unli only.
 */
export const PAPIC_UNLOCK_BUNDLE_KEY = 'PAPIC_UNLOCK';

/**
 * The Ltd-tier twin (owner 2026-07-11 · platform_package_catalog
 * 'PAPIC_UNLOCK_LTD', ₱9,000). Owning it makes the LIMITED (Ltd/Roll) camera tier
 * free + uncapped for the whole event, plus Photo Wall + Camera Bridge. The Unli
 * tier is NOT freed by this pass — that's the separate ₱15,000 PAPIC_UNLOCK.
 */
export const PAPIC_UNLOCK_LTD_BUNDLE_KEY = 'PAPIC_UNLOCK_LTD';

/**
 * Does owning the Unlock-all umbrella make Unli cameras free for this event?
 *
 * The admin-approved, bundle-aware FEATURE GATE: TRUE only when the event owns an
 * ACTIVE (paid/fulfilled) PAPIC_UNLOCK order — so an unpaid/pending umbrella never
 * frees a camera. Read on the ADMIN client at capture surfaces (a seat claimer is
 * not an event member, so an RLS-scoped read would see nothing). Fail-CLOSED:
 * any read error returns false so a hiccup can never free a paid camera for a
 * non-owner — this is money logic.
 */
export async function eventUnliFreeViaUnlock(
  admin: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  try {
    return await eventSkuActive(admin, eventId, PAPIC_UNLOCK_BUNDLE_KEY);
  } catch {
    return false;
  }
}

/**
 * Ltd-tier mirror of {@link eventUnliFreeViaUnlock}: does owning the ₱9,000
 * PAPIC_UNLOCK_LTD pass make Ltd (Roll) cameras free for this event? Same
 * fail-CLOSED money-logic contract — TRUE only on an ACTIVE PAPIC_UNLOCK_LTD order.
 */
export async function eventLtdFreeViaUnlock(
  admin: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  try {
    return await eventSkuActive(admin, eventId, PAPIC_UNLOCK_LTD_BUNDLE_KEY);
  } catch {
    return false;
  }
}

/**
 * apps/web/lib/papic-cameras.ts
 *
 * The PER-CAMERA Papic model (owner-locked 2026-06-26 ·
 * 0012_papic/Papic_v2_Pricing_and_Funnel_Strategy_2026-06-26.md).
 *
 * A "camera" IS a paparazzi seat. PR1 (migration 20270301000000, applied to
 * prod) extended public.paparazzi_seats with a per-camera `tier`
 * (free | roll | unlimited), a validity window, and a `paid_order_id` link,
 * added public.papic_seat_day_usage for quota enforcement, an admin-adjustable
 * events.papic_cost_cap_php (default ₱6,999), and seeded the two rate SKUs in
 * platform_retail_catalog_v2 (PAPIC_CAMERA_ROLL_DAY ₱30, _UNLIMITED_DAY ₱100).
 *
 * THIS module is PR2 — the buy engine: read admin-managed rates, quote a
 * per-camera order (clamped to the cost cap, 5-camera minimum), and provision
 * the paid cameras as paparazzi_seats rows at their chosen tier. Capture stays
 * blocked until the order is paid (presign enforcement is PR3).
 *
 * Strictly ADDITIVE: the PAPIC_SEATS 5-pack (index 1–5) is untouched. Paid
 * per-camera seats
 * live in their own index range (>= PAPIC_CAMERA_INDEX_BASE) so they never
 * collide. Prices are admin-managed — read from the catalog, never hardcoded
 * (the constants below are last-resort fallbacks only).
 */

// ── The camera ladder (owner-confirmed 2026-07-20) ──────────────────────────
//
// Life events run a THREE-rung paid ladder on top of the 3 free cameras:
//
//     Papic Mini ₱100/camera/day · 200 pts/day · wedding cap ₱6,000
//     Papic Max  ₱200/camera/day · 500 pts/day · wedding cap ₱15,000
//     (Papic Ltd — the ₱50 / 70-pt rung — is DEACTIVATED, migration 20270828150000)
//
// ⚠ "Papic Unli" IS RETIRED AS A NAME. The rung is capped at 500 points, and a
// tier capped at 500 is not unlimited — shipping that word would advertise what
// the code does not do. The TIER CODE stays 'unlimited' (schema CHECK value +
// existing seat rows · never-rename lock); only the display title changed to
// "Papic Max". Capping it means points_per_day went NULL -> 500, so the
// fail-closed gate now BINDS on this rung where it never did before.
//
// ⚠ `roll` ↔ `mini` — READ THIS BEFORE TOUCHING EITHER.
// `roll` is the LEGACY tier code for the ₱30 rung. It shipped first (migration
// 20270301000000 · SKU PAPIC_CAMERA_ROLL_DAY) back when there were only two
// rungs, and it is what every already-sold ₱30 seat + order in prod references —
// so it is NEVER deleted or repurposed (never-rename-technical-ids lock).
// Papic v3 (owner 2026-07-17) renamed that rung to **Mini** and added a genuinely
// new ₱50 **Ltd** rung above it. So today:
//
//     tier 'roll'  == tier 'mini'   — same 20 pts/day, same ₱6,000 cap, same ₱30.
//                                     papic_tier_config carries BOTH rows with
//                                     identical economics; roll is display-aliased
//                                     to "Papic Mini".
//     tier 'ltd'   == the NEW ₱50 rung — NOT the old "Ltd" wording that used to
//                                     mean roll. Old comments/SKU titles calling
//                                     the ₱30 rung "Ltd" are pre-v3 wording.
//
// New purchases write 'mini' / 'ltd' / 'unlimited'; 'roll' is accepted forever on
// the read/enforce side and folds into the Mini rung in every quote + display.
// Everything below funnels through papicRungForTier() so there is exactly ONE
// place that knows about the alias.
export const PAPIC_CAMERA_ROLL_SKU = 'PAPIC_CAMERA_ROLL_DAY';
export const PAPIC_CAMERA_MINI_SKU = 'PAPIC_CAMERA_MINI_DAY';
export const PAPIC_CAMERA_LTD_SKU = 'PAPIC_CAMERA_LTD_DAY';
export const PAPIC_CAMERA_UNLIMITED_SKU = 'PAPIC_CAMERA_UNLIMITED_DAY';

/** orders.service_key marker for a per-camera order (free-form TEXT column). */
export const PAPIC_CAMERAS_ORDER_KEY = 'PAPIC_CAMERAS';


/** Paid per-camera seats start here so they never collide with the pack (1–5). */
export const PAPIC_CAMERA_INDEX_BASE = 200;

/**
 * The 3 FREE per-camera seats live at fixed indexes 100..102 — their own range,
 * clear of the legacy PAPIC_SEATS pack (1–5) and the paid per-camera range
 * (>= 200). Fixed indexes make provisioning a dense idempotent top-up (same
 * pattern as the pack's 1..5) instead of a max+1 scan.
 */
export const PAPIC_FREE_CAMERA_INDEX_BASE = 100;

/**
 * The ONE free Papic One camera every event gets (owner-locked 2026-07-29).
 *
 * A DEDICATED camera — its own QR, its own small unshared balance — so a couple
 * can feel what "Papic One" actually is before paying for one. Distinct from the
 * 3 free cameras above, which all draw the SHARED event pool.
 *
 * Fixed index 110: clear of the free shared range (100..102) and the paid range
 * (>= 200), so "does this event already have its free One?" is a unique-key
 * question. The seat + its 5-point grant are minted by the SQL function
 * `papic_ensure_free_one_camera` (migration 20271019231590), which is idempotent
 * on both halves; lib/papic-one.ts is the app-side wrapper.
 */
export const PAPIC_FREE_ONE_CAMERA_INDEX = 110;

/**
 * THE COUPLE'S OWN "UPLOADS" CAMERA — the shutter that is a file picker.
 *
 * Owner 2026-08-26: *"papic is the source where they collect media files for
 * that event"* and *"they can upload their work via papic credits as well per
 * event."* An upload is not a new kind of thing needing new rules — it is a
 * camera taking a shot, so it rides the metering, the safety screen, the
 * derivatives and the Drive copy that every other capture already gets.
 *
 * ⚠ 150 IS NOT ARBITRARY, AND 110 WOULD HAVE BEEN A SILENT NO-OP. The build
 * plan proposed 110; measured in production, `seat_index = 110` already holds
 * the free dedicated camera on FOUR events (100/101/102 are the free block).
 * Minting there upserts with `ignoreDuplicates: true`, so it would have created
 * NOTHING, returned success, and left the couple with no Uploads camera and no
 * error — a gate with no handle, on every event that already exists.
 *
 * 150 sits clear of the free block (100–102), clear of 110, and below the paid
 * base (200). Keep this space legible: read all four constants together before
 * adding a fifth.
 */
export const PAPIC_UPLOADS_CAMERA_INDEX = 150;

/**
 * 👥 EVERY HOST HAS THEIR OWN HOST CAMERA (owner 2026-10-31, DECISION_LOG "SEVEN OWNER ANSWERS" item 3 — asked "Should
 * co-hosts each get a camera, and are host shots free?", answered *"yes. papic credits still"*). A host is an
 * `event_members` row with `member_type = 'couple'`: the couple AND every co-host (2026-09-28 / 2026-10-29).
 *
 * Until then there was ONE Uploads camera per event (seat 150), claimed by whichever host pressed first; every other
 * host was told *"set up on the other host's account"*. The host cameras are now the block
 * `PAPIC_UPLOADS_CAMERA_INDEX..PAPIC_HOST_CAMERA_LAST_INDEX` — 150 stays the FIRST host's, so every camera already
 * claimed keeps working, and each further host gets the next free index (`hostCameraPick`). 151–199 sit clear of the
 * free block (100–102), the free One (110) and the paid range (200+).
 *
 * 🪙 NOTHING IS FREE. Every host camera is a free-tier seat with no credits of its own: what it spends is the event's ONE
 * shared pool (2026-09-16 / 2026-09-22 rulings — no camera holds credits of its own), through the same
 * `papic_capture_points_available` gate, the same capture window and the same uploads switch seat 150 always had.
 */
export const PAPIC_HOST_CAMERA_LAST_INDEX = 199;

/** Is this seat one of the event's host cameras (the block that starts at the original Uploads camera)? */
export function isHostCameraSeatIndex(seatIndex: number | null | undefined): boolean {
  return (
    typeof seatIndex === 'number' &&
    seatIndex >= PAPIC_UPLOADS_CAMERA_INDEX &&
    seatIndex <= PAPIC_HOST_CAMERA_LAST_INDEX
  );
}

/** A host-camera row as the resolver reads it (service role — the token never reaches a browser before its claim). */
export type HostCameraRow = {
  seat_id: string;
  seat_index: number;
  claim_qr_token: string | null;
  claimer_user_id: string | null;
  revoked_at: string | null;
};

/** The columns `HostCameraRow` names — one select string, so the provisioner and the reader cannot drift (module-private: a narrow read of one block, not a canonical list for every `paparazzi_seats` select). */
const hostCameraSelect = 'seat_id, seat_index, claim_qr_token, claimer_user_id, revoked_at';

/**
 * WHICH HOST CAMERA IS THIS HOST'S? Pure, so the rule is measured (`papic-cameras.test.ts`).
 *   • 'mine'  — a live camera this person already claimed (a host keeps theirs; a second press is a no-op);
 *   • 'spare' — the lowest live camera nobody has claimed yet (the first pick claims it);
 *   • 'mint'  — neither: the next index in the block (a revoked row still holds its index — the UNIQUE spans it);
 *   • 'full'  — the block is used up (fifty hosts) — said in words, never minted into the paid range.
 * Never another host's camera: a claimed row is only ever 'mine' to the person who claimed it.
 */
export type HostCameraPick =
  | { kind: 'mine'; seat: HostCameraRow }
  | { kind: 'spare'; seat: HostCameraRow }
  | { kind: 'mint'; index: number }
  | { kind: 'full' };

export function hostCameraPick(rows: readonly HostCameraRow[], userId: string): HostCameraPick {
  const inBlock = rows.filter((r) => isHostCameraSeatIndex(r.seat_index)).sort((a, b) => a.seat_index - b.seat_index);
  const live = inBlock.filter((r) => r.revoked_at === null && Boolean(r.claim_qr_token));
  const mine = live.find((r) => r.claimer_user_id === userId);
  if (mine) return { kind: 'mine', seat: mine };
  const spare = live.find((r) => r.claimer_user_id === null);
  if (spare) return { kind: 'spare', seat: spare };
  const used = new Set(inBlock.map((r) => r.seat_index));
  for (let i = PAPIC_UPLOADS_CAMERA_INDEX; i <= PAPIC_HOST_CAMERA_LAST_INDEX; i += 1) {
    if (!used.has(i)) return { kind: 'mint', index: i };
  }
  return { kind: 'full' };
}

/**
 * Was this capture added by hand? A host camera's seat is the one door for a file picked from a phone or laptop
 * (owner 2026-10-26: anything added costs the camera price × PAPIC_UPLOAD_MULTIPLIER — `papicCaptureCost`). Read off the SEAT the server
 * resolved from the token, never from anything the client says.
 */
export function papicSeatCaptureSource(seatIndex: number | null | undefined): PapicCaptureSource {
  return isHostCameraSeatIndex(seatIndex) ? 'upload' : 'camera';
}

/**
 * Last-resort fallbacks if the catalog row is missing. Live prices come from the
 * catalog. Owner ladder 2026-07-20 (migration 20270828150000): Mini ₱100 · Max
 * ₱200. Ltd is DEACTIVATED — its constant survives for lineage only, so a stale
 * read of a retired rung cannot quote ₱0.
 */
export const PAPIC_CAMERA_ROLL_FALLBACK_PHP = 100;
export const PAPIC_CAMERA_MINI_FALLBACK_PHP = 50; // Papic One ₱50 / 50 shots — owner-locked 2026-07-29 (was ₱100)
export const PAPIC_CAMERA_LTD_FALLBACK_PHP = 50; // retired rung — lineage only
export const PAPIC_CAMERA_UNLIMITED_FALLBACK_PHP = 200; // "Papic Max" — capped at 500 pts, so no longer "Unli"
export const PAPIC_DEFAULT_COST_CAP_PHP = 6999; // deprecated single cap (pre per-tier)
/**
 * Per-tier WEDDING price caps — each tier's subtotal locks here (weddings only;
 * every other event type is uncapped, via the quote's `uncapped` flag). Live
 * values come from events.papic_mini_cap_php / papic_ltd_cap_php / papic_unli_cap_php
 * (per-event override) → papic_tier_config.wedding_day_cap_php (tier default) →
 * these last-resort fallbacks. The legacy 'roll' tier caps at the MINI cap
 * (roll == Mini · see the alias note above).
 */
export const PAPIC_MINI_CAP_FALLBACK_PHP = 6000; // Mini (and legacy roll->Mini) — owner 2026-07-17
export const PAPIC_LTD_CAP_FALLBACK_PHP = 10000; // Ltd (₱50 rung) — owner 2026-07-17
export const PAPIC_UNLI_CAP_FALLBACK_PHP = 15000; // Papic Max (tier code stays 'unlimited') — 75 cameras × ₱200

/**
 * Every per-camera tier code the DB accepts (paparazzi_seats.tier CHECK,
 * migration 20270821110000). 'roll' is the legacy alias of 'mini'.
 */
export type CameraTier = 'free' | 'roll' | 'mini' | 'ltd' | 'unlimited';

/**
 * The three PAID rungs of the ladder — the vocabulary the buy surfaces speak.
 * 'roll' is deliberately absent: it is not a rung, it is Mini's legacy code.
 */
export type PapicRung = 'mini' | 'ltd' | 'unlimited';
export const PAPIC_RUNGS: readonly PapicRung[] = ['mini', 'ltd', 'unlimited'];

/**
 * The ONE place that knows about the roll↔mini alias. Maps any stored tier code
 * to the paid rung it bills/meters as, or null for the free tier / unknown.
 *   'roll' → 'mini'  (legacy ₱30 seats + orders, identical economics)
 */
export function papicRungForTier(
  tier: string | null | undefined,
): PapicRung | null {
  if (tier === 'roll' || tier === 'mini') return 'mini';
  if (tier === 'ltd') return 'ltd';
  if (tier === 'unlimited') return 'unlimited';
  return null;
}

/**
 * Is this per-camera tier a PAID rung — i.e. does capture stay blocked until its
 * order is paid? True for every rung incl. the legacy 'roll'; false for 'free'.
 * Written as "not free" (rather than an allow-list of rung names) so adding a
 * rung can never silently open an unpaid capture hole.
 */
export function isPaidCameraTier(tier: CameraTier | null | undefined): boolean {
  return tier != null && tier !== 'free';
}

/** The rate SKU each rung bills against. */
export function papicRungSku(rung: PapicRung): string {
  if (rung === 'unlimited') return PAPIC_CAMERA_UNLIMITED_SKU;
  if (rung === 'ltd') return PAPIC_CAMERA_LTD_SKU;
  return PAPIC_CAMERA_MINI_SKU;
}

/**
 * Per-camera per-day capture quota. null = unlimited.
 *
 * @deprecated Superseded by the capture-POINTS budget in papic_tier_config (see
 * papicCaptureCost + the points RPCs). Retained only for the deprecated
 * papicTierDailyLimit below; the mini/ltd rows are the points budget expressed
 * in the old per-kind shape (20 pts → 20 photos, 6 clips · 70 pts → 70 photos,
 * 23 clips) and are NOT an independent source of truth.
 */
export const PAPIC_TIER_QUOTA: Record<
  CameraTier,
  { photos: number | null; videos: number | null }
> = {
  free: { photos: 10, videos: 3 }, // owner 2026-07-11 (was 5 + 1) — fatter free taste
  roll: { photos: 30, videos: 10 },
  mini: { photos: 20, videos: 6 },
  ltd: { photos: 70, videos: 23 },
  unlimited: { photos: null, videos: null },
};

/**
 * Live per-camera-per-day rates, in PHP, keyed by rung. `roll` is carried
 * alongside as the legacy ₱30 SKU's own price so the guest-list Limited path
 * (lib/papic-limited.ts) keeps reading exactly what it always read.
 */
export type CameraRates = {
  mini: number;
  ltd: number;
  unlimited: number;
  /** @deprecated legacy alias of `mini` — the PAPIC_CAMERA_ROLL_DAY price. */
  roll: number;
};

/** Last-resort rates when the catalog is unreadable (no DB / missing rows). */
export const PAPIC_CAMERA_RATES_FALLBACK: CameraRates = {
  mini: PAPIC_CAMERA_MINI_FALLBACK_PHP,
  ltd: PAPIC_CAMERA_LTD_FALLBACK_PHP,
  unlimited: PAPIC_CAMERA_UNLIMITED_FALLBACK_PHP,
  roll: PAPIC_CAMERA_ROLL_FALLBACK_PHP,
};

/**
 * Read the admin-managed per-camera rates from platform_retail_catalog_v2 — all
 * FOUR rate SKUs (Mini · Ltd · Unli + the legacy Roll row).
 *
 * ⚠ The Mini rung resolves PAPIC_CAMERA_MINI_DAY, falling back to the legacy
 * PAPIC_CAMERA_ROLL_DAY row (and vice-versa) — they are the same ₱30 rung, and
 * which row the owner ultimately keeps is still an open catalog decision. Doing
 * the fallback both ways means the ladder prices correctly whichever row wins.
 *
 * Graceful-degrade to the fallbacks on a missing/legacy table or row so the buy
 * surface never crashes a pre-bootstrap database.
 */
export async function fetchCameraRates(
  supabase: SupabaseClient,
): Promise<CameraRates> {
  try {
    const { data, error } = await supabase
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php')
      .in('service_code', [
        PAPIC_CAMERA_ROLL_SKU,
        PAPIC_CAMERA_MINI_SKU,
        PAPIC_CAMERA_LTD_SKU,
        PAPIC_CAMERA_UNLIMITED_SKU,
      ]);
    if (error) {
      if (error.code === '42P01' || error.code === '42703') return { ...PAPIC_CAMERA_RATES_FALLBACK };
      throw new Error(`fetchCameraRates failed: ${error.message}`);
    }
    const byCode = new Map(
      (data ?? []).map((r) => [
        r.service_code as string,
        Number(r.retail_price_php),
      ]),
    );
    const num = (code: string): number | null => {
      const v = byCode.get(code);
      return Number.isFinite(v) ? (v as number) : null;
    };
    const rollRow = num(PAPIC_CAMERA_ROLL_SKU);
    const miniRow = num(PAPIC_CAMERA_MINI_SKU);
    return {
      // Same rung → each covers for the other, so a half-seeded catalog still prices.
      mini: miniRow ?? rollRow ?? PAPIC_CAMERA_MINI_FALLBACK_PHP,
      roll: rollRow ?? miniRow ?? PAPIC_CAMERA_ROLL_FALLBACK_PHP,
      ltd: num(PAPIC_CAMERA_LTD_SKU) ?? PAPIC_CAMERA_LTD_FALLBACK_PHP,
      unlimited:
        num(PAPIC_CAMERA_UNLIMITED_SKU) ?? PAPIC_CAMERA_UNLIMITED_FALLBACK_PHP,
    };
  } catch {
    return { ...PAPIC_CAMERA_RATES_FALLBACK };
  }
}

/** The live per-day rate for one rung. */
export function papicRungRate(rates: CameraRates, rung: PapicRung): number {
  const raw =
    rung === 'unlimited' ? rates.unlimited : rung === 'ltd' ? rates.ltd : rates.mini;
  return Number(raw) || PAPIC_CAMERA_RATES_FALLBACK[rung];
}

// ── papic_tier_config — the admin-editable tier metadata (migration 20270821110000)
//
// display_title · points_per_day · wedding_day_cap_php live in ONE admin-editable
// table, and there is exactly ONE reader for it: `lib/papic-tier-copy.ts`
// (fetchPapicTierConfig / PAPIC_TIER_CONFIG_FALLBACK), introduced by the
// 2026-07-20 honesty pass and guarded by `lib/papic-copy-guardrails.test.ts`.
// This module deliberately does NOT carry a second copy — a duplicate reader is
// exactly how a display title or a point budget drifts from the charge path.
// The PAPIC_*_CAP_FALLBACK_PHP constants above stay here because they are
// CHARGE-path fallbacks consumed by computeCameraQuote, not display copy.

/**
 * A per-camera order selection. Every rung is optional so a caller only names
 * what it sells. `roll` is the legacy alias of `mini` and is ADDED to it.
 */
export type CameraSelection = {
  mini?: number;
  ltd?: number;
  unlimited?: number;
  /** @deprecated legacy alias of `mini` — folded into the Mini rung. */
  roll?: number;
};

export type CameraCaps = { mini: number; ltd: number; unli: number };

/**
 * Papic caps apply to WEDDINGS ONLY (owner 2026-07-17); every other event type
 * is uncapped (per-camera pricing runs to the raw subtotal). Callers pass the
 * result as `computeCameraQuote(..., { uncapped })`.
 */
export function isPapicUncapped(eventType: string | null | undefined): boolean {
  return eventType !== 'wedding';
}

/** One rung's line on a quote. */
export type CameraQuoteLine = {
  rung: PapicRung;
  count: number;
  ratePhp: number;
  /**
   * count × rate, BEFORE the cap. FLAT per camera — the capture-window day
   * count is NOT a price multiplier (2026-07-22 flat naming lock · migration
   * 20270830568357; matched /pricing's former _papic-estimator.tsx, deleted 2026-10-25).
   */
  subtotalPhp: number;
  /** What is actually billed: 0 when freed by an unlock, else min(subtotal, cap). */
  chargePhp: number;
  capPhp: number;
  /** Freed by an unlock pass (₱0, not clamped). */
  free: boolean;
  /** Clamped by its cap (never true when free or uncapped). */
  capped: boolean;
};

export type CameraQuote = {
  /** Per-rung lines — the ladder as data. */
  lines: Record<PapicRung, CameraQuoteLine>;
  miniCount: number;
  ltdCount: number;
  unlimitedCount: number;
  /** @deprecated legacy alias of miniCount (roll == Mini). */
  rollCount: number;
  paidCount: number;
  days: number;
  miniSubtotalPhp: number;
  ltdSubtotalPhp: number;
  unlimitedSubtotalPhp: number;
  miniChargePhp: number;
  ltdChargePhp: number;
  unlimitedChargePhp: number;
  /** @deprecated legacy alias of miniSubtotalPhp. */
  rollSubtotalPhp: number;
  /** @deprecated legacy alias of miniChargePhp. */
  rollChargePhp: number;
  rawTotalPhp: number;
  miniCapPhp: number;
  /** The Ltd (₱50) rung's cap. ⚠ Pre-v3 this field carried the MINI cap. */
  ltdCapPhp: number;
  unliCapPhp: number;
  totalPhp: number;
  capped: boolean; // true if ANY rung hit its cap
  /** Just the ladder part, e.g. "3 Mini + 1 Unli" ("none" when empty). */
  rungSummary: string;
  description: string;
};

/** Clamp a raw count to a non-negative integer. */
function intCount(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Short marketing label per rung, for order descriptions. */
const RUNG_LABEL: Record<PapicRung, string> = {
  mini: 'Mini',
  ltd: 'Ltd',
  unlimited: 'Unli',
};

export type CameraQuoteOpts = {
  /** PAPIC_UNLOCK (₱15,000) owner → the Unli rung is free + uncapped. */
  unliFree?: boolean;
  /**
   * PAPIC_UNLOCK_LTD (₱9,000) owner → the MINI rung (legacy 'roll', the ₱30
   * cameras that pass was sold against) is free + uncapped.
   */
  miniFree?: boolean;
  /**
   * @deprecated Legacy name for {@link CameraQuoteOpts.miniFree}. When
   * PAPIC_UNLOCK_LTD shipped (2026-07-11) the ₱30 rung was still called "Ltd";
   * v3 renamed it to Mini and introduced a genuinely new ₱50 Ltd rung. The pass
   * keeps freeing exactly what it always freed — the ₱30/Mini rung — so this
   * alias is preserved verbatim and NO pass currently frees the new ₱50 rung.
   * (Whether ₱9,000 should now also cover ₱50 Ltd is an OWNER pricing call.)
   */
  ltdFree?: boolean;
  /** Non-wedding event → no caps at all (owner 2026-07-17). */
  uncapped?: boolean;
};

/**
 * Quote a per-camera order across the THREE rungs. PURE + unit-testable — the
 * single source both the pickers (client) and the buy actions (server) mirror.
 *
 * Total = Σ over rungs of min(count · rate, rung cap), where a rung freed by its
 * unlock pass charges ₱0 (subtotal still computed, for the "would be" display)
 * and a non-wedding event skips the clamp entirely.
 *
 * ⚠ FLAT per camera (2026-07-22 naming lock · migration 20270830568357). The
 * `days` argument is the capture-WINDOW length: it still sets seat validity
 * (valid_from/valid_until, resolved by the caller) and rides the order
 * description, but it is NEVER a price multiplier. /pricing promises "flat per
 * camera — no per-day or per-hour math" (the former /pricing _papic-estimator.tsx: paidCameras ×
 * rate), and this charge path must equal that. The old `× days` engine was
 * retired with the flat rename.
 *
 * `selection.roll` folds into Mini — legacy callers keep working unchanged.
 */
export function computeCameraQuote(
  selection: CameraSelection,
  days: number,
  rates: CameraRates,
  caps: CameraCaps,
  opts: CameraQuoteOpts = {},
): CameraQuote {
  const unliFree = opts.unliFree === true;
  // miniFree is the honest name; ltdFree is its pre-v3 alias (see the type).
  const miniFree = opts.miniFree === true || opts.ltdFree === true;
  // Non-wedding events are uncapped (owner 2026-07-17): the subtotal never
  // clamps and `capped` stays false. Caps still populate the *CapPhp fields for
  // reference. Defaults to false (wedding path).
  const uncapped = opts.uncapped === true;
  // The capture-window length (days). Kept for the order description + returned
  // for callers that record the window — but NOT a price multiplier (flat model).
  const d = Math.max(1, Math.floor(Number(days)) || 1);

  // roll == Mini (see the alias note at the top of this module): the two counts
  // are ONE rung and are summed before pricing, so roll and mini always quote
  // identically.
  const counts: Record<PapicRung, number> = {
    mini: intCount(selection.mini) + intCount(selection.roll),
    ltd: intCount(selection.ltd),
    unlimited: intCount(selection.unlimited),
  };
  // CameraCaps keys the Unli cap as `unli`; the rung is named `unlimited`.
  const capOf: Record<PapicRung, number> = {
    mini: Number(caps.mini) > 0 ? Number(caps.mini) : PAPIC_MINI_CAP_FALLBACK_PHP,
    ltd: Number(caps.ltd) > 0 ? Number(caps.ltd) : PAPIC_LTD_CAP_FALLBACK_PHP,
    unlimited:
      Number(caps.unli) > 0 ? Number(caps.unli) : PAPIC_UNLI_CAP_FALLBACK_PHP,
  };
  const freeOf: Record<PapicRung, boolean> = {
    mini: miniFree,
    ltd: false, // no pass frees the ₱50 rung today — owner call (see CameraQuoteOpts)
    unlimited: unliFree,
  };

  // Per-rung cap (owner 2026-06-26): each rung locks independently — so 300
  // cameras on Mini still pay only the Mini cap, and that never eats into the
  // Ltd or Unli headroom.
  const lines = {} as Record<PapicRung, CameraQuoteLine>;
  for (const rung of PAPIC_RUNGS) {
    const count = counts[rung];
    const ratePhp = papicRungRate(rates, rung);
    const capPhp = capOf[rung];
    // FLAT: count × rate. The window length `d` never multiplies the price
    // (2026-07-22 flat naming lock) — it only sizes the seat validity window.
    const subtotalPhp = count * ratePhp;
    const free = freeOf[rung];
    const chargePhp = free
      ? 0
      : uncapped
        ? subtotalPhp
        : Math.min(subtotalPhp, capPhp);
    lines[rung] = {
      rung,
      count,
      ratePhp,
      subtotalPhp,
      chargePhp,
      capPhp,
      free,
      // A rung never "caps" when its unlock frees it (₱0, not clamped) or when
      // the event is uncapped (non-wedding — charge is the raw subtotal).
      capped: !uncapped && !free && subtotalPhp > capPhp,
    };
  }

  const rawTotalPhp = PAPIC_RUNGS.reduce((s, r) => s + lines[r].subtotalPhp, 0);
  const totalPhp = PAPIC_RUNGS.reduce((s, r) => s + lines[r].chargePhp, 0);
  const paidCount = PAPIC_RUNGS.reduce((s, r) => s + lines[r].count, 0);

  const parts = PAPIC_RUNGS.filter((r) => lines[r].count > 0).map(
    (r) => `${formatCount(lines[r].count)} ${RUNG_LABEL[r]}`,
  );
  const rungSummary = parts.join(' + ') || 'none';
  const description = `Papic cameras — ${rungSummary} · ${d} day${d > 1 ? 's' : ''}`;

  return {
    lines,
    miniCount: lines.mini.count,
    ltdCount: lines.ltd.count,
    unlimitedCount: lines.unlimited.count,
    rollCount: lines.mini.count,
    paidCount,
    days: d,
    miniSubtotalPhp: lines.mini.subtotalPhp,
    ltdSubtotalPhp: lines.ltd.subtotalPhp,
    unlimitedSubtotalPhp: lines.unlimited.subtotalPhp,
    miniChargePhp: lines.mini.chargePhp,
    ltdChargePhp: lines.ltd.chargePhp,
    unlimitedChargePhp: lines.unlimited.chargePhp,
    rollSubtotalPhp: lines.mini.subtotalPhp,
    rollChargePhp: lines.mini.chargePhp,
    rawTotalPhp,
    miniCapPhp: lines.mini.capPhp,
    ltdCapPhp: lines.ltd.capPhp,
    unliCapPhp: lines.unlimited.capPhp,
    totalPhp,
    capped: PAPIC_RUNGS.some((r) => lines[r].capped),
    rungSummary,
    description,
  };
}

type ProvisionPaidCamerasInput = {
  eventId: string;
  orderId: string;
  miniCount?: number;
  ltdCount?: number;
  unlimitedCount: number;
  /** @deprecated legacy alias of miniCount — ADDED to it (roll == Mini). */
  rollCount?: number;
  validFrom: string | null;
  validUntil: string | null;
};

/**
 * Materialize the paid per-camera seats for an order (admin client, bypasses
 * RLS — call only after verifying the caller is a couple on the event). Each
 * camera is a paparazzi_seats row at its tier, linked to the paying order via
 * paid_order_id. The cameras exist immediately (so the couple can prep invites)
 * but capture is gated on the order being paid (PR3 presign check). Seats use a
 * dedicated index range (>= PAPIC_CAMERA_INDEX_BASE) so they never collide with
 * the pack (1–5). Returns the number inserted.
 */
export async function provisionPaidCamerasAdmin(
  admin: SupabaseClient,
  input: ProvisionPaidCamerasInput,
): Promise<number> {
  const { eventId, orderId, validFrom, validUntil } = input;
  // roll folds into Mini — a legacy caller passing rollCount provisions Mini
  // seats at the SAME economics it always got (20 pts/day · ₱30 · ₱6,000 cap).
  const perRung: Record<PapicRung, number> = {
    mini: intCount(input.miniCount) + intCount(input.rollCount),
    ltd: intCount(input.ltdCount),
    unlimited: intCount(input.unlimitedCount),
  };
  const total = PAPIC_RUNGS.reduce((s, r) => s + perRung[r], 0);
  if (!eventId || !orderId || total === 0) return 0;

  // Next free index in the per-camera range.
  const { data: existing, error: readErr } = await admin
    .from('paparazzi_seats')
    .select('seat_index')
    .eq('event_id', eventId)
    .gte('seat_index', PAPIC_CAMERA_INDEX_BASE)
    .order('seat_index', { ascending: false })
    .limit(1);
  if (readErr) {
    if (readErr.code === '42P01' || readErr.code === '42703') return 0;
    throw new Error(`provisionPaidCamerasAdmin read failed: ${readErr.message}`);
  }
  let next =
    (existing?.[0]?.seat_index ?? PAPIC_CAMERA_INDEX_BASE - 1) + 1;

  type SeatInsert = {
    event_id: string;
    seat_index: number;
    sku_code: string;
    tier: CameraTier;
    claim_qr_token: string;
    paid_order_id: string;
    valid_from: string | null;
    valid_until: string | null;
  };
  const rows: SeatInsert[] = [];
  const add = (tier: CameraTier, sku: string) => {
    rows.push({
      event_id: eventId,
      seat_index: next,
      sku_code: sku,
      tier,
      claim_qr_token: generateSeatClaimToken(),
      paid_order_id: orderId,
      valid_from: validFrom,
      valid_until: validUntil,
    });
    next += 1;
  };
  // New seats are written at their CANONICAL rung code ('mini' / 'ltd' /
  // 'unlimited'); the DB accepts all five codes since migration 20270821110000
  // and the points RPCs resolve each rung's budget from papic_tier_config.
  for (const rung of PAPIC_RUNGS) {
    for (let i = 0; i < perRung[rung]; i += 1) add(rung, papicRungSku(rung));
  }

  const { error: insertErr } = await admin
    .from('paparazzi_seats')
    .upsert(rows, { onConflict: 'event_id,seat_index', ignoreDuplicates: true });
  if (insertErr) {
    throw new Error(`provisionPaidCamerasAdmin insert failed: ${insertErr.message}`);
  }
  return rows.length;
}

/**
 * A unique apply-then-pay reference code. Matches the 'SN' + uppercase
 * base32-ish style the admin payments queue expects; crypto-random so it never
 * collides (orders.reference_code is UNIQUE; the insert is the hard backstop).
 */
export function mintPapicReferenceCode(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let body = '';
  for (const b of bytes) body += alphabet[b % alphabet.length];
  return `SN${body}`;
}

// ── Per-camera enforcement (PR3) ────────────────────────────────────────────

/** The free funnel per-camera SKU — provisioned by provisionFreeCamerasAdmin below. */
export const PAPIC_CAMERA_FREE_SKU = 'PAPIC_CAMERA_FREE';

/**
 * The ONE free Papic One camera's seat SKU (owner-locked 2026-07-29). Its own
 * code, not PAPIC_CAMERA_FREE, because the two free camera kinds meter against
 * different things: PAPIC_CAMERA_FREE seats draw the SHARED pool, this one draws
 * its own 5-point dedicated grant. It must be in PER_CAMERA_SKUS below or
 * papicPerCameraTier() returns null and the seat escapes enforcement entirely.
 */
export const PAPIC_CAMERA_ONE_FREE_SKU = 'PAPIC_CAMERA_ONE_FREE';

const PER_CAMERA_SKUS: ReadonlySet<string> = new Set([
  PAPIC_CAMERA_ROLL_SKU, // legacy ₱30 rung (== Mini)
  PAPIC_CAMERA_MINI_SKU,
  PAPIC_CAMERA_LTD_SKU,
  PAPIC_CAMERA_UNLIMITED_SKU,
  PAPIC_CAMERA_FREE_SKU,
  PAPIC_CAMERA_ONE_FREE_SKU,
]);

/**
 * The per-camera tier to ENFORCE for a seat, or null if the seat is NOT a
 * per-camera seat. Enforcement applies ONLY to seats provisioned by the
 * per-camera buy flow (sku_code PAPIC_CAMERA_*). The legacy PAPIC_SEATS pack
 * also carries tier='free' from the column backfill, but keeps its own
 * behaviour (uncapped) — so it returns null here and is left untouched.
 */
export function papicPerCameraTier(
  skuCode: string | null | undefined,
  tier: string | null | undefined,
): CameraTier | null {
  if (!skuCode || !PER_CAMERA_SKUS.has(skuCode)) return null;
  if (
    tier === 'roll' ||
    tier === 'mini' ||
    tier === 'ltd' ||
    tier === 'unlimited' ||
    tier === 'free'
  ) {
    return tier;
  }
  return null;
}

/**
 * The per-camera per-day limit for a capture kind (null = unlimited).
 *
 * @deprecated Papic v3 (owner 2026-07-17) replaced the per-kind photo/video
 * quotas with a single capture-POINTS budget (1 photo = 1 pt · 1 clip = 8 pts)
 * resolved from the admin-editable papic_tier_config table. Both enforcement
 * seams (api/upload presign + papic/actions record) now call the points RPCs
 * (migration 20270821110100). Kept one release alongside the deprecated
 * papic_camera_remaining / papic_reserve_camera_capture DB fns, both dropped
 * 2026-09-18 (20271234330879).
 */
export function papicTierDailyLimit(
  tier: CameraTier,
  kind: 'photo' | 'clip',
): number | null {
  const q = PAPIC_TIER_QUOTA[tier];
  return kind === 'clip' ? q.videos : q.photos;
}

// ── Capture POINTS (Papic v3 · owner 2026-07-17 · brief PR-3) ───────────────
//
// One per-camera-per-day budget, spent in POINTS: 1 photo = 1 point · 1
// ten-second clip = 8 points. Budgets live in the admin-editable
// papic_tier_config table (roll 20 · ltd 70 · free/mini/unlimited NULL=∞) —
// NEVER hardcoded here. Free + Papic One ('mini') were flipped to NULL by the
// one-pool migration (owner 2026-07-22 · §0): their per-camera reserve passes
// through, so a free/One seat draws ONLY the shared event pool
// (papic_reserve_event_points), no per-seat reserve. The DB RPCs (migration
// 20270821110100) resolve the budget internally:
//   • papic_camera_points_remaining(seat) — read-only probe for the PRESIGN
//     seam (api/upload): refuse the upload URL at 0 so no orphan R2 bytes.
//   • The record-layer gate WAS papic_reserve_camera_points; it was replaced
//     by papic_reserve_capture_split (dedicated first, pool for the rest —
//     owner 2026-08-11) and dropped 2026-09-18 (20271234330879).

/**
 * Postgres "function does not exist" (42883) / PostgREST schema-cache miss
 * (PGRST202) — the ONE carve-out where the points gate fails OPEN: during the
 * seam cutover a deploy can briefly run app code ahead of the migration, and
 * that must not brick every camera. Everything else fails CLOSED.
 */
export function isMissingRpcErrorCode(code: string | null | undefined): boolean {
  return code === '42883' || code === 'PGRST202';
}

export type PointsGateVerdict = 'allow' | 'exhausted' | 'blocked';

/**
 * The shared fail-posture policy for BOTH points-enforcement seams (presign +
 * record). Pure + unit-tested — the brief's invariant lives here, once:
 *
 *   fail-CLOSED on every RPC error EXCEPT function-not-found (the seam-cutover
 *   carve-out), and a definitive "no budget left" is 'exhausted' (the seams
 *   surface it as 409 camera_points_exhausted).
 *
 * @param errorCode  the RPC error's code, or null when the call succeeded.
 * @param allowed    the caller's verdict from the RPC result — true (points
 *                   fit), false (budget definitively exhausted), or null when
 *                   the result shape was indeterminate (fail-CLOSED → blocked).
 */
export function resolvePointsGate(
  errorCode: string | null | undefined,
  allowed: boolean | null,
): PointsGateVerdict {
  if (errorCode != null) {
    return isMissingRpcErrorCode(errorCode) ? 'allow' : 'blocked';
  }
  if (allowed === true) return 'allow';
  if (allowed === false) return 'exhausted';
  return 'blocked';
}

/**
 * Materialize the event's FREE cameras — the "always 3 seats / event" Free tier
 * (owner 2026-07-22 · §0: Free = these 3 seats drawing the ONE shared 50-pt event
 * pool, no per-seat reserve; face-sort + personal reels ON). Before this, "3 free
 * cameras" was display copy with nothing to bind to: no tier='free' per-camera
 * seats were ever provisioned, so free capture ran through the uncapped legacy
 * path — the fake door brief PR-3 closes. These are real paparazzi_seats rows
 * (sku_code PAPIC_CAMERA_FREE · tier 'free'); since free.points_per_day is now
 * NULL, their per-camera reserve passes through and the shared event pool
 * (papic_reserve_event_points) is the sole gate — same plumbing as Papic One.
 *
 * Idempotent dense top-up at fixed indexes 100..102 (mirrors the pack's 1..5
 * pattern): re-running only fills missing indexes and never disturbs a claimed
 * seat; the (event_id, seat_index) UNIQUE constraint is the hard backstop.
 * Called render-time from the couple's Papic studio page (admin client, after
 * the couple check) — same lazy-provision pattern as syncGuestCameras.
 *
 * Best-effort + non-fatal: returns the number of NEW seats inserted, 0 on any
 * error (a provisioning hiccup must never break the setup page; the next render
 * retries).
 */
export async function provisionFreeCamerasAdmin(
  admin: SupabaseClient,
  eventId: string,
  window?: { validFrom: string | null; validUntil: string | null },
): Promise<number> {
  if (!eventId) return 0;
  try {
    const lastIndex = PAPIC_FREE_CAMERA_INDEX_BASE + PAPIC_FREE_CAMERA_COUNT - 1;
    const { data: existing, error: readErr } = await admin
      .from('paparazzi_seats')
      .select('seat_index')
      .eq('event_id', eventId)
      .gte('seat_index', PAPIC_FREE_CAMERA_INDEX_BASE)
      .lte('seat_index', lastIndex);
    if (readErr) console.error('[supabase-error] lib/papic-cameras.ts · from:paparazzi_seats.select', readErr);
    if (readErr) return 0; // missing/legacy table → pre-bootstrap DB; retry next render
    const have = new Set((existing ?? []).map((r) => r.seat_index as number));
    const missing = [];
    for (let i = PAPIC_FREE_CAMERA_INDEX_BASE; i <= lastIndex; i += 1) {
      if (!have.has(i)) {
        missing.push({
          event_id: eventId,
          seat_index: i,
          sku_code: PAPIC_CAMERA_FREE_SKU,
          tier: 'free' as CameraTier,
          claim_qr_token: generateSeatClaimToken(),
          valid_from: window?.validFrom ?? null,
          valid_until: window?.validUntil ?? null,
        });
      }
    }
    if (missing.length === 0) return 0;
    const { error: insertErr } = await admin
      .from('paparazzi_seats')
      .upsert(missing, { onConflict: 'event_id,seat_index', ignoreDuplicates: true });
    if (insertErr) console.error('[supabase-error] lib/papic-cameras.ts · from:paparazzi_seats.upsert', insertErr);
    if (insertErr) return 0;
    return missing.length;
  } catch {
    return 0;
  }
}

/**
 * Mint a host camera for this event — the first host's (seat 150, the original "Uploads" camera) or, given
 * `hostUserId`, THIS host's own (owner 2026-10-31, *"yes. papic credits still"*: every host — each couple member and
 * each co-host — has their own camera, all spending the one shared pool). With `hostUserId` it mints only when that host
 * has no camera of their own AND no unclaimed one is waiting (`hostCameraPick`), so a host who only looks at Memories
 * leaves at most one spare behind, never a pile.
 *
 * A sibling of `provisionFreeCamerasAdmin` above, deliberately: same seat shape,
 * same free tier, same idempotency. **Idempotency is the `(event_id,
 * seat_index)` UNIQUE constraint in SQL, never a check in TypeScript** — two
 * concurrent renders both see "missing" and both insert; only the database can
 * settle that (the loser creates nothing, and its host's next render finds the spare or the next index).
 *
 * ⚠ IT TAKES THE EVENT'S REAL CAPTURE WINDOW, AND MUST. `captureWindowState`
 * returns `'open'` on null bounds — deliberate, so a legacy seat is never
 * bricked mid-party. Passing null here would make this the ONLY seat in the
 * product exempt from the window a couple sets, inventing a rule silently.
 *
 * ⛔ THERE IS NO SERVER ACTION FOR THIS, ON PURPOSE. This is a service-role
 * write, so a standalone action taking a client-supplied `eventId` would let a
 * signed-in stranger mint a live seat on somebody else's wedding and then claim
 * it — after which every downstream gate passes them through, because the
 * upload presign and the record path both check *claimer identity* and nothing
 * else. It is called only from couple-checked renders (the Papic card's self-heal and the Memories host branch),
 * AFTER the couple check those renders perform — `the-uploads-camera-has-no-back-door.test.ts`.
 *
 * Best-effort + non-fatal: returns 1 if a seat was created, 0 otherwise
 * (including on any error — the next render retries).
 */
export async function provisionUploadsCameraAdmin(
  admin: SupabaseClient,
  eventId: string,
  window?: { validFrom: string | null; validUntil: string | null },
  hostUserId?: string,
): Promise<number> {
  if (!eventId) return 0;
  try {
    const { data: existing, error: readErr } = await admin
      .from('paparazzi_seats')
      .select(hostCameraSelect)
      .eq('event_id', eventId)
      .gte('seat_index', PAPIC_UPLOADS_CAMERA_INDEX)
      .lte('seat_index', PAPIC_HOST_CAMERA_LAST_INDEX);
    if (readErr) console.error('[supabase-error] lib/papic-cameras.ts · from:paparazzi_seats.select', readErr);
    // ⚠ A refused read is NOT "there is none". Returning 0 here retries next
    // render; inserting on an unread would race the UNIQUE constraint for
    // nothing.
    if (readErr) return 0;
    const rows = (existing ?? []) as HostCameraRow[];
    let index: number;
    if (hostUserId) {
      const pick = hostCameraPick(rows, hostUserId);
      if (pick.kind !== 'mint') return 0;
      index = pick.index;
    } else {
      if (rows.some((r) => r.seat_index === PAPIC_UPLOADS_CAMERA_INDEX)) return 0;
      index = PAPIC_UPLOADS_CAMERA_INDEX;
    }

    const { error: insertErr } = await admin.from('paparazzi_seats').upsert(
      [
        {
          event_id: eventId,
          seat_index: index,
          sku_code: PAPIC_CAMERA_FREE_SKU,
          tier: 'free' as CameraTier,
          claim_qr_token: generateSeatClaimToken(),
          valid_from: window?.validFrom ?? null,
          valid_until: window?.validUntil ?? null,
        },
      ],
      { onConflict: 'event_id,seat_index', ignoreDuplicates: true },
    );
    if (insertErr) console.error('[supabase-error] lib/papic-cameras.ts · from:paparazzi_seats.upsert', insertErr);
    if (insertErr) return 0;
    return 1;
  } catch {
    return 0;
  }
}

/**
 * THIS HOST'S CAMERA, READ — the one read the Memories render and `startAddingPhotos` both make, so the sheet and the
 * claim can never disagree about which camera is whose. Service role (an unclaimed seat is invisible to its future
 * claimer under RLS); pinned to the event and to the host-camera block, so it can only ever return a host camera.
 * Callers run it AFTER their couple check. `readFailed` is a refusal, never "there is none".
 */
export async function readHostCamera(
  admin: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<{ pick: HostCameraPick | null; readFailed: boolean }> {
  try {
    const { data, error } = await admin
      .from('paparazzi_seats')
      .select(hostCameraSelect)
      .eq('event_id', eventId)
      .gte('seat_index', PAPIC_UPLOADS_CAMERA_INDEX)
      .lte('seat_index', PAPIC_HOST_CAMERA_LAST_INDEX);
    if (error) {
      console.error('[supabase-error] lib/papic-cameras.ts · readHostCamera · from:paparazzi_seats.select', error);
      return { pick: null, readFailed: true };
    }
    return { pick: hostCameraPick((data ?? []) as HostCameraRow[], userId), readFailed: false };
  } catch {
    return { pick: null, readFailed: true };
  }
}

/** The seat a pick hands this host — theirs, or the spare their first pick will claim; null when there is none yet. */
export function hostCameraSeat(pick: HostCameraPick | null): HostCameraRow | null {
  return pick && (pick.kind === 'mine' || pick.kind === 'spare') ? pick.seat : null;
}

/**
 * Is the order that provisioned a paid camera actually PAID? Apply-then-pay: a
 * paid camera (roll/unlimited) only shoots once its order reaches paid/fulfilled
 * (a still-'submitted' order is awaiting the Setnayan team's reconciliation).
 * Read on the admin client (the claimer isn't an event member). Fail-CLOSED:
 * any miss returns false so an unpaid/unknown camera cannot capture.
 */
export async function papicCameraOrderPaid(
  admin: SupabaseClient,
  orderId: string | null | undefined,
): Promise<boolean> {
  if (!orderId) return false;
  try {
    const { data, error } = await admin
      .from('orders')
      .select('status')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] papic-cameras: order status', error, { orderId });
      return false;
    }
    if (!data) return false;
    const status = (data as { status?: string }).status ?? '';
    return status === 'paid' || status === 'fulfilled';
  } catch {
    return false;
  }
}
