import {
  ShieldCheck,
  Star,
  Store,
  RefreshCw,
  ShieldAlert,
  EyeOff,
  X,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import {
  resolveIntegrityFlag,
  rescanReviewsForFraud,
  rescanGhostListings,
} from './actions';
import {
  REVIEW_FRAUD_REASON_LABEL,
  type ReviewFraudDetail,
} from '@/lib/review-fraud-scoring';
import {
  GHOST_LISTING_REASON_LABEL,
  type GhostListingDetail,
} from '@/lib/ghost-listing-scoring';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Integrity watch · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/integrity-watch — Setnayan moderator queue for the review-fraud +
 * ghost-listing integrity signals (migration 20270412000042 · table
 * integrity_flags). Two tabs:
 *
 *   · Reviews  — vendor_reviews rows scored by lib/review-fraud-screener.ts
 *     (velocity/burst · rating anomaly · reviewer device cluster). Populated by
 *     an after() task on every review submit — NO cron.
 *   · Listings — vendor_profiles rows scored by lib/ghost-listing-detector.ts
 *     (no logo · no active services · never answered · long dormant · duplicate
 *     identity). Populated by the "Rescan listings" action.
 *
 * Detect-and-review ONLY: resolving a flag records a verdict; the only action
 * that touches a subject is "Hide listing" (un-publishes a confirmed ghost),
 * always an explicit admin click. A review flag NEVER auto-deletes the review.
 *
 * Auth is enforced at the layout level (app/admin/layout.tsx → notFound() for
 * non-admins), same as every other /admin surface.
 */

type FlagStatus = 'open' | 'dismissed' | 'confirmed_fraud' | 'listing_hidden';

type FlagRow = {
  id: number;
  public_id: string;
  kind: 'review_fraud' | 'ghost_listing';
  subject_vendor_id: string;
  subject_review_id: string | null;
  score: number;
  reason: string;
  detail: ReviewFraudDetail | GhostListingDetail | Record<string, unknown>;
  status: FlagStatus;
  resolution_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type Tab = 'reviews' | 'listings';
type StatusFilter = 'open' | 'confirmed' | 'dismissed' | 'all';

const STATUS_LABEL: Record<FlagStatus, string> = {
  open: 'Open',
  dismissed: 'Dismissed',
  confirmed_fraud: 'Confirmed fraud',
  listing_hidden: 'Listing hidden',
};
const STATUS_TONE: Record<FlagStatus, string> = {
  open: 'bg-warn-100 text-warn-900',
  dismissed: 'bg-ink/10 text-ink/60',
  confirmed_fraud: 'bg-terracotta/10 text-terracotta-700',
  listing_hidden: 'bg-terracotta/10 text-terracotta-700',
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'confirmed', label: 'Actioned' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

function normalizeTab(raw: string | undefined): Tab {
  return raw === 'listings' ? 'listings' : 'reviews';
}
function normalizeStatus(raw: string | undefined): StatusFilter {
  return (['open', 'confirmed', 'dismissed', 'all'] as const).includes(
    raw as StatusFilter,
  )
    ? (raw as StatusFilter)
    : 'open';
}

/** Score tone: higher = more suspicious. */
function scoreTone(s: number): string {
  if (s >= 70) return 'bg-terracotta/10 text-terracotta-700';
  if (s >= 55) return 'bg-warn-100 text-warn-900';
  return 'bg-ink/10 text-ink/60';
}

function reasonLabel(kind: FlagRow['kind'], reason: string): string {
  const map =
    kind === 'review_fraud' ? REVIEW_FRAUD_REASON_LABEL : GHOST_LISTING_REASON_LABEL;
  return map[reason] ?? reason;
}

/** Compact non-PII evidence chips from the detail JSONB. */
function evidenceChips(row: FlagRow): string[] {
  const d = row.detail as Record<string, unknown>;
  const chips: string[] = [];
  if (row.kind === 'review_fraud') {
    const rd = d as unknown as ReviewFraudDetail;
    if (rd.burst?.others_in_window)
      chips.push(
        `${rd.burst.others_in_window} other review(s) in ${rd.burst.window_hours}h`,
      );
    if (rd.anomaly?.delta != null && rd.anomaly.vendor_mean != null)
      chips.push(
        `rating off norm by ${rd.anomaly.delta.toFixed(1)} (mean ${rd.anomaly.vendor_mean.toFixed(1)})`,
      );
    if (rd.linkage?.peer_reviewer_count)
      chips.push(`shares a device with ${rd.linkage.peer_reviewer_count} reviewer(s)`);
  } else {
    const gd = d as unknown as GhostListingDetail;
    if (gd.has_logo === false) chips.push('no logo');
    if (gd.active_service_count === 0) chips.push('no active services');
    if (gd.unanswered)
      chips.push(`${gd.inbound_message_count} message(s), 0 replies`);
    if (gd.dormant_days > 120) chips.push(`dormant ${gd.dormant_days}d`);
    if (gd.duplicate_of_count) chips.push(`duplicate of ${gd.duplicate_of_count} listing(s)`);
  }
  return chips;
}

export default async function AdminIntegrityWatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    scanned?: string;
    flagged?: string;
  }>;
}) {
  await requireAdmin();
  const search = await searchParams;
  const tab = normalizeTab(search.tab);
  const status = normalizeStatus(search.status);
  const kind = tab === 'reviews' ? 'review_fraud' : 'ghost_listing';

  const admin = createAdminClient();

  let listQuery = admin
    .from('integrity_flags')
    .select(
      'id, public_id, kind, subject_vendor_id, subject_review_id, score, reason, detail, status, resolution_notes, reviewed_at, created_at',
    )
    .eq('kind', kind)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (status === 'open') listQuery = listQuery.eq('status', 'open');
  else if (status === 'dismissed') listQuery = listQuery.eq('status', 'dismissed');
  else if (status === 'confirmed')
    listQuery = listQuery.in('status', ['confirmed_fraud', 'listing_hidden']);

  const { data: listData, error: listError } = await listQuery;
  if (listError) logQueryError('AdminIntegrityWatchPage (integrity_flags)', listError);
  const rows = (listData ?? []) as FlagRow[];

  // Resolve vendor business names for the visible page.
  const vendorIds = Array.from(new Set(rows.map((r) => r.subject_vendor_id)));
  const { data: vendorData } = vendorIds.length
    ? await admin
        .from('vendor_profiles')
        .select('vendor_profile_id, business_name')
        .in('vendor_profile_id', vendorIds)
    : { data: [] as { vendor_profile_id: string; business_name: string | null }[] };
  const vendorName = new Map<string, string>();
  for (const v of vendorData ?? []) {
    vendorName.set(
      v.vendor_profile_id,
      ((v.business_name as string | null) ?? '').trim() || 'Unnamed vendor',
    );
  }

  // Open counts per tab (for the tab badges).
  const { count: openReviews } = await admin
    .from('integrity_flags')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'review_fraud')
    .eq('status', 'open');
  const { count: openListings } = await admin
    .from('integrity_flags')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'ghost_listing')
    .eq('status', 'open');

  const rescanAction = tab === 'reviews' ? rescanReviewsForFraud : rescanGhostListings;
  const rescanLabel = tab === 'reviews' ? 'Rescan reviews' : 'Rescan listings';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            <h1 className="text-2xl font-semibold tracking-tight">Integrity watch</h1>
          </div>
          <form action={rescanAction}>
            <SubmitButton
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-ink/[0.04]"
              pendingLabel="Rescanning…"
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />{' '}
              {rescanLabel}
            </SubmitButton>
          </form>
        </div>
        <p className="text-sm text-ink/65">
          Deterministic fraud + ghost-listing screening. <span className="font-medium">Reviews</span>{' '}
          scores every submitted review on velocity/burst, rating anomaly, and
          shared-device reviewer clusters; <span className="font-medium">Listings</span>{' '}
          flags placeholder / abandoned / duplicate marketplace listings.
          Detect-and-review only — resolving records a verdict; a review flag
          never auto-deletes the review, and a listing is only hidden on an
          explicit click. Demo vendors are excluded.
        </p>
      </header>

      {search.scanned !== undefined && (
        <div className="mb-4">
          <FormFlash tone="success">
            Rescan complete — {search.scanned ?? '0'}{' '}
            {tab === 'reviews' ? 'review(s)' : 'listing(s)'} scanned;{' '}
            {search.flagged ?? '0'} new flag(s). New matches (if any) appear below.
          </FormFlash>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/admin/integrity-watch?tab=reviews"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
            tab === 'reviews'
              ? 'bg-ink text-cream'
              : 'border border-ink/15 text-ink/70 hover:bg-ink/[0.04]'
          }`}
        >
          <Star aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Reviews
          {openReviews ? ` · ${openReviews}` : ''}
        </Link>
        <Link
          href="/admin/integrity-watch?tab=listings"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
            tab === 'listings'
              ? 'bg-ink text-cream'
              : 'border border-ink/15 text-ink/70 hover:bg-ink/[0.04]'
          }`}
        >
          <Store aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Listings
          {openListings ? ` · ${openListings}` : ''}
        </Link>
      </div>

      {/* Status filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/integrity-watch?tab=${tab}&status=${f.value}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              status === f.value
                ? 'bg-ink text-cream'
                : 'border border-ink/15 text-ink/70 hover:bg-ink/[0.04]'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {listError && (
        <FormFlash tone="error">
          Flags couldn&apos;t load right now. We&apos;ve logged the issue — refresh
          in a moment.
        </FormFlash>
      )}

      {rows.length === 0 ? (
        <p className="rounded-md border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/65">
          No flags in this view.
          {tab === 'listings'
            ? ' Use “Rescan listings” to sweep the marketplace.'
            : ' Reviews are screened automatically on submit — use “Rescan reviews” to backfill historical ones.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const name = vendorName.get(r.subject_vendor_id) ?? 'Vendor';
            const chips = evidenceChips(r);
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${scoreTone(r.score)}`}
                  >
                    Score {r.score}/100
                  </span>
                  <span className="font-mono text-[10px] text-ink/45">{r.public_id}</span>
                  <span className="text-[11px] text-ink/50">{relativeTime(r.created_at)}</span>
                </div>

                <p className="text-sm text-ink/85">
                  <span className="font-medium">{name}</span>
                  {' · '}
                  <span className="text-ink/60">{reasonLabel(r.kind, r.reason)}</span>
                </p>

                {chips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chips.map((c, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[11px] text-ink/65"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {r.status !== 'open' && r.resolution_notes && (
                  <p className="mt-3 text-xs text-ink/55">
                    {r.resolution_notes}
                    {r.reviewed_at ? ` · ${relativeTime(r.reviewed_at)}` : ''}
                  </p>
                )}

                {r.status === 'open' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form
                      action={resolveIntegrityFlag}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="flag_id" value={r.id} />
                      <input
                        type="text"
                        name="note"
                        placeholder="Optional note…"
                        maxLength={500}
                        className="min-w-0 flex-1 rounded-md border border-ink/15 bg-cream px-2.5 py-1.5 text-xs text-ink/80 placeholder:text-ink/40 sm:w-48 sm:flex-none"
                      />
                      {r.kind === 'review_fraud' ? (
                        <button
                          type="submit"
                          name="action"
                          value="confirm_fraud"
                          className="inline-flex items-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-1.5 text-xs font-medium text-terracotta-700 hover:bg-terracotta/10"
                        >
                          <ShieldAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                          Confirm fraud
                        </button>
                      ) : (
                        <button
                          type="submit"
                          name="action"
                          value="hide_listing"
                          className="inline-flex items-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-1.5 text-xs font-medium text-terracotta-700 hover:bg-terracotta/10"
                        >
                          <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                          Hide listing
                        </button>
                      )}
                      <button
                        type="submit"
                        name="action"
                        value="dismiss"
                        className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-ink/[0.04]"
                      >
                        <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        Dismiss
                      </button>
                    </form>
                    <Link
                      href={`/admin/vendors/${r.subject_vendor_id}`}
                      className="text-xs font-medium text-ink/55 underline-offset-2 hover:underline"
                    >
                      Open vendor →
                    </Link>
                  </div>
                )}
                {r.status !== 'open' && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-success-700">
                    <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Resolved
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Source · review-fraud screener + ghost-listing detector · table{' '}
        <code>integrity_flags</code> (migration 20270412000042) · deterministic ·
        detect-and-review only · non-PII evidence
      </p>
    </div>
  );
}
