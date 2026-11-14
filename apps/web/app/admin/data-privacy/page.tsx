import Link from 'next/link';
import { AlertTriangle, ChevronLeft, Download, FolderArchive } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { relativeTime } from '@/lib/activity';
import {
  approvalStanding,
  reviewBanner,
  summariseReviews,
} from '@/lib/provisional-approval';
import {
  fetchDataPrivacyControlsMeasured,
  PRIVACY_CONTROL_GROUP_ORDER,
  PRIVACY_CONTROL_GROUP_LABEL,
  type PrivacyControlRow,
  type PrivacyControlStatus,
} from '@/lib/data-privacy-controls';
import { computePrivacyCoverage } from '@/lib/privacy-coverage';
import { NPC_DOCUMENTS, NPC_DOC_GROUP_LABEL, type NpcDocGroup } from '@/lib/npc-documents';
import { ControlActions } from './_components/control-actions';
import { CoveragePanel } from './_components/coverage-panel';
import { NpcChecklist } from './_components/npc-checklist';
import { DeletionRunsPanel } from './_components/deletion-runs-panel';
import { fetchPeriodicJobLedger } from '@/lib/periodic-job-health';
import { PageMasthead } from '@/app/_components/page-masthead';
import { Fold } from '@/app/_components/fold';
import { Badge, Facts, One, Row, Rows, Sec } from '@/app/admin/app-performance/_components/insights-parts';
import { ReadFailed } from '../_components/read-failed';

export const metadata = { title: 'Data privacy & NPC filing · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/data-privacy — the Data Privacy & NPC Filing hub (RA 10173). Insights › Privacy & NPC.
 *
 * One surface, five views (`?tab=`):
 *   - Controls        the landing — approve each privacy-sensitive
 *                     capability; the flip records approved_by/at (audit trail).
 *                     Features read `status='active'` from data_privacy_controls
 *                     (isDataPrivacyControlActive), so activation is an in-app
 *                     decision — no env flag, no redeploy.
 *   - Coverage & drift the bridge: which live controls are declared in the NPC
 *                     filing, and which declared activities lack a live control.
 *   - Deletions       the RA 10173 promises with dates on them, and whether the
 *                     job behind each one actually ran and what it did. Added
 *                     2026-09-15: until then `cron_job_runs` recorded only that
 *                     a job had been CLAIMED — a timestamp stamped the instant
 *                     BEFORE the body ran, inside a catch that swallowed every
 *                     failure — and NOTHING in the app read that table at all.
 *                     A silently failing deletion job and a working one were
 *                     byte-identical from every record we keep.
 *   - Checklist       the counsel-prepared NPC pre-filing worklist.
 *   - Documents       the DPO-prepared NPC submission PDFs (drafts pending
 *                     external counsel review before lodging).
 *
 * Drawn to the approved Insights drawing (admin_pub/insights.html › Privacy & NPC): the controls on the landing, the
 * other four views and the NPC data sheet rise from the "Filing" rows (the old tab strip went — one selector, never a
 * pill row). Each sub-view opens with a "‹ Privacy & NPC" press back to the landing.
 *
 * /admin/npc-readiness redirects into ?tab=checklist (the old separate surface).
 *
 * Auth: /admin layout gates non-admins; requireAdmin() re-asserts here.
 * Pre-migration DBs render the code catalog, all inactive (fail-closed).
 */

type TabKey = 'controls' | 'coverage' | 'deletions' | 'checklist' | 'documents';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'controls', label: 'Controls' },
  { key: 'coverage', label: 'Coverage & drift' },
  { key: 'deletions', label: 'Deletions — did they actually run?' },
  { key: 'checklist', label: 'NPC checklist' },
  { key: 'documents', label: 'NPC submission documents' },
];

const STATUS_META: Record<PrivacyControlStatus, { label: string; tone: 'ok' | 'danger' | 'info' | undefined }> = {
  active: { label: 'Active', tone: 'ok' },
  inactive: { label: 'Off', tone: undefined },
  blocked: { label: 'Blocked', tone: 'danger' },
  retired: { label: 'Retired', tone: 'info' },
};

export default async function DataPrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { tab } = await searchParams;
  const active: TabKey = (TABS.find((t) => t.key === tab)?.key ?? 'controls') as TabKey;

  const admin = createAdminClient();
  const { ok: controlsOk, controls } = await fetchDataPrivacyControlsMeasured(admin);
  // Only read the job ledger for the view that shows it — this page is
  // force-dynamic and the other four views have no use for it.
  const jobLedger = active === 'deletions' ? await fetchPeriodicJobLedger(admin) : null;
  const activeCount = controls.filter((c) => c.status === 'active').length;
  const retiredCount = controls.filter((c) => c.status === 'retired').length;
  const liveTotal = controls.length - retiredCount;

  // The Filing row's line is computed from the controls already read — no new read. A refused read says "—".
  const coverage = controlsOk
    ? computePrivacyCoverage(
        new Set(controls.filter((c) => c.status === 'active').map((c) => c.control_key)),
        new Set(controls.filter((c) => c.status === 'retired').map((c) => c.control_key)),
      )
    : null;

  const subTitle = TABS.find((t) => t.key === active)?.label ?? '';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <PageMasthead
        title="Data Privacy & NPC Filing"
      />

      {active !== 'controls' ? (
        <div className="mb-1 flex min-h-11 items-center gap-2">
          <Link
            href="/admin/data-privacy"
            scroll={false}
            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-semibold text-[var(--sn-accent)] hover:bg-ink/[0.03]"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2.2} /> Privacy &amp; NPC
          </Link>
          <span className="text-[13px] text-ink/55" aria-current="page">
            · {subTitle}
          </span>
        </div>
      ) : null}

      {/* 🔑 On a refused read every control is the catalog default — "Off". A board
          full of Off switches is a claim that nothing is protected. */}
      {active === 'controls' ? (
        controlsOk ? <ControlsBoard controls={controls} /> : <ReadFailed what="the privacy controls" />
      ) : null}

      {active === 'controls' ? (
        <section data-privacy-filing="">
          <Sec
            title="Filing"
            about="Where the switches meet the NPC filing: coverage and drift, whether the promised deletions ran, the pre-filing checklist, the submission documents, and the data sheet."
          />
          <Rows label="Filing">
            <Row
              title="Coverage & drift"
              href="/admin/data-privacy?tab=coverage"
              tone={coverage === null ? 'warn' : coverage.undeclaredActive.length > 0 ? 'warn' : undefined}
              sub={
                coverage === null
                  ? 'Couldn’t read the controls — not the same as none'
                  : `${coverage.declaredCount} of ${coverage.privacySensitiveTotal} privacy-sensitive controls declared${coverage.undeclaredActive.length > 0 ? ` · ${coverage.undeclaredActive.length} live but not declared` : ''}`
              }
              trail={controlsOk ? `${activeCount} of ${liveTotal} active` : '—'}
            />
            <Row
              title="Deletions — did they actually run?"
              href="/admin/data-privacy?tab=deletions"
              sub="each retention job’s last run"
            />
            <Row title="NPC checklist" href="/admin/data-privacy?tab=checklist" sub="the counsel-prepared pre-filing worklist" />
            <Row
              title="NPC submission documents"
              href="/admin/data-privacy?tab=documents"
              sub={`${NPC_DOCUMENTS.length} PDFs · the complete packet`}
            />
            <Row title="NPC data sheet" href="/admin/compliance/data-sheet" sub="the stored facts as the NPC registration fields" />
          </Rows>
        </section>
      ) : null}

      {active === 'coverage' ? (
        controlsOk ? <CoveragePanel controls={controls} /> : <ReadFailed what="the privacy controls" />
      ) : null}

      {active === 'deletions' && jobLedger ? <DeletionRunsPanel ledger={jobLedger} /> : null}

      {active === 'checklist' ? <NpcChecklist /> : null}

      {active === 'documents' ? <NpcDocuments /> : null}
    </div>
  );
}

/**
 * The NPC submission document set, downloadable (admin-only) from here. The full
 * packet is featured; the individual documents follow, grouped. Files stream
 * through /admin/data-privacy/documents/[key] — internal compliance docs, never
 * public. These are DPO-prepared drafts pending external counsel review before
 * actual lodging (per the dossier's own filing gate).
 *
 * The rows are the Insights hairline rows, drawn here rather than with `Row` because each must keep
 * `prefetch={false}` — a document row is a PDF download, never something to fetch ahead.
 */
function NpcDocuments() {
  const packet = NPC_DOCUMENTS.find((d) => d.group === 'packet');
  const rest = NPC_DOCUMENTS.filter((d) => d.group !== 'packet');
  const groups: NpcDocGroup[] = ['executive', 'pack', 'companion', 'audit'];

  return (
    <section data-npc-documents="">
      <One label="Drafts · internal only">
        The DPO-prepared filing set for the National Privacy Commission, as PDFs. Download the full packet or any single
        document. These are drafts pending external counsel review before lodging — internal only, never shared
        publicly.
      </One>

      {packet ? (
        <div className="my-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/admin/data-privacy/documents/${packet.key}`}
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--sn-accent)] px-4 text-sm font-semibold text-[var(--sn-on-accent)] hover:opacity-90"
          >
            <FolderArchive aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {packet.title}
          </Link>
          <span className="text-[13px] text-ink/60">
            Every pack document below, merged into one PDF. The Data Privacy Summary is separate.
          </span>
        </div>
      ) : null}

      {groups.map((g) => {
        const docs = rest.filter((d) => d.group === g);
        if (docs.length === 0) return null;
        return (
          <div key={g}>
            <Sec title={NPC_DOC_GROUP_LABEL[g]} count={docs.length} />
            <ul aria-label={NPC_DOC_GROUP_LABEL[g]} className="[&>li:first-child]:border-t-0">
              {docs.map((d) => (
                <li key={d.key} className="border-t border-ink/10">
                  <Link
                    href={`/admin/data-privacy/documents/${d.key}`}
                    prefetch={false}
                    className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 py-2 text-left hover:bg-ink/[0.02] focus-visible:outline-2 focus-visible:outline-[var(--sn-accent)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold leading-tight text-ink">{d.title}</span>
                      <span className="mt-px block text-[13px] text-ink/65">PDF</span>
                    </span>
                    <Download aria-hidden className="h-4 w-4 text-[var(--sn-accent)]" strokeWidth={2} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/**
 * The control board, rendered as risk-grouped sections (biometric → supplier-mediated →
 * automated/AI → coordinator → onboarding → activation switches), with any
 * RETIRED controls pulled into their own muted section at the bottom so a
 * parked, feature-less control never sits among the live switches.
 */
function ControlsBoard({ controls }: { controls: PrivacyControlRow[] }) {
  const live = controls.filter((c) => c.status !== 'retired');
  const retired = controls.filter((c) => c.status === 'retired');
  const activeNow = live.filter((c) => c.status === 'active').length;

  /*
   * ⚠ A TEMPORARY APPROVAL THAT LOOKS PERMANENT IS THE DEFECT THIS ANSWERS.
   * Owner 2026-09-22: the controls are on TEMPORARILY, to be revisited in
   * January. Until migration 20271238899699 the table could not say so, and a
   * date that only exists in conversation raises nothing when it arrives. This
   * banner is the arrival. It never switches a control off — `review_by` gates
   * nothing, by design; see lib/provisional-approval.ts.
   */
  const summary = summariseReviews(
    live.map((c) => ({ status: c.status, reviewBy: c.review_by })),
  );
  const banner = reviewBanner(summary);

  return (
    <div data-privacy-controls="">
      {banner ? (
        <p
          role="status"
          className={`my-2 flex items-start gap-2 text-sm leading-relaxed ${summary.overdue > 0 ? 'text-[var(--sn-danger)]' : 'text-[var(--sn-warning-deep)]'}`}
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span>{banner}</span>
        </p>
      ) : null}

      <Sec
        title="Controls"
        about="Approve privacy-sensitive capabilities. Activation switches (not privacy-sensitive) sit in their own group; retired controls are parked for audit lineage and fail-closed everywhere."
        count={controls.length}
        right={`${activeNow} active`}
      />

      {PRIVACY_CONTROL_GROUP_ORDER.map((g) => {
        const rows = live.filter((c) => c.group === g);
        if (rows.length === 0) return null;
        return (
          <section key={g}>
            <Sec title={PRIVACY_CONTROL_GROUP_LABEL[g]} count={rows.length} />
            <ul className="[&>li:first-child]:border-t-0">
              {rows.map((c) => (
                <ControlCard key={c.control_key} control={c} />
              ))}
            </ul>
          </section>
        );
      })}

      {retired.length > 0 ? (
        <section>
          <Sec
            title="Retired"
            count={retired.length}
            about="Feature removed or never built — parked for audit lineage. Fail-closed everywhere (nothing reads a retired control as active). Restore to bring it back onto the board."
          />
          <ul className="[&>li:first-child]:border-t-0">
            {retired.map((c) => (
              <ControlCard key={c.control_key} control={c} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** The one line under a control's name: its approval and review standing, or its note. */
function controlLine(c: PrivacyControlRow): { text: string; tone?: 'warn' | 'danger' } {
  if (c.status === 'active' && c.approved_at) {
    // The row has to carry it too: a board-level count tells you SOMETHING is provisional, never WHICH.
    const standing = approvalStanding({ status: c.status, reviewBy: c.review_by });
    const base = `Approved ${relativeTime(c.approved_at)}${c.note ? ` · “${c.note}”` : ''}`;
    if (standing === 'overdue') return { text: `${base} · review was due ${c.review_by ?? '(date unreadable)'}`, tone: 'danger' };
    if (standing === 'provisional') return { text: `${base} · temporary — review by ${c.review_by}`, tone: 'warn' };
    return { text: base };
  }
  if (c.status === 'retired') return { text: c.note ? `Note: “${c.note}”` : 'Feature removed or never built · fail-closed everywhere' };
  return { text: c.note ? `Note: “${c.note}”` : c.category };
}

function ControlCard({ control: c }: { control: PrivacyControlRow }) {
  const meta = STATUS_META[c.status];
  const line = controlLine(c);

  return (
    <li className="border-t border-ink/10" data-privacy-control={c.control_key}>
      <Fold
        title={c.title}
        line={line.text}
        aside={<Badge tone={meta.tone}>{meta.label}</Badge>}
        data="privacy-control"
      >
        <Facts
          rows={[
            ['Status', meta.label],
            ['Category', c.category],
            ['What it does', c.description],
            ...(c.risk_note ? ([['Why it’s sensitive', c.risk_note]] as [string, string][]) : []),
            ...(line.tone
              ? ([
                  [
                    'Review',
                    <span key="review" className={line.tone === 'danger' ? 'text-[var(--sn-danger)]' : 'text-[var(--sn-warning-deep)]'}>
                      {line.text}
                    </span>,
                  ],
                ] as [string, React.ReactNode][])
              : []),
          ]}
        />
        {/* Approve / turn off / block / retire / restore — in-place via useActionState, no page nav */}
        <ControlActions control={c} />
      </Fold>
    </li>
  );
}
