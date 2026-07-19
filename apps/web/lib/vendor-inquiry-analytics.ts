/**
 * Inquiry-handling analytics reader (vendor "My Performance" · Phase B family 1).
 *
 * Wraps four ownership-gated SECURITY DEFINER RPCs (migration
 * 20270421213000_vendor_inquiry_analytics_rpcs) into one bundle for the
 * InquiryHandlingCard. All four are OWN-BUSINESS only — each RPC filters to the
 * caller's own vendor_profile_id in SQL, so this surface never sees another
 * business's inquiries. Pro tier (canSeePerformanceAdvanced), enforced at the
 * page layer.
 *
 * HONESTY notes carried from the schema-discovery pass:
 *   - "missed / unanswered-over-SLA" is a DERIVED judgment (the SLA is an app
 *     threshold, not a stored expiry), and self-reported no_response is opt-in
 *     and sparse — so the missed counts are a floor, not a census. The card
 *     labels them as such.
 *   - token efficiency uses on-platform bookings only (event_vendors), and
 *     vendors settle off-platform, so tokens-per-won can read high when a real
 *     win was never marked booked. Labelled accordingly.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type InquiryReplyStats = {
  /** Threads the vendor has replied to (the distribution's N). */
  answeredCount: number;
  /** Median first-reply time, minutes. null when no answered threads. */
  p50Minutes: number | null;
  /** 90th-percentile first-reply time, minutes. null when no answered threads. */
  p90Minutes: number | null;
  avgMinutes: number | null;
};

export type InquiryMissed = {
  declined: number;
  unansweredOverSla: number;
  selfReportedNoResponse: number;
  waitlisted: number;
};

/** One weekday×hour bucket. dow 0=Sun..6=Sat, hr 0..23 (Asia/Manila). */
export type InquiryHeatCell = {
  dow: number;
  hr: number;
  count: number;
};

export type TokenEfficiency = {
  tokensBurned: number;
  unlockedEvents: number;
  wonEvents: number;
  /** Tokens spent per booking won. null when no wins yet. */
  tokensPerWon: number | null;
};

export type InquiryAnalytics = {
  reply: InquiryReplyStats;
  missed: InquiryMissed;
  heatmap: InquiryHeatCell[];
  tokens: TokenEfficiency;
};

const EMPTY: InquiryAnalytics = {
  reply: { answeredCount: 0, p50Minutes: null, p90Minutes: null, avgMinutes: null },
  missed: { declined: 0, unansweredOverSla: 0, selfReportedNoResponse: 0, waitlisted: 0 },
  heatmap: [],
  tokens: { tokensBurned: 0, unlockedEvents: 0, wonEvents: 0, tokensPerWon: null },
};

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Fetch the caller's inquiry-handling analytics bundle. Every RPC is
 * ownership-gated in SQL; a failed RPC degrades to its empty shape rather than
 * crashing the page (mirrors the other My Performance readers).
 *
 * @param supabase  RLS-scoped session client.
 * @param vendorProfileId  The caller's own vendor profile id.
 * @param sinceIso  Optional lower bound (ISO string) applied to each window.
 */
export async function fetchVendorInquiryAnalytics(
  supabase: SupabaseClient,
  vendorProfileId: string,
  sinceIso?: string | null,
): Promise<InquiryAnalytics> {
  const since = sinceIso ?? null;

  const [replyRes, missedRes, heatRes, tokenRes] = await Promise.all([
    supabase.rpc('vendor_inquiry_reply_stats', {
      p_vendor_profile_id: vendorProfileId,
      p_since: since,
    }),
    supabase.rpc('vendor_inquiry_missed', {
      p_vendor_profile_id: vendorProfileId,
      p_since: since,
    }),
    supabase.rpc('vendor_inquiry_heatmap', {
      p_vendor_profile_id: vendorProfileId,
      p_since: since,
    }),
    supabase.rpc('vendor_token_efficiency', {
      p_vendor_profile_id: vendorProfileId,
      p_since: since,
    }),
  ]);

  const firstRow = <T>(res: { data: unknown; error: unknown }): T | null => {
    if (res.error) {
      // eslint-disable-next-line no-console
      console.error('[vendor-inquiry-analytics] rpc failed', {
        vendor_profile_id: vendorProfileId,
        error: (res.error as { message?: string }).message,
      });
      return null;
    }
    const rows = (res.data ?? []) as T[];
    return rows[0] ?? null;
  };

  const replyRow = firstRow<{
    answered_count: number | null;
    p50_minutes: number | string | null;
    p90_minutes: number | string | null;
    avg_minutes: number | string | null;
  }>(replyRes);

  const missedRow = firstRow<{
    declined: number | null;
    unanswered_over_sla: number | null;
    self_reported_no_response: number | null;
    waitlisted: number | null;
  }>(missedRes);

  const tokenRow = firstRow<{
    tokens_burned: number | string | null;
    unlocked_events: number | null;
    won_events: number | null;
    tokens_per_won: number | string | null;
  }>(tokenRes);

  const heatRows = (heatRes.error ? [] : (heatRes.data ?? [])) as {
    dow: number | null;
    hr: number | null;
    inquiry_count: number | null;
  }[];

  return {
    reply: replyRow
      ? {
          answeredCount: Number(replyRow.answered_count ?? 0),
          p50Minutes: num(replyRow.p50_minutes),
          p90Minutes: num(replyRow.p90_minutes),
          avgMinutes: num(replyRow.avg_minutes),
        }
      : EMPTY.reply,
    missed: missedRow
      ? {
          declined: Number(missedRow.declined ?? 0),
          unansweredOverSla: Number(missedRow.unanswered_over_sla ?? 0),
          selfReportedNoResponse: Number(missedRow.self_reported_no_response ?? 0),
          waitlisted: Number(missedRow.waitlisted ?? 0),
        }
      : EMPTY.missed,
    heatmap: heatRows.map((r) => ({
      dow: Number(r.dow ?? 0),
      hr: Number(r.hr ?? 0),
      count: Number(r.inquiry_count ?? 0),
    })),
    tokens: tokenRow
      ? {
          tokensBurned: Number(tokenRow.tokens_burned ?? 0),
          unlockedEvents: Number(tokenRow.unlocked_events ?? 0),
          wonEvents: Number(tokenRow.won_events ?? 0),
          tokensPerWon: num(tokenRow.tokens_per_won),
        }
      : EMPTY.tokens,
  };
}

/** Minutes → "2h 10m" / "45m" / "just now". null → em dash handled by caller. */
export function formatMinutes(mins: number | null): string {
  if (mins === null || mins < 0) return '—';
  const rounded = Math.round(mins);
  if (rounded < 1) return '<1m';
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
