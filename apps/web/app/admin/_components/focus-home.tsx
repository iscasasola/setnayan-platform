/**
 * FocusHome — the admin in FOCUS (owner approved 14 Nov 2026: *"admin focus and full approved"*; DECISION_LOG
 * "ADMIN FOCUS | FULL — APPROVED (v6)" (2); prototype https://claude.ai/artifact/M2EWM32A9Y9LrJBsYXgagq).
 *
 *   Saturday, 14 November
 *   5 things need you
 *   [ Ask or go anywhere            ? ]     ← top on a computer; the thumb zone on a phone
 *   REPLY · 3   rows — what somebody asked of you
 *   FIX · 1     rows — something broke
 *
 * Every row is a real item of a real queue: a queue that peeks its rows (`peekQueue`) gives one row per item, titled
 * by the item's REQUEST CARD; tapping it opens that same card in a sheet (`?card=`). A queue that does not peek (a
 * judgement, or work done on its own page) is one row with its count, opening its page. No bottom nav: the top bar's
 * Full is the way to every page. No explainer text (ruling (7)).
 *
 * 🔑 THE NUMBER IS THE WORK LIST'S NUMBER. Counts come from the same `getAdminQueueDigest` + `BASE_ROWS` the Work list
 * and the nav badges read, and a queue that could not be counted is SAID — never folded into "Nothing needs you".
 */
import Link from 'next/link';
import { Check, ChevronRight, ShieldAlert } from 'lucide-react';
import {
  ADMIN_QUEUE_META,
  ageShort,
  compareQueuePriority,
  computeDueState,
  getAdminQueueDigest,
  type AdminQueueDigest,
} from '@/lib/admin/queue-counts';
import { BASE_ROWS } from '@/lib/admin/work-rows';
import { EXPANDABLE_QUEUES, JUDGEMENT_QUEUES, SETTLED_ELSEWHERE, peekQueue, type PeekItem } from '@/lib/admin/queue-peek';
import { FOCUS_KIND_LABEL, focusKindOf, needsYouLine, type FocusKind } from '@/lib/admin/admin-mode';
import { agoWords } from '@/lib/admin/request-card';
import { formatCount } from '@/lib/format-number';
import { RequestCardView } from '../queues/_components/request-card-view';
import { SETTLE_NOTICES } from '../queues/_components/queues-triage-feed';
import { AdminAskPill } from './admin-ask-pill';
import { FocusCardSheet } from './focus-card-sheet';

type FocusRow = {
  key: string;
  kind: FocusKind;
  title: string;
  sub: string;
  href: string;
  late: boolean;
};

const KIND_MARK: Record<FocusKind, string> = { reply: '↩', fix: '!', refresh: '↻' };
const KIND_STYLE: Record<FocusKind, { background: string; color: string }> = {
  reply: { background: 'rgb(var(--sn-accent) / 0.12)', color: 'rgb(var(--sn-accent))' },
  fix: { background: 'var(--sn-warning-soft)', color: 'var(--sn-warning-deep)' },
  refresh: { background: 'var(--sn-info-soft)', color: 'var(--sn-info)' },
};

const todayWords = (nowMs: number) =>
  new Date(nowMs).toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Manila' });

export async function FocusHome({
  viewerUserId,
  cardKey,
  settle,
  why,
}: {
  viewerUserId: string;
  /** `?card=<queue>:<item id>` — the card opened over the list. */
  cardKey?: string;
  settle?: string;
  why?: string;
}) {
  const nowMs = Date.now();
  const digest = await getAdminQueueDigest().catch(() => ({}) as AdminQueueDigest);

  const queues = BASE_ROWS.map((base, index) => {
    const d = digest[base.key] ?? { count: null, oldestAt: null };
    const meta = ADMIN_QUEUE_META[base.key];
    const dueState = computeDueState(d, meta ? meta.slaHours : 48, nowMs);
    return { ...base, index, count: d.count, oldestAt: d.oldestAt, dueState, watchOnly: meta?.watchOnly === true };
  })
    .filter((q) => !q.watchOnly)
    .sort((a, b) => compareQueuePriority(a, b) || a.index - b.index);

  const waiting = queues.filter((q) => (q.count ?? 0) > 0);
  const unread = queues.filter((q) => q.count === null);
  const total = waiting.reduce((n, q) => n + (q.count ?? 0), 0);

  // Only a queue that settles in place has items to open; the rest are one row each.
  const peeked = await Promise.all(
    waiting.map(async (q) => {
      const settlesHere = EXPANDABLE_QUEUES.has(q.key) && !JUDGEMENT_QUEUES[q.key] && !SETTLED_ELSEWHERE[q.key];
      return { q, peek: settlesHere ? await peekQueue(q.key, viewerUserId) : null };
    }),
  );

  const rows: FocusRow[] = [];
  let opened: { item: PeekItem; late: boolean; queueLabel: string } | null = null;
  for (const { q, peek } of peeked) {
    const late = q.dueState === 'overdue';
    const kind = focusKindOf(q.key);
    const items = (peek?.items ?? []).filter((it) => it.card);
    for (const it of items) {
      const key = `${q.key}:${it.id}`;
      if (key === cardKey) opened = { item: it, late, queueLabel: q.label };
      const ago = agoWords(it.card!.at, nowMs);
      rows.push({
        key,
        kind,
        title: it.card!.title,
        sub: [it.card!.chip, ago].filter(Boolean).join(' · '),
        href: `/admin?card=${encodeURIComponent(key)}`,
        late,
      });
    }
    const rest = (q.count ?? 0) - items.length;
    if (rest > 0) {
      const age = ageShort(q.oldestAt, nowMs);
      rows.push({
        key: `${q.key}:queue`,
        kind,
        title: items.length > 0 ? `${formatCount(rest)} more in ${q.label}` : `${q.label} · ${formatCount(rest)} waiting`,
        sub: [items.length > 0 ? null : q.description, age ? `oldest ${age}` : null].filter(Boolean).join(' · '),
        href: items.length > 0 || EXPANDABLE_QUEUES.has(q.key) ? `/admin/work?open=${encodeURIComponent(q.key)}` : q.href,
        late,
      });
    }
  }

  const groups = (['reply', 'fix', 'refresh'] as const)
    .map((k) => ({ kind: k, rows: rows.filter((r) => r.kind === k) }))
    .filter((g) => g.rows.length > 0);

  const notice = settle ? SETTLE_NOTICES[settle] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col pb-36 lg:pb-12" data-admin-focus>
      <header className="px-4 pb-1.5 pt-5 lg:pt-7">
        <p className="text-[13px] text-[color:var(--sn-ink-500)]">{todayWords(nowMs)}</p>
        <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight text-[color:var(--sn-ink-900)]">
          {unread.length > 0 && total === 0 ? 'Couldn’t count everything' : needsYouLine(total)}
        </h1>
      </header>

      <div className="hidden px-4 py-2.5 lg:block">
        <AdminAskPill place="top" />
      </div>

      {notice ? (
        <p
          role="status"
          className="mx-4 mt-2 flex items-start gap-2 text-sm"
          style={{ color: notice.tone === 'warn' ? 'var(--sn-warning-deep)' : 'var(--sn-ink-900)' }}
        >
          {notice.tone === 'warn' ? (
            <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            <strong>{notice.headline}</strong>
            {why ? <span className="block text-[color:var(--sn-ink-500)]">{why}</span> : null}
          </span>
        </p>
      ) : null}

      {unread.length > 0 ? (
        <p role="alert" className="mx-4 mt-2 text-sm" style={{ color: 'var(--sn-warning-deep)' }}>
          {formatCount(unread.length)} {unread.length === 1 ? 'list' : 'lists'} couldn’t be counted — this is not an
          all-clear.{' '}
          <Link href="/admin/work" className="underline underline-offset-2">
            Open Work
          </Link>
        </p>
      ) : null}

      {groups.map((g) => (
        <section key={g.kind} aria-label={FOCUS_KIND_LABEL[g.kind]}>
          <p className="sn-eye mx-4 mb-1 mt-4">
            {FOCUS_KIND_LABEL[g.kind]} · {formatCount(g.rows.length)}
          </p>
          <ul>
            {g.rows.map((r) => (
              <li key={r.key}>
                <Link
                  href={r.href}
                  scroll={false}
                  className="flex min-h-16 items-center gap-3 border-t px-4 py-2.5 transition-colors hover:bg-[var(--sn-paper)]"
                  style={{ borderColor: 'var(--sn-line)' }}
                  data-focus-row={r.kind}
                >
                  <span
                    aria-hidden
                    className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-md font-extrabold"
                    style={KIND_STYLE[r.kind]}
                  >
                    {KIND_MARK[r.kind]}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-[15px] font-semibold text-[color:var(--sn-ink-900)]">{r.title}</span>
                    <span
                      className="truncate text-[13px]"
                      style={{ color: r.late ? 'var(--sn-danger)' : 'var(--sn-ink-500)', fontWeight: r.late ? 600 : 400 }}
                    >
                      {r.sub}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-[color:var(--sn-ink-500)]" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* The phone's ask box — in the thumb zone, above the home indicator. */}
      <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+14px)] z-30 lg:hidden">
        <AdminAskPill place="thumb" />
      </div>

      {opened && opened.item.card ? (
        <FocusCardSheet title={opened.item.card.title} kicker={opened.queueLabel}>
          <RequestCardView card={opened.item.card} back="/admin" late={opened.late} nowMs={nowMs} />
        </FocusCardSheet>
      ) : null}
    </div>
  );
}
