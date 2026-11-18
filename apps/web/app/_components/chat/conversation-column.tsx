'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  CONVERSATION_FILTERS,
  COUPLE_CONVERSATION_FILTERS,
  matchesCoupleFilter,
  matchesFilter,
  matchesSearch,
  rowPills,
  type ConversationRow,
} from '@/lib/conversation-list';
import { THREAD_STAGE_LABEL, THREAD_STAGE_TONE } from '@/lib/vendor-thread-stage';
import { formatCount } from '@/lib/format-number';

/**
 * THE LEFT COLUMN — every conversation, beside the one being read.
 *
 * Owner, 2026-09-08: *"list · conversation · context"* · *"you can rely on
 * facebook business chatbox"*. Ported from the binding prototype's list pane
 * (`chat_interface_v4_2026-09-09.html`), which draws it on BOTH sides.
 *
 * ── WHY ONE COMPONENT SERVES BOTH SIDES ─────────────────────────────────────
 * The supplier's column and the couple's column draw an identical row and
 * differ only in which chips sit above it. Two components would be two places
 * for a row to be drawn, and this repo's recurring failure is exactly that —
 * one fact rendered by two mechanisms that quietly stop agreeing. The chips are
 * the parameter; the row is not.
 *
 * ── WHY IT IS A CLIENT COMPONENT WITH NO FETCHING ───────────────────────────
 * Every row arrives already built on the server — name, last line, stage,
 * whether a reply is owed. Filtering and searching are pure functions over that
 * array, so a chip is instant and costs no round trip, and there is no second
 * place that could rank a row differently from the pill on the thread it opens.
 *
 * 🔑 DESKTOP ONLY, DELIBERATELY. On a phone this column would cover the
 * conversation it exists to navigate; the way back to the whole list there is
 * the header's own link, which already ships on both sides.
 */
export function ConversationColumn({
  rows,
  activeThreadId,
  side,
  hrefBase,
  heading,
  backHref,
  backLabel,
}: {
  rows: ConversationRow[];
  activeThreadId: string;
  side: 'vendor' | 'couple';
  /** `${hrefBase}/${threadId}` — a string, because a function cannot cross the
   *  server/client boundary as a prop. */
  hrefBase: string;
  heading?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const chips = side === 'vendor' ? CONVERSATION_FILTERS : COUPLE_CONVERSATION_FILTERS;
  const [filter, setFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

  const shown = useMemo(
    () =>
      rows.filter((r) => {
        const passesChip =
          side === 'vendor'
            ? matchesFilter(r, filter as Parameters<typeof matchesFilter>[1])
            : matchesCoupleFilter(r, filter as Parameters<typeof matchesCoupleFilter>[1]);
        return passesChip && matchesSearch(r, query);
      }),
    [rows, filter, query, side],
  );

  const activeChipLabel = chips.find((f) => f.key === filter)?.label ?? 'matching';
  const unreadCount = rows.filter((r) => r.unread).length;

  return (
    <aside className="hidden w-[17.5rem] shrink-0 flex-col overflow-hidden border-r border-[color:var(--m-line)] xl:flex">
      {heading ? (
        <div className="flex items-baseline gap-2 border-b border-[color:var(--m-line)] px-3 pb-2 pt-3">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex min-h-11 shrink-0 items-center text-[13px] font-medium text-mulberry hover:underline"
            >
              {backLabel ?? '‹ Back'}
            </Link>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{heading}</span>
          {/* The roll-up the prototype prints beside the heading: how many of
              these have something in them the reader has not seen. */}
          <span className="shrink-0 text-[13px] tabular-nums text-[color:var(--m-slate-2)]">
            {rows.length}
            {unreadCount > 0 ? ` · ${formatCount(unreadCount)} new` : ''}
          </span>
        </div>
      ) : null}

      <div className="border-b border-[color:var(--m-line)] p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          className="h-11 w-full rounded-xl border border-[color:var(--m-line)] bg-white px-3 text-sm text-ink placeholder:text-[color:var(--m-slate-3)] focus:border-mulberry focus:outline-none dark:bg-raised"
        />
      </div>

      {/* The chips scroll rather than wrap: six of them wrapped to three rows
          and pushed the conversations themselves below the fold. */}
      <div
        role="group"
        aria-label="Filter conversations"
        className="flex gap-1 overflow-x-auto border-b border-[color:var(--m-line)] px-3 py-2"
      >
        {chips.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-[13px] font-medium ${
                on
                  ? 'border-mulberry bg-mulberry text-cream'
                  : 'border-[color:var(--m-line)] bg-white text-[color:var(--m-slate-2)] hover:border-ink/30 dark:bg-raised'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          /* ⚠ SAYS WHICH EMPTY IT IS. "Nothing here" over a filtered list reads
             as "you have no conversations", which is a different and much worse
             sentence than "none of them are unanswered" — and it is the same
             disease as a refused read drawing a blank page. */
          <p className="px-4 py-6 text-center text-[13px] leading-relaxed text-[color:var(--m-slate-2)]">
            {rows.length === 0
              ? 'No conversations yet.'
              : query.trim()
                ? `Nothing matches “${query.trim()}”.`
                : `No ${activeChipLabel.toLowerCase()} conversations.`}
          </p>
        ) : (
          <ul>
            {shown.map((r) => {
              const active = r.threadId === activeThreadId;
              const pills = rowPills(r, { showUnanswered: side === 'vendor' });
              return (
                <li key={r.threadId}>
                  <Link
                    href={`${hrefBase}/${r.threadId}`}
                    aria-current={active ? 'true' : undefined}
                    /* The prototype's active row: a soft wash plus a 3px bar
                       down its left edge. The bar is a BORDER, not an inset
                       shadow — this palette's colours are
                       `rgb(var(--…) / <alpha-value>)`, so `theme(colors.mulberry)`
                       inside an arbitrary value emits the unresolved
                       `<alpha-value>` placeholder and the rule is dropped
                       silently. Transparent on the inactive rows so nothing
                       shifts by 3px when the selection moves. */
                    className={`flex gap-2.5 border-b border-l-[3px] border-[color:var(--m-line)] px-3 py-2.5 ${
                      active
                        ? 'border-l-mulberry bg-mulberry/[0.07]'
                        : 'border-l-transparent hover:bg-ink/[0.03]'
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--m-paper-2)] text-[12px] font-semibold text-ink">
                      {r.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                          {r.displayName}
                        </span>
                        <span className="shrink-0 text-[12px] tabular-nums text-[color:var(--m-slate-2)]">
                          {r.timeLabel}
                        </span>
                      </span>
                      {/* ⚠ `block`, not the default inline. An inline span has no
                          width of its own, so `truncate` cannot ellipsis it — the
                          prototype's own note records this costing a whole
                          revision, where the text simply clipped mid-word. */}
                      <span
                        className={`mt-0.5 block truncate text-[13px] ${
                          r.unread ? 'font-semibold text-ink' : 'text-[color:var(--m-slate-2)]'
                        }`}
                      >
                        {r.preview}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {pills.map((p) =>
                          p.kind === 'unanswered' ? (
                            <span
                              key="unanswered"
                              className="rounded-full border border-mulberry bg-white px-2 py-0.5 text-[12px] font-semibold text-mulberry dark:bg-raised"
                            >
                              Unanswered
                            </span>
                          ) : (
                            /* The stage's OWN tone, shared with the pill on the
                               thread this row opens — never a second palette. */
                            <span
                              key={`stage-${p.stage}`}
                              className={`rounded-full border px-2 py-0.5 text-[12px] font-medium ${THREAD_STAGE_TONE[p.stage]}`}
                            >
                              {THREAD_STAGE_LABEL[p.stage]}
                            </span>
                          ),
                        )}
                        {r.labels.map((l) => (
                          <span
                            key={l}
                            className="rounded-full bg-[color:var(--m-paper-2)] px-2 py-0.5 text-[12px] font-medium text-[color:var(--m-slate-2)]"
                          >
                            {l}
                          </span>
                        ))}
                      </span>
                    </span>
                    {r.unread ? (
                      <span
                        aria-label="Unread"
                        className="mt-2 h-2 w-2 shrink-0 rounded-full bg-mulberry"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
