/**
 * QueuesTriageFeed — the admin command center: every open queue in one ranked
 * worklist, most-urgent first, each row one click into the work.
 *
 * WHY: the admin's job is to CLEAR time-sensitive work, not browse a menu. The
 * page (../../work/page.tsx) ranks the rows — overdue (past SLA) first, then
 * due-soon, then busiest — and hands them down already ordered. This component
 * is presentational: it splits the ranked list into a "Needs attention now"
 * group (anything overdue) and the rest, and renders both at every breakpoint
 * (single column on phones, two-up on desktop). It is the desktop home AND the
 * mobile Work tab — the old lg:hidden mobile-only limit is gone (2026-06-28).
 *
 * count === null = the tally is momentarily unavailable (query degraded) — the
 * row still routes. Per [[feedback_setnayan_no_dev_text_post_launch]] all copy
 * is brand-voice; no schema names leak into the UI.
 */

import Link from 'next/link';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react';
import type {
  AdminQueueLane,
  AdminQueueDueState,
} from '@/lib/admin/queue-counts';

export type TriageItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** 1-line brand-voice description rendered under the label. */
  description: string;
  /** Live open-count. 0 = clear · null = momentarily unavailable. */
  count: number | null;
  /** Consequence bucket (rendered as a small tag). */
  lane?: AdminQueueLane;
  /** Urgency of the oldest open item vs the queue's SLA. */
  dueState?: AdminQueueDueState;
  /** Age line shown in place of the description when there's open work. */
  ageLabel?: string;
};

type Props = {
  /** Rows pre-ordered most-urgent-first by the page. */
  items: TriageItem[];
  /** Sum of open counts across all queues. */
  totalOpen: number;
  /** Page heading. Defaults to "Queues"; the Work landing passes "Work". */
  title?: string;
};

const LANE_LABEL: Record<AdminQueueLane, string> = {
  money: 'Money',
  trust: 'Trust',
  growth: 'Growth',
  support: 'Support',
};

// Accent + badge colour by urgency. ok/open keeps the brand orange; overdue and
// due-soon escalate to red / amber so the eye lands on the deadline first.
const DUE_ACCENT: Partial<Record<AdminQueueDueState, string>> = {
  overdue: '#B42318',
  'due-soon': '#B54708',
};

function badgeColor(dueState?: AdminQueueDueState): string {
  if (dueState === 'overdue') return '#B42318';
  if (dueState === 'due-soon') return '#B54708';
  return 'var(--m-orange-2)';
}

function TriageRow({ item }: { item: TriageItem }) {
  const Icon = item.icon;
  const open = (item.count ?? 0) > 0;
  const accent = DUE_ACCENT[item.dueState ?? 'ok'];
  return (
    <li>
      <Link
        href={item.href}
        className="m-card flex items-center gap-3 p-4 transition-colors hover:bg-[var(--m-paper)]"
        style={{
          color: 'var(--m-ink)',
          minHeight: 64,
          borderLeft: accent ? `3px solid ${accent}` : undefined,
        }}
      >
        <span
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
          style={{ background: 'var(--m-paper-2)' }}
        >
          <Icon
            aria-hidden
            className="h-5 w-5"
            strokeWidth={1.75}
            style={{ color: open ? badgeColor(item.dueState) : 'var(--m-slate)' }}
          />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span
              className="text-base font-semibold"
              style={{ color: 'var(--m-ink)' }}
            >
              {item.label}
            </span>
            {item.lane ? (
              <span
                className="m-label-mono shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                style={{ background: 'var(--m-paper-2)', color: 'var(--m-slate-2)' }}
              >
                {LANE_LABEL[item.lane]}
              </span>
            ) : null}
          </span>
          <span
            className="truncate text-xs"
            style={{ color: accent ?? 'var(--m-slate)' }}
          >
            {open && item.ageLabel ? item.ageLabel : item.description}
          </span>
        </span>

        {open ? (
          <span
            className="inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full px-2 text-sm font-semibold"
            style={{ background: badgeColor(item.dueState), color: 'white' }}
            aria-label={`${item.count} waiting${item.dueState === 'overdue' ? ', past SLA' : ''}`}
          >
            {item.count}
          </span>
        ) : item.count === null ? (
          <ChevronRight
            aria-hidden
            className="h-5 w-5 shrink-0"
            style={{ color: 'var(--m-slate-2)' }}
          />
        ) : (
          <Check
            aria-label="clear"
            className="h-5 w-5 shrink-0"
            strokeWidth={2}
            style={{ color: 'var(--m-slate-2)' }}
          />
        )}
      </Link>
    </li>
  );
}

export function QueuesTriageFeed({ items, totalOpen, title = 'Queues' }: Props) {
  const subtitle =
    totalOpen === 0
      ? "You're all caught up — nothing is waiting on you right now."
      : `${totalOpen} ${totalOpen === 1 ? 'item needs' : 'items need'} your attention across all queues.`;

  const overdue = items.filter((i) => i.dueState === 'overdue');
  const rest = items.filter((i) => i.dueState !== 'overdue');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:max-w-5xl lg:py-8">
      <header className="mb-6 space-y-2">
        <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
          Admin
        </p>
        <h1 className="m-display-tight text-3xl" style={{ color: 'var(--m-ink)' }}>
          {title}
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          {subtitle}
        </p>
      </header>

      {totalOpen === 0 && (
        <div
          className="m-card mb-4 flex items-center gap-3 p-4"
          style={{ color: 'var(--m-ink)' }}
        >
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--m-paper-2)' }}
          >
            <Check
              aria-hidden
              className="h-5 w-5"
              strokeWidth={2}
              style={{ color: 'var(--m-slate)' }}
            />
          </span>
          <span className="text-sm" style={{ color: 'var(--m-slate)' }}>
            All queues clear. Open any queue to review history or recent decisions.
          </span>
        </div>
      )}

      {overdue.length > 0 && (
        <section className="mb-8">
          <h2
            className="m-label-mono mb-3 flex items-center gap-2"
            style={{ color: '#B42318' }}
          >
            Needs attention now
            <span
              className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
              style={{ background: '#B42318', color: 'white' }}
            >
              {overdue.length}
            </span>
          </h2>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {overdue.map((item) => (
              <TriageRow key={item.key} item={item} />
            ))}
          </ul>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          {overdue.length > 0 && (
            <h2 className="m-label-mono mb-3" style={{ color: 'var(--m-slate-2)' }}>
              All queues
            </h2>
          )}
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {rest.map((item) => (
              <TriageRow key={item.key} item={item} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
