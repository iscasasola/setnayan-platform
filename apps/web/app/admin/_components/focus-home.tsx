/**
 * FocusHome — the admin in FOCUS (owner approved 14 Nov 2026: *"admin focus and full approved"*; DECISION_LOG
 * "ADMIN FOCUS | FULL — APPROVED (v6)" (2); prototype https://claude.ai/artifact/M2EWM32A9Y9LrJBsYXgagq).
 *
 *   Saturday, 14 November
 *   5 things need you
 *   [ Ask or go anywhere            ? ]     ← top on a computer; the thumb zone on a phone
 *   ONE LIST, most urgent first — ↩ reply · ! fix on each row (no Reply · N / Fix · N headings since Today v3 part 4)
 *
 * Every row is a real item of a real queue: a queue that peeks its rows (`peekQueue`) gives one row per item, titled
 * by the item's REQUEST CARD; tapping it opens that same card IN PLACE, where it sits (`?card=`; Today v3 part 4, owner
 * 19 Nov "Admin Focus opens in place too … No sheet over the list"). A queue that does not peek is one row with its
 * count; tapped, its card is the count and a sentence, and "Open in page ›" is its one action. Drag right = the item's
 * page · drag left = "Do it tomorrow" for this admin only (`focus-row.tsx`). No bottom nav: the top bar's Full is the
 * way to every page. No explainer text (ruling (7)).
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
import { focusKindOf, needsYouLine, type FocusKind } from '@/lib/admin/admin-mode';
import { agoWords } from '@/lib/admin/request-card';
import { formatCount } from '@/lib/format-number';
import { RequestCardView } from '../queues/_components/request-card-view';
import { SETTLE_NOTICES } from '../queues/_components/queues-triage-feed';
import { AdminAskPill } from './admin-ask-pill';
import { FocusRecents } from './focus-recents';
import { createAdminClient } from '@/lib/supabase/admin';
import { readBadgeShopList, badgeTraceHref } from '../offers/_surfaces/badges-view';

/** ➕ v10: what the Ask bar answers in place. A `queue` answer filters the Focus list to that queue. */
export const FOCUS_ASK_ANSWERS: Record<string, { question: string; queue?: string; openHref: string; openLabel: string }> = {
  badges: { question: 'suppliers badge progress', openHref: '/admin/offers?view=badges&show=shops', openLabel: 'Badges & seals' },
  payments: { question: 'payments to confirm', queue: 'payments', openHref: '/admin/payments', openLabel: 'To approve · Payments' },
  papers: { question: 'papers to verify', queue: 'verify', openHref: '/admin/verify', openLabel: 'Papers' },
};
import { FocusList, FocusRow } from './focus-row';
import { createClient } from '@/lib/supabase/server';
import { focusLevel, orderFocusRows, splitFocusPutOffs, type FocusLevel } from '@/lib/admin/focus-urgency';
import { FOCUS_PUT_OFF_KEY, PUT_OFF_WORDS, activePutOffs } from '@/lib/today-put-off';
import { manilaToday } from '@/lib/chat-cards';
import { FocusReceived } from './focus-received';
import { PageMasthead } from '@/app/_components/page-masthead';

type FocusRowData = {
  key: string;
  kind: FocusKind;
  title: string;
  sub: string;
  href: string;
  late: boolean;
  /** v3 part 4: the level (red · Overdue / amber · Soon) from the queue's own clock; null = normal. */
  level: FocusLevel | null;
  /** v3 part 4: where a drag right goes — the item's own page (the queue page, never `?card=`). */
  pageHref: string;
  /** v3 part 4: a list worked on its own page — its card is a count and a sentence, not buttons. */
  queue?: { label: string; count: number; oldest: string | null };
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
  ask,
}: {
  viewerUserId: string;
  /** ➕ v10: `?ask=<key>` — the Ask bar answered in place (`FOCUS_ASK_ANSWERS`). */
  ask?: string;
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

  const rows: FocusRowData[] = [];
  let opened: { item: PeekItem; late: boolean; queueLabel: string } | null = null;
  for (const { q, peek } of peeked) {
    const late = q.dueState === 'overdue';
    const level = focusLevel(q.dueState);
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
        level,
        pageHref: q.href,
      });
    }
    const rest = (q.count ?? 0) - items.length;
    if (rest > 0) {
      const age = ageShort(q.oldestAt, nowMs);
      const qKey = `${q.key}:queue`;
      rows.push({
        key: qKey,
        kind,
        title: items.length > 0 ? `${formatCount(rest)} more in ${q.label}` : `${q.label} · ${formatCount(rest)} waiting`,
        sub: [items.length > 0 ? null : q.description, age ? `oldest ${age}` : null].filter(Boolean).join(' · '),
        // v3 part 4: a tap opens the list's card in place too (a count and a sentence); its page is a drag right away.
        href: `/admin?card=${encodeURIComponent(qKey)}`,
        late,
        level,
        pageHref: items.length > 0 || EXPANDABLE_QUEUES.has(q.key) ? `/admin/work?open=${encodeURIComponent(q.key)}` : q.href,
        queue: { label: q.label, count: rest, oldest: age },
      });
    }
  }

  // ➕ ADMIN REORG v10 (17 Nov 2026): the Ask bar answers in place — the question, a count, the SAME rows, and where
  // the list lives. A queue answer is this list filtered to that queue; badge progress is the Badges & seals shop list.
  const answer = ask ? FOCUS_ASK_ANSWERS[ask] : undefined;
  let answerRows: FocusRowData[] | null = null;
  if (answer?.queue) answerRows = rows.filter((r) => r.key.startsWith(`${answer.queue}:`));
  if (answer && !answer.queue) {
    const { list, error } = await readBadgeShopList(createAdminClient());
    answerRows = error
      ? null
      : list.map((s) => ({ key: `badges:${s.vendor_profile_id}`, kind: 'reply' as const, title: s.business_name ?? 'Unnamed shop', sub: 'Five badges · tap for the trace', href: badgeTraceHref(s.vendor_profile_id), late: false, level: null, pageHref: badgeTraceHref(s.vendor_profile_id) }));
  }

  // 📋 v3 part 4 (ruled 19 Nov): ONE list by urgency — red, then amber, then the rest; no Reply · N / Fix · N headings
  // (each row keeps its ↩ or ! mark). What THIS admin put off with "Do it tomorrow" sits under Tomorrow — a red item
  // never does. An unread record holds nothing off.
  const putOff = await readFocusPutOffs(viewerUserId);
  const { now: listed, tomorrow } = splitFocusPutOffs(orderFocusRows(rows), putOff);

  const notice = settle ? SETTLE_NOTICES[settle] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col pb-36 lg:pb-12" data-admin-focus>
      <PageMasthead title="Focus" />
      <header className="px-4 pb-1.5 pt-5 lg:pt-7">
        <p className="text-[13px] text-[color:var(--sn-ink-500)]">{todayWords(nowMs)}</p>
        <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight text-[color:var(--sn-ink-900)]">
          {unread.length > 0 && total === 0 ? 'Couldn’t count everything' : needsYouLine(total)}
        </p>
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

      {answer ? (
        <section aria-label="Your answer" className="mx-4 mt-3 flex flex-col gap-2" data-focus-ask={ask}>
          <p className="text-[13px] text-[color:var(--sn-ink-500)]">You asked</p>
          <p className="text-[18px] font-semibold text-[color:var(--sn-ink-900)]">“{answer.question}”</p>
          <p className="text-[13px] text-[color:var(--sn-ink-500)]">
            {answerRows === null ? 'Couldn’t read this just now — not the same as none.' : `${formatCount(answerRows.length)} · answered here`}
          </p>
          <ul>
            {(answerRows ?? []).map((r) => (
              <li key={r.key}>
                <Link href={r.href} scroll={false} className="flex min-h-14 items-center gap-3 border-t py-2.5" style={{ borderColor: 'var(--sn-line)' }} data-focus-ask-row="">
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-[15px] font-semibold text-[color:var(--sn-ink-900)]">{r.title}</span>
                    <span className="truncate text-[13px] text-[color:var(--sn-ink-500)]">{r.sub}</span>
                  </span>
                  <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-[color:var(--sn-ink-500)]" />
                </Link>
              </li>
            ))}
          </ul>
          <Link href={answer.openHref} className="text-sm font-medium text-[color:var(--sn-ink-900)]">
            Open {answer.openLabel} ›
          </Link>
          {/* Focus is a bar root — no back link here (lib/page-home.ts); the full list is one plain link away. */}
          <Link href="/admin" className="text-sm text-[color:var(--sn-ink-500)]" data-focus-ask-all="">
            Everything that needs you
          </Link>
        </section>
      ) : null}

      {/* From your BDO (owner 2026-11-17, v5 drawing): its own block and cards, in its own file.
          Hidden while an Ask answer is showing — the answer filters Focus to one list. */}
      {!answer ? <FocusReceived cardKey={cardKey} /> : null}

      {!answer && listed.length > 0 ? (
        <section aria-label="Needs you" className="mt-3">
          <FocusList>
            {listed.map((r) => (
              <FocusRow
                key={r.key}
                itemKey={r.key}
                mark={KIND_MARK[r.kind]}
                markStyle={KIND_STYLE[r.kind]}
                title={r.title}
                sub={r.level ? `${r.level.word} · ${r.sub}` : r.sub}
                level={r.level?.level ?? null}
                open={r.key === cardKey}
                openHref={r.href}
                pageHref={r.pageHref}
              >
                {r.key === cardKey && opened && opened.item.card ? (
                  <RequestCardView card={opened.item.card} back="/admin" late={opened.late} nowMs={nowMs} />
                ) : r.key === cardKey && r.queue ? (
                  <div className="text-[14px] text-[color:var(--sn-ink-900)]" data-focus-queue-card="">
                    <p className="font-semibold">
                      {formatCount(r.queue.count)} waiting in {r.queue.label}
                    </p>
                    {r.queue.oldest ? <p className="text-[13px] text-[color:var(--sn-ink-500)]">Oldest {r.queue.oldest}</p> : null}
                    <p className="mt-1 text-[13px] text-[color:var(--sn-ink-500)]">Nothing to press here — this list is worked on its own page.</p>
                  </div>
                ) : null}
              </FocusRow>
            ))}
          </FocusList>
        </section>
      ) : null}

      {!answer && tomorrow.length > 0 ? (
        <section aria-label={PUT_OFF_WORDS.heading} data-focus-tomorrow="">
          <p className="sn-eye mx-4 mb-1 mt-4">
            {PUT_OFF_WORDS.heading} · {formatCount(tomorrow.length)}
          </p>
          <ul>
            {tomorrow.map((r) => (
              <li key={r.key} className="flex min-h-14 items-center gap-3 border-t px-4 py-2" style={{ borderColor: 'var(--sn-line)' }}>
                <span aria-hidden className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-md font-extrabold" style={KIND_STYLE[r.kind]}>
                  {KIND_MARK[r.kind]}
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-[15px] font-semibold text-[color:var(--sn-ink-900)]">{r.title}</span>
                  <span className="truncate text-[13px] text-[color:var(--sn-ink-500)]">{PUT_OFF_WORDS.back}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 🔦 Recent — the last things opened from Focus, under your needs list (Focus at Spotlight level, 18 Nov 2026). */}
      {!answer ? <FocusRecents /> : null}

      {/* The phone's ask box — in the thumb zone, above the home indicator. */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+14px)] left-[calc(var(--sn-safe-l)+0.75rem)] right-[calc(var(--sn-safe-r)+0.75rem)] z-30 lg:hidden">
        <AdminAskPill place="thumb" />
      </div>

    </div>
  );
}

/** This admin's own "Do it tomorrow" records still in force (`admin_focus_put_offs`, RLS: own rows). null = unread. */
async function readFocusPutOffs(userId: string): Promise<Set<string> | null> {
  try {
    const supabase = await createClient();
    const today = manilaToday();
    const r = await supabase.from('admin_focus_put_offs').select('item_key, until_day').eq('user_id', userId).gt('until_day', today).limit(300);
    if (r.error) {
      console.error('[supabase-error] app/admin/_components/focus-home.tsx · from:admin_focus_put_offs.select', r.error);
      return null;
    }
    return activePutOffs(((r.data ?? []) as { item_key: string; until_day: string }[]).map((x) => ({ task_key: x.item_key, until_day: x.until_day })), today, FOCUS_PUT_OFF_KEY);
  } catch {
    return null;
  }
}
