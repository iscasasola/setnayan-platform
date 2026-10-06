/**
 * march-owner-shape.fixture.ts — a Wedding March the SHAPE of the owner's own
 * event (2026-10-06 crash report: 45 walks · 80 walking), for tests only.
 *
 * Shape, not data: no name here is a real guest. What it copies is what the
 * march has to survive — the "Surname first" Name style ("Mr. Casasola,
 * Manuel C."), hyphenated surnames with a title ("Atty. Sacdalan-Casasola,
 * Eufrocina M."), the groom's and the bride's sides, "Maid of Honor & Best
 * Man / Best Woman" (a best woman AND a best man), parents in pairs (one pair
 * walking ACROSS the two sides — a tied walk), many people walking alone, a
 * person holding two roles, and people nobody has placed yet.
 */
import type { EntourageGuestRow } from '@/lib/entourage';

type Spot = { walk_no: number; place_in_walk: number };
export type OwnerRow = EntourageGuestRow & { guest_id: string };

const SURNAMES = ['Casasola', 'Sacdalan-Casasola', 'Domingo', 'Villanueva-Reyes', 'Magsaysay', 'Dela Cruz', 'Lim', 'Ocampo', 'Tan', 'Santos'];
const FIRSTS = ['Manuel', 'Eufrocina', 'Bridgette', 'Juanita', 'Ricardo', 'Pilar', 'Teodoro', 'Nora', 'Cesar', 'Amy', 'Lito', 'Ivy'];
const PREFIX = ['Mr.', 'Mrs.', 'Atty.', 'Hon.', 'Dr.', 'Engr.', 'Ms.', 'USec.'];

/** The fixture: 80 people, 45 walks once the unplaced ones are counted (see the test). */
export function ownerShapedMarch(): OwnerRow[] {
  const rows: OwnerRow[] = [];
  let n = 0;
  let walk = 0;
  const person = (role: string, spot: Spot | null, extra: string[] = []): OwnerRow => {
    const i = n++;
    const row: OwnerRow = {
      guest_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      name_prefix: role === 'flower_girl' || role.endsWith('_bearer') ? null : PREFIX[i % PREFIX.length]!,
      first_name: FIRSTS[i % FIRSTS.length]!,
      middle_name: i % 3 === 0 ? 'Cruz' : null,
      last_name: SURNAMES[i % SURNAMES.length]!,
      role,
      extra_roles: extra,
      march: spot,
    };
    rows.push(row);
    return row;
  };
  const pair = (a: string, b: string) => {
    person(a, { walk_no: walk, place_in_walk: 0 });
    person(b, { walk_no: walk, place_in_walk: 1 });
    walk++;
  };
  const alone = (role: string, extra: string[] = []) => {
    person(role, { walk_no: walk, place_in_walk: 0 }, extra);
    walk++;
  };

  // The groom's side: his parents (a pair), the groom himself unplaced (no row yet).
  pair('groom_parents', 'groom_parents');
  person('groom', null);
  // Immediate family — some pairs, some alone, one unplaced.
  pair('groom_immediate_family', 'bride_immediate_family');
  alone('groom_immediate_family');
  alone('bride_immediate_family');
  person('bride_immediate_family', null);
  // Maid of Honor & Best Man / Best Woman: a maid with a best woman, a best man alone.
  pair('maid_of_honor', 'best_woman');
  alone('best_man');
  // Principal sponsors: 18 pairs, 3 alone (one legacy `principal_sponsor`), one unplaced.
  for (let i = 0; i < 18; i++) pair('principal_sponsor_ninong', 'principal_sponsor_ninang');
  alone('principal_sponsor_ninong');
  alone('principal_sponsor_ninang');
  alone('principal_sponsor');
  person('principal_sponsor_ninang', null);
  // Secondary sponsors — candle, veil, cord pairs; a coin sponsor alone.
  pair('candle_sponsor', 'candle_sponsor');
  pair('veil_sponsor', 'veil_sponsor');
  pair('cord_sponsor', 'cord_sponsor');
  alone('coin_sponsor');
  // Bride's crew & groom's crew — 5 pairs, 2 alone; one bridesmaid also a reader (two roles).
  for (let i = 0; i < 5; i++) pair('bridesmaid', 'groomsman');
  alone('bridesmaid', ['reader_lector']);
  alone('groomsman');
  // Bearers and flower girls.
  alone('ring_bearer');
  alone('bible_bearer');
  alone('coin_bearer');
  pair('flower_girl', 'flower_girl');
  alone('flower_girl');
  // The ceremony.
  alone('officiant');
  // The bride's side: a TIED walk — her mother walks with the groom's father's
  // number (a pair spanning the two sides under the printed "Parents"), her
  // father alone, the bride unplaced.
  person('bride_parents', { walk_no: 0, place_in_walk: 2 });
  alone('bride_parents');
  person('bride', null);
  return rows;
}
