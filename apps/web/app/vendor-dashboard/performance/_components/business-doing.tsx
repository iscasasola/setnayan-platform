'use client';

/**
 * HOW IS MY BUSINESS DOING — the top of the Insights page, in plain words (simpler supplier dashboard step 6;
 * owner-APPROVED 2026-10-14; prototype SCREENS.insights).
 *
 *   window ▾ (Last 28 days · Last 12 months) — ONE dropdown, swapped client-side (both windows arrive pre-read, the
 *   way the page's own Daily/Monthly/Annual toggle already works — no refetch);
 *   the answer line — "48 couples looked at you · 6 asked · 2 booked";
 *   three rows that count up — Looked at you · Asked · Booked;
 *   the bars — bookings a month, the page's own 12-month series;
 *   How you are doing ▾ — reply time (the public badge's verdict) · what couples say · where bookings come from;
 *   More ▾ — doors to the full cards below (◆ only where the plan paywall actually applies).
 *
 * Every figure is a prop the server read with the SHIPPED readers; nothing here fetches. Motion stops under
 * "reduce motion" (the count lands at once, the bars do not grow).
 */
import { useEffect, useState } from 'react';
import { Check, Eye, MessageSquare } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { Fold } from '@/app/_components/fold';
import { DatesRow } from '../../customers/_components/dates-row';
import { CountUp } from './count-up';
import { formatPhp } from '@/lib/php';

export type DoingWindow = {
  key: 'month' | 'year';
  label: string;
  views: number;
  inquiries: number;
  booked: number;
  bookedPhp: number;
  lead: string;
  rest: string;
  from: string;
};

function useStill(): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setStill(mq.matches);
    const on = () => setStill(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return still;
}

export function BusinessDoing({
  windows,
  initial,
  bars,
  barLabels,
  reply,
  rating,
  more,
}: {
  windows: readonly DoingWindow[];
  initial: 'month' | 'year';
  /** Heights 0–100, one a month (oldest first); empty = nothing booked yet. */
  bars: readonly number[];
  barLabels: readonly string[];
  reply: { line: string; good: boolean };
  rating: string;
  /** Doors to the full cards below, each `{ title, line, href, pro }` — `pro` = the paywall applies here (◆). */
  more: readonly { key: string; title: string; line: string; href: string; pro: boolean }[];
}) {
  const [key, setKey] = useState<'month' | 'year'>(windows.some((w) => w.key === initial) ? initial : windows[0].key);
  const w = windows.find((x) => x.key === key) ?? windows[0];
  const still = useStill();
  const dur = still ? 0 : 650;

  return (
    <section aria-label="How is my business doing" data-business-doing="">
      <div className="flex min-h-11 items-center" data-business-window="">
        {windows.length > 1 ? (
          <PickMenu
            label="Which days"
            value={key}
            options={windows.map((x) => ({ key: x.key, label: x.label }))}
            onPick={(k) => setKey(k === 'year' ? 'year' : 'month')}
            dataAttr="data-business-window-pick"
            compact
            className="!min-h-11"
          />
        ) : (
          <span className="home-k2">{w.label}</span>
        )}
      </div>

      <p className="mt-2 text-[15px] text-ink" data-business-answer="">
        <b className="font-semibold">{w.lead}</b> · {w.rest}
      </p>

      <div className="mt-2" data-business-rows="">
        <DatesRow
          data="business-views"
          lead={<Eye aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />}
          title="Looked at you"
          line="Couples who opened your page"
          strong={<CountUp key={`v-${key}`} value={w.views} durationMs={dur} />}
        />
        <DatesRow
          data="business-asked"
          lead={<MessageSquare aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />}
          title="Asked"
          line={reply.line}
          strong={<CountUp key={`a-${key}`} value={w.inquiries} durationMs={dur} />}
        />
        <DatesRow
          data="business-booked"
          lead={<Check aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />}
          title="Booked"
          line={w.bookedPhp > 0 ? `${formatPhp(w.bookedPhp)} booked` : 'Nothing booked in these days yet'}
          strong={<CountUp key={`b-${key}`} value={w.booked} durationMs={dur} />}
        />
      </div>

      {bars.length > 0 ? (
        <figure className="mt-3" data-business-bars="">
          <div className="flex h-[70px] items-end gap-1" aria-hidden>
            {bars.map((h, i) => (
              <i
                key={i}
                title={barLabels[i]}
                className="block flex-1 rounded-t bg-sn-accent/25 transition-[height] duration-500 ease-out motion-reduce:transition-none"
                style={{ height: `${Math.max(h, 3)}%` }}
              />
            ))}
          </div>
          <figcaption className="mt-1 text-[12.5px] text-ink/55">Each bar is a month · bookings</figcaption>
        </figure>
      ) : null}

      <div className="mt-3 border-t border-ink/10" data-business-fold="health">
        <Fold title="How you are doing" line={`${reply.good ? 'Good' : 'Getting there'} · ${rating}`} data="business-health">
          <div className="pb-3">
            <DatesRow data="business-reply" title="How fast you reply" line={reply.line} badge={reply.good ? { tone: 'ok', word: 'Good' } : null} />
            <DatesRow data="business-rating" title="What couples say" line={rating} />
            <DatesRow data="business-from" title="Where bookings come from" line={w.from} />
          </div>
        </Fold>
      </div>
      {more.length > 0 ? (
        <div className="border-t border-ink/10" data-business-fold="more">
          <Fold title="More" line="Over time · demand · how you compare" data="business-more">
            <div className="pb-3">
              {more.map((m) => (
                <DatesRow
                  key={m.key}
                  data="business-more-row"
                  title={m.pro ? `${m.title} ◆` : m.title}
                  line={m.line}
                  href={m.href}
                />
              ))}
            </div>
          </Fold>
        </div>
      ) : null}
    </section>
  );
}
