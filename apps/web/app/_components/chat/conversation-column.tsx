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
    <aside className="hidden w-[17.5rem] shrink-0 flex-col overflow-hidden sn-row xl:flex">
      {heading ? (
        <div className="flex items-baseline gap-2 border-b border-ink/10 px-3 pb-2 pt-3">
          {backHref ? (
            <Link
              href={backHref}
              className="shrink-0 text-xs font-medium text-mulberry hover:underline"
            >
              {backLabel ?? '‹ Back'}
            </Link>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{heading}</span>
          {/* The roll-up the prototype prints beside the heading: how many of
              these have something in them the reader has not seen. */}
          <span className="shrink-0 text-[11px] text-ink/55">
            {rows.length}
            {unreadCount > 0 ? ` · ${unreadCount} new` : ''}
          </span>
        </div>
      ) : null}

      <div className="border-b border-ink/10 p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          className="h-9 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-mulberry focus:outline-none"
        />
      </div>

      {/* The chips scroll rather than wrap: six of them wrapped to three rows
          and pushed the conversations themselves below the fold. */}
      <div
        role="group"
        aria-label="Filter conversations"
        className="flex gap-1 overflow-x-auto border-b border-ink/10 px-3 py-2"
      >
        {chips.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                on
                  ? 'border-mulberry bg-mulberry text-cream'
                  : 'border-ink/15 bg-white text-ink/65 hover:border-ink/30'
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
          <p className="px-4 py-6 text-center text-xs leading-relaxed text-ink/55">
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
                    className={`flex gap-2.5 border-b border-ink/[0.07] px-3 py-2.5 ${
                      active ? 'bg-mulberry/[0.07] shadow-[inset_3px_0_0_theme(colors.mulberry)]' : 'hover:bg-ink/[0.03]'
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-white text-[11px] font-semibold text-ink/70">
                      {r.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                          {r.displayName}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-ink/45">
                          {r.timeLabel}
                        </span>
                      </span>
                      {/* ⚠ `block`, not the default inline. An inline span has no
                          width of its own, so `truncate` cannot ellipsis it — the
                          prototype's own note records this costing a whole
                          revision, where the text simply clipped mid-word. */}
                      <span
                        className={`mt-0.5 block truncate text-xs ${
                          r.unread ? 'font-semibold text-ink' : 'text-ink/60'
                        }`}
                      >
                        {r.preview}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {pills.map((p) =>
                          p.kind === 'unanswered' ? (
                            <span
                              key="unanswered"
                              className="rounded-full border border-mulberry bg-white px-1.5 py-0.5 text-[10px] font-semibold text-mulberry"
                            >
                              Unanswered
                            </span>
                          ) : (
                            /* The stage's OWN tone, shared with the pill on the
                               thread this row opens — never a second palette. */
                            <span
                              key={`stage-${p.stage}`}
                              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${THREAD_STAGE_TONE[p.stage]}`}
                            >
                              {THREAD_STAGE_LABEL[p.stage]}
                            </span>
                          ),
                        )}
                        {r.labels.map((l) => (
                          <span
                            key={l}
                            className="rounded-full bg-ink/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-ink/55"
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
