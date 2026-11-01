/**
 * guests-of-each-role-add-up.test.ts — 👥 GUESTS OF [ROLE] (owner 2026-11-01, DECISION_LOG "GUESTS › LIST: \"GUESTS OF
 * [ROLE]\" APPROVED"; the approved prototype `prototypes/guests_of_each_role_2026-11-01/`, its "Proposed" view — except
 * that a plain guest's +1 stays in Guests, owner verbatim: *"They can stay on guest already. Since they are both
 * guests"*).
 *
 * The PROPERTIES, on a fixture with every case the owner named (a best man's +1, a groomsman's two +1s — one of them a
 * bridesmaid herself — a principal sponsor's +1, plain guests' +1s, an unnamed seat):
 *   1. THE SECTIONS ADD UP — the Role view's section counts sum to the total (`rosterStats`), every person is counted in
 *      exactly ONE section, and a jump row is never counted;
 *   2. EACH ROLE COUNTS ITS OWN PEOPLE, and "Guests of [Role]" — right after it — counts the +1s its holders bring who
 *      have no role of their own; a group that would count nobody is not drawn;
 *   3. A +1 WITH A ROLE OF THEIR OWN is counted once, in that role, and is only a jump row in "Guests of [host's role]";
 *   4. PLAIN GUESTS' +1s STAY IN GUESTS, beside their guest — there is no "Guests of Guests";
 *   5. the Map (By role, By side), the search ("guests of groomsmen") and the header's doors follow the same rule;
 *   6. the drawn List says it: "· N" per heading, "guest of Antonio Loo ↗", the jump row, "+2 ↓" — measured on the
 *      REAL screen's HTML.
 *
 * SABOTAGE (each seen red, then restored): `roleSectionOf` sectioning a +1 by their guest again (`host === g ||
 * holdsOwnRole(g)` → `true` → … the shipped `roleBucket(at(g))`) → 1, 2, 3, 6 · a "Guests of Guests" group (`hb ===
 * 'guest'` → `false`) → 4 · the jumps counted (`guests: counted` → `[...counted, ...jumps]`) → 1, 3 · the `isPlace`
 * filter dropped from the role push → 1, 2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GuestRow } from '@/lib/guests';
import {
  guestsOfKey,
  mapTree,
  rosterSearchMatches,
  rosterSections,
  rosterStats,
  typedLineIsAFilter,
  withTheirPlusOnes,
  type MapBranch,
  type RosterFacts,
} from '@/lib/guest-roster-view';
import { sectionHeadDoors } from '@/lib/guest-section-head';
import { guestRow as baseRow, renderGuestsScreen } from './render-guests-screen';

const row = (over: Partial<GuestRow>) =>
  baseRow({ custom_tags: [], group_category: 'friends', rsvp_status: 'attending', ...over } as Partial<GuestRow>);
const plus = (id: string, of: string, first: string, last: string, over: Partial<GuestRow> = {}) =>
  row({ guest_id: id, first_name: first, last_name: last, plus_one_of_guest_id: of, plus_one_name_confirmed_at: '2026-10-01T00:00:00Z', ...over } as Partial<GuestRow>);

/* The prototype's roster — every case the owner named. */
const ROSTER: GuestRow[] = [
  row({ guest_id: 'maria', first_name: 'Maria', last_name: 'Santos', role: 'bride', side: 'bride' }),
  row({ guest_id: 'jose', first_name: 'Jose', last_name: 'Reyes', role: 'groom', side: 'groom' }),
  row({ guest_id: 'daniel', first_name: 'Daniel', last_name: 'Ramos', role: 'best_man', side: 'groom', plus_one_count: 1 }),
  row({ guest_id: 'andrea', first_name: 'Andrea', last_name: 'Flores', role: 'maid_of_honor', side: 'bride' }),
  plus('lea', 'daniel', 'Lea', 'Ramos', { side: 'groom' }),
  row({ guest_id: 'antonio', first_name: 'Antonio', last_name: 'Loo', role: 'groomsman', side: 'groom', plus_one_count: 2 }),
  plus('mariac', 'antonio', 'Maria', 'Cruz', { side: 'groom' }),
  plus('ana', 'antonio', 'Ana', 'Reyes', { role: 'bridesmaid', side: 'bride' }),
  row({ guest_id: 'gabriel', first_name: 'Gabriel', last_name: 'Castillo', role: 'groomsman', side: 'groom', plus_one_count: 1 }),
  plus('bianca', 'gabriel', 'Bianca', 'Lim', { side: 'groom', rsvp_status: 'pending' }),
  row({ guest_id: 'marco', first_name: 'Marco', last_name: 'Tan', role: 'groomsman', side: 'groom', rsvp_status: 'pending' }),
  row({ guest_id: 'sofia', first_name: 'Sofia', last_name: 'Navarro', role: 'bridesmaid', side: 'bride' }),
  row({ guest_id: 'efren', first_name: 'Efren', last_name: 'Ramos', role: 'principal_sponsor_ninong', side: 'groom', plus_one_count: 1 }),
  plus('lito', 'efren', 'Lito', 'Ramos', { side: 'groom' }),
  row({ guest_id: 'cita', first_name: 'Cita', last_name: 'Ramos', role: 'principal_sponsor_ninang', side: 'groom' }),
  row({ guest_id: 'joana', first_name: 'Joana', last_name: 'Cruz', role: 'guest', side: 'bride', plus_one_count: 1 }),
  plus('paolo', 'joana', 'Paolo', 'Mendoza', { side: 'bride' }),
  row({ guest_id: 'divina', first_name: 'Divina', last_name: 'Mercado', role: 'guest', side: 'bride', plus_one_count: 1 }),
  // An unnamed seat under a plain guest — still a guest, still in Guests.
  row({ guest_id: 'divina-tba', first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA', side: 'bride', plus_one_of_guest_id: 'divina', rsvp_status: 'pending', invitation_sent_at: null } as Partial<GuestRow>),
  row({ guest_id: 'angela', first_name: 'Angela', last_name: 'Santos', role: 'guest', side: 'bride', rsvp_status: 'declined' }),
];
const byId = new Map(ROSTER.map((g) => [g.guest_id, g] as const));
const facts: RosterFacts = { hasSides: true, groupsOf: () => [], tableOf: () => null, guestById: (id) => byId.get(id) };

const role = () => rosterSections(ROSTER, 'role', facts);
const counts = (secs = role()) => Object.fromEntries(secs.map((s) => [s.label, s.guests.length]));
const ids = (secs: ReturnType<typeof role>, key: string) => secs.find((s) => s.key === key)?.guests.map((g) => g.guest_id) ?? null;

test('1 · THE SECTIONS ADD UP — every person counted once, jump rows never', () => {
  const secs = role();
  const sum = secs.reduce((t, s) => t + s.guests.length, 0);
  console.log(`  ${secs.map((s) => `${s.label} ${s.guests.length}${s.jumps?.length ? ` (+${s.jumps.length} jump)` : ''}`).join(' · ')} = ${sum}`);
  assert.equal(sum, rosterStats(ROSTER).total, 'the sections do not add up to the total');
  assert.equal(sum, ROSTER.length);
  const seen = new Map<string, string>();
  for (const s of secs) {
    for (const g of s.guests) {
      assert.ok(!seen.has(g.guest_id), `${g.guest_id} is counted twice — in "${seen.get(g.guest_id)}" and "${s.label}"`);
      seen.set(g.guest_id, s.label);
    }
  }
  // …and it adds up WITH each role counting only its holders: every roleless +1 a role holder brings is counted in a
  // "Guests of [Role]" group, never in their guest's own role section.
  const roleless = ['lea', 'mariac', 'bianca', 'lito'];
  for (const id of roleless) {
    const sec = secs.find((s) => s.guests.some((g) => g.guest_id === id))!;
    assert.ok(sec.guestsOf, `${id} is counted in "${sec.label}" — their guest's role counts them, so the sections only add up by counting a +1 as a role holder`);
  }
  for (const s of secs) {
    for (const j of s.jumps ?? []) {
      assert.ok(!s.guests.some((g) => g.guest_id === j.guest_id), `${j.guest_id} is a jump row AND counted in "${s.label}"`);
      assert.ok(seen.has(j.guest_id), `${j.guest_id}'s jump row leads nowhere — nobody counts them`);
    }
  }
});

test('2 · each role counts its own people; "Guests of [Role]" right after it counts their roleless +1s', () => {
  assert.deepEqual(counts(), {
    'Bride & Groom': 2,
    'Honour attendants': 2,
    'Guests of Honour attendants': 1,
    Groomsmen: 3,
    'Guests of Groomsmen': 2,
    Bridesmaids: 2,
    'Principal Sponsors': 2,
    'Guests of Principal Sponsors': 1,
    Guests: 5,
  });
  const secs = role();
  const keys = secs.map((s) => s.key);
  for (const grp of ['honour_attendants', 'groomsmen', 'principal_sponsors'] as const) {
    assert.equal(keys.indexOf(guestsOfKey(grp)), keys.indexOf(`role:${grp}`) + 1, `"Guests of ${grp}" is not right after its role`);
    assert.equal(secs.find((s) => s.key === guestsOfKey(grp))!.guestsOf, grp);
  }
  assert.deepEqual(ids(secs, guestsOfKey('groomsmen')), ['mariac', 'bianca'], 'in the order their guests are listed');
  assert.deepEqual(ids(secs, 'role:groomsmen'), ['antonio', 'gabriel', 'marco'], 'Groomsmen holds only the groomsmen');
  // Bridesmaids bring nobody, so their group is not drawn; nor is a group whose only +1 has a role of their own.
  assert.equal(ids(secs, guestsOfKey('bridesmaids')), null);
  const onlyAna = rosterSections(ROSTER.filter((g) => g.guest_id !== 'mariac' && g.guest_id !== 'bianca'), 'role', facts);
  assert.equal(ids(onlyAna, guestsOfKey('groomsmen')), null, 'a jump row alone opened a "Guests of" group');
});

test('3 · a +1 with a role of their own is counted ONCE, in that role — a jump row under their guest’s', () => {
  const secs = role();
  assert.deepEqual(new Set(ids(secs, 'role:bridesmaids')), new Set(['ana', 'sofia']), 'Ana is not counted under Bridesmaids');
  assert.ok(!ids(secs, guestsOfKey('groomsmen'))!.includes('ana'), 'Ana is counted again under Guests of Groomsmen');
  assert.ok(!ids(secs, 'role:groomsmen')!.includes('ana'), 'Ana is counted under Groomsmen, as her guest is');
  assert.deepEqual(secs.find((s) => s.key === guestsOfKey('groomsmen'))!.jumps?.map((g) => g.guest_id), ['ana']);
});

test('4 · plain guests’ +1s stay in Guests, beside their guest — no "Guests of Guests"', () => {
  const secs = role();
  assert.deepEqual(ids(secs, 'role:guest'), ['joana', 'paolo', 'divina', 'divina-tba', 'angela']);
  assert.ok(!secs.some((s) => s.key === guestsOfKey('guest') || /guests of guests|plus-ones of guests/i.test(s.label)), 'a Guests-of-Guests group is drawn');
});

test('5 · the Map, the search and the header follow the same rule', () => {
  // By role — the List's own sections.
  const tree = mapTree(ROSTER, 'role', facts);
  assert.deepEqual(Object.fromEntries(tree.map((b) => [b.label, b.guests.length])), counts());
  // By side — every person on one leaf; an ungrouped groomsman's +1 on "Guests of Groomsmen", Ana on Bridesmaids.
  const leaves = (bs: readonly MapBranch[]): MapBranch[] => bs.flatMap((b) => [b, ...leaves(b.kids)]);
  const side = leaves(mapTree(ROSTER, 'side', facts));
  assert.equal(side.reduce((t, b) => t + b.guests.length, 0), ROSTER.length, 'the side map does not add up');
  const leafOf = (id: string) => side.find((b) => b.guests.some((g) => g.guest_id === id))?.label;
  assert.equal(leafOf('mariac'), 'Guests of Groomsmen');
  assert.equal(leafOf('antonio'), 'Groomsmen');
  assert.equal(leafOf('ana'), 'Bridesmaids');
  assert.equal(leafOf('paolo'), 'Guests');
  // The search: the heading's words find exactly the people it counts; a role's word finds only its holders.
  const hits = (q: string) => withTheirPlusOnes(q, ROSTER.filter((g) => rosterSearchMatches(q, g, facts)), ROSTER).map((g) => g.guest_id);
  assert.deepEqual(hits('guests of groomsmen'), ['mariac', 'bianca']);
  assert.deepEqual(hits('Guests of Honour attendants'), ['lea']);
  assert.ok(!hits('groomsmen').includes('mariac'), 'a groomsman’s +1 answers "groomsmen"');
  assert.ok(typedLineIsAFilter('guests of groomsmen', facts), 'Enter would add a guest named "Guests of Groomsmen"');
  // The heading renames nothing and adds nobody (its word is the role's; a typed name would have nobody bringing them).
  assert.deepEqual(sectionHeadDoors(guestsOfKey('groomsmen'), { groups: [], offeredRoles: ['groomsman', 'guest'] }), { rename: null, add: null });
});

test('6 · the drawn List: "· N" per heading, "guest of Antonio Loo ↗", the jump row, "+2 ↓"', async () => {
  // A name search opens every section with a hit and brings the +1s: Antonio, Maria Cruz, Ana.
  const html = await renderGuestsScreen({ guests: ROSTER, initialQuery: 'Antonio' });
  const section = (key: string) => {
    const at = html.indexOf(`data-guest-section="${key}"`);
    assert.ok(at >= 0, `no "${key}" section drawn`);
    return html.slice(at, html.indexOf('</section>', at));
  };
  const n = (key: string) => Number(/data-count="gs-n-[^"]*">([\d,]+)</.exec(section(key))?.[1] ?? NaN);
  const of = section(guestsOfKey('groomsmen'));
  assert.match(of, /Guests of Groomsmen/);
  assert.equal(n(guestsOfKey('groomsmen')), 1, 'the heading counts Maria Cruz only — not Ana');
  assert.match(of, /data-guest-id="mariac"[\s\S]*?guest of Antonio Loo[\s\S]*?data-jump-to="antonio"/, 'Maria Cruz’s row does not say whose guest she is, with ↗');
  assert.match(of, /data-jump-row="" data-guest-id="ana"[\s\S]*?Ana Reyes[\s\S]*?Bridesmaid[\s\S]*?Listed under Bridesmaids · not counted here/, 'Ana’s jump row is missing');
  assert.doesNotMatch(of, /data-guest-row=""[^>]*data-guest-id="ana"/, 'Ana is a counted row under Guests of Groomsmen');
  const maids = section('role:bridesmaids');
  assert.match(maids, /data-guest-row=""[\s\S]*?data-guest-id="ana"[\s\S]*?guest of Antonio Loo[\s\S]*?data-jump-to="antonio"/, 'Ana’s own row lost the way back to Antonio');
  const men = section('role:groomsmen');
  assert.match(men, /data-guest-id="antonio"[\s\S]*?data-jump-kids="">\+2/, 'Antonio’s "+2" is not the jump to his guests');
  // The page's total equals the sections' counts, drawn.
  const all = await renderGuestsScreen({ guests: ROSTER });
  const drawn = [...all.matchAll(/data-count="gs-n-[^"]*">([\d,]+)</g)].map((m) => Number(m[1]));
  assert.equal(drawn.reduce((a, b) => a + b, 0), ROSTER.length, `drawn heading counts ${drawn.join(' + ')} do not add up to ${ROSTER.length}`);
});
