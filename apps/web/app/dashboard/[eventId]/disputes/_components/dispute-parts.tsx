import { Paperclip, Plus } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { PostedPick } from '@/app/dashboard/[eventId]/_components/posted-pick';
import { FileUpload } from '@/app/_components/file-upload';
import { StayForm } from '@/app/_components/stay-form';
import {
  FLAG_TYPES,
  FLAG_TYPE_LABEL,
  FLAG_STATUS_LABEL,
  FLAG_STATUS_TONE,
  formatAutoResolveCountdown,
  type FlagStatus,
  type FlagType,
} from '@/lib/force-majeure';
import { formatCount } from '@/lib/format-number';
import { fileForceMajeureFlag } from '../actions';

/**
 * 🚩 THE COUPLE'S REPORT A PROBLEM — the form and one filed report, drawn by BOTH the Disputes page
 * (`disputes/page.tsx`, every report on the event) and the picked supplier's Report page
 * (`vendors/[vendorId]/workspace/_components/report-supplier-page.tsx`, the reports about that one supplier).
 * Moved here from the Disputes page (11 Nov 2026), not redrawn: one form, one action (`fileForceMajeureFlag`), one
 * stay door (`disputes.fileForceMajeureFlag`).
 */

export type FlagRow = {
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

export type EventVendorRow = {
  vendor_id: string;
  vendor_name: string;
  status: string;
};

// A report about one supplier starts on "Other" (a typhoon is the whole event's, not one supplier's); the Disputes page
// keeps its first type.
export function NewFlagForm({
  eventId,
  vendors = [],
  supplier = null,
  onSaved,
}: {
  eventId: string;
  vendors?: readonly EventVendorRow[];
  /**
   * 🚩 The picked supplier's Report page (owner 11 Nov 2026, "There is also no report"): the same form, OPEN, about
   * this one supplier — the supplier is filled in (a hidden field, said in one line), never picked from a list.
   */
  supplier?: { id: string; name: string } | null;
  /** After a report lands (the Report page says so in a line under the form; the Disputes page re-draws its list). */
  onSaved?: () => void;
}) {
  return (
    <details className="sn-row" open={supplier ? true : undefined} data-report-supplier={supplier ? supplier.id : undefined}>
      <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
        <Plus aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        {supplier ? 'Report a problem' : 'Open a new dispute'}
      </summary>
      <StayForm
        door="disputes.fileForceMajeureFlag"
        action={fileForceMajeureFlag}
        resetOnSaved
        onSaved={onSaved}
        className="space-y-5 border-t border-ink/10 p-4"
      >
        <input type="hidden" name="event_id" value={eventId} />

        <fieldset className="space-y-2">
          <legend className="sn-eye">
            Flag type
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FLAG_TYPES.map((t, idx) => (
              <label
                key={t}
                className="sn-row flex cursor-pointer items-start gap-2 p-3 text-sm hover:border-terracotta/40"
              >
                <input
                  type="radio"
                  name="flag_type"
                  value={t}
                  defaultChecked={supplier ? t === 'other' : idx === 0}
                  required
                  className="mt-0.5"
                />
                <span>{FLAG_TYPE_LABEL[t]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor="description" className="block space-y-1">
          <span className="sn-eye">
            What happened? (min 30 characters)
          </span>
          <textarea
            id="description"
            name="description"
            required
            minLength={30}
            maxLength={4000}
            rows={5}
            placeholder="Brief but specific — date, supplier, what you expected vs. what happened, any deadlines you've already missed."
            className="input-field min-h-[120px] py-2"
          />
        </label>

        {supplier ? (
          <p className="text-sm text-ink/70" data-report-about="">
            <input type="hidden" name="event_vendor_id" value={supplier.id} />
            About {supplier.name}
          </p>
        ) : (
          <label className="block space-y-1">
            <span className="sn-eye">
              Affects which supplier? (optional)
            </span>
            <PostedPick
              name="event_vendor_id"
              label="Affects which supplier?"
              options={[
                { key: '', label: 'Whole event (no specific supplier)' },
                ...vendors.map((v) => ({ key: v.vendor_id, label: `${v.vendor_name} · ${v.status.replace(/_/g, ' ')}` })),
              ]}
            />
            {vendors.length === 0 ? (
              <span className="block text-xs text-ink/70">
                No contracted suppliers yet. You can still file a whole-event flag.
              </span>
            ) : null}
          </label>
        )}

        <div className="block space-y-1">
          <span className="sn-eye">
            Evidence (optional — photos, screenshots, weather alerts, PDFs)
          </span>
          <FileUpload
            bucket="thread-files"
            pathPrefix={`events/${eventId}/disputes/incoming`}
            name="evidence_refs"
            unsavedHint="press File flag below"
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
      </StayForm>
    </details>
  );
}

export function FlagCard({
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
    <li className="sn-row space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs uppercase tracking-[0.06em] text-ink/70">
            {flag.public_id} · {FLAG_TYPE_LABEL[flag.flag_type]} ·{' '}
            {flag.created_at.slice(0, 10)}
          </p>
          <p className="text-sm font-medium text-ink">
            {vendor ? `Affects ${vendor.vendor_name}` : 'Whole event'}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-[0.06em] ${FLAG_STATUS_TONE[flag.status]}`}
        >
          {FLAG_STATUS_LABEL[flag.status]}
        </span>
      </div>

      <p className="whitespace-pre-wrap rounded-md bg-ink/[0.03] p-3 text-sm text-ink/75">
        {flag.description}
      </p>

      {evidenceCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/70">
          <Paperclip aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>
            {formatCount(evidenceCount)} attachment{evidenceCount === 1 ? '' : 's'}:
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
          <span className="text-xs uppercase tracking-[0.06em]">
            Resolution notes
          </span>
          <br />
          {flag.resolution_notes}
        </p>
      ) : null}

      <p className="text-xs uppercase tracking-[0.06em] text-ink/70">
        {flag.resolved_at
          ? `Resolved ${flag.resolved_at.slice(0, 10)}`
          : countdown
            ? `Auto-resolve: ${countdown}`
            : 'In progress'}
      </p>
    </li>
  );
}
