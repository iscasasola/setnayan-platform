import Link from 'next/link';
import {
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Gavel,
  MinusCircle,
  ArrowRight,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { relativeTime } from '@/lib/activity';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  fetchNpcFilingTasks,
  isFilingCounselGated,
  COUNSEL_REVIEW_TASK,
  NPC_TASK_STATUS_LABEL,
  NPC_TASK_KIND_LABEL,
  NPC_TIER_LABEL,
  type NpcTaskRow,
  type NpcTaskStatus,
} from '@/lib/npc-filing-tasks';
import { setNpcFilingTask } from './actions';

export const metadata = { title: 'NPC Filing Readiness · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/npc-readiness — the NPC pre-filing readiness worklist (council verdict
 * 2026-07-16). Turns the completeness audit's Tier 0-3 checklist into tracked
 * work. This is a WORKLIST, not a gate — nothing reads task status to flip a
 * capability. It is structurally incapable of implying the filing is cleared:
 * the header can only say "counsel review outstanding" until t0-1 resolves, the
 * blocker strip is always pinned, and the standing banner never disappears.
 */

const STATUS_ICON: Record<NpcTaskStatus, typeof CheckCircle2> = {
  resolved: CheckCircle2,
  in_progress: Clock,
  blocked_on_counsel: Gavel,
  not_applicable: MinusCircle,
  not_started: Circle,
};

const STATUS_ORDER: NpcTaskStatus[] = ['not_started', 'in_progress', 'blocked_on_counsel', 'resolved'];

export default async function NpcReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; error?: string }>;
}) {
  await requireAdmin();
  const search = await searchParams;
  const admin = createAdminClient();
  const tasks = await fetchNpcFilingTasks(admin);

  const total = tasks.length;
  const resolved = tasks.filter((t) => t.status === 'resolved').length;
  const naCount = tasks.filter((t) => t.status === 'not_applicable').length;
  const counselGatedStill = isFilingCounselGated(tasks);
  const blockers = tasks.filter((t) => t.severity === 'blocking' && t.status !== 'resolved');

  // The header string is COMPUTED — it can only read "counsel review outstanding"
  // while t0-1 is unresolved, no matter how many other tasks resolve.
  const headline = counselGatedStill
    ? `${resolved} of ${total} worked down · external counsel review outstanding — NOT cleared to file`
    : `${resolved} of ${total} worked down · counsel review recorded — still verify every blocker before lodging`;

  const tiers: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-5 space-y-2">
        <p className="sn-eye flex items-center gap-2">
          <ListChecks aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          NPC filing readiness · RA 10173
        </p>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--m-ink)' }}>
          Before you file with the NPC
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
          {headline}
          {naCount > 0 ? ` · ${naCount} marked N/A` : ''}.
        </p>
        <p className="text-sm" style={{ color: 'var(--m-slate-3)' }}>
          From the{' '}
          <Link href="/admin/data-privacy" className="font-semibold underline" style={{ color: 'var(--m-orange-2)' }}>
            completeness audit
          </Link>
          . Download the documents on the Data Privacy board.
        </p>
      </header>

      {/* Standing NOT-FILED banner — never disappears until counsel review lands. */}
      <div
        className="mb-5 flex items-start gap-3 rounded-xl border px-4 py-3.5"
        style={{ borderColor: 'var(--sn-danger, #b42318)', background: 'rgba(180,35,24,0.06)', color: 'var(--sn-danger, #b42318)' }}
      >
        <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <p className="text-sm leading-relaxed">
          <strong>NOT FILED.</strong> External Philippine counsel review is a required gate. A green
          count here means the work is staged — it does <strong>not</strong> mean Setnayan is
          compliant or cleared to lodge with the NPC.
        </p>
      </div>

      {search.error ? <FormFlash tone="error">{search.error}</FormFlash> : null}
      {search.flash ? <FormFlash tone="success">{search.flash}</FormFlash> : null}

      {/* Pinned blocker strip — the B-cluster, above the tiers, always. */}
      {blockers.length > 0 ? (
        <section className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--sn-danger, #b42318)' }}>
            {blockers.length} blocker{blockers.length === 1 ? '' : 's'} — resolve before filing
          </p>
          <ul className="mt-2 space-y-1">
            {blockers.map((t) => (
              <li key={t.key} className="flex items-center gap-2 text-sm" style={{ color: 'var(--m-ink)' }}>
                <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--sn-danger, #b42318)' }} strokeWidth={2} />
                <a href={`#${t.key}`} className="hover:underline">
                  <span className="font-mono text-xs" style={{ color: 'var(--m-slate-3)' }}>{t.key}</span> · {t.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tiers.map((tier) => {
        const rows = tasks.filter((t) => t.tier === tier);
        if (rows.length === 0) return null;
        return (
          <section key={tier} className="mb-7">
            <h2 className="sn-sec">{NPC_TIER_LABEL[tier]}</h2>
            <ul className="mt-3 space-y-3">
              {rows.map((t) => (
                <TaskCard key={t.key} task={t} counselGatedStill={counselGatedStill} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TaskCard({ task: t, counselGatedStill }: { task: NpcTaskRow; counselGatedStill: boolean }) {
  const StatusIcon = STATUS_ICON[t.status];
  const isBlocker = t.severity === 'blocking';
  const isFileTask = t.key === 't3-13';
  const fileTaskFenced = isFileTask && counselGatedStill;
  const statusColor =
    t.status === 'resolved'
      ? 'var(--sn-success, #157347)'
      : t.status === 'blocked_on_counsel'
        ? 'var(--m-orange-2)'
        : isBlocker
          ? 'var(--sn-danger, #b42318)'
          : 'var(--m-slate-3)';

  return (
    <li id={t.key} className="sn-tile" style={isBlocker && t.status !== 'resolved' ? { borderColor: 'var(--sn-danger, #b42318)' } : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: statusColor, background: 'var(--m-line-soft)' }}>
              <StatusIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {NPC_TASK_STATUS_LABEL[t.status]}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
              {t.key} · {NPC_TASK_KIND_LABEL[t.kind]}
            </span>
            {isBlocker ? (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: 'rgba(180,35,24,0.1)', color: 'var(--sn-danger, #b42318)' }}>
                Blocker
              </span>
            ) : null}
            {t.counselGated ? (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}>
                <Gavel aria-hidden className="h-3 w-3" strokeWidth={2} /> Counsel-gated
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
            {t.title}
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--m-slate-2)' }}>
            {t.detail}
          </p>
          {t.relatedControlKey ? (
            <Link href="/admin/data-privacy" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: 'var(--m-orange-2)' }}>
              Related privacy control <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          ) : null}
          {(t.note || t.evidence) && (
            <div className="mt-2 space-y-0.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
              {t.evidence ? <p><strong>Evidence:</strong> {t.evidence}</p> : null}
              {t.note ? <p><strong>Note:</strong> {t.note}</p> : null}
              {t.status === 'resolved' && t.resolvedAt ? <p>Resolved {relativeTime(t.resolvedAt)}</p> : null}
            </div>
          )}
        </div>

        <form action={setNpcFilingTask} className="flex w-full shrink-0 flex-col gap-2 sm:w-56">
          <input type="hidden" name="task_key" value={t.key} />
          <input
            type="text"
            name="note"
            defaultValue={t.note ?? ''}
            placeholder={t.counselGated ? 'Counsel ref (needed to resolve)' : 'Working note'}
            maxLength={2000}
            className="w-full rounded-md border px-2.5 py-1.5 text-xs"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
          />
          <input
            type="text"
            name="evidence"
            defaultValue={t.evidence ?? ''}
            placeholder="Evidence (ref / ack no.)"
            maxLength={500}
            className="w-full rounded-md border px-2.5 py-1.5 text-xs"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
          />
          <div className="grid grid-cols-2 gap-1.5">
            {STATUS_ORDER.map((s) => {
              const active = t.status === s;
              const resolveBlocked = s === 'resolved' && fileTaskFenced;
              return (
                <SubmitButton
                  key={s}
                  name="status"
                  value={s}
                  disabled={resolveBlocked}
                  overlay={false}
                  title={resolveBlocked ? 'Resolve external counsel review (t0-1) first' : undefined}
                  className="rounded-lg border px-2 py-1 text-[11px] font-semibold"
                  style={
                    active
                      ? { background: 'var(--m-ink)', color: 'var(--m-paper)', borderColor: 'var(--m-ink)' }
                      : { borderColor: 'var(--m-line)', color: 'var(--m-slate)', opacity: resolveBlocked ? 0.5 : 1 }
                  }
                >
                  {NPC_TASK_STATUS_LABEL[s]}
                </SubmitButton>
              );
            })}
          </div>
          <SubmitButton
            name="status"
            value="not_applicable"
            overlay={false}
            className="rounded-lg border px-2 py-1 text-[11px] font-medium"
            style={
              t.status === 'not_applicable'
                ? { background: 'var(--m-slate-3)', color: 'var(--m-paper)', borderColor: 'var(--m-slate-3)' }
                : { borderColor: 'var(--m-line)', color: 'var(--m-slate-3)' }
            }
          >
            Mark N/A
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
