import Link from 'next/link';
import { CheckCircle2, Clock, Gavel, MinusCircle, Circle, AlertTriangle, ArrowRight } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { relativeTime } from '@/lib/activity';
import {
  fetchNpcFilingTasks,
  isFilingCounselGated,
  NPC_TIER_LABEL,
  NPC_TASK_STATUS_LABEL,
  NPC_TASK_KIND_LABEL,
  type NpcTaskRow,
  type NpcTaskStatus,
} from '@/lib/npc-filing-tasks';
import { TaskActions } from './task-actions';

/**
 * NPC pre-filing checklist — the "checklist" tab of the compliance hub.
 *
 * The counsel-prepared worklist (lib/npc-filing-tasks) the owner + DPO work down
 * before lodging with the National Privacy Commission. Task status updates run
 * IN PLACE (TaskActions / useActionState) so a status flip never navigates the
 * hub. The header can never render a terminal "ready to file" state; the
 * NOT-FILED banner + the counsel gate keep the board honest.
 */

const STATUS_ICON: Record<NpcTaskStatus, typeof CheckCircle2> = {
  resolved: CheckCircle2,
  in_progress: Clock,
  blocked_on_counsel: Gavel,
  not_applicable: MinusCircle,
  not_started: Circle,
};

export async function NpcChecklist() {
  const admin = createAdminClient();
  const tasks = await fetchNpcFilingTasks(admin);
  const total = tasks.length;
  const resolved = tasks.filter((t) => t.status === 'resolved').length;
  const naCount = tasks.filter((t) => t.status === 'not_applicable').length;
  const counselGatedStill = isFilingCounselGated(tasks);
  const blockers = tasks.filter((t) => t.severity === 'blocking' && t.status !== 'resolved');
  const headline = counselGatedStill
    ? `${resolved} of ${total} worked down · external counsel review outstanding — NOT cleared to file`
    : `${resolved} of ${total} worked down · counsel review recorded — still verify every blocker before lodging`;
  const tiers: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];

  return (
    <div>
      <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
        {headline}
        {naCount > 0 ? ` · ${naCount} marked N/A` : ''}.
      </p>

      {/* Anti-false-assurance banner — a green count is not clearance to file. */}
      <div
        className="mt-4 mb-6 flex items-start gap-3 rounded-xl border px-4 py-3.5"
        style={{ borderColor: 'var(--sn-danger, #b42318)', background: 'rgba(180,35,24,0.06)', color: 'var(--sn-danger, #b42318)' }}
      >
        <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <p className="text-sm leading-relaxed">
          <strong>NOT FILED.</strong> External Philippine counsel review is a required gate. A green
          count here means the work is staged — it does <strong>not</strong> mean Setnayan is
          compliant or cleared to lodge with the NPC.
        </p>
      </div>

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
            <h3 className="sn-sec">{NPC_TIER_LABEL[tier]}</h3>
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
  const statusColor =
    t.status === 'resolved'
      ? 'var(--sn-success, #157347)'
      : t.status === 'blocked_on_counsel'
        ? 'var(--m-orange-2)'
        : isBlocker
          ? 'var(--sn-danger, #b42318)'
          : 'var(--m-slate-3)';

  return (
    <li
      id={t.key}
      className="sn-tile scroll-mt-24"
      style={isBlocker && t.status !== 'resolved' ? { borderColor: 'var(--sn-danger, #b42318)' } : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ color: statusColor, background: 'var(--m-line-soft)' }}
            >
              <StatusIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {NPC_TASK_STATUS_LABEL[t.status]}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
              {t.key} · {NPC_TASK_KIND_LABEL[t.kind]}
            </span>
            {isBlocker ? (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: 'rgba(180,35,24,0.1)', color: 'var(--sn-danger, #b42318)' }}
              >
                Blocker
              </span>
            ) : null}
            {t.counselGated ? (
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
              >
                <Gavel aria-hidden className="h-3 w-3" strokeWidth={2} /> Counsel-gated
              </span>
            ) : null}
          </div>
          <h4 className="mt-2 text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
            {t.title}
          </h4>
          <p className="mt-1 text-sm" style={{ color: 'var(--m-slate-2)' }}>
            {t.detail}
          </p>
          {t.note || t.evidence || (t.status === 'resolved' && t.resolvedAt) ? (
            <div className="mt-2 space-y-0.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
              {t.evidence ? <p><strong>Evidence:</strong> {t.evidence}</p> : null}
              {t.note ? <p><strong>Note:</strong> {t.note}</p> : null}
              {t.status === 'resolved' && t.resolvedAt ? <p>Resolved {relativeTime(t.resolvedAt)}</p> : null}
            </div>
          ) : null}
          {t.relatedControlKey ? (
            <Link
              href="/admin/data-privacy?tab=controls"
              scroll={false}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
              style={{ color: 'var(--m-orange-2)' }}
            >
              Related privacy control <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          ) : null}
        </div>

        {/* Status / note / evidence — in-place via useActionState, no page nav */}
        <TaskActions task={t} counselGatedStill={counselGatedStill} />
      </div>
    </li>
  );
}
