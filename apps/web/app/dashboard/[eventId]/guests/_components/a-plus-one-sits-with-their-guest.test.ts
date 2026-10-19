/**
 * a-plus-one-sits-with-their-guest.test.ts — 🤝 A +1 IS DRAWN WITH THE GUEST WHO BRINGS THEM (owner 2026-10-19,
 * on cale-ice's Guests › List: *"the plus 1 did not connect properly to the guest"* — GUESTS · 68 opened on a
 * run of identical "+1 · TBA · To invite" rows, none saying whose).
 *
 * The rows WERE linked (`guests.plus_one_of_guest_id`); the List bucketed each +1 by its OWN role ("guest"),
 * side and name, so a bridesmaid's +1 sat under GUESTS. The PROPERTY held here, over every Sort and every map
 * arrangement:
 *   1. every row with a guest it belongs to is in THAT GUEST'S section (the RSVP Sort excepted — its headings are
 *      answers, and a +1's answer is their own) and comes right after the guest, or after that guest's earlier +1s;
 *   2. the drawn row is NAMED with the guest — "Juanita Sacdalan’s +1 · TBA" for an unnamed seat,
 *      "· +1 of Juanita Sacdalan" after a named one — and shows the guest's side;
 *   3. searching the guest's NAME brings their +1s; a reply word does not (Pick who must not tick them);
 *   4. every write that sets a guest's side carries it to their +1s (`carrySideToTheirPlusOnes`), so the drift
 *      measured in production (4 of 19 live +1s on "both" under a "bride" guest) stops at the source.
 *
 * SABOTAGE (2026-10-20, each seen red, then restored):
 *   · `roleBucket(at(g))` → `roleBucket(g)` in `rosterSections`  → tests 1, 4 red (the +1s fall to "Guests");
 *   · `guests: beside(list)` → `guests: list`                    → test 1 red (a +1 not after its guest);
 *   · `plusWords?.name ??` dropped from `GuestRowLine`            → test 4 red ("+1 · TBA" again);
 *   · the `carrySideToTheirPlusOnes` call dropped from `setGuestSide` → test 6 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import type { GuestRow } from '@/lib/guests';
import {
  MAP_ARRANGE,
  mapTree,
  plusOneWordsFrom,
  ROSTER_VIEWS,
  rosterSearchMatches,
  rosterSections,
  withTheirPlusOnes,
  type MapBranch,
  type RosterFacts,
} from '@/lib/guest-roster-view';
import { carrySideToTheirPlusOnes } from '@/lib/extra-seats-sync';
import { guestRow as baseRow, renderGuestsScreen } from './render-guests-screen';

const guestRow = (over: Partial<GuestRow>) => baseRow({ custom_tags: [], group_category: 'friends', ...over } as Partial<GuestRow>);

const HERE = dirname(fileURLToPath(import.meta.url));

/* The owner's shape: entourage and sponsors with TBA seats on "both", a named +1, a plain guest's +1. */
const bride = guestRow({ guest_id: 'bride', first_name: 'Ice', last_name: 'Casasola', role: 'bride', side: 'bride' });
const groom = guestRow({ guest_id: 'groom', first_name: 'Cale', last_name: 'Reyes', role: 'groom', side: 'groom' });
const juanita = guestRow({ guest_id: 'juanita', first_name: 'Juanita', last_name: 'Sacdalan', role: 'groom_immediate_family', side: 'groom', plus_one_count: 2 });
const lauren = guestRow({ guest_id: 'lauren', first_name: 'Lauren', last_name: 'Mijares', role: 'bridesmaid', side: 'bride', plus_one_count: 1 });
const nelson = guestRow({ guest_id: 'nelson', first_name: 'Nelson', last_name: 'Somo', role: 'principal_sponsor', side: 'bride', plus_one_count: 1 });
const ana = guestRow({ guest_id: 'ana', first_name: 'Ana', last_name: 'Zamora', role: 'guest', side: 'bride', plus_one_count: 1 });
const zed = guestRow({ guest_id: 'zed', first_name: 'Zed', last_name: 'Abad', role: 'guest', side: 'groom' });
const seat = (id: string, of: string, over: Partial<GuestRow> = {}) =>
  guestRow({
    guest_id: id,
    first_name: 'TBA',
    last_name: '+1',
    display_name: '+1 · TBA',
    role: 'guest',
    side: 'both',
    plus_one_of_guest_id: of,
    invitation_sent_at: null,
    ...over,
  } as Partial<GuestRow>);
const juanitaSeat = seat('juanita-tba', 'juanita');
const juanitaNamed = seat('juanita-pedro', 'juanita', { first_name: 'Pedro', last_name: 'Cruz', display_name: null, rsvp_status: 'attending' });
const laurenSeat = seat('lauren-tba', 'lauren');
const nelsonSeat = seat('nelson-tba', 'nelson');
const anaSeat = seat('ana-tba', 'ana');

/** The page's order puts the +1s together, away from their guests — the very order the owner saw. */
const ROSTER: GuestRow[] = [bride, groom, juanita, lauren, nelson, juanitaSeat, juanitaNamed, laurenSeat, nelsonSeat, anaSeat, ana, zed];
const byId = new Map(ROSTER.map((g) => [g.guest_id, g] as const));
const GROUPS: Record<string, string[]> = { juanita: ['Sacdalan family'], lauren: ['Barkada'] };
const facts: RosterFacts = {
  hasSides: true,
  groupsOf: (id) => GROUPS[id] ?? [],
  tableOf: () => null,
  guestById: (id) => byId.get(id),
};

/** The property, over one list of sections: in the guest's section, right after the guest (or their earlier +1s). */
function assertBeside(sections: readonly { label: string; guests: readonly GuestRow[] }[], where: string, ownAnswer = false) {
  const sectionOf = new Map<string, string>();
  for (const s of sections) for (const g of s.guests) sectionOf.set(g.guest_id, s.label);
  let checked = 0;
  for (const s of sections) {
    s.guests.forEach((g, i) => {
      const host = g.plus_one_of_guest_id;
      if (!host || !byId.has(host)) return;
      if (ownAnswer && sectionOf.get(host) !== s.label) return; // RSVP: their own answer, another heading
      checked++;
      assert.equal(sectionOf.get(host), s.label, `${where}: ${g.guest_id} is in "${s.label}", their guest in "${sectionOf.get(host)}"`);
      const h = s.guests.findIndex((x) => x.guest_id === host);
      assert.ok(h >= 0 && h < i, `${where}: ${g.guest_id} comes before their guest`);
      for (const between of s.guests.slice(h + 1, i)) {
        assert.equal(between.plus_one_of_guest_id, host, `${where}: ${between.guest_id} sits between ${host} and their +1 ${g.guest_id}`);
      }
    });
  }
  return checked;
}

test('every Sort: a +1 is in their guest’s section, right after them', () => {
  for (const v of ROSTER_VIEWS) {
    const secs = rosterSections(ROSTER, v.key, facts);
    const n = assertBeside(secs, `Sort ${v.label}`, v.key === 'rsvp');
    if (v.key !== 'rsvp') assert.equal(n, 5, `Sort ${v.label}: all five +1s were checked`);
    // Nothing lost, nothing doubled: the section counts still add up to the list.
    assert.equal(secs.reduce((t, s) => t + s.guests.length, 0), ROSTER.length, `Sort ${v.label}: every row once`);
  }
  // The bridesmaid's +1 is a bridesmaid's line, not under "Guests".
  const role = rosterSections(ROSTER, 'role', facts);
  const guests = role.find((s) => s.key === 'role:guest')!;
  assert.deepEqual(guests.guests.map((g) => g.guest_id), ['ana', 'ana-tba', 'zed']);
});

test('a search that leaves the guest out still sections their +1 with that guest', () => {
  const secs = rosterSections([laurenSeat], 'role', facts);
  assert.equal(secs.length, 1);
  assert.equal(secs[0]!.key, 'role:bridesmaids');
});

test('every map arrangement: a +1 is on their guest’s branch, right after them', () => {
  const leaves = (bs: readonly MapBranch[]): { label: string; guests: GuestRow[] }[] =>
    bs.flatMap((b) => [{ label: b.key, guests: b.guests }, ...leaves(b.kids)]).filter((b) => b.guests.length > 0);
  for (const a of MAP_ARRANGE) {
    const n = assertBeside(leaves(mapTree(ROSTER, a.key, facts)), `Map ${a.label}`, a.key === 'rsvp');
    if (a.key !== 'rsvp') assert.equal(n, 5, `Map ${a.label}: all five +1s were checked`);
  }
});

test('the drawn row names its guest and wears their side', async () => {
  const words = plusOneWordsFrom(ROSTER);
  assert.equal(words.get('juanita-tba')!.name, 'Juanita Sacdalan’s +1 · TBA');
  assert.equal(words.get('juanita-pedro')!.of, '+1 of Juanita Sacdalan');
  assert.equal(words.get('juanita-pedro')!.name, null);
  assert.equal(words.has('juanita'), false);

  // A search opens every section, so every row is drawn.
  const html = await renderGuestsScreen({ guests: ROSTER, initialQuery: 'Sacdalan' });
  const rows = [...html.matchAll(/<div class="([^"]*)" data-guest-row="" data-guest-id="([^"]+)"( data-plus-one-of="([^"]+)")?>([\s\S]*?)(?=<div class="[^"]*" data-guest-row=""|<\/section>)/g)].map(
    (m) => ({ cls: m[1]!, id: m[2]!, of: m[4] ?? null, body: m[5]! }),
  );
  assert.deepEqual(rows.map((r) => r.id), ['juanita', 'juanita-tba', 'juanita-pedro'], 'Juanita, then her two +1s, in seat order');
  const tba = rows[1]!;
  assert.equal(tba.of, 'juanita');
  assert.match(tba.body, /Juanita Sacdalan’s \+1 · TBA/);
  assert.doesNotMatch(tba.body, />\+1 · TBA</, 'the bare seat label is gone');
  assert.match(tba.body, /sideGroom/, 'the +1 shows the side of the guest who brings them');
  assert.match(tba.cls, /\bjoined\b/, 'drawn as part of the guest above');
  assert.match(rows[2]!.body, /Pedro Cruz[\s\S]*\+1 of Juanita Sacdalan/);
  assert.doesNotMatch(rows[0]!.cls, /\bjoined\b/);
});

test('searching a guest’s name brings their +1s; a reply word does not', () => {
  const hits = (q: string) => withTheirPlusOnes(q, ROSTER.filter((g) => rosterSearchMatches(q, g, facts)), ROSTER).map((g) => g.guest_id);
  assert.deepEqual(hits('lauren'), ['lauren', 'lauren-tba']);
  assert.deepEqual(hits('juanita sacdalan'), ['juanita', 'juanita-tba', 'juanita-pedro']);
  // "to invite": the seats are uninvited, their guests are invited — each on their own answer.
  assert.deepEqual(hits('to invite'), ['juanita-tba', 'juanita-pedro', 'lauren-tba', 'nelson-tba', 'ana-tba'].filter((id) => rosterSearchMatches('to invite', byId.get(id)!, facts)));
  assert.ok(!hits('to invite').includes('lauren'));
});

test('every write that sets a guest’s side carries it to their +1s', async () => {
  // The helper writes the +1s of exactly those guests, only where the side differs, never a deleted row.
  const calls: [string, ...unknown[]][] = [];
  const chain: Record<string, (...a: unknown[]) => unknown> = {};
  for (const k of ['update', 'eq', 'in', 'neq', 'is']) chain[k] = (...a: unknown[]) => (calls.push([k, ...a]), chain);
  (chain as { then?: unknown }).then = (ok: (v: unknown) => unknown) => ok({ error: null });
  const supabase = { from: (t: string) => (calls.push(['from', t]), chain) } as never;
  assert.deepEqual(await carrySideToTheirPlusOnes(supabase, 'e1', ['lauren'], 'bride'), { ok: true });
  assert.deepEqual(calls[0], ['from', 'guests']);
  assert.equal((calls[1]![1] as { side: string }).side, 'bride');
  assert.deepEqual(calls.slice(2), [['eq', 'event_id', 'e1'], ['in', 'plus_one_of_guest_id', ['lauren']], ['neq', 'side', 'bride'], ['is', 'deleted_at', null]]);

  // Every guest-side write in the Guests actions is followed, in the same function, by the carry.
  const root = join(HERE, '..');
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/actions\.ts$/.test(f)) files.push(p);
    }
  };
  walk(root);
  let writes = 0;
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/\.update\(\{\s*side\b/g)) {
      writes++;
      const rest = src.slice(m.index!);
      const end = rest.search(/\n(export )?(async )?function |\n}\n/);
      const body = end > 0 ? rest.slice(0, end) : rest;
      assert.match(body, /carrySideToTheirPlusOnes\(/, `${f.slice(root.length)}: a side write without carrying it to the +1s`);
    }
  }
  assert.ok(writes >= 2, `found the inline and bulk side writes (${writes})`);
  // The card's save reaches it through syncExtraSeats, which also creates each seat on the guest's side.
  const sync = stripComments(readFileSync(join(HERE, '..', '..', '..', '..', '..', 'lib', 'extra-seats-sync.ts'), 'utf8'));
  const body = sync.slice(sync.indexOf('export async function syncExtraSeats'));
  assert.match(body, /carrySideToTheirPlusOnes\(supabase, eventId, \[primary\.guest_id\], primary\.side\)/);
  assert.match(body, /side: primary\.side/);
});
