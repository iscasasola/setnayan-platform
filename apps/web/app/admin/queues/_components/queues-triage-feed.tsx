/**
 * QueuesTriageFeed — admin mobile triage action feed (v2.1 nav · 2026-06-05).
 *
 * WHY: the Queues bottom-nav tab previously landed on a flat 7-card menu
 * (MobileLandingGrid). On a phone the admin's job is to clear time-sensitive
 * work, not browse a menu — so this replaces the menu with a single
 * PRIORITIZED action feed: every open queue with its live open-count, the
 * busiest queue first, each row a 64px tap target straight into the queue.
 *
 * Per the 0023 §5 "mobile = urgent approvals" rule. Desktop is untouched —
 * admins use the sidebar tree there, so this stays lg:hidden exactly like
 * the MobileLandingGrid it replaces (orphan-prevention: every row maps 1:1
 * to a sidebar entry).
 *
 * Presentational only. The page (../page.tsx) does the data fetch and hands
 * down already-ordered rows + the total-open tally. count === null means the
 * tally is momentarily unavailable (query degraded) — the row still routes.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] all copy is brand-voice;
 * no schema names or engineering jargon leak into the UI.
 */

import Link from 'next/link';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react';

export type TriageItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** 1-line brand-voice description rendered under the label. */
  description: string;
  /** Live open-count. 0 = clear · null = momentarily unavailable. */
  count: number | null;
};

type Props = {
  /** Rows pre-ordered busiest-first by the page. */
  items: TriageItem[];
  /** Sum of open counts across all queues. */
  totalOpen: number;
};

export function QueuesTriageFeed({ items, totalOpen }: Props) {
  const subtitle =
    totalOpen === 0
      ? "You're all caught up — nothing is waiting on you right now."
      : `${totalOpen} ${totalOpen === 1 ? 'item needs' : 'items need'} your attention across all queues.`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:hidden">
      <header className="mb-6 space-y-2">
        <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
          Admin
        </p>
        <h1 className="m-display-tight text-3xl" style={{ color: 'var(--m-ink)' }}>
          Queues
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
            All queues clear. Tap any queue to review history or recent decisions.
          </span>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          const open = (item.count ?? 0) > 0;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className="m-card flex items-center gap-3 p-4 transition-colors hover:bg-[var(--m-paper)]"
                style={{ color: 'var(--m-ink)', minHeight: 64 }}
              >
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
                  style={{ background: 'var(--m-paper-2)' }}
                >
                  <Icon
                    aria-hidden
                    className="h-5 w-5"
                    strokeWidth={1.75}
                    style={{ color: open ? 'var(--m-orange-2)' : 'var(--m-slate)' }}
                  />
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className="text-base font-semibold"
                    style={{ color: 'var(--m-ink)' }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="truncate text-xs"
                    style={{ color: 'var(--m-slate)' }}
                  >
                    {item.description}
                  </span>
                </span>

                {open ? (
                  <span
                    className="inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full px-2 text-sm font-semibold"
                    style={{ background: 'var(--m-orange-2)', color: 'white' }}
                    aria-label={`${item.count} waiting`}
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
        })}
      </ul>
    </div>
  );
}
