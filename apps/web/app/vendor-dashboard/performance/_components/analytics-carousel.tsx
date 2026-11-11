'use client';

import './analytics-growing.css';
import { useMemo, useState, type ReactNode } from 'react';
import { SnapCarousel, type CarouselCard } from '@/components/snap-carousel';
import { PillSelector } from '@/app/_components/pill-selector';
import { formatCount } from '@/lib/format-number';
import type { GrowthWindow } from '@/lib/analytics-growing';
import type { NewGraphs } from '@/lib/vendor-analytics-graphs';
import type { GrowthRec, GrowthRecKey } from '@/lib/vendor-growth-recs';
import { graphSpecsFor, type GraphKey } from './analytics-growing';
import { GraphCard, type GraphSpec } from './graph-tile';
import { CountBarsPic, CountLinePic } from './new-graph-pics';
import { AnalyticsLock } from './analytics-lock';
import { HeldCount } from './growth-motion';
import { CARD_ORDER, FIXED_WINDOW, type CardKey } from './analytics-cards';
import type { GrowthView, Totals } from './growth-view';

/**
 * 📊🎠 SHOP › ANALYTICS — ONE LONG CAROUSEL, AND IT IS THE ONLY ANALYTICS (owner 11 Nov 2026: *"Analytics should be the
 * carousel."* → *"we want one long carousel"* → the window *"inside each card"* → *"Sliding switch"*; also *"they see
 * graph analysis fully animated"*; DECISION_LOG 2026-11-11 🎠 · 📊✅ · 🎚✅ · 📈; prototype
 * `prototypes/analytics_option_b_2026-11-11/analytics-option-b.html`, option 3).
 *
 *   · Every graph once, in the prototype's order: Opened · Asked · Booked (three cards of their own) · Where couples found
 *     you · Which card sells · How fast you answer · Reply speed vs bookings · Quotes waiting · Setnayan vs your own book ·
 *     The next 13 weeks · Dates you lost · Slow months ahead · What couples say · Compared with similar suppliers · Where
 *     your price sits.
 *   · Nothing sits above the carousel. Each card carries its OWN 30 days / 12 months sliding switch beside its number; a
 *     card with a fixed window shows the window as a label instead (`FIXED_WINDOW`).
 *   · Tap a card → it rises full screen (the one `RiseScreen`): the graph larger, the same switch in the head, then ONE
 *     recommendation from `buildGrowthRecs` (Problem → Solution → one door), or "Nothing to fix right now."
 *   · Each card animates when it is swiped into view (bars grow, lines draw); reduced motion keeps it still.
 *   · An unverified shop sees its three counts (each still switchable) and the graphs as ONE shared lock card
 *     (DECISION_LOG 2026-11-10 "FREE (UNVERIFIED): THE LAST SEVEN").
 * The badge row stays directly under this carousel (the Shop page's order).
 *
 * 🔒 shop/analytics-is-the-carousel.test.ts · performance/every-graph-is-a-tile.test.ts
 */

export const WINDOW_OPTIONS = [
  { key: '30', label: '30 days' },
  { key: '12', label: '12 months' },
] as const;

const WINDOW_WORD: Record<GrowthWindow, string> = { '30': 'in the last 30 days', '12': 'in the last 12 months' };

/** The rule each count card may show (the prototype's own). */
const COUNT_REC: Readonly<Record<'opened' | 'asked' | 'booked', GrowthRecKey>> = { opened: 'add_photos', asked: 'reply_faster', booked: 'requote_expired' };

type CountKind = 'opened' | 'asked' | 'booked';
const COUNT_COPY: Readonly<Record<CountKind, { title: string; word: string; src: string; door: { label: string; href: string } }>> = {
  opened: { title: 'Opened', word: 'opened', src: 'Counts · couples opening your page, by day (by month on 12 months)', door: { label: 'Share your shop link', href: '/vendor-dashboard/shop/promote' } },
  asked: { title: 'Asked', word: 'asked', src: 'Counts · inquiries, on the day they arrived', door: { label: 'Go to messages', href: '/vendor-dashboard/messages' } },
  booked: { title: 'Booked', word: 'booked', src: 'Counts · bookings confirmed', door: { label: 'Open your clients', href: '/vendor-dashboard/customers' } },
};

const countOf = (t: Totals | null, k: CountKind): number | null => (t === null ? null : k === 'opened' ? t.views : k === 'asked' ? t.inquiries : t.booked);

function countLine(k: CountKind, n: number, win: GrowthWindow): string {
  const w = WINDOW_WORD[win];
  if (k === 'opened') return `${formatCount(n)} ${n === 1 ? 'couple' : 'couples'} opened your page ${w}.`;
  if (k === 'asked') return `${formatCount(n)} ${n === 1 ? 'couple' : 'couples'} asked ${w}.`;
  return `${formatCount(n)} ${n === 1 ? 'booking' : 'bookings'} ${w}.`;
}

function Figure({ n, word }: { n: number | null; word: string }) {
  return (
    <span className="ag-fig" data-analytics-figure={word}>
      {/* Counts up when the card is swiped into view, and old → new when its switch slides (reduced motion: at once). */}
      {n === null ? <b>—</b> : <HeldCount value={n} id={`ag:fig:${word}`} className="ag-fig-n" />}
      <small>{word}</small>
    </span>
  );
}

/** One count card's spec for a window — its number is the window's total; its picture the window's own series. */
function countSpec(k: CountKind, win: GrowthWindow, totals: Totals | null, view: GrowthView | null): GraphSpec {
  const copy = COUNT_COPY[k];
  const n = countOf(totals, k);
  const w = view ? view.windows[win] : null;
  const series = w ? (k === 'opened' ? w.lanes.views : k === 'asked' ? w.lanes.asked : w.lanes.booked) : null;
  const rec: GrowthRec | null = w ? (w.recs.find((r) => r.key === COUNT_REC[k]) ?? null) : null;
  const empty = n === 0;
  const line = n === null ? 'Couldn’t load.' : empty ? `Nobody ${copy.word} ${WINDOW_WORD[win]} yet.` : countLine(k, n, win);
  const sample = Array.from({ length: win === '30' ? 30 : 12 }, (_, i) => (k === 'opened' ? 3 + ((i * 7) % 6) : (i * 5) % 7 === 0 ? 1 : 0));
  const pic =
    view === null ? null : k === 'opened' ? (
      <CountLinePic values={series && !empty ? series : sample} labels={w!.lanes.labels} />
    ) : (
      <CountBarsPic values={series && !empty ? series : sample} labels={w!.lanes.labels} kind={k} />
    );
  return {
    k,
    title: copy.title,
    src: copy.src,
    state: n === null ? 'unread' : empty && view !== null ? 'empty' : 'ok',
    pic,
    line,
    problem: line,
    rec,
    door: copy.door,
  };
}

type Props =
  | { view: GrowthView; graphs: Record<GrowthWindow, NewGraphs>; locked?: undefined }
  | { locked: { progress: string; totals: Record<GrowthWindow, Totals | null> }; view?: undefined; graphs?: undefined };

export function AnalyticsCarousel(props: Props) {
  const [wins, setWins] = useState<Partial<Record<CardKey, GrowthWindow>>>({});
  const winOf = (k: CardKey): GrowthWindow => wins[k] ?? '30';
  const setWin = (k: CardKey, w: GrowthWindow) => setWins((cur) => ({ ...cur, [k]: w }));

  // The graphs of BOTH windows, built once each from the same reads (no refetch when a switch slides).
  const specs = useMemo(
    () =>
      props.view
        ? { '30': graphSpecsFor({ view: props.view, graphs: props.graphs['30'], win: '30' }), '12': graphSpecsFor({ view: props.view, graphs: props.graphs['12'], win: '12' }) }
        : null,
    [props.view, props.graphs],
  );

  const control = (k: CardKey, title: string): ReactNode =>
    FIXED_WINDOW[k] ? (
      <span className="ag-when" data-analytics-fixed-window={k}>
        {FIXED_WINDOW[k]}
      </span>
    ) : (
      <PillSelector label={`Window for ${title}`} value={winOf(k)} options={WINDOW_OPTIONS} onPick={(v) => setWin(k, v)} grow={false} data={`analytics-window-${k}`} />
    );

  const totalsOf = (win: GrowthWindow): Totals | null => {
    if (props.locked) return props.locked.totals[win];
    const f = props.view.windows[win].booking.funnel;
    return f ? { views: f[0]!.count, inquiries: f[1]!.count, quotes: f[2]!.count, booked: f[3]!.count } : null;
  };

  const cards: CarouselCard[] = [];
  for (const k of CARD_ORDER) {
    if (k === 'opened' || k === 'asked' || k === 'booked') {
      const win = winOf(k);
      const g = countSpec(k, win, totalsOf(win), props.view ?? null);
      cards.push({ key: k, label: g.title, node: <GraphCard g={g} control={control(k, g.title)} figure={<Figure n={countOf(totalsOf(win), k)} word={COUNT_COPY[k].word} />} /> });
      continue;
    }
    if (!specs) continue;
    const g = specs[winOf(k)][k as GraphKey];
    if (!g) continue;
    cards.push({ key: k, label: g.title, node: <GraphCard g={g} control={control(k, g.title)} /> });
  }
  if (props.locked) {
    cards.push({
      key: 'locked',
      label: 'Analytics, locked',
      node: (
        <div className="ag-card-in ag-lockcard" data-analytics-locked-card="">
          <AnalyticsLock progress={props.locked.progress} />
        </div>
      ),
    });
  }

  return (
    <section aria-labelledby="shop-analytics-h" data-shop-analytics="" data-tour="shop-analytics" id="analytics" className="scroll-mt-24" data-growth="" data-analytics-carousel={props.locked ? 'locked' : 'full'}>
      <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
        <h2 id="shop-analytics-h" className="sn-eye">
          Analytics
        </h2>
        <span className="text-[11.5px] text-ink/50">
          {formatCount(cards.length)} {cards.length === 1 ? 'card' : 'cards'} · swipe · tap one
        </span>
      </div>
      {/* No auto-advance and no dots (spec §9 #4) — the loop stays (owner 27 Oct). */}
      <SnapCarousel cards={cards} label="Analytics" advanceMs={0} dots={false} />
    </section>
  );
}
