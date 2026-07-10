import {
  ScanSearch,
  ArrowUpRight,
  Check,
  X,
  ShieldAlert,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  resolveRepostFlag,
  rescanAllRepostWatch,
  scanQrMediaGuard,
  resolveQrMediaFlag,
} from './actions';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Repost watch · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/repost-watch — Setnayan moderator queue for the on-platform
 * reverse-image repost-detection signal (migration 20270330665855). A flag = a
 * newly-uploaded vendor image whose 64-bit DCT pHash matched (Hamming <= the
 * admin-managed threshold) an OLDER image owned by a DIFFERENT, non-demo vendor.
 *
 * Detect-and-flag ONLY — resolving a flag records a verdict; it NEVER auto-hides
 * or deletes a vendor's image. With the founder-only pilot (~1 real vendor + a
 * demo set) this stays dormant until a 2nd real vendor onboards, and is empty
 * until "Rescan all" backfills the existing images.
 *
 * Auth is enforced at the layout level (app/admin/layout.tsx → notFound() for
 * non-admins), same as every other /admin surface.
 */

type FlagRow = {
  id: number;
  public_id: string;
  flagged_vendor_id: string;
  flagged_r2_ref: string;
  flagged_surface: 'service_primary' | 'portfolio';
  source_vendor_id: string;
  source_r2_ref: string;
  source_surface: 'service_primary' | 'portfolio';
  hamming_distance: number;
  status: 'open' | 'dismissed' | 'confirmed_theft' | 'escalated';
  resolution_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type QrFlagRow = {
  id: number;
  public_id: string;
  vendor_profile_id: string;
  r2_ref: string;
  surface: 'portfolio' | 'logo' | 'microsite_hero' | 'service_primary' | 'service_showcase';
  decoded_payload: string;
  resolved_url: string | null;
  status: 'open' | 'cleared' | 'removed';
  resolution_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const QR_SURFACE_LABEL: Record<QrFlagRow['surface'], string> = {
  portfolio: 'Portfolio',
  logo: 'Logo',
  microsite_hero: 'Website hero',
  service_primary: 'Service cover',
  service_showcase: 'Service showcase',
};

type StatusFilter = 'all' | 'open' | 'confirmed_theft' | 'dismissed' | 'escalated';

const STATUS_LABEL: Record<FlagRow['status'], string> = {
  open: 'Open',
  dismissed: 'Dismissed',
  confirmed_theft: 'Confirmed theft',
  escalated: 'Escalated',
};
const STATUS_TONE: Record<FlagRow['status'], string> = {
  open: 'bg-warn-100 text-warn-900',
  dismissed: 'bg-ink/10 text-ink/60',
  confirmed_theft: 'bg-terracotta/10 text-terracotta-700',
  escalated: 'bg-warn-50 text-warn-900',
};

const SURFACE_LABEL: Record<FlagRow['flagged_surface'], string> = {
  service_primary: 'Service cover',
  portfolio: 'Portfolio',
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'confirmed_theft', label: 'Confirmed' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

function normalizeStatus(raw: string): StatusFilter {
  return (
    ['all', 'open', 'confirmed_theft', 'dismissed', 'escalated'] as const
  ).includes(raw as StatusFilter)
    ? (raw as StatusFilter)
    : 'open';
}

/** Distance tone: tighter match = more suspicious. */
function distanceTone(d: number): string {
  if (d <= 6) return 'bg-terracotta/10 text-terracotta-700';
  if (d <= 10) return 'bg-warn-100 text-warn-900';
  return 'bg-ink/10 text-ink/60';
}

export default async function AdminRepostWatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    rescanned?: string;
    refs?: string;
    rematched?: string;
    flagged?: string;
    qr_vendors?: string;
    qr_refs?: string;
    qr_flagged?: string;
    qr_videos?: string;
  }>;
}) {
  await requireAdmin();
  const search = await searchParams;
  const status = normalizeStatus(search.status ?? 'open');

  const admin = createAdminClient();

  let listQuery = admin
    .from('vendor_image_flags')
    .select(
      'id, public_id, flagged_vendor_id, flagged_r2_ref, flagged_surface, source_vendor_id, source_r2_ref, source_surface, hamming_distance, status, resolution_notes, reviewed_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'all') listQuery = listQuery.eq('status', status);
  const { data: listData, error: listError } = await listQuery;
  if (listError) logQueryError('AdminRepostWatchPage (vendor_image_flags)', listError);
  const rows = (listData ?? []) as FlagRow[];

  // Resolve vendor business names + presign every flagged/source image, one
  // parallel batch keyed on the visible page.
  const vendorIds = Array.from(
    new Set(rows.flatMap((r) => [r.flagged_vendor_id, r.source_vendor_id])),
  );
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

  // Presign both images for each row in parallel.
  const imageEntries = await Promise.all(
    rows.flatMap((r) => [
      (async () =>
        [`flagged-${r.id}`, await displayUrlForStoredAsset(r.flagged_r2_ref)] as const)(),
      (async () =>
        [`source-${r.id}`, await displayUrlForStoredAsset(r.source_r2_ref)] as const)(),
    ]),
  );
  const imageUrl = new Map<string, string | null>();
  for (const [k, url] of imageEntries) imageUrl.set(k, url);

  const openCount = rows.filter((r) => r.status === 'open').length;

  // QR-in-media guard queue (owner-locked 2026-07-03) — retro-scan hits on
  // already-uploaded website media containing a vendor-funnel QR. Open flags
  // lead; the latest resolved few give resolution context.
  const { data: qrData, error: qrError } = await admin
    .from('vendor_qr_media_flags')
    .select(
      'id, public_id, vendor_profile_id, r2_ref, surface, decoded_payload, resolved_url, status, resolution_notes, reviewed_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (qrError) logQueryError('AdminRepostWatchPage (vendor_qr_media_flags)', qrError);
  const qrRowsAll = ((qrData ?? []) as QrFlagRow[]).sort(
    (a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1),
  );
  const qrOpen = qrRowsAll.filter((r) => r.status === 'open');
  const qrResolvedRecent = qrRowsAll.filter((r) => r.status !== 'open').slice(0, 5);
  const qrRows = [...qrOpen, ...qrResolvedRecent];

  const qrVendorIds = Array.from(new Set(qrRows.map((r) => r.vendor_profile_id)));
  const { data: qrVendorData } = qrVendorIds.length
    ? await admin
        .from('vendor_profiles')
        .select('vendor_profile_id, business_name')
        .in('vendor_profile_id', qrVendorIds)
    : { data: [] as { vendor_profile_id: string; business_name: string | null }[] };
  const qrVendorName = new Map<string, string>();
  for (const v of qrVendorData ?? []) {
    qrVendorName.set(
      v.vendor_profile_id,
      ((v.business_name as string | null) ?? '').trim() || 'Unnamed vendor',
    );
  }
  const qrImageEntries = await Promise.all(
    qrRows.map(
      async (r) => [r.id, await displayUrlForStoredAsset(r.r2_ref)] as const,
    ),
  );
  const qrImageUrl = new Map<number, string | null>();
  for (const [id, url] of qrImageEntries) qrImageUrl.set(id, url);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScanSearch className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            <h1 className="text-2xl font-semibold tracking-tight">Repost watch</h1>
          </div>
          <form action={rescanAllRepostWatch}>
            <SubmitButton
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-ink/[0.04]"
              pendingLabel="Rescanning…"
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Rescan all
            </SubmitButton>
          </form>
        </div>
        <p className="text-sm text-ink/65">
          Cross-vendor reverse-image matches — a vendor&apos;s newly-uploaded
          portfolio / service-cover image whose perceptual hash matches an older
          image owned by a <span className="font-medium">different</span> vendor.
          Detect-and-review only: resolving a flag records a verdict and never
          touches the image. Demo vendors and same-vendor matches are excluded.
          The latest 200 matching the filter, newest first.
        </p>
      </header>

      {(search.rescanned !== undefined) && (
        <div className="mb-4">
          <FormFlash tone="success">
            Rescan complete — {search.rescanned ?? '0'} real vendor(s),{' '}
            {search.refs ?? '0'} image(s) considered;{' '}
            {search.rematched ?? '0'} hashed image(s) re-matched at the current
            threshold. New matches (if any) appear below.
          </FormFlash>
        </div>
      )}

      {(search.qr_vendors !== undefined) && (
        <div className="mb-4">
          <FormFlash tone="success">
            QR scan complete — {search.qr_vendors ?? '0'} real vendor(s),{' '}
            {search.qr_refs ?? '0'} image(s) scanned, {search.qr_flagged ?? '0'}{' '}
            new flag(s). {search.qr_videos ?? '0'} showcase video(s) skipped
            (videos are checked at upload time, not in the sweep).
          </FormFlash>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <a
            key={f.value}
            href={`/admin/repost-watch?status=${f.value}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              status === f.value
                ? 'bg-ink text-cream'
                : 'border border-ink/15 text-ink/70 hover:bg-ink/[0.04]'
            }`}
          >
            {f.label}
            {f.value === 'open' && openCount > 0 ? ` · ${openCount}` : ''}
          </a>
        ))}
      </div>

      {listError && (
        <FormFlash tone="error">
          Flags couldn&apos;t load right now. We&apos;ve logged the issue —
          refresh in a moment.
        </FormFlash>
      )}

      {rows.length === 0 ? (
        <p className="rounded-md border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/65">
          No flags in this view. With the founder-only pilot this stays empty
          until a second real vendor onboards — use “Rescan all” to hash existing
          images.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const flaggedName = vendorName.get(r.flagged_vendor_id) ?? 'Vendor';
            const sourceName = vendorName.get(r.source_vendor_id) ?? 'Vendor';
            const flaggedUrl = imageUrl.get(`flagged-${r.id}`) ?? null;
            const sourceUrl = imageUrl.get(`source-${r.id}`) ?? null;
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${distanceTone(r.hamming_distance)}`}
                  >
                    Hamming {r.hamming_distance}/64
                  </span>
                  <span className="font-mono text-[10px] text-ink/45">{r.public_id}</span>
                  <span className="text-[11px] text-ink/50">
                    {relativeTime(r.created_at)}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Likely reposter — the NEW upload. */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-terracotta-700">
                      Newly uploaded
                    </p>
                    <div className="aspect-video w-full overflow-hidden rounded-xl bg-ink/[0.04]">
                      {flaggedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={flaggedUrl}
                          alt="Newly uploaded vendor image"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-ink/40">
                          image unavailable
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-ink/80">
                      <span className="font-medium">{flaggedName}</span>
                      {' · '}
                      <span className="text-ink/55">{SURFACE_LABEL[r.flagged_surface]}</span>
                    </p>
                  </div>

                  {/* Likely victim — first seen. */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink/60">
                      Seen earlier on
                    </p>
                    <div className="aspect-video w-full overflow-hidden rounded-xl bg-ink/[0.04]">
                      {sourceUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sourceUrl}
                          alt="Earlier vendor image"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-ink/40">
                          image unavailable
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-ink/80">
                      <span className="font-medium">{sourceName}</span>
                      {' · '}
                      <span className="text-ink/55">{SURFACE_LABEL[r.source_surface]}</span>
                    </p>
                  </div>
                </div>

                {r.status !== 'open' && r.resolution_notes && (
                  <p className="mt-3 text-xs text-ink/55">
                    {r.resolution_notes}
                    {r.reviewed_at ? ` · ${relativeTime(r.reviewed_at)}` : ''}
                  </p>
                )}

                {r.status === 'open' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={resolveRepostFlag} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="flag_id" value={r.id} />
                      <input
                        type="text"
                        name="note"
                        placeholder="Optional note…"
                        maxLength={500}
                        className="min-w-0 flex-1 rounded-md border border-ink/15 bg-cream px-2.5 py-1.5 text-xs text-ink/80 placeholder:text-ink/40 sm:w-48 sm:flex-none"
                      />
                      <button
                        type="submit"
                        name="action"
                        value="confirm_theft"
                        className="inline-flex items-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-1.5 text-xs font-medium text-terracotta-700 hover:bg-terracotta/10"
                      >
                        <ShieldAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        Confirm theft
                      </button>
                      <button
                        type="submit"
                        name="action"
                        value="escalate"
                        className="inline-flex items-center gap-1.5 rounded-md border border-warn-300 bg-warn-50 px-3 py-1.5 text-xs font-medium text-warn-900 hover:bg-warn-100"
                      >
                        <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        Escalate
                      </button>
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
                    <a
                      href={`/admin/vendors/${r.flagged_vendor_id}`}
                      className="text-xs font-medium text-ink/55 underline-offset-2 hover:underline"
                    >
                      Open vendor →
                    </a>
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

      {/* ── QR-in-media guard (owner-locked 2026-07-03) ─────────────────── */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            <h2 className="text-lg font-semibold tracking-tight">QR-in-media guard</h2>
            {qrOpen.length > 0 && (
              <span className="rounded-full bg-warn-100 px-2 py-0.5 text-[11px] font-medium text-warn-900">
                {qrOpen.length} open
              </span>
            )}
          </div>
          <form action={scanQrMediaGuard}>
            <SubmitButton
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-ink/[0.04]"
              pendingLabel="Scanning…"
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Scan QR
              codes
            </SubmitButton>
          </form>
        </div>
        <p className="mb-4 text-sm text-ink/65">
          Vendor-website media (portfolio, logo, hero, service photos) containing a
          QR that targets the vendor&apos;s invite / lock funnel — directly or via a
          link shortener. New uploads are rejected at save time; this sweep covers
          media uploaded before the guard shipped. Review-only: resolving a flag
          never touches the image.
        </p>

        {qrError && (
          <FormFlash tone="error">
            QR flags couldn&apos;t load right now. We&apos;ve logged the issue —
            refresh in a moment.
          </FormFlash>
        )}

        {qrRows.length === 0 ? (
          <p className="rounded-md border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/65">
            No QR flags. Run “Scan QR codes” to sweep already-uploaded vendor
            media.
          </p>
        ) : (
          <ul className="space-y-4">
            {qrRows.map((r) => {
              const url = qrImageUrl.get(r.id) ?? null;
              const vendorLabel = qrVendorName.get(r.vendor_profile_id) ?? 'Vendor';
              return (
                <li
                  key={`qr-${r.id}`}
                  className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        r.status === 'open'
                          ? 'bg-warn-100 text-warn-900'
                          : r.status === 'removed'
                            ? 'bg-terracotta/10 text-terracotta-700'
                            : 'bg-ink/10 text-ink/60'
                      }`}
                    >
                      {r.status === 'open'
                        ? 'Open'
                        : r.status === 'removed'
                          ? 'Removed'
                          : 'Cleared'}
                    </span>
                    <span className="font-mono text-[10px] text-ink/45">
                      {r.public_id}
                    </span>
                    <span className="text-[11px] text-ink/50">
                      {relativeTime(r.created_at)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
                    <div className="aspect-square w-full max-w-[10rem] overflow-hidden rounded-xl bg-ink/[0.04]">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt="Flagged vendor media"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-ink/40">
                          image unavailable
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-sm text-ink/80">
                        <span className="font-medium">{vendorLabel}</span>
                        {' · '}
                        <span className="text-ink/55">{QR_SURFACE_LABEL[r.surface]}</span>
                      </p>
                      <p className="break-all font-mono text-xs text-ink/60">
                        QR → {r.decoded_payload}
                      </p>
                      {r.resolved_url && (
                        <p className="break-all font-mono text-xs text-terracotta-700">
                          resolves to → {r.resolved_url}
                        </p>
                      )}
                      {r.status !== 'open' && r.resolution_notes && (
                        <p className="text-xs text-ink/55">
                          {r.resolution_notes}
                          {r.reviewed_at ? ` · ${relativeTime(r.reviewed_at)}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {r.status === 'open' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <form
                        action={resolveQrMediaFlag}
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
                        <button
                          type="submit"
                          name="action"
                          value="mark_removed"
                          className="inline-flex items-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-1.5 text-xs font-medium text-terracotta-700 hover:bg-terracotta/10"
                        >
                          <ShieldAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                          Media removed
                        </button>
                        <button
                          type="submit"
                          name="action"
                          value="clear"
                          className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-ink/[0.04]"
                        >
                          <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                          Clear
                        </button>
                      </form>
                      <a
                        href={`/admin/vendors/${r.vendor_profile_id}`}
                        className="text-xs font-medium text-ink/55 underline-offset-2 hover:underline"
                      >
                        Open vendor →
                      </a>
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
      </section>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Source · reverse-image repost-watch · tables <code>vendor_image_hashes</code>{' '}
        + <code>vendor_image_flags</code> (migration 20270330665855) · 64-bit DCT
        pHash · detect-and-review only · QR-in-media guard ·{' '}
        <code>vendor_qr_media_flags</code> (migration 20270504200000) ·
        reject-at-save + retro-scan
      </p>
    </div>
  );
}
