/**
 * 🧪 THE OUR DAY POSTER LAB'S SAMPLE EVENT (DEV-ONLY — `/dev/day-poster-lab`). Maria & Jose, 12 December 2026 — the
 * drawing's own sample couple (approved v4) — with a real wedding's people: 38 principal sponsors and an ≈ 80-name
 * entourage (DECISION_LOG 2026-11-13 "SIZED TO A REAL WEDDING"). Invented names; no database.
 */
import { buildEntourage, type EntourageGuestRow } from '@/lib/entourage';
import type { PrintSetData } from '@/lib/print-layout';
import { DEFAULT_NAME_STYLE } from '@/lib/name-style';

const FIRST = ['Nene', 'Hernan', 'Ofelia', 'Corazon', 'Jun', 'Queenie', 'Elvie', 'Lito', 'Susan', 'Gloria', 'Nestor', 'Ben', 'Imelda', 'Pepito', 'Danilo', 'Kristina', 'Rodel', 'Fidel', 'Marites'];
const LAST = ['Reyes', 'Aquino', 'Flores', 'Navarro', 'Ramos', 'Uy', 'Zamora', 'Lim', 'Bautista', 'Garcia', 'Ocampo', 'Salazar', 'Valdez', 'Abad', 'Dizon', 'Castro', 'Mendoza'];
let n = 0;
const p = (role: string, title: string | null = null): EntourageGuestRow => {
  n += 1;
  return { guest_id: `lab-${n}`, march: null, name_prefix: title, first_name: FIRST[n % FIRST.length]!, middle_name: null, last_name: LAST[(n * 5) % LAST.length]!, name_suffix: null, role } as EntourageGuestRow;
};

function guests(): EntourageGuestRow[] {
  const r: EntourageGuestRow[] = [];
  r.push(p('groom_parents'), p('groom_parents'), p('bride_parents'), p('bride_parents'));
  r.push(p('maid_of_honor'), p('maid_of_honor'), p('best_man'));
  for (let i = 0; i < 38; i += 1) r.push(p(i % 2 ? 'principal_sponsor_ninang' : 'principal_sponsor_ninong', i % 2 ? 'Mrs.' : 'Mr.'));
  for (const x of ['candle_sponsor', 'candle_sponsor', 'veil_sponsor', 'veil_sponsor', 'cord_sponsor', 'cord_sponsor']) r.push(p(x));
  for (let i = 0; i < 12; i += 1) r.push(p('bridesmaid'));
  for (let i = 0; i < 12; i += 1) r.push(p('groomsman'));
  for (const x of ['ring_bearer', 'bible_bearer', 'coin_bearer', 'flower_girl', 'flower_girl']) r.push(p(x));
  return r;
}

export const LAB_GROUPS = buildEntourage(guests(), null, null, DEFAULT_NAME_STYLE);
export const LAB_EVENT = '00000000-0000-4000-8000-00000000da11';
export const LAB_BASE = '/dev/day-poster-lab/api';
export const LAB_PHOTOS = 14;
export const labRef = (i: number) => `r2://setnayan-media/papic/event-lab/photo-${i}.jpg`;

export function labData(): Omit<PrintSetData, 'dayPoster'> {
  return {
    names: { first: 'Maria', second: 'Jose' },
    eyebrow: 'The wedding of',
    dateLabel: 'Saturday · December 12, 2026',
    ceremonyTime: null,
    ceremonyVenue: 'The Ridge, Tagaytay',
    receptionTime: null,
    receptionVenue: null,
    monogram: null,
    initials: 'M & J',
    details: { parents: [], openingLine: null, rsvpContact: null, giftLines: [] },
    entourage: [],
    attire: [],
    swatches: [],
    hubAddress: 'setnayan.com/maria-and-jose',
    hasStill: false,
    hasEventQr: true,
  };
}

export const LAB_LINE = 'We planned this for a year, and it went by in an afternoon.';
export const LAB_CREDITS = ['The Ridge', 'Liwanag Studio', 'Kusina ni Rosa', 'Talulot Florals', 'Ganda by Bea', 'Emcee Migs'];
