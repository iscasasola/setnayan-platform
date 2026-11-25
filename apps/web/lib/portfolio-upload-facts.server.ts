import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';

/**
 * The Upload doors' facts — the shop and its stored list, exactly what Portfolio's own page hands the uploader.
 * 🔓 Reads nothing since 2026-11-23: the portfolio has no count, allowance or wallet price (owner, *"Yes, drop it"* —
 * storage is the only limit, and `/api/upload` checks it before any bytes move). The client and the plan are still
 * taken so the Shop's call site stays as it is; neither is read.
 */
export async function readPortfolioUploadFacts(
  _supabase: SupabaseClient,
  vendorProfileId: string,
  storedRefs: string[],
  _tier?: Promise<string | null | undefined> | string | null | undefined,
): Promise<PortfolioUploadFacts> {
  return { vendorProfileId, storedRefs };
}
