import Link from 'next/link';
import { formatCount } from '@/lib/format-number';
import { formatPesoCompact } from '@/lib/vendors-plan-budget';
import type { TodayStats as Stats } from '@/lib/supplier-today-view';
import { customerLandingHref } from '@/app/vendor-dashboard/customers/anchors';

/**
 * 📊 TODAY'S FIVE STATS (THE ONE BUILD A4, v113 Today — v103/v104 "stats jump"): Views · Inquiries · Booked ·
 * Portfolio · Money, EACH A LINK to the place it counts. Retires the counts row that filtered in place (A5).
 *
 *   Views      N · "last 28 days"          → Shop                       (`readTodayViews`, 28 days — said, never "this month")
 *   Inquiries  N · "asked · last 28 days"  → Clients › Asked             (`inquiries28`)
 *   Booked     N · "this month"            → Clients › Booked            (events DATED this Manila month — owner Q2 default)
 *   Portfolio  "N of 50" · "free photos"   → Portfolio                   (C4's `getPortfolioCount`; no figure until it lands)
 *   Money      ₱X · "to come in"           → Clients › To collect        (`numbers.toComeInPhp` — "to come in", WRONG row 23)
 *
 * 🔴 A figure that could not be read says "couldn't load" — never 0 or ₱0.
 * The strip pins as row 2 under row 1 once the foundation's `CollapsingTop` takes it as `second`.
 * 🔒 app/vendor-dashboard/_components/today-stats-each-jump.test.ts
 */
export const TODAY_STAT_HREFS = {
  views: '/vendor-dashboard/shop',
  inquiries: '/vendor-dashboard/customers?door=asking',
  booked: '/vendor-dashboard/customers?door=booked',
  portfolio: '/vendor-dashboard/collections',
  money: customerLandingHref('payday'),
} as const;

const UNREAD = 'couldn’t load';

type Stat = { id: keyof typeof TODAY_STAT_HREFS; figure: string | null; label: string; line: string };

export function todayStatsOf(s: Stats): Stat[] {
  const n = (v: number | null) => (v === null ? null : formatCount(v));
  return [
    { id: 'views', figure: n(s.views), label: 'Views', line: s.views === null ? UNREAD : 'last 28 days' },
    { id: 'inquiries', figure: n(s.inquiries), label: 'Inquiries', line: s.inquiries === null ? UNREAD : 'asked · last 28 days' },
    // RW-84 (walk 13 Nov 2026): it counts events DATED this month (owner Q2) — said so, so 4 bookings MADE this month for
    // later dates are not read as missing.
    { id: 'booked', figure: n(s.booked), label: 'Booked', line: s.booked === null ? UNREAD : 'events this month' },
    s.portfolio === undefined
      ? { id: 'portfolio', figure: null, label: 'Portfolio', line: 'your photos' }
      : s.portfolio === null
        ? { id: 'portfolio', figure: null, label: 'Portfolio', line: UNREAD }
        : { id: 'portfolio', figure: `${formatCount(s.portfolio.used)} of ${formatCount(s.portfolio.free)}`, label: 'Portfolio', line: 'free photos' },
    {
      id: 'money',
      figure: s.toComeInPhp === null ? null : formatPesoCompact(s.toComeInPhp * 100),
      label: 'Money',
      line: s.toComeInPhp === null ? UNREAD : 'to come in',
    },
  ];
}

export function TodayStats({ stats }: { stats: Stats }) {
  return (
    <nav aria-label="Your numbers" data-today-stats="" data-tour="today-stats" className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex snap-x gap-2">
        {todayStatsOf(stats).map((s) => (
          <li key={s.id} className="snap-start">
            <Link
              href={TODAY_STAT_HREFS[s.id]}
              data-today-stat={s.id}
              // 🔦 the app-wide supplier tour's "Get paid" stop (it lit the retired money count).
              data-tour={s.id === 'money' ? 'today-money' : undefined}
              className="flex min-h-[88px] w-[104px] flex-col justify-center rounded-2xl bg-ink/[0.045] px-3 py-2.5"
            >
              {s.figure !== null ? (
                <span className="text-[22px] font-semibold leading-none tracking-[-0.01em] text-ink">{s.figure}</span>
              ) : null}
              <span className="mt-1.5 text-[14px] font-semibold leading-tight text-ink">{s.label}</span>
              <span className={`truncate text-[12px] leading-tight ${s.line === UNREAD ? 'text-[rgb(var(--color-danger))]' : 'text-[color:var(--m-slate-2)]'}`}>
                {s.line}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * 📌 THE STATS, PINNED (v113 row 2 once the cover has collapsed — "1,240 Views · 4 Inquiries · 6 Booked · 64% Portfolio
 * · ₱48k Money"): the same five links, one compact row. Handed to `CollapsingTop` as `second.pinned` when the foundation
 * lands (spec A2 A4: "pins as row 2 under row 1"). An unread figure shows "—" here (the full strip says why).
 */
export function TodayStatsPinned({ stats }: { stats: Stats }) {
  return (
    <nav aria-label="Your numbers" data-today-stats-pinned="" className="flex w-full items-stretch justify-between gap-1">
      {todayStatsOf(stats).map((s) => (
        <Link key={s.id} href={TODAY_STAT_HREFS[s.id]} data-today-stat-pinned={s.id} className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center text-center">
          <span className="text-[14px] font-semibold leading-none text-ink">{s.figure ?? '—'}</span>
          <span className="mt-0.5 truncate text-xs text-[color:var(--m-slate-2)]">{s.label}</span>
        </Link>
      ))}
    </nav>
  );
}
