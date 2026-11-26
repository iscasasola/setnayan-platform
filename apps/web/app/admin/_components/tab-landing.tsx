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

import { CHIP_CLASS, CHIP_OFF_CLASS } from '@/app/_components/chip-classes';

import { PageMasthead } from '@/app/_components/page-masthead';

import { ADMIN_QUEUE_META, ageShort, getAdminQueueDigest, type AdminQueueDigest } from '@/lib/admin/queue-counts';
import { BASE_ROWS } from '@/lib/admin/work-rows';
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

/** A8·C-7: what a view adds to a card's or a tab's "N waiting" — a watch-only trail keeps its chip count but adds nothing. */
function countToSum(view: AdminPageView, digest: AdminQueueDigest): number | null | undefined {
  if (view.queue && ADMIN_QUEUE_META[view.queue]?.watchOnly === true) return undefined;
  return countOf(view, digest);
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
    const count = sum(page.views.map((vw) => countToSum(vw, digest)));
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
    const count = sum(views.map((vw) => countToSum(vw, digest)));
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

/**
 * 🗂 CATALOGUE's own head numbers (#7693, the Catalogue Home): how big the taxonomy is, read by the Categories page's
 * own loader (`loadCategories`) on `/admin/catalogue`. `null` = that list could not be read → "—", never 0.
 */
export type CatalogueHeadFacts = { categories: number | null; services: number | null };

export async function TabLanding({
  tab,
  digest: given,
  catalogue,
}: {
  tab: AdminBarKey;
  /** Lab only — fixture counts. */
  digest?: AdminQueueDigest;
  /** Catalogue only — the taxonomy counts its page read (absent = the head shows the requests alone). */
  catalogue?: CatalogueHeadFacts;
}) {
  const digest = given ?? (await getAdminQueueDigest());
  const nowMs = Date.now();
  const pages = pagesIn(tab);
  // People (owner, 17 Nov — DECISION_LOG): the Look up and Papers cards are REMOVED; People is the cards for counts, then
  // the everyone list (its Show & sort holds both jobs). The pages stay in the picker and the rail.
  const cards = pages.filter((p) => !(tab === 'people' && (p.key === 'look-up' || p.key === 'papers'))).flatMap((p) => cardsFor(p, digest));
  const allViews = pages.flatMap((p) => [...p.views]);
  const waiting = sum(allViews.map((vw) => countToSum(vw, digest)));
  const q = (key: string) => {
    const vw = allViews.find((x) => x.key === key);
    return vw ? countOf(vw, digest) : undefined;
  };

  let head: HeadNumber[] = [];
  let hello: string;
  if (tab === 'work') {
    // A8·C-7: "across every queue" is the SAME total the Work list and Focus show — every queue in `BASE_ROWS`,
    // watch-only trails left out (`ADMIN_QUEUE_META[…].watchOnly`), an unread queue makes it "—".
    const workTotal = sum(
      BASE_ROWS.filter((b) => ADMIN_QUEUE_META[b.key]?.watchOnly !== true).map((b) => (digest[b.key] ? digest[b.key]!.count : null)),
    );
    head = [{ label: 'Waiting', value: show(workTotal), sub: 'across every queue' }];
    const o = oldest(allViews, digest, nowMs);
    if (o) head.push(o);
    hello = typeof workTotal === 'number' && workTotal > 0 ? `${formatCount(workTotal)} things are waiting` : workTotal === null ? 'Some counts could not be read' : HELLO_WHEN_EMPTY.work;
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
    // 🗂 #7693: what waits here is shops asking for a service we lack (the Work queue `service-requests`, same read).
    const asking = q('requests');
    head = [
      ...(catalogue
        ? [
            { label: 'Categories', value: show(catalogue.categories), sub: catalogue.categories === null ? 'couldn’t read' : 'in the taxonomy' },
            { label: 'Services', value: show(catalogue.services), sub: catalogue.services === null ? 'couldn’t read' : 'under them' },
          ]
        : []),
      { label: 'Asking', value: show(asking), sub: asking === null ? 'couldn’t read' : 'shops asking for a service' },
    ];
    const o = oldest(allViews, digest, nowMs);
    if (o) head.push(o);
    hello =
      typeof asking === 'number' && asking > 0
        ? asking === 1
          ? '1 shop is asking for a service'
          : `${formatCount(asking)} shops are asking for a service`
        : asking === null || catalogue?.categories === null || catalogue?.services === null
          ? 'Some counts could not be read'
          : HELLO_WHEN_EMPTY.catalogue;
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
              {/* 👆 Each chip is the app's ONE chip (`CHIP_CLASS`: 40 drawn, `.sn-hit` presses at 44 — walk W4/W5 18 Nov,
                  #7900 follow-up: these were 24-px one-offs). gap-2 keeps two wrapped rows' presses from overlapping. */}
              <div className="flex flex-wrap gap-2" data-admin-landing-chips="">
                {/* Every chip the line names (A8·P-B-12: a cap of six dropped Hub music and Songs on Catalogue). */}
                {c.chips.map((ch) => (
                  <Link key={ch.href} href={ch.href} className={`${CHIP_CLASS} ${CHIP_OFF_CLASS}`} data-admin-landing-chip="">
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
