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
import { Check, ChevronRight, ShieldAlert, type LucideIcon } from 'lucide-react';
import type { QueuePeek } from '@/lib/admin/queue-peek';
import { partitionQueues } from '@/lib/admin/queue-partition';
import { EXPANDABLE_QUEUES } from '@/lib/admin/queue-peek';
import { QueueDrawer } from './queue-drawer';
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
  /** Items behind this row, when the queue is the one `?open=` names. */
  peek?: QueuePeek | null;
};

type Props = {
  /** Rows pre-ordered most-urgent-first by the page. */
  items: TriageItem[];
  /** Sum of open counts across all queues. */
  totalOpen: number;
  /** Page heading. Defaults to "Queues"; the Work landing passes "Work". */
  title?: string;
  /**
   * Active lane filter from `?lane=`. Undefined = show everything.
   * Filtering is URL-driven rather than client state so this stays a Server
   * Component: the chips are plain links, they work with JS off, and a filtered
   * view is bookmarkable. (The rest of the admin uses the same `?tab=`/`?view=`
   * convention.)
   */
  lane?: AdminQueueLane;
  /** Base path the lane chips link to. */
  basePath?: string;
  /** The queue currently expanded via `?open=`, if any. */
  openKey?: string;
};

const LANE_LABEL: Record<AdminQueueLane, string> = {
  money: 'Money',
  trust: 'Trust',
  growth: 'Growth',
  support: 'Support',
};

const LANE_ORDER: AdminQueueLane[] = ['money', 'trust', 'growth', 'support'];

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

function TriageRow({
  item,
  toggleHref,
}: {
  item: TriageItem;
  /** Opens this row, or closes it when it is the open one. Absent ⇒ plain link. */
  toggleHref?: string;
}) {
  const Icon = item.icon;
  const open = (item.count ?? 0) > 0;
  const accent = DUE_ACCENT[item.dueState ?? 'ok'];
  return (
    <li>
      <Link
        href={toggleHref ?? item.href}
        aria-expanded={toggleHref ? Boolean(item.peek) : undefined}
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
      {item.peek ? (
        <QueueDrawer
          peek={item.peek}
          href={item.href}
          label={item.label}
          backTo={toggleHref ?? '/admin/work'}
        />
      ) : null}
    </li>
  );
}

/**
 * The morning read: how much of the open work is late, close, or fine.
 *
 * Counts ITEMS WAITING, not queues — the same unit as the nav badge and the
 * subtitle, so no two numbers on this screen mean different things. Built from
 * the UNFILTERED list on purpose: the strip is the whole picture, and a lane
 * filter narrows the list below it without hiding how the day actually looks.
 */
function triageTotals(items: TriageItem[]) {
  let late = 0,
    soon = 0,
    onPace = 0;
  for (const i of items) {
    const n = i.count ?? 0;
    if (n <= 0) continue;
    if (i.dueState === 'overdue') late += n;
    else if (i.dueState === 'due-soon') soon += n;
    else onPace += n;
  }
  return { late, soon, onPace, total: late + soon + onPace };
}

function TriageStrip({ items }: { items: TriageItem[] }) {
  const { late, soon, onPace, total } = triageTotals(items);
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;
  const parts: Array<[number, string, string]> = [
    [late, 'past promise', '#B42318'],
    [soon, 'due soon', '#B54708'],
    [onPace, 'on pace', '#8A6A2E'],
  ];
  return (
    <div className="sn-tile mb-5 p-4">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        {parts.map(([n, label, colour]) => (
          <span key={label} className="flex items-baseline gap-1.5">
            <span
              className="font-mono text-xl font-bold tabular-nums"
              style={{ color: n > 0 ? colour : 'var(--sn-ink-500)' }}
            >
              {n}
            </span>
            <span className="text-xs text-[color:var(--sn-ink-500)]">{label}</span>
          </span>
        ))}
      </div>
      <div
        className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-ink/5"
        role="img"
        aria-label={`${late} past promise, ${soon} due soon, ${onPace} on pace`}
      >
        {parts.map(([n, label, colour]) =>
          n > 0 ? (
            <span key={label} style={{ width: pct(n), background: colour }} />
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Lane chips as links — see the `lane` prop note on why this isn't client state. */
function LaneChips({
  items,
  lane,
  basePath,
}: {
  items: TriageItem[];
  lane?: AdminQueueLane;
  basePath: string;
}) {
  const waiting = (rows: TriageItem[]) =>
    rows.reduce((sum, i) => sum + Math.max(0, i.count ?? 0), 0);

  const present = LANE_ORDER.filter((l) => items.some((i) => i.lane === l));
  if (present.length < 2) return null; // a filter with one option is not a filter

  const chip = (href: string, label: string, n: number, active: boolean) => (
    <Link
      key={label}
      href={href}
      aria-current={active ? 'true' : undefined}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
      style={{
        borderColor: active ? '#8A6A2E' : 'var(--sn-line)',
        background: active ? 'var(--sn-paper)' : 'transparent',
        color: active ? '#8A6A2E' : 'var(--sn-ink-500)',
      }}
    >
      {label}
      <span className="font-mono text-[10px] opacity-70">{n}</span>
    </Link>
  );

  return (
    <div className="mb-5 flex flex-wrap gap-2" aria-label="Filter by lane">
      {chip(basePath, 'All', waiting(items), !lane)}
      {present.map((l) =>
        chip(
          `${basePath}?lane=${l}`,
          LANE_LABEL[l],
          waiting(items.filter((i) => i.lane === l)),
          lane === l,
        ),
      )}
    </div>
  );
}

/**
 * What each refusal means, in the admin's words rather than the code's.
 *
 * 🔑 A SHORT PAYMENT AND A DUPLICATE REFERENCE MUST NOT BE ANNOUNCED THE SAME
 * WAY. One means "wait for the rest of the money"; the other means "someone may
 * be claiming a transfer twice". Collapsing them into a generic "couldn't do
 * that" throws away the only part an admin can act on.
 */
const SETTLE_NOTICES: Record<string, { tone: 'warn' | 'ok'; headline: string }> = {
  shortfall: { tone: 'warn', headline: 'Not enough money to finish this order' },
  duplicate: { tone: 'warn', headline: 'This reference has been used before' },
  refused: { tone: 'warn', headline: 'That could not be done' },
  missing: { tone: 'warn', headline: 'Nothing was sent — try again' },
  published: { tone: 'ok', headline: 'Published' },
};

export function QueuesTriageFeed({
  items,
  totalOpen,
  title = 'Queues',
  lane,
  basePath = '/admin/work',
  openKey,
  settle,
  why,
}: Props & { settle?: string; why?: string }) {
  // Derived from the rows this page actually renders — never a typed number, so
  // adding or removing a queue cannot leave the sentence below saying something
  // untrue about its own coverage.
  const queueCount = items.length;
  /*
    🚨 "ALL CAUGHT UP" WAS A CLAIM ABOUT 14 QUEUES, NOT ALL OF THEM. Owner, on a
    phone, 2026-08-18: the page read "You're all caught up — nothing is waiting
    on you right now" and "14 queues are clear", while TEN other queue-shaped
    admin surfaces are not counted here at all — among them vendor PAYOUTS and
    the FRAUD queue. Some are excluded on purpose (judgement queues get no
    one-click action, by design); none of that was said out loud.

    🔑 A SCREEN MAY ONLY CLAIM WHAT IT MEASURED. "Nothing is waiting on you"
    reads as everything, and the day something lands in an uncounted queue it
    becomes false without changing. Same family as the empty-read that says
    "nothing here" without knowing — and this one is read by the person whose
    job is to notice.

    The count is DERIVED from the rows actually rendered, never typed, so a
    queue added or removed cannot make this sentence stale.
  */
  const subtitle =
    totalOpen === 0
      ? `Nothing waiting in the ${queueCount} ${queueCount === 1 ? 'queue' : 'queues'} tracked here. ` +
        `Other admin surfaces are not counted on this page — see All surfaces.`
      : `${totalOpen} ${totalOpen === 1 ? 'item needs' : 'items need'} your attention across the ` +
        `${queueCount} ${queueCount === 1 ? 'queue' : 'queues'} tracked here.`;

  // The strip + chips read the FULL list; only the rows below are filtered.
  // Opening a row keeps the lane filter; closing drops only `open`. Built here
  // rather than in the row so the row stays presentational.
  // 🪤 A ROW WITH NO PEEK MUST KEEP ITS PLAIN LINK — this is the dead-tap bug
  // (found by audit 2026-08-05). Handing every row a `?open=` href made five of
  // them do NOTHING when tapped: the URL changed, no drawer existed to render,
  // the page redrew identically, and on a phone it just jumped back to the top.
  // Before the expand-in-place work those rows at least opened their queue page.
  // 🔑 A CONTROL THAT CANNOT SUCCEED MUST NOT BE OFFERED. Expansion is opt-in
  // per queue, so the toggle has to be opt-in too — otherwise adding a queue
  // silently adds a dead tap.
  const canExpand = (key: string) =>
    items.some((i) => i.key === key && (i.peek != null || EXPANDABLE_QUEUES.has(key)));

  const toggleFor = (key: string) => {
    const p = new URLSearchParams();
    if (lane) p.set('lane', lane);
    if (openKey !== key) p.set('open', key);
    const q = p.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  const shown = lane ? items.filter((i) => i.lane === lane) : items;
  const { overdue, waiting, clear } = partitionQueues(shown);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:max-w-5xl lg:py-8">
      <header className="mb-6 space-y-2">
        <p className="sn-eye">Admin</p>
        <h1 className="sn-h1">{title}</h1>
        <p className="text-sm text-[color:var(--sn-ink-500)]">{subtitle}</p>
      </header>

      {settle && SETTLE_NOTICES[settle] ? (
        (() => {
          const n = SETTLE_NOTICES[settle]!;
          const warn = n.tone === 'warn';
          return (
            <div
              role="status"
              className="sn-tile mb-4 flex items-start gap-3 p-4"
              style={{ borderColor: warn ? '#B54708' : undefined }}
            >
              {warn ? (
                <ShieldAlert
                  aria-hidden
                  className="mt-0.5 h-5 w-5 shrink-0"
                  strokeWidth={1.75}
                  style={{ color: '#B54708' }}
                />
              ) : (
                <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
              )}
              <span className="text-sm">
                <strong style={{ color: warn ? '#B54708' : 'var(--sn-ink-900)' }}>
                  {n.headline}
                </strong>
                {why ? (
                  <span className="mt-0.5 block text-[color:var(--sn-ink-500)]">{why}</span>
                ) : null}
              </span>
            </div>
          );
        })()
      ) : null}

      <TriageStrip items={items} />
      <LaneChips items={items} lane={lane} basePath={basePath} />

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
              <TriageRow
                key={item.key}
                item={item}
                toggleHref={canExpand(item.key) ? toggleFor(item.key) : undefined}
              />
            ))}
          </ul>
        </section>
      )}

      {waiting.length > 0 && (
        <section>
          {overdue.length > 0 && <h2 className="sn-eye mb-3">Also waiting</h2>}
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {waiting.map((item) => (
              <TriageRow
                key={item.key}
                item={item}
                toggleHref={canExpand(item.key) ? toggleFor(item.key) : undefined}
              />
            ))}
          </ul>
        </section>
      )}

      {/* The quiet majority. <details> because it must open with JavaScript off,
          like everything else on this page — and because a native disclosure is
          keyboard- and screen-reader-correct without a line of our own code. */}
      {clear.length > 0 && (
        <details className="mt-6 group">
          <summary
            className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg px-4 py-3 text-sm"
            style={{ color: 'var(--sn-ink-500)' }}
          >
            <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span>
              <strong style={{ color: 'var(--sn-ink-900)' }}>{clear.length}</strong>{' '}
              {clear.length === 1 ? 'queue is' : 'queues are'} clear
            </span>
            <ChevronRight
              aria-hidden
              className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
            />
          </summary>
          <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {clear.map((item) => (
              <TriageRow
                key={item.key}
                item={item}
                toggleHref={canExpand(item.key) ? toggleFor(item.key) : undefined}
              />
            ))}
          </ul>
        </details>
      )}

      {/* A lane can be chosen while every queue in it is clear. Without this the
          page would render the header and then nothing, which reads as broken
          rather than as good news. */}
      {shown.length === 0 && (
        <div className="sn-tile flex items-center gap-3 p-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/5">
            <Check
              aria-hidden
              className="h-5 w-5"
              strokeWidth={2}
              style={{ color: 'var(--sn-ink-500)' }}
            />
          </span>
          <span className="text-sm text-[color:var(--sn-ink-500)]">
            Nothing waiting in {lane ? LANE_LABEL[lane] : 'this lane'}.{' '}
            <Link href={basePath} className="underline underline-offset-2">
              See every queue
            </Link>
          </span>
        </div>
      )}
    </div>
  );
}
