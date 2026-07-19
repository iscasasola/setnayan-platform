/**
 * Conversion & deals analytics reader (vendor "My Performance" · Phase B family 2).
 *
 * Bundles four ownership-gated SECURITY DEFINER RPCs (migration
 * 20270422213000_vendor_conversion_analytics_rpcs) — quote acceptance +
 * time-to-quote, deal size, booking lead time, win/loss. All OWN-BUSINESS only:
 * each RPC filters to the caller's own vendor in SQL. Pro tier
 * (canSeePerformanceAdvanced), enforced at the page layer.
 *
 * HONESTY notes carried from the schema-discovery pass:
 *   - peso figures (deal size) are PARTIAL — event_vendors.total_cost_php is
 *     nullable and vendors settle off-platform; the card labels coverage.
 *   - lead time / sales cycle use the booking-row created_at as the booked-date
 *     proxy (no contracted_at column exists).
 *   - win rate is "of decided inquiries" (won / (won + declined)); the
 *     silent-loss class (accepted-but-never-booked, stale quotes) is not a loss.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type QuoteStats = {
  sentCount: number;
  acceptedCount: number;
  acceptancePct: number | null;
  quotedWithInquiryCount: number;
  avgHoursToQuote: number | null;
};

export type DealSize = {
  acceptedProposalCount: number;
  avgQuotedPhp: number | null;
  bookedPricedCount: number;
  avgContractPhp: number | null;
  totalContractPhp: number;
};

export type LeadTime = {
  bookedWithDateCount: number;
  avgLeadDays: number | null;
  medianLeadDays: number | null;
};

export type WinLoss = {
  bookingsWon: number;
  inquiriesDeclined: number;
  quotesLost: number;
  winRateOfDecided: number | null;
};

export type ConversionAnalytics = {
  quote: QuoteStats;
  deal: DealSize;
  lead: LeadTime;
  winLoss: WinLoss;
};

const EMPTY: ConversionAnalytics = {
  quote: { sentCount: 0, acceptedCount: 0, acceptancePct: null, quotedWithInquiryCount: 0, avgHoursToQuote: null },
  deal: { acceptedProposalCount: 0, avgQuotedPhp: null, bookedPricedCount: 0, avgContractPhp: null, totalContractPhp: 0 },
  lead: { bookedWithDateCount: 0, avgLeadDays: null, medianLeadDays: null },
  winLoss: { bookingsWon: 0, inquiriesDeclined: 0, quotesLost: 0, winRateOfDecided: null },
};

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Fetch the caller's conversion & deals bundle. Each RPC is ownership-gated in
 * SQL and degrades to its empty shape on error (mirrors the other readers).
 */
export async function fetchVendorConversionAnalytics(
  supabase: SupabaseClient,
  vendorProfileId: string,
  sinceIso?: string | null,
): Promise<ConversionAnalytics> {
  const since = sinceIso ?? null;
  const args = { p_vendor_profile_id: vendorProfileId, p_since: since };

  const [quoteRes, dealRes, leadRes, winRes] = await Promise.all([
    supabase.rpc('vendor_quote_stats', args),
    supabase.rpc('vendor_deal_size', args),
    supabase.rpc('vendor_lead_time', args),
    supabase.rpc('vendor_win_loss', args),
  ]);

  const firstRow = <T>(res: { data: unknown; error: unknown }): T | null => {
    if (res.error) {
      // eslint-disable-next-line no-console
      console.error('[vendor-conversion-analytics] rpc failed', {
        vendor_profile_id: vendorProfileId,
        error: (res.error as { message?: string }).message,
      });
      return null;
    }
    const rows = (res.data ?? []) as T[];
    return rows[0] ?? null;
  };

  const q = firstRow<{
    sent_count: number | null;
    accepted_count: number | null;
    acceptance_pct: number | string | null;
    quoted_with_inquiry_count: number | null;
    avg_hours_to_quote: number | string | null;
  }>(quoteRes);

  const d = firstRow<{
    accepted_proposal_count: number | null;
    avg_quoted_php: number | string | null;
    booked_priced_count: number | null;
    avg_contract_php: number | string | null;
    total_contract_php: number | string | null;
  }>(dealRes);

  const l = firstRow<{
    booked_with_date_count: number | null;
    avg_lead_days: number | string | null;
    median_lead_days: number | string | null;
  }>(leadRes);

  const w = firstRow<{
    bookings_won: number | null;
    inquiries_declined: number | null;
    quotes_lost: number | null;
    win_rate_of_decided: number | string | null;
  }>(winRes);

  return {
    quote: q
      ? {
          sentCount: Number(q.sent_count ?? 0),
          acceptedCount: Number(q.accepted_count ?? 0),
          acceptancePct: num(q.acceptance_pct),
          quotedWithInquiryCount: Number(q.quoted_with_inquiry_count ?? 0),
          avgHoursToQuote: num(q.avg_hours_to_quote),
        }
      : EMPTY.quote,
    deal: d
      ? {
          acceptedProposalCount: Number(d.accepted_proposal_count ?? 0),
          avgQuotedPhp: num(d.avg_quoted_php),
          bookedPricedCount: Number(d.booked_priced_count ?? 0),
          avgContractPhp: num(d.avg_contract_php),
          totalContractPhp: Number(d.total_contract_php ?? 0),
        }
      : EMPTY.deal,
    lead: l
      ? {
          bookedWithDateCount: Number(l.booked_with_date_count ?? 0),
          avgLeadDays: num(l.avg_lead_days),
          medianLeadDays: num(l.median_lead_days),
        }
      : EMPTY.lead,
    winLoss: w
      ? {
          bookingsWon: Number(w.bookings_won ?? 0),
          inquiriesDeclined: Number(w.inquiries_declined ?? 0),
          quotesLost: Number(w.quotes_lost ?? 0),
          winRateOfDecided: num(w.win_rate_of_decided),
        }
      : EMPTY.winLoss,
  };
}

/** Hours → "3h" / "2.5 days" / "45m". null → em dash handled by caller. */
export function formatDuration(hours: number | null): string {
  if (hours === null || hours < 0) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round((hours / 24) * 10) / 10} days`;
}
