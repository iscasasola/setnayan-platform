import { CalendarHeart, Star, Trophy } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * vendor-track-record-panel.tsx — "One profile, every life event."
 *
 * WHY: A vendor's completed-events count + review score are surfaced today as a
 * SINGLE blended number (vendor-stats-panel's Experience badge + Review score).
 * But `events.event_type` spans the whole life-event catalog (wedding · debut ·
 * christening · gender_reveal · anniversary · …), and a vendor's cross-life-event
 * reputation is never broken out. A photographer proven at 12 weddings + 3 debuts
 * reads as one flat "15 completed" — losing the story of WHICH kinds of events
 * they excel at. This panel renders that per-event-type breakdown, e.g.
 *   Weddings   12 · ★4.8
 *   Debuts      3 · ★4.6
 *
 * DATA: the `vendor_track_record_by_event_type` RPC (migration
 * 20270415213000). It is read-only, SECURITY DEFINER, and RLS-scoped to the
 * caller via current_vendor_ids() — a vendor only ever sees their OWN breakdown.
 * The RPC composes the exclusion-hardened public.vendor_completed_events view
 * (no self-booking padding) + vendor_reviews, so these counts match the flat
 * public number, just split by type. Only types with >=1 real completed event
 * come back — empty/zero rows are never rendered.
 *
 * DESIGN: server component, single query, graceful null → hidden. Matches the
 * editorial card treatment used across the vendor dashboard (--m-* tokens,
 * cream/ink, mono eyebrow). Deliberately a NEW file — does not touch
 * vendor-stats-panel.tsx.
 */

// ---------------------------------------------------------------------------
// Types + data
// ---------------------------------------------------------------------------

export type VendorTrackRecordRow = {
  event_type: string;
  event_type_label: string;
  completed_count: number;
  review_count: number;
  /** Average of vendor_reviews.rating_overall; null when the type has
   *  completions but no reviews yet. */
  avg_rating: number | null;
};

/**
 * Fetch the calling vendor's completed-events breakdown by event type. Returns
 * [] on any error or when the vendor has no completed events yet — the panel
 * then renders nothing (no misleading zero-state clutter on the home page).
 */
export async function fetchVendorTrackRecord(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorTrackRecordRow[]> {
  const { data, error } = await supabase.rpc(
    'vendor_track_record_by_event_type',
    { p_vendor_profile_id: vendorProfileId },
  );
  if (error || !Array.isArray(data)) {
    // Non-fatal: a stale deploy without the RPC, or a fresh vendor. Log for
    // Sentry capture but never crash the page.
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[VendorTrackRecordPanel] RPC failed', {
        vendor_profile_id: vendorProfileId,
        error: error.message,
      });
    }
    return [];
  }
  return (data as VendorTrackRecordRow[]).filter(
    (r) => r.completed_count > 0,
  );
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** "Weddings" from ("Wedding", 12); pluralizes the label for the count line. */
function pluralizeLabel(label: string, count: number): string {
  if (count === 1) return label;
  // Naive English pluralization — event-type labels are short common nouns
  // (Wedding, Debut, Christening, Birthday, Anniversary, Reunion, Graduation).
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(label)) return `${label}es`;
  return `${label}s`;
}

/** Total completed across every type — the panel's headline figure. */
function totalCompleted(rows: VendorTrackRecordRow[]): number {
  return rows.reduce((sum, r) => sum + r.completed_count, 0);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TrackRecordRow({ row }: { row: VendorTrackRecordRow }) {
  const label = pluralizeLabel(row.event_type_label, row.completed_count);
  const hasRating = row.avg_rating !== null && row.review_count > 0;
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream px-4 py-3">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
      >
        <CalendarHeart className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-ink/55">
          {row.completed_count} completed
          {hasRating ? (
            <>
              {' · '}
              {row.review_count} review{row.review_count === 1 ? '' : 's'}
            </>
          ) : null}
        </p>
      </div>
      {hasRating ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
          <Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} aria-hidden />
          <span className="font-mono text-xs font-semibold tabular-nums">
            {(row.avg_rating ?? 0).toFixed(1)}
          </span>
        </span>
      ) : (
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/35">
          No reviews yet
        </span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main export — server component
// ---------------------------------------------------------------------------

/**
 * "Your track record across life events" panel. Renders nothing when the vendor
 * has no completed events (so it stays invisible on brand-new profiles). Pass an
 * already-loaded rows array to skip the query, or let it fetch.
 */
export async function VendorTrackRecordPanel({
  supabase,
  vendorProfileId,
  rows: passedRows,
}: {
  supabase: SupabaseClient;
  vendorProfileId: string;
  /** Optional pre-loaded rows (avoids a duplicate query when the parent page
   *  already fetched them). Falls back to fetching. */
  rows?: VendorTrackRecordRow[];
}) {
  const rows =
    passedRows ?? (await fetchVendorTrackRecord(supabase, vendorProfileId));

  if (rows.length === 0) return null;

  const total = totalCompleted(rows);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy
            className="h-4 w-4 text-ink/45"
            strokeWidth={1.75}
            aria-hidden
          />
          <h2
            className="font-mono text-[11px] uppercase tracking-[0.18em]"
            style={{ color: 'var(--m-slate)' }}
          >
            Your track record across life events
          </h2>
        </div>
        <span className="text-xs text-ink/45 tabular-nums">
          {total} completed · {rows.length} event type
          {rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <TrackRecordRow key={row.event_type} row={row} />
        ))}
      </ul>

      <p className="text-[10px] text-ink/40">
        Counts include only real, delivered bookings from couples — never your
        own or your team&rsquo;s events. Ratings average the reviews left on
        those events.
      </p>
    </section>
  );
}
