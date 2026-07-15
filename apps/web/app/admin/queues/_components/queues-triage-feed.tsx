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

// Returns a TEXT-SAFE colour: the count badge renders white text on this as a
// background, so the open/ok case uses a darker champagne (#8A6A2E ≈ 4.7:1 vs
// white) rather than reading --m-orange-2 (now #8A6B39 ≈ 4.9:1 after the
// Atelier swap) directly. overdue/due-soon are already AA-dark.
function badgeColor(dueState?: AdminQueueDueState): string {
  if (dueState === 'overdue') return '#B42318';
  if (dueState === 'due-soon') return '#B54708';
  return '#8A6A2E';
}

function TriageRow({ item }: { item: TriageItem }) {
  const Icon = item.icon;
  const open = (item.count ?? 0) > 0;
  const accent = DUE_ACCENT[item.dueState ?? 'ok'];
  return (
    <li>
      <Link
        href={item.href}
        className="sn-row flex items-center gap-3 p-4 transition-colors hover:bg-[var(--sn-paper)]"
        style={{
          color: 'var(--sn-ink-900)',
          minHeight: 64,
          borderLeft: accent ? `3px solid ${accent}` : undefined,
        }}
      >
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-ink/5">
          <Icon
            aria-hidden
            className="h-5 w-5"
            strokeWidth={1.75}
            style={{ color: open ? badgeColor(item.dueState) : 'var(--sn-ink-500)' }}
          />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span
              className="text-base font-semibold"
              style={{ color: 'var(--sn-ink-900)' }}
            >
              {item.label}
            </span>
            {item.lane ? (
              <span className="shrink-0 rounded bg-ink/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.10em] text-[color:var(--sn-ink-500)]">
                {LANE_LABEL[item.lane]}
              </span>
            ) : null}
          </span>
          <span
            className="truncate text-xs"
            style={{ color: accent ?? 'var(--sn-ink-500)' }}
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
            style={{ color: 'var(--sn-ink-500)' }}
          />
        ) : (
          <Check
            aria-label="clear"
            className="h-5 w-5 shrink-0"
            strokeWidth={2}
            style={{ color: 'var(--sn-ink-500)' }}
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
        <p className="sn-eye">Admin</p>
        <h1 className="sn-h1">{title}</h1>
        <p className="text-sm text-[color:var(--sn-ink-500)]">{subtitle}</p>
      </header>

      {totalOpen === 0 && (
        <div
          className="sn-tile mb-4 flex items-center gap-3 p-4"
          style={{ color: 'var(--sn-ink-900)' }}
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/5">
            <Check
              aria-hidden
              className="h-5 w-5"
              strokeWidth={2}
              style={{ color: 'var(--sn-ink-500)' }}
            />
          </span>
          <span className="text-sm text-[color:var(--sn-ink-500)]">
            All queues clear. Open any queue to review history or recent decisions.
          </span>
        </div>
      )}

      {overdue.length > 0 && (
        <section className="mb-8">
          <h2
            className="sn-eye mb-3 flex items-center gap-2"
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
            <h2 className="sn-eye mb-3">All queues</h2>
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
