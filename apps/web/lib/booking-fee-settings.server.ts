import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BOOKING_FEE, type BookingFeeSchedule } from '@/lib/booking-fee';

/**
 * The LIVE vendor booking-fee schedule — the owner's three numbers, read from
 * `platform_settings`.
 *
 * ⚖ OWNER RULING 2026-08-28: the 5%, the ₱100,000 threshold and the 1% are his
 * to set, from /admin/pricing → "Vendor booking fee".
 *
 * 🔑 THIS IS THE *DISPLAY* HALF. The AUTHORITATIVE arithmetic is
 * `public.booking_fee_centavos()` in SQL — every charge is computed there, by
 * the RPC, and nothing on this side decides what a vendor is billed. What this
 * function exists for is to stop the two halves from DISAGREEING out loud: the
 * vendor's money document quotes the schedule in words, and a sentence composed
 * from stale code constants on a bill computed from live settings is exactly
 * the defect 20271013349208 was written to close, one level up.
 *
 * ⚠ FAILS TOWARD THE LOCKED DEFAULT, NEVER TOWARD FREE. An unreadable settings
 * row returns `BOOKING_FEE` — the owner-locked 2026-07-25 taper — so a
 * transient read error degrades to today's schedule rather than to a zero fee
 * or a thrown page. `platform_settings` is a singleton at id = 1.
 *
 * 🔒 The ₱50 floor and the no-cap rule are NOT read from the database: the
 * owner did not rule on them, so they stay `BOOKING_FEE.minPhp` in code. If
 * they ever become editable, they get columns of their own — they are not
 * quietly folded in here.
 */
export async function getBookingFeeSchedule(
  admin: SupabaseClient,
): Promise<BookingFeeSchedule> {
  try {
    const { data, error } = await admin
      .from('platform_settings')
      .select(
        'booking_fee_rate_pct, booking_fee_tail_rate_pct, booking_fee_tier1_limit_php',
      )
      .eq('id', 1)
      .maybeSingle();

    // ⚠ Supabase RESOLVES with `{ error }`; it does not throw. A `catch` alone
    // would never see a refused read, so the error is checked explicitly.
    if (error || !data) return BOOKING_FEE;

    const row = data as {
      booking_fee_rate_pct?: number | string | null;
      booking_fee_tail_rate_pct?: number | string | null;
      booking_fee_tier1_limit_php?: number | string | null;
    };

    return {
      rate: pctToFraction(row.booking_fee_rate_pct, BOOKING_FEE.rate),
      tailRate: pctToFraction(row.booking_fee_tail_rate_pct, BOOKING_FEE.tailRate),
      tier1LimitPhp: positiveOr(
        row.booking_fee_tier1_limit_php,
        BOOKING_FEE.tier1LimitPhp,
      ),
      // FIXED in code — see the docblock. Deliberately not read.
      minPhp: BOOKING_FEE.minPhp,
    };
  } catch {
    return BOOKING_FEE;
  }
}

/**
 * A stored PERCENT (5.00) as the FRACTION the arithmetic uses (0.05).
 *
 * ⚠ The database stores a percent and the pure functions take a fraction. That
 * is a factor of 100 between two numbers that both look like "the rate", so the
 * conversion lives in exactly one place rather than at each call site.
 * A NULL / non-finite / out-of-range value falls back rather than producing a
 * nonsense rate; 0 is legal (a waived fee) and is preserved.
 */
function pctToFraction(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return n / 100;
}

/** A stored peso threshold, or the fallback when it is missing / nonsense. */
function positiveOr(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}
