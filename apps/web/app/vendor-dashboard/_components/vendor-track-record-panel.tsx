import { CalendarHeart, Star } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCount } from '@/lib/format-number';
import { TemplateRows } from '@/app/_components/template-rows';
import { ToolChip, ToolLead, ToolRow, ToolSection } from './tool-page';

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
 * Fetch the calling vendor's completed-events breakdown by event type.
 *
 * 🔴 NULL MEANS "COULD NOT READ", NEVER "NONE" (controller 21 Nov 2026, the tool pages redraw v3). This returned [] when
 * its RPC errored, and the page then said "No completed events yet" to a supplier with a real record. A refused read is
 * `null`; only a read that ran returns rows (or [] for a shop with none yet).
 * 🔒 app/vendor-dashboard/a-failed-tool-read-is-never-clean.test.ts
 */
export async function fetchVendorTrackRecord(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorTrackRecordRow[] | null> {
  const { data, error } = await supabase.rpc(
    'vendor_track_record_by_event_type',
    { p_vendor_profile_id: vendorProfileId },
  );
  if (error || !Array.isArray(data)) {
    // Logged for Sentry, and said on the page (`ToolFail`) — a log line never changed a pixel.
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[VendorTrackRecordPanel] RPC failed', {
        vendor_profile_id: vendorProfileId,
        error: error.message,
      });
    }
    return null;
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
    <ToolRow
      data={row.event_type}
      lead={
        <ToolLead>
          <CalendarHeart className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </ToolLead>
      }
      title={label}
      lines={[
        <>
          {formatCount(row.completed_count)} completed
          {hasRating ? (
            <>
              {' · '}
              {formatCount(row.review_count)} review{row.review_count === 1 ? '' : 's'}
            </>
          ) : null}
        </>,
        hasRating ? null : (
          <span key="n" className="mt-1 inline-flex">
            <ToolChip tone="quiet">No reviews yet</ToolChip>
          </span>
        ),
      ]}
      right={
        hasRating ? (
          <span className="inline-flex items-center gap-1 text-[15px] font-bold tabular-nums text-ink">
            {/* Gold is the rating star only — never words (the drawing's one gold). */}
            <Star className="h-3.5 w-3.5 fill-current" style={{ color: 'var(--sn-gold-500)' }} strokeWidth={0} aria-hidden />
            {(row.avg_rating ?? 0).toFixed(1)}
          </span>
        ) : null
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Main export — server component
// ---------------------------------------------------------------------------

/**
 * "Across life events" — the redraw's label (v3, 21 Nov 2026): the old "Your track record across life events" is the ⓘ's
 * name. Renders nothing when the vendor has no completed events (so it stays invisible on brand-new profiles); the page
 * says the empty line and the failed read itself. Hand it the rows the page already read.
 */
export function VendorTrackRecordPanel({ rows }: { rows: VendorTrackRecordRow[] }) {
  if (rows.length === 0) return null;

  const total = totalCompleted(rows);

  return (
    <ToolSection
      label="Across life events"
      tip="Your track record across life events. Counts include only real, delivered bookings from couples — never your own or your team’s events. Ratings average the reviews left on those events."
      right={
        <span className="tabular-nums">
          {formatCount(total)} completed · {formatCount(rows.length)} type{rows.length === 1 ? '' : 's'}
        </span>
      }
      data="track-record"
    >
      <TemplateRows label="Your track record across life events">
        {rows.map((row) => (
          <TrackRecordRow key={row.event_type} row={row} />
        ))}
      </TemplateRows>
    </ToolSection>
  );
}
