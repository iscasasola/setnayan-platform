import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  ScrollText,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  DOCUMENT_META,
  DOCUMENTS_BY_CEREMONY_TYPE,
  STATUS_LABEL,
  STATUS_TONE,
  completeByDate,
  deadlineTone,
  expiryTone,
  fetchEventPaperwork,
  formatLongDate,
  resolveCeremonyType,
  summarize,
  type DeadlineTone,
  type PaperworkDocumentType,
  type PaperworkRow,
} from '@/lib/paperwork';
import {
  WEDDING_TRADITIONS_GUIDE,
  DIMENSION_LABEL,
  fetchTraditionItems,
  type TraditionGuideKey,
  type TraditionItem,
} from '@/lib/wedding-traditions';
import {
  markPaperworkReceived,
  markPaperworkRequested,
  seedPaperworkForEvent,
  setPaperworkNotes,
  setPaperworkStatus,
  uploadPaperworkScan,
} from './actions';

export const metadata = { title: 'Wedding paperwork' };

type Props = { params: Promise<{ eventId: string }> };

export default async function PaperworkPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/dashboard/${eventId}/paperwork`)}`);
  const supabase = await createClient();

  // Pull the event + paperwork rows in parallel — same one-round-trip
  // pattern as /budget.
  const [eventRes, rows] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, display_name, event_date, ceremony_type')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchEventPaperwork(supabase, eventId),
  ]);

  const event = eventRes.data as
    | { event_id: string; display_name: string; event_date: string | null; ceremony_type: string | null }
    | null;

  if (!event) {
    // Event-host RLS denied access OR event was deleted. Redirect home
    // — the dashboard layout's outer auth gate handles the broader
    // "wrong account" case, so this only fires on stale URLs.
    redirect('/dashboard');
  }

  const ceremony = resolveCeremonyType(event.ceremony_type);
  // Per-religion traditions: admin-editable rows from wedding_tradition_items
  // when present, else the code defaults in TraditionsGuide. Null on
  // empty/absent/error (pre-migration or before an admin loads starter content).
  const traditionItems = await fetchTraditionItems(supabase, ceremony);
  const expectedDocs = DOCUMENTS_BY_CEREMONY_TYPE[ceremony];

  // Resolve r2 display URLs for any existing uploads. The FileUpload
  // widget needs these to render the existing thumbnail/filename row.
  const uploadedRefs = rows
    .map((r) => r.document_r2_key)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  const displayUrlByRef: Record<string, string> = {};
  for (const ref of uploadedRefs) {
    try {
      const url = await displayUrlForStoredAsset(ref);
      if (url) displayUrlByRef[ref] = url;
    } catch (e) {
      // Don't kill the page if a single signed URL fails — the host
      // still sees the row + can re-upload. Brand voice elsewhere
      // handles the user-facing "couldn't render preview" path; here
      // we just skip silently and the FileUpload widget shows a
      // generic file chip instead of a thumbnail.
      console.warn('[paperwork] displayUrl failed for', ref, e);
    }
  }

  // Group existing rows by document_type for fast lookup. Hosts who
  // haven't seeded yet (or whose ceremony changed) will see ROWS that
  // belong to expectedDocs but have no DB row yet — the page renders
  // those as inline "Mark as requested / Upload scan" forms that POST
  // to the seed action implicitly via the action's idempotent path.
  const rowByDocument = new Map<PaperworkDocumentType, PaperworkRow>();
  for (const r of rows) rowByDocument.set(r.document_type, r);

  // First-visit seed: if the host has zero rows for this event AND we
  // know the expected document set, ship a sub-form they can submit
  // once to populate the table.
  const needsSeed = rows.length === 0 && expectedDocs.length > 0;

  const summary = summarize(rows, event.event_date);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink eventId={eventId} />
        {/* YOUR PLAN consolidation 2026-05-22 — every paper artifact also
         *  lives in the consolidated /documents view alongside contracts,
         *  Setnayan creations, and receipts. */}
        <Link
          href={`/dashboard/${eventId}/documents`}
          className="inline-flex items-center gap-1 text-xs font-medium text-terracotta-700 hover:text-terracotta-800"
        >
          See all documents <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
        </Link>
      </div>
      <header className="space-y-3">
        <h1 className="font-display text-3xl italic tracking-tight text-ink sm:text-4xl">
          Your wedding paperwork
        </h1>
        <p className="max-w-prose text-sm text-ink/65 sm:text-base">
          Filipino paperwork rewards lead time. PSA documents take 2–4 weeks
          to process, the marriage license is valid for 120 days, and most
          parishes need 60–90 days notice for Pre&#8209;Cana. We track each
          one and surface the deadline pegged to your wedding date.
        </p>
        {!event.event_date ? (
          <NoDatePrompt eventId={eventId} />
        ) : (
          <DeadlineHint eventDate={event.event_date} />
        )}
      </header>

      <TraditionsGuide ceremony={ceremony} items={traditionItems} />

      {needsSeed ? (
        <SeedPrompt eventId={eventId} ceremonyLabel={ceremonyLabel(ceremony)} />
      ) : null}

      {rows.length > 0 ? (
        <SummaryStrip summary={summary} />
      ) : null}

      {expectedDocs.length > 0 ? (
        <ul className="space-y-4">
          {expectedDocs.map((docType) => {
            const row = rowByDocument.get(docType);
            return (
              <li key={docType}>
                <DocumentCard
                  eventId={eventId}
                  eventDate={event.event_date}
                  documentType={docType}
                  row={row}
                  displayUrlByRef={displayUrlByRef}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <UnknownCeremonyPrompt eventId={eventId} />
      )}

      {/* Document types the host has rows for that aren't in the
       *  current expectedDocs set (e.g., they switched ceremony_type
       *  from Catholic to Civil and want to keep their Pre-Cana row
       *  for reference). Show them in a "Also tracking" section so
       *  nothing is silently dropped. */}
      <ExtraRowsSection
        eventId={eventId}
        eventDate={event.event_date}
        expectedDocs={expectedDocs}
        rows={rows}
        displayUrlByRef={displayUrlByRef}
      />
    </section>
  );
}

// ---------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------

/**
 * Per-religion traditions & process overview (the "follow the traditions of
 * each religion" surface). Data lives in lib/wedding-traditions.ts, keyed by
 * the same ceremony_type as the document checklist below. Renders nothing for
 * an unset ceremony (the header + document prompts already cover that case).
 */
function TraditionsGuide({
  ceremony,
  items,
}: {
  ceremony: TraditionGuideKey;
  items?: TraditionItem[] | null;
}) {
  const guide = WEDDING_TRADITIONS_GUIDE[ceremony];
  if (!guide) return null;
  // Admin-edited rows from wedding_tradition_items override the code defaults
  // when present; otherwise fall back to the seeded WEDDING_TRADITIONS_GUIDE.
  const display = items && items.length > 0 ? items : guide.items;
  if (display.length === 0) return null;
  return (
    <section className="space-y-4 rounded-xl border border-terracotta/20 bg-terracotta/[0.03] p-5">
      <div className="space-y-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-700">
          What to expect
        </h2>
        <p className="text-lg font-semibold tracking-tight text-ink">
          Your {guide.label} wedding
        </p>
        <p className="max-w-prose text-sm text-ink/70">{guide.overview}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {display.map((item) => (
          <li
            key={`${item.dimension}-${item.label}`}
            className="rounded-lg border border-ink/10 bg-cream p-3"
          >
            <span className="inline-block rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
              {DIMENSION_LABEL[item.dimension]}
            </span>
            <p className="mt-1.5 text-sm font-medium text-ink">{item.label}</p>
            <p className="mt-0.5 text-xs text-ink/65">{item.note}</p>
          </li>
        ))}
      </ul>
      {guide.confirmWith ? (
        <p className="text-xs text-ink/55">
          General guidance to help you plan — traditions vary by family, parish,
          and region. Confirm the specifics with {guide.confirmWith}.
        </p>
      ) : null}
    </section>
  );
}

function BackLink({ eventId }: { eventId: string }) {
  return (
    <Link
      href={`/dashboard/${eventId}`}
      className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-terracotta"
    >
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      Back to event home
    </Link>
  );
}

function NoDatePrompt({ eventId }: { eventId: string }) {
  return (
    <div className="rounded-xl border border-warn-300/50 bg-warn-50/50 p-4 text-sm text-warn-900">
      <p className="font-medium">Set a wedding date to unlock deadline math.</p>
      <p className="mt-1 text-warn-900/80">
        Once your date is in, every paperwork row gets a &ldquo;complete
        by&rdquo; target anchored to PSA + LGU + parish lead times.
      </p>
      <Link
        href={`/dashboard/${eventId}/settings`}
        className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.15em] text-warn-900 underline"
      >
        Set wedding date
      </Link>
    </div>
  );
}

function DeadlineHint({ eventDate }: { eventDate: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
      Anchored to {formatLongDate(eventDate)}
    </p>
  );
}

function SeedPrompt({
  eventId,
  ceremonyLabel,
}: {
  eventId: string;
  ceremonyLabel: string;
}) {
  return (
    <form
      action={seedPaperworkForEvent}
      className="rounded-xl border border-terracotta/30 bg-terracotta/[0.04] p-5"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-700">
        Start your checklist
      </h2>
      <p className="mt-2 text-sm text-ink/75">
        We&rsquo;ll set up the document rows that apply to a {ceremonyLabel} ceremony.
        You can mark progress + upload scans as each one lands.
      </p>
      <SubmitButton
        className="mt-3 inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70"
        pendingLabel="Setting up…"
      >
        <ScrollText className="h-4 w-4" strokeWidth={1.75} />
        Build my checklist
      </SubmitButton>
    </form>
  );
}

function UnknownCeremonyPrompt({ eventId }: { eventId: string }) {
  return (
    <div className="rounded-xl border border-ink/15 bg-cream p-5 text-sm text-ink/70">
      <p>
        Pick a ceremony type on your event so we can show the document set that
        applies. Catholic, Civil, INC, and Muslim each carry distinct paperwork.
      </p>
      <Link
        href={`/dashboard/${eventId}/settings`}
        className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta underline"
      >
        Choose ceremony type
      </Link>
    </div>
  );
}

function SummaryStrip({
  summary,
}: {
  summary: ReturnType<typeof summarize>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryTile label="Received" value={`${summary.received}/${summary.total}`} tone="good" />
      <SummaryTile label="In progress" value={summary.inProgress.toString()} tone={summary.inProgress > 0 ? 'warn' : 'default'} />
      <SummaryTile label="Overdue" value={summary.overdueCount.toString()} tone={summary.overdueCount > 0 ? 'bad' : 'good'} />
      <SummaryTile
        label="License status"
        value={
          summary.hasMarriageLicenseExpiring
            ? 'Expiring soon'
            : '—'
        }
        tone={summary.hasMarriageLicenseExpiring ? 'warn' : 'default'}
      />
    </ul>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn' | 'good' | 'bad';
}) {
  return (
    <li className="rounded-xl border border-ink/10 bg-cream p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tracking-tight ${
          tone === 'bad'
            ? 'text-danger-700'
            : tone === 'warn'
              ? 'text-warn-800'
              : tone === 'good'
                ? 'text-success-700'
                : 'text-ink'
        }`}
      >
        {value}
      </p>
    </li>
  );
}

function DocumentCard({
  eventId,
  eventDate,
  documentType,
  row,
  displayUrlByRef,
}: {
  eventId: string;
  eventDate: string | null;
  documentType: PaperworkDocumentType;
  row: PaperworkRow | undefined;
  displayUrlByRef: Record<string, string>;
}) {
  const meta = DOCUMENT_META[documentType];
  const status = row?.status ?? 'not_started';
  const completeBy = completeByDate(documentType, eventDate);
  const tone = deadlineTone(completeBy, status);
  const expires =
    documentType === 'marriage_license' && row?.expires_at
      ? row.expires_at
      : null;
  const expireTone = expiryTone(expires);

  // The status pill, the deadline copy color, and the card border all
  // read the same tone — keeps every card visually consistent without
  // a separate "danger level" axis per element.
  const borderClass =
    status === 'received'
      ? 'border-success-300/50 bg-success-50/40'
      : tone === 'overdue'
        ? 'border-danger-300/50 bg-danger-50/40'
        : tone === 'soon'
          ? 'border-warn-300/50 bg-warn-50/40'
          : 'border-ink/10 bg-cream';

  return (
    <article className={`overflow-hidden rounded-xl border ${borderClass}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-ink sm:text-lg">
            {meta.label}
          </h2>
          <p className="text-sm text-ink/70">{meta.helper}</p>
        </div>
        <StatusPill status={status} />
      </header>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        <Field
          label="Complete by"
          value={completeBy ? formatLongDate(completeBy) : '—'}
          tone={tone}
          icon="deadline"
        />
        <Field
          label="Processing time"
          value={meta.processingHint}
          tone="default"
          icon="clock"
        />
        {documentType === 'marriage_license' && expires ? (
          <Field
            label="License expires"
            value={formatLongDate(expires)}
            tone={expireTone}
            icon="expire"
          />
        ) : (
          <Field
            label="Status"
            value={STATUS_LABEL[status]}
            tone="default"
            icon="clock"
          />
        )}
      </div>

      {documentType === 'marriage_license' && expires && expireTone !== 'fine' ? (
        <ExpiryWarning expires={expires} tone={expireTone} />
      ) : null}

      <div className="border-t border-ink/10 bg-cream/40 px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Where to go
        </p>
        <p className="mt-1 text-sm text-ink/75">{meta.whereToGo}</p>
      </div>

      <div className="border-t border-ink/10 px-5 py-4">
        <ActionsBlock
          eventId={eventId}
          documentType={documentType}
          row={row}
          displayUrlByRef={displayUrlByRef}
        />
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: PaperworkRow['status'] }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Field({
  label,
  value,
  tone,
  icon,
  collapsible = false,
}: {
  label: string;
  value: string;
  tone: DeadlineTone | 'default';
  icon: 'deadline' | 'clock' | 'expire' | 'pin';
  collapsible?: boolean;
}) {
  // The "Where to go" field can get long; collapse it to 2 lines with
  // line-clamp on mobile so the card stays compact.
  const valueClass = collapsible
    ? 'text-sm text-ink/75 line-clamp-2 sm:line-clamp-none'
    : 'text-sm font-medium text-ink';
  const toneClass =
    tone === 'overdue'
      ? 'text-danger-700'
      : tone === 'soon'
        ? 'text-warn-800'
        : tone === 'fine'
          ? 'text-success-700'
          : 'text-ink';

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {icon === 'deadline' ? (
          <Clock className="h-3 w-3" strokeWidth={1.75} aria-hidden />
        ) : icon === 'clock' ? (
          <Clock className="h-3 w-3" strokeWidth={1.75} aria-hidden />
        ) : icon === 'expire' ? (
          <AlertCircle className="h-3 w-3" strokeWidth={1.75} aria-hidden />
        ) : (
          <FileText className="h-3 w-3" strokeWidth={1.75} aria-hidden />
        )}
        {label}
      </p>
      <p className={`${valueClass} ${tone !== 'default' && icon === 'deadline' ? toneClass : tone !== 'default' && icon === 'expire' ? toneClass : ''}`}>
        {value}
      </p>
    </div>
  );
}

function ExpiryWarning({
  expires,
  tone,
}: {
  expires: string;
  tone: DeadlineTone;
}) {
  const formatted = formatLongDate(expires);
  const message =
    tone === 'overdue'
      ? `Your marriage license expired on ${formatted}. You'll need to request a fresh one before the wedding.`
      : `Your marriage license is valid until ${formatted}. Keep it close — the parish/officiant needs it on the day.`;
  return (
    <div
      className={`mx-5 mb-4 rounded-md border px-3 py-2 text-xs ${
        tone === 'overdue'
          ? 'border-danger-300/50 bg-danger-50/60 text-danger-900'
          : 'border-warn-300/50 bg-warn-50/60 text-warn-900'
      }`}
    >
      {message}
    </div>
  );
}

function ActionsBlock({
  eventId,
  documentType,
  row,
  displayUrlByRef,
}: {
  eventId: string;
  documentType: PaperworkDocumentType;
  row: PaperworkRow | undefined;
  displayUrlByRef: Record<string, string>;
}) {
  // No row yet — the seed action ships the row once submitted, so the
  // host needs to seed first. We still surface the upload widget for
  // hosts who want to drop a scan they already have on hand; the
  // server action handles the no-existing-row case by short-circuiting
  // with a helpful error.
  if (!row) {
    return (
      <div className="text-sm text-ink/65">
        <p>This document will appear once you build your checklist above.</p>
      </div>
    );
  }

  const status = row.status;

  return (
    <div className="space-y-4">
      {/* Primary actions row — what the host clicks first */}
      <div className="flex flex-wrap gap-2">
        {status === 'not_started' ? (
          <form action={markPaperworkRequested}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="paperwork_id" value={row.id} />
            <SubmitButton
              className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70"
              pendingLabel="Saving…"
            >
              Mark as requested
            </SubmitButton>
          </form>
        ) : null}

        {(status === 'requested' || status === 'in_processing') ? (
          <form action={markPaperworkReceived}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="paperwork_id" value={row.id} />
            <input type="hidden" name="document_type" value={documentType} />
            <SubmitButton
              className="inline-flex items-center gap-1.5 rounded-md bg-success-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-success-800 disabled:opacity-70"
              pendingLabel="Saving…"
            >
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
              Mark as received
            </SubmitButton>
          </form>
        ) : null}

        {status === 'received' ? (
          <form action={setPaperworkStatus}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="paperwork_id" value={row.id} />
            <input type="hidden" name="status" value="not_started" />
            <SubmitButton
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta/40 hover:text-terracotta disabled:opacity-70"
              pendingLabel="Resetting…"
            >
              Reset status
            </SubmitButton>
          </form>
        ) : null}

        {/* Helpful external link to the PSA portal when relevant. */}
        {(documentType.startsWith('psa_birth_cert_') ||
          documentType.startsWith('cenomar_')) ? (
          <a
            href="https://psa.gov.ph"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta/40 hover:text-terracotta"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Open PSA portal
          </a>
        ) : null}
        {documentType === 'cfo_counseling_complete' ? (
          <a
            href="https://www.cfo.gov.ph"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta/40 hover:text-terracotta"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Open CFO site
          </a>
        ) : null}
      </div>

      {/* Tracking reference (PSA online order #) when one exists or can
       *  be added. Surfaces inside the requested form for visibility. */}
      {(status === 'requested' || status === 'in_processing') ? (
        <TrackingReferenceForm
          eventId={eventId}
          paperworkId={row.id}
          current={row.tracking_reference}
        />
      ) : null}

      {/* Upload */}
      <UploadBlock
        eventId={eventId}
        paperworkId={row.id}
        documentType={documentType}
        currentRef={row.document_r2_key}
        displayUrl={
          row.document_r2_key ? displayUrlByRef[row.document_r2_key] : undefined
        }
      />

      {/* Notes — small inline form */}
      <NotesForm
        eventId={eventId}
        paperworkId={row.id}
        currentNotes={row.notes}
      />
    </div>
  );
}

function TrackingReferenceForm({
  eventId,
  paperworkId,
  current,
}: {
  eventId: string;
  paperworkId: string;
  current: string | null;
}) {
  return (
    <form
      action={markPaperworkRequested}
      className="flex flex-wrap items-center gap-2 rounded-md border border-ink/10 bg-ink/[0.02] px-3 py-2"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="paperwork_id" value={paperworkId} />
      <label
        htmlFor={`tracking-${paperworkId}`}
        className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
      >
        Tracking reference
      </label>
      <input
        id={`tracking-${paperworkId}`}
        name="tracking_reference"
        defaultValue={current ?? ''}
        placeholder="PSA order # or batch number"
        maxLength={120}
        className="h-8 min-w-[12rem] flex-1 rounded-md border border-ink/15 bg-cream px-2 text-xs text-ink placeholder:text-ink/40"
      />
      <SubmitButton
        className="inline-flex items-center rounded-md bg-ink/80 px-3 py-1 text-xs font-medium text-cream hover:bg-ink disabled:opacity-70"
        pendingLabel="Saving…"
      >
        Save
      </SubmitButton>
    </form>
  );
}

function UploadBlock({
  eventId,
  paperworkId,
  documentType,
  currentRef,
  displayUrl,
}: {
  eventId: string;
  paperworkId: string;
  documentType: PaperworkDocumentType;
  currentRef: string | null;
  displayUrl: string | undefined;
}) {
  return (
    <form action={uploadPaperworkScan} className="space-y-2">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="paperwork_id" value={paperworkId} />
      <input type="hidden" name="document_type" value={documentType} />
      <FileUpload
        bucket="vendor-contracts"
        pathPrefix={`paperwork/${eventId}/${documentType}`}
        name="document_r2_key"
        label="Upload scan"
        help="PDF or photo of the document. PNG, JPEG, WebP, HEIC, or PDF up to 20 MB."
        maxSizeMB={20}
        acceptedTypes={[
          'image/png',
          'image/jpeg',
          'image/webp',
          'image/heic',
          'image/heif',
          'application/pdf',
        ]}
        variant="wide"
        currentValue={currentRef ?? undefined}
        initialDisplayUrls={
          currentRef && displayUrl ? { [currentRef]: displayUrl } : undefined
        }
      />
      <SubmitButton
        className="inline-flex items-center rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-cream hover:bg-ink/85 disabled:opacity-70"
        pendingLabel="Saving…"
      >
        Save scan
      </SubmitButton>
    </form>
  );
}

function NotesForm({
  eventId,
  paperworkId,
  currentNotes,
}: {
  eventId: string;
  paperworkId: string;
  currentNotes: string | null;
}) {
  return (
    <form action={setPaperworkNotes} className="space-y-1">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="paperwork_id" value={paperworkId} />
      <label
        htmlFor={`notes-${paperworkId}`}
        className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
      >
        Notes (private)
      </label>
      <textarea
        id={`notes-${paperworkId}`}
        name="notes"
        defaultValue={currentNotes ?? ''}
        placeholder="e.g., scheduled with Fr. Reyes for March 2 at 9 a.m."
        rows={2}
        maxLength={2000}
        className="block w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40"
      />
      <div>
        <SubmitButton
          className="inline-flex items-center rounded-md border border-ink/15 bg-cream px-3 py-1 text-xs font-medium text-ink hover:border-terracotta/40 hover:text-terracotta disabled:opacity-70"
          pendingLabel="Saving…"
        >
          Save note
        </SubmitButton>
      </div>
    </form>
  );
}

function ExtraRowsSection({
  eventId,
  eventDate,
  expectedDocs,
  rows,
  displayUrlByRef,
}: {
  eventId: string;
  eventDate: string | null;
  expectedDocs: ReadonlyArray<PaperworkDocumentType>;
  rows: ReadonlyArray<PaperworkRow>;
  displayUrlByRef: Record<string, string>;
}) {
  const expectedSet = new Set(expectedDocs);
  const extras = rows.filter((r) => !expectedSet.has(r.document_type));
  if (extras.length === 0) return null;

  return (
    <section className="space-y-3 pt-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        Also tracking
      </h2>
      <p className="text-xs text-ink/65">
        Documents from a previous ceremony pick. Your current ceremony doesn&rsquo;t
        require these — kept here in case you want to keep the records.
      </p>
      <ul className="space-y-4">
        {extras.map((r) => (
          <li key={r.id}>
            <DocumentCard
              eventId={eventId}
              eventDate={eventDate}
              documentType={r.document_type}
              row={r}
              displayUrlByRef={displayUrlByRef}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ceremonyLabel(ceremony: ReturnType<typeof resolveCeremonyType>): string {
  switch (ceremony) {
    case 'catholic':
      return 'Catholic';
    case 'civil':
      return 'Civil';
    case 'inc':
      return 'INC (Iglesia ni Cristo)';
    case 'christian':
      return 'Christian (non-Catholic)';
    case 'muslim':
      return 'Muslim';
    case 'cultural':
      return 'cultural';
    case 'aglipayan':
      return 'Aglipayan (IFI)';
    case 'lds':
      return 'LDS (Latter-day Saints)';
    case 'sda':
      return 'Seventh-day Adventist';
    case 'jw':
      return "Jehovah's Witnesses";
    case 'hindu':
      return 'Hindu';
    case 'sikh':
      return 'Sikh';
    case 'buddhist':
      return 'Buddhist';
    case 'orthodox':
      return 'Orthodox Christian';
    case 'mixed':
      return 'mixed-faith';
    default:
      return 'Filipino';
  }
}
