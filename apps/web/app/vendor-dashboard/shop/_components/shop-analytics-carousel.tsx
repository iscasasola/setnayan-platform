'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { SnapCarousel, type CarouselCard } from '@/components/snap-carousel';
import { Sheet } from '@/app/_components/sheet';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { GrowthRec } from '@/lib/vendor-growth-recs';
import { ANALYTICS_PERIODS, SERIES_LABEL, periodLine, type AnalyticsPeriod, type SeriesCard } from '@/lib/shop-analytics-series';

/**
 * 📊 SHOP › ANALYTICS — FIVE cards on the shared carousel: What's ahead · deals · price · worth · compare (spec §4 +
 * §9 #8: "Analytics = FIVE cards incl. What's ahead"). The ONE carousel shape (`components/snap-carousel.tsx`): centre
 * snap (first and last too), the continuous loop KEPT (owner 27 Oct + its guard), NO auto-advance (`advanceMs={0}`)
 * and NO dots (`dots={false}`, owner v110 "No dot pagers on carousels") — both props from L1's foundation. No
 * "See all", no highlight on the centred card.
 *
 * Each face is the SHIPPED card's `compact` variant, drawn on the server and handed in. Tap → the card's sheet:
 * By month · By quarter · By year (ONE PickMenu), this period as a line with the last one as a dashed ghost and
 * "+N% vs last …" — only for the three cards with a history (ahead · deals · worth); price and compare are
 * snapshots, so their sheet shows the card large with no line, never an invented one. "What it tells you" (one fixed
 * sentence) and "To improve it" = only the SHIPPED tips (`buildGrowthRecs`) for that card (spec §4).
 * 🔒 shop/the-analytics-carousel-is-the-ruled-set.test.ts
 */
export const ANALYTICS_CARDS = ['ahead', 'deals', 'price', 'worth', 'compare'] as const;
export type AnalyticsCard = (typeof ANALYTICS_CARDS)[number];

export const ANALYTICS_CARD_LABEL: Readonly<Record<AnalyticsCard, string>> = {
  ahead: 'What’s ahead',
  deals: 'Quotes that turn into bookings',
  price: 'Where your price sits',
  worth: 'What Setnayan added',
  compare: 'Compared with similar suppliers',
};

/** "What it tells you" — one fixed sentence per card. */
const TELLS: Readonly<Record<AnalyticsCard, string>> = {
  ahead:
    'The next 13 weeks, a square per day. Gold = a booked day. A ring = a date couples asked for that you weren’t free on — many rings on one weekday means demand you’re turning away.',
  deals: 'Of the quotes you sent, how many couples accepted. A quote they accept becomes a booking.',
  price: 'Where your starting price sits between the low, the median and the high of published prices for your service in your region.',
  worth: 'Your bookings that came through Setnayan, beside the clients you brought in yourself.',
  compare: 'How you reply and book compared with shops like yours — Reply rate, Reply time and Inquiry → booking, each placed in a quarter.',
};

/** Which shipped tips belong under which card (`lib/vendor-growth-recs.ts` keys). */
const TIP_KEYS: Readonly<Record<AnalyticsCard, readonly GrowthRec['key'][]>> = {
  ahead: ['open_saturdays'],
  deals: ['reply_faster'],
  price: [],
  worth: ['add_photos', 'build_partnerships'],
  compare: ['reply_faster', 'ask_reviews'],
};

/**
 * The shared carousel's "no auto-advance, no dots" (L1 adds `dots`, and makes `advanceMs={0}` mean no auto-advance,
 * in `-foundation` — spec §9 #4). The loop stays.
 */
const CAROUSEL_STILL = { advanceMs: 0, dots: false } as const;

export type AnalyticsCardData = {
  key: AnalyticsCard;
  face: ReactNode;
  /** Locked by plan: the face is the lock line, and the sheet only says which plan shows it. */
  locked: boolean;
  /** The sheet's instants (only ahead · deals · worth); null = refused → "Couldn't load". */
  series?: string[] | null;
};

export function ShopAnalyticsCarousel({ cards, recs, nowMs }: { cards: AnalyticsCardData[]; recs: GrowthRec[]; nowMs: number }) {
  const [open, setOpen] = useState<AnalyticsCardData | null>(null);
  const slides: CarouselCard[] = cards.map((c) => ({
    key: c.key,
    label: ANALYTICS_CARD_LABEL[c.key],
    node: (
      <button
        type="button"
        className="block h-full w-full text-left"
        onClick={() => setOpen(c)}
        data-analytics-card={c.key}
        aria-label={`${ANALYTICS_CARD_LABEL[c.key]} — open`}
      >
        {c.face}
      </button>
    ),
  }));
  return (
    <section aria-labelledby="shop-analytics-h" data-shop-analytics="" data-tour="shop-analytics" id="analytics" className="scroll-mt-24">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
        <h2 id="shop-analytics-h" className="sn-eye">
          Analytics
        </h2>
        <span className="text-[11.5px] text-ink/50">swipe</span>
      </div>
      <SnapCarousel cards={slides} label="Analytics" {...CAROUSEL_STILL} />
      {open ? <AnalyticsSheet card={open} recs={recs} nowMs={nowMs} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

function AnalyticsSheet({ card, recs, nowMs, onClose }: { card: AnalyticsCardData; recs: GrowthRec[]; nowMs: number; onClose: () => void }) {
  const hid = useId();
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const hasLine = card.series !== undefined && !card.locked;
  const line = useMemo(() => (hasLine ? periodLine(card.series ?? null, period, nowMs) : null), [hasLine, card.series, period, nowMs]);
  const tips = recs.filter((r) => TIP_KEYS[card.key].includes(r.key));
  return (
    <Sheet open onClose={onClose} labelledById={hid} rise>
      <div className="space-y-4 px-4 pb-6 pt-2" data-analytics-sheet={card.key}>
        <div className="flex items-center justify-between gap-3 pr-12">
          <h2 id={hid} className="text-[17px] font-semibold text-ink">
            {ANALYTICS_CARD_LABEL[card.key]}
          </h2>
          {hasLine ? (
            <PickMenu
              label="Period"
              value={period}
              options={ANALYTICS_PERIODS.map((p) => ({ key: p.key, label: p.label }))}
              onPick={(k) => setPeriod(k as AnalyticsPeriod)}
              compact
              dataAttr="data-analytics-period"
            />
          ) : null}
        </div>

        {card.locked ? (
          <div>{card.face}</div>
        ) : hasLine ? (
          <PeriodChart card={card.key as SeriesCard} line={line} />
        ) : (
          // Price and compare are snapshots — the card, large; no line (no history is stored).
          <div data-analytics-snapshot="">{card.face}</div>
        )}

        <div>
          <p className="sn-eye pb-1">What it tells you</p>
          <p className="text-[14px] leading-relaxed text-ink/80">{TELLS[card.key]}</p>
        </div>
        {tips.length > 0 ? (
          <div>
            <p className="sn-eye pb-1">To improve it</p>
            <ul className="divide-y divide-ink/10" data-analytics-tips="">
              {tips.map((t) => (
                <li key={t.key} className="py-2.5">
                  <p className="text-[14px] font-medium text-ink">{t.title}</p>
                  <p className="text-[13px] text-ink/65">{t.body}</p>
                  <Link href={t.ctaHref} className="mt-1 inline-block text-[13px] font-medium" style={{ color: 'var(--m-orange-deep)' }} onClick={onClose}>
                    {t.ctaLabel} ›
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function PeriodChart({ card, line }: { card: SeriesCard; line: ReturnType<typeof periodLine> }) {
  if (line === null) {
    return (
      <p role="status" className="text-[13.5px] text-ink/65" data-analytics-unread="">
        Couldn&rsquo;t load {SERIES_LABEL[card].toLowerCase()} just now.
      </p>
    );
  }
  const W = 300;
  const H = 110;
  const max = Math.max(1, ...line.now, ...line.ghost);
  const n = Math.max(line.ghost.length, line.now.length, 2);
  const pts = (v: number[]) => v.map((y, i) => `${((i / (n - 1)) * W).toFixed(1)},${(H - (y / max) * (H - 8) - 4).toFixed(1)}`).join(' ');
  return (
    <div data-analytics-line={card}>
      <p className="text-[13px] text-ink/60">{SERIES_LABEL[card]}</p>
      <p className="text-[15px] text-ink">
        {line.change === null ? (
          <span className="text-ink/60">Nothing yet this period or the last</span>
        ) : (
          <>
            <b className="text-[22px] font-semibold">{line.change === 'new' ? 'New' : line.change === 'same' ? 'Same' : line.change}</b>{' '}
            <span className="text-ink/60">vs {line.vs} · {line.total} so far</span>
          </>
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-[120px] w-full" role="img" aria-label={`${SERIES_LABEL[card]}: ${line.total} this period, ${line.prevSameSpan} by the same point ${line.vs}`}>
        <polyline points={pts(line.ghost)} fill="none" stroke="color-mix(in srgb, var(--m-ink) 35%, transparent)" strokeWidth="1.5" strokeDasharray="4 4" />
        <polyline points={pts(line.now)} fill="none" stroke="var(--m-orange-2)" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[11px] text-ink/50">
        {line.axis.map((a) => (
          <span key={a}>{a}</span>
        ))}
      </div>
      <div className="mt-1 flex gap-4 text-[11.5px] text-ink/55">
        <span>— This {line.vs.replace('last ', '')}</span>
        <span>- - - {line.vs.charAt(0).toUpperCase() + line.vs.slice(1)}</span>
      </div>
    </div>
  );
}
