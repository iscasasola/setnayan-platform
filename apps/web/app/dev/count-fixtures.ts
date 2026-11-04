/**
 * 🧮 The labs' "who a supplier counts" fixture (owner 2026-11-04, the approved prototype `count-and-quotes.html`): 180
 * attending — 18 principal sponsors, 8 secondary sponsors, 14 of the entourage, 12 Kids, 6 Crew & helpers, 64 Family —
 * and 11 guests the couple ticked "Not counted for" the caterer. No database: `/dev/suppliers-lab` and
 * `/dev/guests-lab` draw the shipped components from it.
 */
import { countFor, ruleOfKeys, serviceLabel, type CountedService, type RosterEntry, type ServiceCounts } from '@/lib/supplier-count';
import type { GuestRole } from '@/lib/guests';

const KIDS = 'g-kids';
const CREW = 'g-crew';
const FAM = 'g-fam';

function roster(cateringId: string): RosterEntry[] {
  const out: RosterEntry[] = [];
  const add = (n: number, r: GuestRole, g: string[] = []) => {
    for (let i = 0; i < n; i += 1) out.push({ r: [r], g, t: [] });
  };
  add(9, 'principal_sponsor_ninong');
  add(9, 'principal_sponsor_ninang');
  add(2, 'candle_sponsor');
  add(2, 'veil_sponsor');
  add(2, 'cord_sponsor');
  add(2, 'coin_sponsor');
  add(7, 'groomsman');
  add(7, 'bridesmaid');
  add(1, 'flower_girl', [KIDS]);
  add(11, 'guest', [KIDS]);
  add(6, 'guest', [CREW]);
  add(64, 'guest', [FAM]);
  add(180 - out.length, 'guest');
  // The 11 the couple ticked for the caterer — 6 of the Kids, 5 of the crew who eat separately.
  let k = 0;
  for (const g of out) {
    if (k < 11 && (g.g.includes(KIDS) || g.g.includes(CREW)) && !g.r.includes('flower_girl')) {
      g.t = [cateringId];
      k += 1;
    }
  }
  return out;
}

function service(
  id: string,
  category: string,
  shop: string,
  booked: boolean,
  rule: CountedService['rule'],
  r: RosterEntry[],
): CountedService {
  return { id, category, label: serviceLabel(category, shop), shop, booked, rule, ...countFor(r, rule, id) };
}

/** The labs' event: a booked caterer, a sponsors' giveaway counting principal sponsors only, a quoted bar. */
export function labServiceCounts(ids: { catering: string; cateringShop?: string; giveaway?: string; quoted?: string }): ServiceCounts {
  const r = roster(ids.catering);
  const services: CountedService[] = [service(ids.catering, 'catering', ids.cateringShop ?? 'Juan’s Kitchen', true, ruleOfKeys('all', []), r)];
  if (ids.giveaway) services.push(service(ids.giveaway, 'gifts_and_giveaways', 'Bloom & Vine', true, ruleOfKeys('only', ['r:principal_sponsors']), r));
  if (ids.quoted) services.push(service(ids.quoted, 'mobile_bar', 'Tipsy Cart', false, ruleOfKeys('all', []), r));
  return {
    services,
    groups: [
      { id: CREW, label: 'Crew & helpers' },
      { id: FAM, label: 'Family' },
      { id: KIDS, label: 'Kids' },
    ],
    roster: r,
  };
}

export const LAB_KIDS_GROUP = KIDS;
