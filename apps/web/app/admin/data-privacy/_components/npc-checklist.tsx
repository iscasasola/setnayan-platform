import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { Badge, Facts, Row, Rows, Sec } from '@/app/admin/app-performance/_components/insights-parts';
import { createAdminClient } from '@/lib/supabase/admin';
import { relativeTime } from '@/lib/activity';
import {
  fetchNpcFilingTasksMeasured,
  isFilingCounselGated,
  NPC_TIER_LABEL,
  NPC_TASK_STATUS_LABEL,
  NPC_TASK_KIND_LABEL,
  type NpcTaskRow,
  type NpcTaskStatus,
} from '@/lib/npc-filing-tasks';
import { TaskActions } from './task-actions';
import { formatCount } from '@/lib/format-number';
import { ReadFailed } from '../../_components/read-failed';

/**
 * NPC pre-filing checklist — the "checklist" tab of the compliance hub.
 *
 * The counsel-prepared worklist (lib/npc-filing-tasks) the owner + DPO work down
 * before lodging with the National Privacy Commission. Task status updates run
 * IN PLACE (TaskActions / useActionState) so a status flip never navigates the
 * hub. The header can never render a terminal "ready to file" state; the
 * NOT-FILED banner + the counsel gate keep the board honest.
 *
 * Drawn to the Insights drawing (admin_pub/insights.html › Privacy & NPC › NPC checklist): the headline, the NOT FILED
 * line with its reason in an ⓘ, the blockers as rows that open their task, then one fold per task in its tier.
 */

const STATUS_TONE: Record<NpcTaskStatus, 'ok' | 'warn' | 'info' | undefined> = {
  resolved: 'ok',
  in_progress: 'info',
  blocked_on_counsel: 'warn',
  not_applicable: undefined,
  not_started: undefined,
};

export async function NpcChecklist() {
  const admin = createAdminClient();
  const { ok: tasksOk, tasks } = await fetchNpcFilingTasksMeasured(admin);
  // Every task is the catalog default when the read failed — "0 of N worked down"
  // and a task list with no progress would be a measurement nobody took.
  if (!tasksOk) return <ReadFailed what="the filing checklist" />;
  const total = tasks.length;
  const resolved = tasks.filter((t) => t.status === 'resolved').length;
  const naCount = tasks.filter((t) => t.status === 'not_applicable').length;
  const counselGatedStill = isFilingCounselGated(tasks);
  const blockers = tasks.filter((t) => t.severity === 'blocking' && t.status !== 'resolved');
  const headline = counselGatedStill
    ? `${formatCount(resolved)} of ${formatCount(total)} worked down · external counsel review outstanding — NOT cleared to file`
    : `${formatCount(resolved)} of ${formatCount(total)} worked down · counsel review recorded — still verify every blocker before lodging`;
  const tiers: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];

  return (
    <div data-npc-checklist="">
      <p className="mt-1 text-sm text-ink/70">
        {headline}
        {naCount > 0 ? ` · ${formatCount(naCount)} marked N/A` : ''}.
      </p>

      {/* Anti-false-assurance line — a green count is not clearance to file. The words stay; the reason is its ⓘ. */}
      <p role="note" className="my-2 flex items-center gap-2 text-sm text-[var(--sn-danger)]">
        <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <strong>NOT FILED.</strong>
        <InfoTip label="Counsel is a required gate" align="start">
          External Philippine counsel review is a required gate. A green count here means the work is staged — it does
          not mean Setnayan is compliant or cleared to lodge with the NPC.
        </InfoTip>
      </p>

      {blockers.length > 0 ? (
        <section>
          <Sec title="Blockers — resolve before filing" count={blockers.length} />
          <Rows label="Blockers — resolve before filing">
            {blockers.map((t) => (
              <Row key={t.key} href={`#${t.key}`} title={`${t.key} · ${t.title}`} tone="danger" />
            ))}
          </Rows>
        </section>
      ) : null}

      {tiers.map((tier) => {
        const rows = tasks.filter((t) => t.tier === tier);
        if (rows.length === 0) return null;
        return (
          <section key={tier}>
            <Sec title={NPC_TIER_LABEL[tier]} count={rows.length} />
            <ul className="[&>li:first-child]:border-t-0">
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
  const isBlocker = t.severity === 'blocking';
  const open = isBlocker && t.status !== 'resolved';
  const line = [
    t.key,
    NPC_TASK_KIND_LABEL[t.kind],
    t.counselGated ? 'Counsel-gated' : null,
    isBlocker ? 'Blocker' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="scroll-mt-24 border-t border-ink/10" data-npc-task={t.key}>
      {/* `anchor` puts id={t.key} on the fold, and a link ending in #t0-1 (the Blockers rows) opens it in place. */}
      <Fold
        title={t.title}
        line={line}
        wrap
        anchor={t.key}
        popovers
        aside={
          <Badge tone={open && t.status === 'not_started' ? 'danger' : STATUS_TONE[t.status]}>
            {NPC_TASK_STATUS_LABEL[t.status]}
          </Badge>
        }
        data="npc-task"
      >
        <p className="whitespace-pre-line pb-2 text-sm text-ink/70">{t.detail}</p>
        {t.note || t.evidence || (t.status === 'resolved' && t.resolvedAt) ? (
          <Facts
            rows={[
              ...(t.evidence ? ([['Evidence', t.evidence]] as [string, string][]) : []),
              ...(t.note ? ([['Note', t.note]] as [string, string][]) : []),
              ...(t.status === 'resolved' && t.resolvedAt
                ? ([['Resolved', relativeTime(t.resolvedAt)]] as [string, string][])
                : []),
            ]}
          />
        ) : null}

        {/* Status / note / evidence — in-place via useActionState, no page nav */}
        <TaskActions task={t} counselGatedStill={counselGatedStill} />

        {t.relatedControlKey ? (
          <Link
            href="/admin/data-privacy?tab=controls"
            scroll={false}
            className="mb-2 inline-flex min-h-11 items-center gap-1 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink hover:bg-ink/[0.03]"
          >
            Related privacy control <ArrowRight aria-hidden className="h-4 w-4 text-[var(--sn-accent)]" strokeWidth={1.75} />
          </Link>
        ) : null}
      </Fold>
    </li>
  );
}
