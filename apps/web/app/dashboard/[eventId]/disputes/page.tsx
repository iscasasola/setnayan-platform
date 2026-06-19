import { redirect } from 'next/navigation';
import { AlertTriangle, Paperclip, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { displayUrlsForStoredAssets } from '@/lib/uploads';
import {
  FLAG_TYPES,
  FLAG_TYPE_LABEL,
  FLAG_STATUS_LABEL,
  FLAG_STATUS_TONE,
  formatAutoResolveCountdown,
  sweepAutoResolveStaleFlags,
  type FlagStatus,
  type FlagType,
} from '@/lib/force-majeure';
import { fileForceMajeureFlag } from './actions';

export const metadata = { title: 'Disputes · Setnayan' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ filed?: string; error?: string }>;
};

type FlagRow = {
  flag_id: string;
  public_id: string;
  event_vendor_id: string | null;
  flag_type: FlagType;
  description: string;
  evidence_urls: string[] | null;
  status: FlagStatus;
  resolution_notes: string | null;
  auto_resolve_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

type EventVendorRow = {
  vendor_id: string;
  vendor_name: string;
  status: string;
};

export default async function CoupleDisputesPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Per the no-cron lock (PR #47, 2026-05-14): every couple pageview
  // sweeps stale `open` / `under_review` flags past their 7-day window.
  // Uses the admin client because RLS restricts UPDATE to admins.
  await sweepAutoResolveStaleFlags(createAdminClient());

  const [flagsRes, vendorsRes] = await Promise.all([
    supabase
      .from('force_majeure_flags')
      .select(
        'flag_id, public_id, event_vendor_id, flag_type, description, evidence_urls, status, resolution_notes, auto_resolve_at, resolved_at, created_at',
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('event_vendors')
      .select('vendor_id, vendor_name, status')
      .eq('event_id', eventId)
      .in('status', ['contracted', 'deposit_paid', 'delivered', 'shortlisted'])
      .order('vendor_name', { ascending: true }),
  ]);

  const flags = (flagsRes.data ?? []) as FlagRow[];
  const vendors = (vendorsRes.data ?? []) as EventVendorRow[];

  // Build a lookup so flag rows can show the affected vendor's name.
  const vendorById = new Map<string, EventVendorRow>(
    vendors.map((v) => [v.vendor_id, v]),
  );

  // Pre-resolve every flag's evidence URLs. Legacy http(s) URLs pass through
  // unchanged; new r2:// refs get a 24h presigned GET. The map is keyed by
  // flag_id so `<FlagCard>` can look up the resolved hrefs without
  // smuggling secrets back through React state.
  const evidenceUrlMap: Record<string, string[]> = {};
  await Promise.all(
    flags.map(async (f) => {
      if (!f.evidence_urls?.length) return;
      evidenceUrlMap[f.flag_id] = await displayUrlsForStoredAssets(
        f.evidence_urls,
      );
    }),
  );

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <AlertTriangle aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Disputes
          </h1>
        </div>
        <p className="max-w-prose text-base text-ink/65">
          File a force-majeure flag — typhoon, family emergency, vendor or
          venue cancellation — and the Setnayan Disputes Handler will reach
          out within 7 days. We work toward one of four outcomes: refund,
          reschedule, partial credit, or mediation.
        </p>
      </header>

      {search.filed ? (
        <p
          role="status"
          className="rounded-md border border-success-300/60 bg-success-50/80 px-4 py-3 text-sm text-success-900"
        >
          Flag filed. We&rsquo;ll be in touch — track its status below.
        </p>
      ) : null}
      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {search.error}
        </p>
      ) : null}

      <NewFlagForm eventId={eventId} vendors={vendors} />

      <section aria-labelledby="existing-flags" className="space-y-3">
        <h2
          id="existing-flags"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          Existing flags ({flags.length})
        </h2>
        {flags.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
            No disputes on record. Open one above when something goes
            sideways.
          </div>
        ) : (
          <ul className="space-y-3">
            {flags.map((f) => (
              <FlagCard
                key={f.flag_id}
                flag={f}
                vendor={vendorById.get(f.event_vendor_id ?? '') ?? null}
                resolvedEvidenceUrls={evidenceUrlMap[f.flag_id] ?? null}
              />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function NewFlagForm({
  eventId,
  vendors,
}: {
  eventId: string;
  vendors: EventVendorRow[];
}) {
  return (
    <details className="rounded-xl border border-ink/10 bg-cream">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
        <Plus aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Open a new dispute
      </summary>
      <form
        action={fileForceMajeureFlag}
        className="space-y-5 border-t border-ink/10 p-4"
      >
        <input type="hidden" name="event_id" value={eventId} />

        <fieldset className="space-y-2">
          <legend className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Flag type
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FLAG_TYPES.map((t, idx) => (
              <label
                key={t}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-ink/10 bg-cream p-3 text-sm hover:border-terracotta/40"
              >
                <input
                  type="radio"
                  name="flag_type"
                  value={t}
                  defaultChecked={idx === 0}
                  required
                  className="mt-0.5"
                />
                <span>{FLAG_TYPE_LABEL[t]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor="description" className="block space-y-1">
          <span className="block font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            What happened? (min 30 characters)
          </span>
          <textarea
            id="description"
            name="description"
            required
            minLength={30}
            maxLength={4000}
            rows={5}
            placeholder="Brief but specific — date, vendor, what you expected vs. what happened, any deadlines you've already missed."
            className="input-field min-h-[120px] py-2"
          />
        </label>

        <label htmlFor="event_vendor_id" className="block space-y-1">
          <span className="block font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Affects which vendor? (optional)
          </span>
          <select
            id="event_vendor_id"
            name="event_vendor_id"
            defaultValue=""
            className="input-field"
          >
            <option value="">Whole event (no specific vendor)</option>
            {vendors.map((v) => (
              <option key={v.vendor_id} value={v.vendor_id}>
                {v.vendor_name} · {v.status.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          {vendors.length === 0 ? (
            <span className="block text-xs text-ink/55">
              No contracted vendors yet. You can still file a whole-event flag.
            </span>
          ) : null}
        </label>

        <div className="block space-y-1">
          <span className="block font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Evidence (optional — photos, screenshots, weather alerts, PDFs)
          </span>
          <FileUpload
            bucket="thread-files"
            pathPrefix={`events/${eventId}/disputes/incoming`}
            name="evidence_refs"
            multiple
            maxFiles={5}
            maxSizeMB={10}
            acceptedTypes={[
              'image/png',
              'image/jpeg',
              'image/webp',
              'image/gif',
              'image/heic',
              'image/heif',
              'image/avif',
              'application/pdf',
            ]}
            help="Up to 5 files, 10 MB each. PNG / JPEG / WebP / HEIC / PDF."
            variant="wide"
          />
        </div>

        <SubmitButton className="button-primary" pendingLabel="Filing…">
          File flag
        </SubmitButton>
      </form>
    </details>
  );
}

function FlagCard({
  flag,
  vendor,
  resolvedEvidenceUrls,
}: {
  flag: FlagRow;
  vendor: EventVendorRow | null;
  /**
   * Pre-resolved display URLs (one per entry in `flag.evidence_urls`).
   * Provided by the page-level server component so we can render either
   * legacy http(s) URLs or freshly-presigned r2:// refs without exposing
   * R2 internals to the client.
   */
  resolvedEvidenceUrls: string[] | null;
}) {
  const evidenceCount = resolvedEvidenceUrls?.length ?? flag.evidence_urls?.length ?? 0;
  const countdown = flag.resolved_at
    ? null
    : formatAutoResolveCountdown(flag.auto_resolve_at);

  return (
    <li className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            {flag.public_id} · {FLAG_TYPE_LABEL[flag.flag_type]} ·{' '}
            {flag.created_at.slice(0, 10)}
          </p>
          <p className="text-sm font-medium text-ink">
            {vendor ? `Affects ${vendor.vendor_name}` : 'Whole event'}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${FLAG_STATUS_TONE[flag.status]}`}
        >
          {FLAG_STATUS_LABEL[flag.status]}
        </span>
      </div>

      <p className="whitespace-pre-wrap rounded-md bg-ink/[0.03] p-3 text-sm text-ink/75">
        {flag.description}
      </p>

      {evidenceCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
          <Paperclip aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>
            {evidenceCount} attachment{evidenceCount === 1 ? '' : 's'}:
          </span>
          {resolvedEvidenceUrls?.map((url, idx) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-terracotta hover:underline"
            >
              file {idx + 1}
            </a>
          ))}
        </div>
      ) : null}

      {flag.resolution_notes ? (
        <p className="rounded-md bg-success-50/60 p-3 text-xs text-success-900">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em]">
            Resolution notes
          </span>
          <br />
          {flag.resolution_notes}
        </p>
      ) : null}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {flag.resolved_at
          ? `Resolved ${flag.resolved_at.slice(0, 10)}`
          : countdown
            ? `Auto-resolve: ${countdown}`
            : 'In progress'}
      </p>
    </li>
  );
}
