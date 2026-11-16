import { giftsLine, giftsRec, type GiftsRecFacts, type GiftsToBookings } from '@/lib/graph-unlocks';
import type { GraphSpec } from './graph-tile';
import type { SourceRow } from './growth-view';
import { SourceBars } from './source-bars';

/**
 * 🎁 GIFTS GIVEN → BOOKINGS — the graph Gifts given Bronze opens (J5; badge-unlock_v6 `DEF.gifts`: "couples who asked ·
 * booked, split by whether you gave them a gift"). New with this change, so it sits at the END of the carousel, marked
 * New, and opens by its badge for every shop (a kept shop never "had" it — lib/graph-unlocks.ts).
 *
 * The SAME card as every graph (`GraphCard`, via the carousel's one card builder) and the same honest states: a refused
 * read is `unread` ("Couldn’t load.", no picture, no advice), a shop with nobody asking draws the faded Example. Its one
 * recommendation is `giftsRec` — fires only with couples still deciding AND gift stock; never made up.
 * Read by `readGiftsToBookings` (lib/graph-unlocks.server.ts), only once the badge has opened it.
 */
export const GIFTS_TITLE = 'Gifts given → bookings';

const SAMPLE: GiftsToBookings = { giftedBooked: 5, giftedDeciding: 4, plainBooked: 3, plainDeciding: 21, freeStock: 0 };

const rowsOf = (g: GiftsToBookings): SourceRow[] => [
  { key: 'gifted-booked', label: 'Gifted · booked', count: g.giftedBooked },
  { key: 'gifted-deciding', label: 'Gifted · still deciding', count: g.giftedDeciding },
  { key: 'plain-booked', label: 'Not gifted · booked', count: g.plainBooked },
  { key: 'plain-deciding', label: 'Not gifted · still deciding', count: g.plainDeciding },
];

const EMPTY_LINE = 'Shows once couples ask you about your services.';

/** One window's gifts card. `data` null = the read was refused; undefined never reaches here (not opened = no card). */
export function giftsSpec(data: GiftsToBookings | null, more?: GiftsRecFacts): GraphSpec {
  const asked = data ? data.giftedBooked + data.giftedDeciding + data.plainBooked + data.plainDeciding : 0;
  const empty = data !== null && asked === 0;
  const line = data === null ? 'Couldn’t load.' : empty ? EMPTY_LINE : giftsLine(data);
  return {
    k: 'gifts',
    title: GIFTS_TITLE,
    src: 'Counts · couples who asked · booked, split by whether you gave them a gift',
    tag: 'new',
    state: data === null ? 'unread' : empty ? 'empty' : 'ok',
    pic: <SourceBars rows={rowsOf(empty || data === null ? SAMPLE : data)} />,
    line,
    problem: line,
    rec: giftsRec(data, more),
    door: { label: 'Give a gift', href: '/vendor-dashboard/shop/promote' },
  };
}
