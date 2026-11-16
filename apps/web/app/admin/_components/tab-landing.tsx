/**
 * TabLanding — each Full-mode tab's own dashboard (admin reorg v7, the drawing's "5 tab dashboards" · `landings.py`).
 *
 * Owner, 17 Nov 2026: *"i want a more visually functional work, money, people, catalogue, insights page. like how we
 * did event and supplier dashboard"*. Drawn in that language:
 *   · a head card with the 2–4 numbers that matter now;
 *   · the tab's groups as tappable cards — each with a live count, one line and chips, and "Open … ›" to the ONE merged
 *     page with its view preselected (`lib/admin/admin-pages.ts`);
 *   · an empty group is greyed (9 Nov rule); frames only on pressable things.
 *
 * ⚖ EVERY NUMBER NAMES ITS SOURCE and none is invented. The counts are the Work queues' own reads
 * (`getAdminQueueDigest`, `lib/admin/queue-counts.ts`); the standing totals (accounts, shops, events) are NOT re-read here
 * — they stay on Insights › Overview (`admin-totals-surface.tsx`), owner rule 17 Nov "no code everything that is
 * already there". A group with nothing countable shows no number. A
 * refused read prints "—" and the line says so — never a 0 that reads as "all clear".
 */
import Link from 'next/link';

import { PageMasthead } from '@/app/_components/page-masthead';

import { ageShort, getAdminQueueDigest, type AdminQueueDigest } from '@/lib/admin/queue-counts';
import { formatCount } from '@/lib/format-number';
import { pagesIn, type AdminBarKey, type AdminMergedPage, type AdminPageView } from '@/lib/admin/admin-pages';

type Card = {
  key: string;
  title: string;
  /** `undefined` = nothing countable here (no number drawn); `null` = a count that could not be read. */
  count: number | null | undefined;
  line: string;
  chips: { label: string; href: string; count: number | null | undefined }[];
  href: string;
  opens: string;
};

type HeadNumber = { label: string; value: string; sub: string };

const LABEL: Record<AdminBarKey, string> = { work: 'Work', money: 'Money', people: 'People', catalogue: 'Catalogue', insights: 'Insights' };

const HELLO_WHEN_EMPTY: Record<AdminBarKey, string> = {
  work: 'Nothing is waiting',
  money: 'Nothing to approve',
  people: 'Find anyone',
  catalogue: 'The catalogue',
  insights: 'This week',
};

function countOf(view: AdminPageView, digest: AdminQueueDigest): number | null | undefined {
  if (!view.queue) return undefined;
  const row = digest[view.queue];
  return row ? row.count : null;
}

function sum(values: (number | null | undefined)[]): number | null | undefined {
  const counted = values.filter((x) => x !== undefined);
  if (counted.length === 0) return undefined;
  if (counted.some((x) => x === null)) return null;
  return (counted as number[]).reduce((a, b) => a + b, 0);
}

/** A page whose views carry `kindGroup` draws one card per group (Queue's four, Studio's two, Insights' three). */
function cardsFor(page: AdminMergedPage, digest: AdminQueueDigest): Card[] {
  if (!page.href) return [];
  const toChip = (vw: AdminPageView) => ({ label: vw.label, href: vw.href, count: countOf(vw, digest) });
  const grouped = page.views.filter((vw) => vw.kindGroup);
  if (grouped.length === 0) {
    const chips = page.views.map(toChip);
    const count = sum(chips.map((c) => c.count));
    return [
      {
        key: page.key,
        title: page.label,
        count,
        line: page.line,
        chips,
        href: page.href,
        opens: page.label,
      },
    ];
  }
  const names = [...new Set(grouped.map((vw) => vw.kindGroup!))];
  return names.map((name) => {
    const views = grouped.filter((vw) => vw.kindGroup === name);
    const chips = views.map(toChip);
    const count = sum(chips.map((c) => c.count));
    // Open the kind that has something waiting, else the first — the view is preselected.
    const first = chips.find((c) => typeof c.count === 'number' && c.count > 0) ?? chips[0]!;
    return {
      key: `${page.key}.${name}`,
      title: name,
      count,
      line: chips.map((c) => c.label).join(' · '),
      chips,
      href: first.href,
      opens: `${page.label}${page.picker ? ` · ${page.picker} ▾ ${name}` : ''}`,
    };
  });
}

function oldest(views: AdminPageView[], digest: AdminQueueDigest, nowMs: number): HeadNumber | null {
  let best: { at: string; label: string } | null = null;
  for (const vw of views) {
    const row = vw.queue ? digest[vw.queue] : undefined;
    if (!row?.oldestAt || !row.count) continue;
    if (!best || row.oldestAt < best.at) best = { at: row.oldestAt, label: vw.label };
  }
  if (!best) return null;
  return { label: 'Oldest', value: ageShort(best.at, nowMs) ?? '—', sub: best.label };
}

function show(n: number | null | undefined): string {
  return typeof n === 'number' ? formatCount(n) : '—';
}

export async function TabLanding({ tab, digest: given }: { tab: AdminBarKey; /** Lab only — fixture counts. */ digest?: AdminQueueDigest }) {
  const digest = given ?? (await getAdminQueueDigest());
  const nowMs = Date.now();
  const pages = pagesIn(tab);
  const cards = pages.flatMap((p) => cardsFor(p, digest));
  const allViews = pages.flatMap((p) => [...p.views]);
  const waiting = sum(allViews.map((vw) => countOf(vw, digest)));
  const q = (key: string) => {
    const vw = allViews.find((x) => x.key === key);
    return vw ? countOf(vw, digest) : undefined;
  };

  let head: HeadNumber[] = [];
  let hello: string;
  if (tab === 'work') {
    head = [{ label: 'Waiting', value: show(waiting), sub: 'across every queue' }];
    const o = oldest(allViews, digest, nowMs);
    if (o) head.push(o);
    hello = typeof waiting === 'number' && waiting > 0 ? `${formatCount(waiting)} things are waiting` : waiting === null ? 'Some counts could not be read' : HELLO_WHEN_EMPTY.work;
  } else if (tab === 'money') {
    head = [
      { label: 'To confirm', value: show(q('payments')), sub: 'payments' },
      { label: 'Refunds', value: show(q('refunds')), sub: 'waiting' },
      { label: 'Payouts', value: show(q('payouts')), sub: 'due' },
      { label: 'Fees owed', value: show(q('fees')), sub: 'booking fees' },
    ];
    hello = typeof waiting === 'number' && waiting > 0 ? `${formatCount(waiting)} money items to approve` : waiting === null ? 'Some counts could not be read' : HELLO_WHEN_EMPTY.money;
  } else if (tab === 'people') {
    head = [
      { label: 'To verify', value: show(q('three-papers')), sub: 'papers waiting' },
      { label: 'Partnerships', value: show(q('partnerships')), sub: 'waiting' },
    ];
    hello = HELLO_WHEN_EMPTY.people;
  } else if (tab === 'insights') {
    // The standing totals stay where they are read today (Insights › Overview, `admin-totals-surface.tsx`).
    head = [{ label: 'Problems, last 24 h', value: show(q('problems')), sub: 'app errors' }];
    hello = HELLO_WHEN_EMPTY.insights;
  } else {
    hello = HELLO_WHEN_EMPTY.catalogue;
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-12 pt-2 sm:px-6" data-admin-landing={tab}>
      <PageMasthead title={LABEL[tab]} />
      <p className="sn-h2 mb-3 mt-1" data-admin-landing-hello="">{hello}</p>
      {head.length > 0 ? (
        <section
          aria-label="The numbers that matter now"
          className="mb-5 grid grid-cols-2 gap-3 rounded-2xl bg-cream p-4 sm:grid-cols-4"
          data-admin-landing-head=""
        >
          {head.map((h) => (
            <div key={h.label} className="min-w-0">
              <p className="sn-eye">{h.label}</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[color:var(--sn-ink-900)]">{h.value}</p>
              {h.sub ? <p className="mt-0.5 truncate text-xs text-[color:var(--sn-ink-400)]">{h.sub}</p> : null}
            </div>
          ))}
        </section>
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const empty = c.count === 0;
          return (
            <div
              key={c.key}
              className={`sn-glass-bare flex flex-col gap-2 rounded-2xl p-4 ${empty ? 'opacity-60' : ''}`}
              data-admin-landing-card={c.key}
              data-empty={empty ? 'true' : 'false'}
            >
              <Link href={c.href} className="flex items-baseline justify-between gap-3">
                <span className="text-base font-semibold text-[color:var(--sn-ink-900)]">{c.title}</span>
                {c.count !== undefined ? (
                  <b className="font-mono text-xl tabular-nums text-[color:var(--sn-ink-900)]" title={c.count === null ? 'Couldn’t count — not the same as none' : undefined}>
                    {show(c.count)}
                  </b>
                ) : null}
              </Link>
              <p className="text-sm text-[color:var(--sn-ink-500)]">{c.count === null ? 'Couldn’t count — not the same as none' : c.line}</p>
              <div className="flex flex-wrap gap-1.5">
                {c.chips.slice(0, 6).map((ch) => (
                  <Link
                    key={ch.href}
                    href={ch.href}
                    className="rounded-full bg-cream px-2.5 py-1 text-xs text-[color:var(--sn-ink-700)]"
                  >
                    {ch.label}
                    {typeof ch.count === 'number' && ch.count > 0 ? <em className="ml-1 not-italic font-semibold">{formatCount(ch.count)}</em> : null}
                    {ch.count === null ? <em className="ml-1 not-italic">—</em> : null}
                  </Link>
                ))}
              </div>
              <Link href={c.href} className="mt-auto text-sm font-medium text-[color:var(--sn-ink-900)]">
                Open {c.opens} ›
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
