import Link from 'next/link';
import { ShieldCheck, CheckCircle2, Circle, Ban, Download, FileText, FolderArchive } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { relativeTime } from '@/lib/activity';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  fetchDataPrivacyControls,
  type PrivacyControlRow,
  type PrivacyControlStatus,
} from '@/lib/data-privacy-controls';
import { NPC_DOCUMENTS, NPC_DOC_GROUP_LABEL, type NpcDocGroup } from '@/lib/npc-documents';
import { setDataPrivacyControl } from './actions';

export const metadata = { title: 'Data Privacy · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/data-privacy — the Data Privacy control board (RA 10173).
 *
 * One row per privacy-sensitive capability. The owner/admin approves activation
 * here; the flip is recorded (approved_by + approved_at + note) as the audit
 * trail that supports the NPC filing. Feature gates read `status='active'` from
 * `data_privacy_controls` (via lib/data-privacy-controls `isDataPrivacyControlActive`),
 * so activation is an in-app decision — no env flag, no redeploy.
 *
 * Auth: /admin layout gates non-admins; requireAdmin() re-asserts here.
 * Pre-migration DBs render the code catalog, all inactive (fail-closed).
 */

const STATUS_META: Record<
  PrivacyControlStatus,
  { label: string; tone: 'active' | 'off' | 'blocked'; icon: typeof CheckCircle2 }
> = {
  active: { label: 'Active', tone: 'active', icon: CheckCircle2 },
  inactive: { label: 'Off', tone: 'off', icon: Circle },
  blocked: { label: 'Blocked', tone: 'blocked', icon: Ban },
};

export default async function DataPrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; error?: string }>;
}) {
  await requireAdmin();
  const search = await searchParams;
  const admin = createAdminClient();
  const controls = await fetchDataPrivacyControls(admin);

  const activeCount = controls.filter((c) => c.status === 'active').length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="sn-eye flex items-center gap-2">
          <ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Data Privacy · RA 10173
        </p>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--m-ink)' }}>
          Privacy control board
        </h1>
        <p className="max-w-2xl text-sm" style={{ color: 'var(--m-slate-2)' }}>
          Every privacy-sensitive capability, and the switch that turns it on. Approving a control
          records who approved it and when — the audit trail for the NPC filing. Features read this
          board, so a control that isn’t <strong>Active</strong> stays off everywhere.
          <span className="mt-1 block" style={{ color: 'var(--m-slate-3)' }}>
            {activeCount} of {controls.length} active.
          </span>
        </p>
      </header>

      {search.error ? <FormFlash tone="error">{search.error}</FormFlash> : null}
      {search.flash ? <FormFlash tone="success">{search.flash}</FormFlash> : null}

      <ul className="space-y-3">
        {controls.map((c) => (
          <ControlCard key={c.control_key} control={c} />
        ))}
      </ul>

      <NpcDocuments />
    </div>
  );
}

/**
 * The NPC submission document set, downloadable (admin-only) from here. The full
 * packet is featured; the individual documents follow, grouped. Files stream
 * through /admin/data-privacy/documents/[key] — internal compliance docs, never
 * public. These are DPO-prepared drafts pending external counsel review before
 * actual lodging (per the dossier's own filing gate).
 */
function NpcDocuments() {
  const packet = NPC_DOCUMENTS.find((d) => d.group === 'packet');
  const rest = NPC_DOCUMENTS.filter((d) => d.group !== 'packet');
  const groups: NpcDocGroup[] = ['executive', 'pack', 'companion', 'audit'];

  return (
    <section className="mt-10">
      <h2 className="sn-sec flex items-center gap-2">
        <FileText aria-hidden className="h-4 w-4" strokeWidth={1.75} /> NPC submission documents
      </h2>
      <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--m-slate-2)' }}>
        The DPO-prepared filing set for the National Privacy Commission, as PDFs. Download the full
        packet or any single document. These are <strong>drafts pending external counsel review</strong>{' '}
        before lodging — internal only, never shared publicly.
      </p>

      {packet ? (
        <Link
          href={`/admin/data-privacy/documents/${packet.key}`}
          prefetch={false}
          className="sn-tile sn-press mt-4 flex items-center justify-between gap-4"
        >
          <span className="flex items-start gap-3">
            <FolderArchive aria-hidden className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
            <span>
              <span className="block text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
                {packet.title}
              </span>
              <span className="mt-0.5 block text-sm" style={{ color: 'var(--m-slate-2)' }}>
                Every document below, merged into one PDF.
              </span>
            </span>
          </span>
          <Download aria-hidden className="h-5 w-5 shrink-0" style={{ color: 'var(--m-slate-3)' }} strokeWidth={1.75} />
        </Link>
      ) : null}

      {groups.map((g) => {
        const docs = rest.filter((d) => d.group === g);
        if (docs.length === 0) return null;
        return (
          <div key={g} className="mt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
              {NPC_DOC_GROUP_LABEL[g]}
            </p>
            <ul className="mt-2 space-y-1.5">
              {docs.map((d) => (
                <li key={d.key}>
                  <Link
                    href={`/admin/data-privacy/documents/${d.key}`}
                    prefetch={false}
                    className="sn-tile sn-press flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="flex items-center gap-2.5">
                      <FileText aria-hidden className="h-4 w-4 shrink-0" style={{ color: 'var(--m-slate-3)' }} strokeWidth={1.75} />
                      <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                        {d.title}
                      </span>
                    </span>
                    <Download aria-hidden className="h-4 w-4 shrink-0" style={{ color: 'var(--m-slate-3)' }} strokeWidth={1.75} />
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

function ControlCard({ control: c }: { control: PrivacyControlRow }) {
  const meta = STATUS_META[c.status];
  const StatusIcon = meta.icon;
  const toneColor =
    meta.tone === 'active'
      ? 'var(--sn-success, #157347)'
      : meta.tone === 'blocked'
        ? 'var(--sn-danger, #b42318)'
        : 'var(--m-slate-3)';

  return (
    <li className="sn-tile">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ color: toneColor, background: 'var(--m-line-soft)' }}
            >
              <StatusIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {meta.label}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
              {c.category}
            </span>
          </div>
          <h2 className="mt-2 text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
            {c.title}
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--m-slate-2)' }}>
            {c.description}
          </p>
          {c.risk_note ? (
            <p
              className="mt-2 rounded-md px-3 py-2 text-xs"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              <strong>Why it’s sensitive:</strong> {c.risk_note}
            </p>
          ) : null}
          {c.status === 'active' && c.approved_at ? (
            <p className="mt-2 text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Approved {relativeTime(c.approved_at)}
              {c.note ? ` · “${c.note}”` : ''}
            </p>
          ) : c.note ? (
            <p className="mt-2 text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Note: “{c.note}”
            </p>
          ) : null}
        </div>

        {/* Approve / turn off / block */}
        <form action={setDataPrivacyControl} className="flex shrink-0 flex-col items-stretch gap-2">
          <input type="hidden" name="control_key" value={c.control_key} />
          <input
            type="text"
            name="note"
            defaultValue={c.note ?? ''}
            placeholder="Note (optional)"
            maxLength={1000}
            className="w-44 rounded-md border px-2.5 py-1.5 text-xs"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
          />
          <div className="flex gap-2">
            {c.status !== 'active' ? (
              <SubmitButton
                name="status"
                value="active"
                className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: 'var(--m-ink)' }}
              >
                Approve · activate
              </SubmitButton>
            ) : (
              <SubmitButton
                name="status"
                value="inactive"
                className="flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
              >
                Turn off
              </SubmitButton>
            )}
            {c.status !== 'blocked' ? (
              <SubmitButton
                name="status"
                value="blocked"
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: 'var(--sn-danger, #b42318)', color: 'var(--sn-danger, #b42318)' }}
              >
                Block
              </SubmitButton>
            ) : null}
          </div>
        </form>
      </div>
    </li>
  );
}
