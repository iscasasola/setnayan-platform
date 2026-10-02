import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { readOnboardingDiscountPct } from '@/lib/onboarding-discount';

/**
 * The ONE sign-up discount (owner tracker d18, 2026-10-02: *"40% off everything
 * bought during sign-up"*, one admin-set number) — `platform_settings.
 * onboarding_discount_pct`, read live.
 *
 * 🔑 ADMIN CLIENT: `platform_settings` is platform config (it also holds the TIN
 * and bank numbers) and onboarding is reached ANONYMOUSLY — a caller-scoped read
 * returns 401 and would silently fall back. Fails to the DEFAULT, never to zero
 * (`readOnboardingDiscountPct`).
 */
export async function fetchOnboardingDiscountPct(): Promise<number> {
  try {
    const { data } = await createAdminClient()
      .from('platform_settings')
      .select('onboarding_discount_pct')
      .eq('id', 1)
      .maybeSingle();
    return readOnboardingDiscountPct(
      (data as { onboarding_discount_pct?: number | string | null } | null)?.onboarding_discount_pct,
    );
  } catch {
    return readOnboardingDiscountPct(null);
  }
}
