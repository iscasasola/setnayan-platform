import type { SupabaseClient } from '@supabase/supabase-js';
import { generateSeatClaimToken } from '@/lib/papic-seats';

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
export const PAPIC_DEFAULT_COST_CAP_PHP = 6999;

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

export type CameraQuote = {
  rollCount: number;
  unlimitedCount: number;
  paidCount: number;
  days: number;
  rollSubtotalPhp: number;
  unlimitedSubtotalPhp: number;
  rawTotalPhp: number;
  capPhp: number;
  totalPhp: number;
  capped: boolean;
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
  capPhp: number,
): CameraQuote {
  const rollCount = intCount(selection.roll);
  const unlimitedCount = intCount(selection.unlimited);
  const d = Math.max(1, Math.floor(Number(days)) || 1);
  const rollRate = Number(rates.roll) || PAPIC_CAMERA_ROLL_FALLBACK_PHP;
  const unlimitedRate =
    Number(rates.unlimited) || PAPIC_CAMERA_UNLIMITED_FALLBACK_PHP;

  const rollSubtotalPhp = rollCount * rollRate * d;
  const unlimitedSubtotalPhp = unlimitedCount * unlimitedRate * d;
  const rawTotalPhp = rollSubtotalPhp + unlimitedSubtotalPhp;

  const cap = Number(capPhp) > 0 ? Number(capPhp) : PAPIC_DEFAULT_COST_CAP_PHP;
  const totalPhp = Math.min(rawTotalPhp, cap);
  const paidCount = rollCount + unlimitedCount;

  const parts: string[] = [];
  if (rollCount) parts.push(`${rollCount} Roll`);
  if (unlimitedCount) parts.push(`${unlimitedCount} Unlimited`);
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
    rawTotalPhp,
    capPhp: cap,
    totalPhp,
    capped: rawTotalPhp > cap,
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
