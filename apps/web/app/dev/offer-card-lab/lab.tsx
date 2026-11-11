/**
 * /dev/offer-card-lab — the PR-4 offer card and "See every version · side by side" on fixture data: no sign-in, no
 * database. DEV-ONLY: production builds 404 this route. Names and amounts are samples — nobody real, never a price.
 *
 *   ?m=drop|drop2|open|supplier|applied|expired|ended|compare
 */
import { notFound } from 'next/navigation';
import { DroppedOfferCard } from '@/app/_components/chat/cards/offer-card';
import type { DroppedOffer } from '@/app/_components/chat/cards/offer-calls';
import { OfferDropLab, QuoteVersionsCompareLab } from './compare-lab';
import { blankOffer, type Offer } from '@/lib/offers';
import { orderQuoteVersions, type QuoteVersionRow } from '@/lib/quote-versions';
import { manilaTodayIsoFor } from '@/lib/quote-valid-until';
import { resolveSchedule } from '@/lib/proposal-payment-schedule';

const C = (php: number) => php * 100;

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function OfferCardLab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const m = typeof sp.m === 'string' ? sp.m : 'open';
  const today = manilaTodayIsoFor(Date.now());

  const rainy: Offer = { ...blankOffer('S89D-LAB0000001'), name: 'Rainy-season weekday', pctOff: 10, reachesAll: false, cards: ['card-buffet'], untilDate: addDays(today, 30) };
  const early: Offer = { ...blankOffer('S89D-LAB0000002'), name: 'Book early', phpOff: 5000, untilDate: addDays(today, 60) };
  const lines = [
    { label: 'Garden buffet · 150 pax', detail: null, amount_centavos: C(90_000), card_id: 'card-buffet' },
    { label: 'Cocktail hour', detail: null, amount_centavos: C(20_000), card_id: 'card-cocktail' },
  ];
  const total = C(110_000);
  const plan = resolveSchedule({
    manual: [{ label: 'Reservation', kind: 'percent', amountPhp: null, percent: 30, due: 'on_lock', offsetDays: 0 }],
    autoBalance: { label: 'Final balance', due: 'before_event', offsetDays: 30 },
    baseCentavos: total,
    creditCentavos: 0,
  });
  const v = (id: string, at: string, ls: typeof lines | (typeof lines[number] | Record<string, unknown>)[], t: number, status: string): QuoteVersionRow => ({
    proposal_id: id,
    public_id: `S89P-${id}`,
    event_id: 'ev',
    vendor_profile_id: 'shop',
    status,
    sent_at: at,
    created_at: at,
    total_centavos: t,
    line_items: ls as QuoteVersionRow['line_items'],
    payment_schedule: plan,
  });
  const v1 = v('LAB0000001', `${addDays(today, -3)}T06:00:00Z`, [...lines, { label: 'Grazing table', detail: null, amount_centavos: C(15_000), card_id: 'card-buffet' }], C(125_000), 'superseded');
  const v2 = v('LAB0000002', `${addDays(today, -1)}T06:00:00Z`, lines, total, 'superseded');
  const v3 = v('LAB0000003', `${today}T02:00:00Z`, [...lines, { label: 'Rainy-season weekday', detail: '10% off · offer', amount_centavos: -C(9_000), offer_id: rainy.id }], C(101_000), 'sent');
  const versions = orderQuoteVersions(m === 'applied' || m === 'compare' ? [v1, v2, v3] : [v1, v2]);

  const drop = (over: Partial<DroppedOffer>): DroppedOffer => ({
    messageId: '00000000-0000-4000-8000-0000000d0d0d',
    droppedAt: `${today}T01:00:00Z`,
    goodUntil: addDays(today, 6),
    markerPresent: true,
    offer: rainy,
    appliedIn: null,
    quote: { lines, totalCentavos: total, cardIds: ['card-buffet', 'card-cocktail'], schedule: plan },
    eventDate: addDays(today, 180),
    versions,
    ...over,
  });

  const body = (() => {
    switch (m) {
      case 'drop':
      case 'drop2':
        return <OfferDropLab seed={[{ rowId: 1, offer: rainy }, { rowId: 2, offer: early }]} startStep={m === 'drop2' ? 1 : 0} />;
      case 'supplier':
        return <DroppedOfferCard messageId="lab" viewer="supplier" kicker="You · 9:02 AM" seed={drop({})} />;
      case 'applied':
        return <DroppedOfferCard messageId="lab" viewer="couple" kicker="Rosa’s Kitchen · 9:02 AM" seed={drop({ appliedIn: 3 })} />;
      case 'expired':
        return <DroppedOfferCard messageId="lab" viewer="couple" kicker="Rosa’s Kitchen · Nov 2" seed={drop({ goodUntil: addDays(today, -2) })} />;
      case 'ended':
        return <DroppedOfferCard messageId="lab" viewer="couple" kicker="Rosa’s Kitchen · Nov 2" seed={drop({ offer: null })} />;
      case 'compare':
        return <QuoteVersionsCompareLab versions={versions} />;
      default:
        return <DroppedOfferCard messageId="lab" viewer="couple" kicker="Rosa’s Kitchen · 9:02 AM" seed={drop({})} />;
    }
  })();

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] bg-cream px-4 py-6" data-offer-card-lab={m}>
      <p className="mb-3 text-[12px] uppercase tracking-[0.08em] text-ink/50">Offer card lab · {m} · sample data</p>
      {body}
    </main>
  );
}
