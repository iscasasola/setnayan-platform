import type { SupabaseClient } from '@supabase/supabase-js';
import { generateSeatClaimToken } from '@/lib/papic-seats';
import { eventSkuActive } from '@/lib/entitlements';

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
 * Strictly ADDITIVE: the free sampler (is_free_sampler seats at index 101–103)
 * and the PAPIC_SEATS 5-pack (index 1–5) are untouched. Paid per-camera seats
 * live in their own index range (>= PAPIC_CAMERA_INDEX_BASE) so they never
 * collide. Prices are admin-managed — read from the catalog, never hardcoded
 * (the constants below are last-resort fallbacks only).
 */

export const PAPIC_CAMERA_ROLL_SKU = 'PAPIC_CAMERA_ROLL_DAY';
export const PAPIC_CAMERA_UNLIMITED_SKU = 'PAPIC_CAMERA_UNLIMITED_DAY';

/** orders.service_key marker for a per-camera order (free-form TEXT column). */
export const PAPIC_CAMERAS_ORDER_KEY = 'PAPIC_CAMERAS';

/** First N cameras are free (the funnel taste); paid orders require >= MIN. */
export const PAPIC_FREE_CAMERA_COUNT = 5;
export const PAPIC_MIN_PAID_CAMERAS = 5;

/** Paid per-camera seats start here so they never collide with pack (1–5) or sampler (101–103). */
export const PAPIC_CAMERA_INDEX_BASE = 200;

/** Last-resort fallbacks if the catalog row is missing. Live prices come from the catalog. */
export const PAPIC_CAMERA_ROLL_FALLBACK_PHP = 30;
export const PAPIC_CAMERA_UNLIMITED_FALLBACK_PHP = 100;
export const PAPIC_DEFAULT_COST_CAP_PHP = 6999; // deprecated single cap (pre per-tier)
/** Per-tier price caps (owner 2026-06-26) — each tier's subtotal locks here. */
export const PAPIC_LTD_CAP_FALLBACK_PHP = 6000; // Ltd (Roll) ≈ 200 cameras × ₱30
export const PAPIC_UNLI_CAP_FALLBACK_PHP = 10000; // Unli ≈ 100 cameras × ₱100

export type CameraTier = 'free' | 'roll' | 'unlimited';

/** Per-camera per-day capture quota. null = unlimited. */
export const PAPIC_TIER_QUOTA: Record<
  CameraTier,
  { photos: number | null; videos: number | null }
> = {
  free: { photos: 5, videos: 1 },
  roll: { photos: 30, videos: 10 },
  unlimited: { photos: null, videos: null },
};

export type CameraRates = { roll: number; unlimited: number };

/**
 * Read the admin-managed per-camera rates from platform_retail_catalog_v2.
 * Graceful-degrade to the fallbacks on a missing/legacy table or row so the
 * buy surface never crashes a pre-bootstrap database.
 */
export async function fetchCameraRates(
  supabase: SupabaseClient,
): Promise<CameraRates> {
  try {
    const { data, error } = await supabase
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php')
      .in('service_code', [PAPIC_CAMERA_ROLL_SKU, PAPIC_CAMERA_UNLIMITED_SKU]);
    if (error) {
      if (error.code === '42P01' || error.code === '42703') {
        return {
          roll: PAPIC_CAMERA_ROLL_FALLBACK_PHP,
          unlimited: PAPIC_CAMERA_UNLIMITED_FALLBACK_PHP,
        };
      }
      throw new Error(`fetchCameraRates failed: ${error.message}`);
    }
    const byCode = new Map(
      (data ?? []).map((r) => [
        r.service_code as string,
        Number(r.retail_price_php),
      ]),
    );
    const roll = byCode.get(PAPIC_CAMERA_ROLL_SKU);
    const unlimited = byCode.get(PAPIC_CAMERA_UNLIMITED_SKU);
    return {
      roll: Number.isFinite(roll) ? (roll as number) : PAPIC_CAMERA_ROLL_FALLBACK_PHP,
      unlimited: Number.isFinite(unlimited)
        ? (unlimited as number)
        : PAPIC_CAMERA_UNLIMITED_FALLBACK_PHP,
    };
  } catch {
    return {
      roll: PAPIC_CAMERA_ROLL_FALLBACK_PHP,
      unlimited: PAPIC_CAMERA_UNLIMITED_FALLBACK_PHP,
    };
  }
}

export type CameraSelection = { roll: number; unlimited: number };

export type CameraCaps = { ltd: number; unli: number };

export type CameraQuote = {
  rollCount: number;
  unlimitedCount: number;
  paidCount: number;
  days: number;
  rollSubtotalPhp: number; // raw Ltd subtotal, before the cap
  unlimitedSubtotalPhp: number; // raw Unli subtotal, before the cap
  rollChargePhp: number; // Ltd subtotal after its ₱6,000 cap
  unlimitedChargePhp: number; // Unli subtotal after its ₱10,000 cap
  rawTotalPhp: number;
  ltdCapPhp: number;
  unliCapPhp: number;
  totalPhp: number;
  capped: boolean; // true if EITHER tier hit its cap
  description: string;
};

/** Clamp a raw count to a non-negative integer. */
function intCount(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Quote a per-camera order. PURE + unit-testable. Total = (roll·rollRate +
 * unlimited·unlimitedRate) · days, clamped to the event cost cap.
 */
export function computeCameraQuote(
  selection: CameraSelection,
  days: number,
  rates: CameraRates,
  caps: CameraCaps,
): CameraQuote {
  const rollCount = intCount(selection.roll);
  const unlimitedCount = intCount(selection.unlimited);
  const d = Math.max(1, Math.floor(Number(days)) || 1);
  const rollRate = Number(rates.roll) || PAPIC_CAMERA_ROLL_FALLBACK_PHP;
  const unlimitedRate =
    Number(rates.unlimited) || PAPIC_CAMERA_UNLIMITED_FALLBACK_PHP;

  const ltdCap =
    Number(caps.ltd) > 0 ? Number(caps.ltd) : PAPIC_LTD_CAP_FALLBACK_PHP;
  const unliCap =
    Number(caps.unli) > 0 ? Number(caps.unli) : PAPIC_UNLI_CAP_FALLBACK_PHP;

  const rollSubtotalPhp = rollCount * rollRate * d;
  const unlimitedSubtotalPhp = unlimitedCount * unlimitedRate * d;
  const rawTotalPhp = rollSubtotalPhp + unlimitedSubtotalPhp;

  // Per-tier cap (owner 2026-06-26): each tier locks independently — Ltd at
  // ₱6,000, Unli at ₱10,000 — so 300 guests on Ltd still pay ₱6,000.
  const rollChargePhp = Math.min(rollSubtotalPhp, ltdCap);
  const unlimitedChargePhp = Math.min(unlimitedSubtotalPhp, unliCap);
  const totalPhp = rollChargePhp + unlimitedChargePhp;
  const paidCount = rollCount + unlimitedCount;

  const parts: string[] = [];
  if (rollCount) parts.push(`${rollCount} Ltd`);
  if (unlimitedCount) parts.push(`${unlimitedCount} Unli`);
  const description = `Papic cameras — ${parts.join(' + ') || 'none'} · ${d} day${
    d > 1 ? 's' : ''
  }`;

  return {
    rollCount,
    unlimitedCount,
    paidCount,
    days: d,
    rollSubtotalPhp,
    unlimitedSubtotalPhp,
    rollChargePhp,
    unlimitedChargePhp,
    rawTotalPhp,
    ltdCapPhp: ltdCap,
    unliCapPhp: unliCap,
    totalPhp,
    capped: rollSubtotalPhp > ltdCap || unlimitedSubtotalPhp > unliCap,
    description,
  };
}

type ProvisionPaidCamerasInput = {
  eventId: string;
  orderId: string;
  rollCount: number;
  unlimitedCount: number;
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
 * the pack (1–5) or the sampler (101–103). Returns the number inserted.
 */
export async function provisionPaidCamerasAdmin(
  admin: SupabaseClient,
  input: ProvisionPaidCamerasInput,
): Promise<number> {
  const { eventId, orderId, rollCount, unlimitedCount, validFrom, validUntil } =
    input;
  const total = intCount(rollCount) + intCount(unlimitedCount);
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
    is_free_sampler: boolean;
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
      is_free_sampler: false,
      paid_order_id: orderId,
      valid_from: validFrom,
      valid_until: validUntil,
    });
    next += 1;
  };
  for (let i = 0; i < intCount(rollCount); i += 1) add('roll', PAPIC_CAMERA_ROLL_SKU);
  for (let i = 0; i < intCount(unlimitedCount); i += 1)
    add('unlimited', PAPIC_CAMERA_UNLIMITED_SKU);

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

/** The free funnel per-camera SKU (forward-compat; free-tier provisioning is a later PR). */
export const PAPIC_CAMERA_FREE_SKU = 'PAPIC_CAMERA_FREE';

const PER_CAMERA_SKUS: ReadonlySet<string> = new Set([
  PAPIC_CAMERA_ROLL_SKU,
  PAPIC_CAMERA_UNLIMITED_SKU,
  PAPIC_CAMERA_FREE_SKU,
]);

/**
 * The per-camera tier to ENFORCE for a seat, or null if the seat is NOT a
 * per-camera seat. Enforcement applies ONLY to seats provisioned by the
 * per-camera buy flow (sku_code PAPIC_CAMERA_*). The legacy PAPIC_SEATS pack and
 * the free sampler also carry tier='free' from the column backfill, but keep
 * their own behaviour (uncapped pack / RPC-capped sampler) — so they return
 * null here and are left untouched.
 */
export function papicPerCameraTier(
  skuCode: string | null | undefined,
  tier: string | null | undefined,
): CameraTier | null {
  if (!skuCode || !PER_CAMERA_SKUS.has(skuCode)) return null;
  if (tier === 'roll' || tier === 'unlimited' || tier === 'free') return tier;
  return null;
}

/** The per-camera per-day limit for a capture kind (null = unlimited). */
export function papicTierDailyLimit(
  tier: CameraTier,
  kind: 'photo' | 'clip',
): number | null {
  const q = PAPIC_TIER_QUOTA[tier];
  return kind === 'clip' ? q.videos : q.photos;
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
    if (error || !data) return false;
    const status = (data as { status?: string }).status ?? '';
    return status === 'paid' || status === 'fulfilled';
  } catch {
    return false;
  }
}

/** orders.service_key marker for the Papic Unlock All bundle (₱15,000). */
export const PAPIC_UNLOCK_ORDER_KEY = 'PAPIC_UNLOCK';

/**
 * THE camera-allowance model (owner-locked 2026-06-26): the Papic Unlock All
 * bundle grants free, UNCAPPED Unli cameras. Owning PAPIC_UNLOCK (admin-approved)
 * makes every Unli-tier seat shoot WITHOUT its own paid per-camera order — the
 * capture gate ORs this onto papicCameraOrderPaid. Read on an ADMIN client (the
 * claimer isn't an event member, so an RLS read would see nothing). eventSkuActive
 * is bundle-aware and requires paid/fulfilled, so an apply-then-pay PAPIC_UNLOCK
 * stays dark until the Setnayan team confirms — consistent with the per-camera
 * paid gate. Fail-CLOSED: any error returns false so an unconfirmed bundle can't
 * unlock capture.
 *
 * Scope: UNLI tier only. Roll/Ltd cameras are NOT unlocked by the bundle (Unli is
 * the premium tier the bundle covers, and it's strictly better, so there's no
 * reason to shoot Roll once Unlock All is owned).
 */
export async function papicUnliUnlockAllActive(
  admin: SupabaseClient,
  eventId: string | null | undefined,
): Promise<boolean> {
  if (!eventId) return false;
  try {
    return await eventSkuActive(admin, eventId, PAPIC_UNLOCK_ORDER_KEY);
  } catch {
    return false;
  }
}
