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

/** The spread tile's percentile — "90% of replies land within" is `p90Minutes`, named once. */
export const REPLY_SPREAD_PCT = 90;

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

  const missedRow = firstRow<MissedRow>(missedRes);

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
    missed: missedRow ? missedOf(missedRow) : EMPTY.missed,
    heatmap: heatOf(heatRows),
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

type MissedRow = {
  declined: number | null;
  unanswered_over_sla: number | null;
  self_reported_no_response: number | null;
  waitlisted: number | null;
};

const missedOf = (r: MissedRow): InquiryMissed => ({
  declined: Number(r.declined ?? 0),
  unansweredOverSla: Number(r.unanswered_over_sla ?? 0),
  selfReportedNoResponse: Number(r.self_reported_no_response ?? 0),
  waitlisted: Number(r.waitlisted ?? 0),
});

const heatOf = (rows: readonly { dow: number | null; hr: number | null; inquiry_count: number | null }[]): InquiryHeatCell[] =>
  rows.map((r) => ({ dow: Number(r.dow ?? 0), hr: Number(r.hr ?? 0), count: Number(r.inquiry_count ?? 0) }));

/**
 * 🔑 THE HONEST SINGLE READS (the Store's graphs, owner 23 Nov 2026): the same two RPCs as the bundle above, one at a
 * time, and `null` when the RPC refused — never the bundle's empty shape, which a graph would draw as a real zero.
 */
export async function fetchInquiryMissed(supabase: SupabaseClient, vendorProfileId: string, sinceIso: string | null): Promise<InquiryMissed | null> {
  const { data, error } = await supabase.rpc('vendor_inquiry_missed', { p_vendor_profile_id: vendorProfileId, p_since: sinceIso });
  if (error || !Array.isArray(data)) {
    console.error('[vendor-inquiry-analytics] missed rpc failed', { vendor_profile_id: vendorProfileId, error: error?.message ?? 'no rows' });
    return null;
  }
  const row = (data as MissedRow[])[0];
  return row ? missedOf(row) : missedOf({ declined: 0, unanswered_over_sla: 0, self_reported_no_response: 0, waitlisted: 0 });
}

/** Inquiries by Manila weekday × hour since `sinceIso` — `null` when the RPC refused. */
export async function fetchInquiryHeatmap(supabase: SupabaseClient, vendorProfileId: string, sinceIso: string | null): Promise<InquiryHeatCell[] | null> {
  const { data, error } = await supabase.rpc('vendor_inquiry_heatmap', { p_vendor_profile_id: vendorProfileId, p_since: sinceIso });
  if (error || !Array.isArray(data)) {
    console.error('[vendor-inquiry-analytics] heatmap rpc failed', { vendor_profile_id: vendorProfileId, error: error?.message ?? 'no rows' });
    return null;
  }
  return heatOf(data as { dow: number | null; hr: number | null; inquiry_count: number | null }[]);
}

/** Philippine-time heat: rows Monday → Sunday, eight 3-hour blocks (12a 3a 6a 9a 12p 3p 6p 9p). `null` = no inquiry. */
export function heatGrid(cells: readonly InquiryHeatCell[]): number[][] | null {
  const g = Array.from({ length: 7 }, () => Array(8).fill(0) as number[]);
  let any = false;
  for (const c of cells) {
    // dow: 0 = Sunday (Postgres extract(dow)) → row 6; Monday → row 0.
    const row = (c.dow + 6) % 7;
    const col = Math.floor(c.hr / 3);
    if (row < 0 || row > 6 || col < 0 || col > 7) continue;
    g[row]![col]! += c.count;
    if (c.count > 0) any = true;
  }
  return any ? g : null;
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
