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
 * 🪑 LIVE FOLLOW-UP (2026-10-20, cale-ice, read-only): Juanita's and Maxima's "+1 · TBA" rows were not missing from the
 * DRAWING — they were soft-deleted on 2026-10-14 (Remove, when they still sat as bare rows under GUESTS), and Remove left
 * their guests' "+1" standing. So the List drew a +1 pill over a seat with no row, and the card on a +1 still read
 * "+1 · TBA" under "GUEST · BRIDE'S SIDE". Held below (tests 7–9):
 *   7. a "+N" with fewer seat rows than N says "+N not added yet" on the guest's row;
 *   8. removing a +1 without their guest lowers the guest's number by it, and Undo gives it back (`seatNumbersAfter`,
 *      called by the remove and by its Undo);
 *   9. the card's title and eyebrow name the guest who brings them — "Rosa Santos’s +1 · TBA", "+1 of Rosa Santos ·
 *      Bride’s side" — on the panel over the List (page.tsx) and on the card's own page.
 *
 * SABOTAGE (2026-10-20, each seen red, then restored):
 *   · `roleBucket(at(g))` → `roleBucket(g)` in `rosterSections`  → tests 1–4 red (the +1s fall to "Guests");
 *   · `guests: beside(list)` → `guests: list`                    → tests 1, 3 red (a +1 not after its guest);
 *   · `plusWords?.name ??` dropped from `GuestRowLine`            → test 4 red ("+1 · TBA" again);
 *   · the `carrySideToTheirPlusOnes` call dropped from `setGuestSide` → test 6 red;
 *   · `notAdded` forced to 0 in `GuestRowLine`                     → test 7 red;
 *   · `seatNumbersFollowTheRows` dropped from the remove           → test 8 red;
 *   · `plusOneOf` dropped from page.tsx’s InspectorColumn title, or ignored by `guestCardEyebrow` → test 9 red.
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
import { seatNumbersAfter } from '@/lib/extra-seats';
import { plusOneOfWords } from '@/lib/plus-one-of';
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

test('7 · a "+N" with fewer seat rows than N says so on the guest’s row', async () => {
  // Live: two of the groom's immediate family, "+1", their seat rows removed.
  const sison = guestRow({ guest_id: 'sison', first_name: 'Juana', last_name: 'Sison', role: 'groom_immediate_family', side: 'groom', plus_one_count: 1 });
  const html = await renderGuestsScreen({ guests: [bride, groom, sison, juanita, juanitaSeat, juanitaNamed], initialQuery: 'Sison' });
  const row = /data-guest-id="sison"[\s\S]*?(?=data-guest-row=""|<\/section>)/.exec(html)?.[0] ?? '';
  assert.match(row, /data-seat-not-added="">[^<]*\+1 not added yet/, 'the missing seat is said, not hidden');
  const full = await renderGuestsScreen({ guests: [bride, groom, juanita, juanitaSeat, juanitaNamed], initialQuery: 'Sacdalan' });
  assert.doesNotMatch(full, /data-seat-not-added/, 'a guest whose seats are all rows says nothing');
});

test('8 · removing a +1 without their guest lowers the guest’s number; Undo gives it back', () => {
  const bringers = [
    { guest_id: 'juanita', plus_one_count: 2, plus_one_allowed: true },
    { guest_id: 'lauren', plus_one_count: 1, plus_one_allowed: true },
  ];
  assert.deepEqual(seatNumbersAfter([{ guest_id: 'juanita-tba', plus_one_of_guest_id: 'juanita' }], bringers, 'removed'), [
    { guest_id: 'juanita', plus_one_count: 1, plus_one_allowed: true },
  ]);
  assert.deepEqual(seatNumbersAfter([{ guest_id: 'lauren-tba', plus_one_of_guest_id: 'lauren' }], bringers, 'removed'), [
    { guest_id: 'lauren', plus_one_count: 0, plus_one_allowed: false },
  ]);
  // The guest removed WITH their +1: the party goes as it was, the number untouched.
  assert.deepEqual(seatNumbersAfter([{ guest_id: 'lauren', plus_one_of_guest_id: null }, { guest_id: 'lauren-tba', plus_one_of_guest_id: 'lauren' }], bringers, 'removed'), []);
  assert.deepEqual(seatNumbersAfter([{ guest_id: 'lauren-tba', plus_one_of_guest_id: 'lauren' }], [{ guest_id: 'lauren', plus_one_count: 0, plus_one_allowed: false }], 'restored'), [
    { guest_id: 'lauren', plus_one_count: 1, plus_one_allowed: true },
  ]);
  // Both the remove and its Undo apply it.
  const src = stripComments(readFileSync(join(HERE, '..', 'groups-actions.ts'), 'utf8'));
  const fn = (name: string) => src.slice(src.indexOf(`export async function ${name}`), src.indexOf('\nexport ', src.indexOf(`export async function ${name}`) + 10));
  assert.match(fn('bulkSoftDeleteGuestsForUndo'), /seatNumbersFollowTheRows\(supabase, eventId, deletedIds, 'removed'\)/);
  assert.match(fn('restoreDeletedGuests'), /seatNumbersFollowTheRows\(supabase, eventId, \[\.\.\.restoredIds\], 'restored'\)/);
});

test('9 · the card on a +1 names the guest who brings them, in its title and its eyebrow', async () => {
  const { guestCardEyebrow, guestCardTitle } = await import('./guest-card-body');
  const host = { guest_id: 'rosa', first_name: 'Rosa', last_name: 'Santos', display_name: null, side: 'bride' as const };
  const tba = plusOneOfWords({ guest_id: 's1', first_name: 'TBA' }, host, 0);
  const seatRow = guestRow({ guest_id: 's1', first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA', side: 'groom', plus_one_of_guest_id: 'rosa' } as Partial<GuestRow>);
  assert.equal(guestCardTitle(seatRow, tba), 'Rosa Santos’s +1 · TBA');
  assert.equal(guestCardEyebrow(seatRow, { hasSides: true, roleNames: {}, plusOneOf: tba }), "+1 of Rosa Santos · Bride's side");
  const named = plusOneOfWords({ guest_id: 's2', first_name: 'Paulo' }, host, 1);
  assert.equal(guestCardTitle(guestRow({ first_name: 'Paulo', last_name: 'Reyes' }), named), 'Paulo Reyes');
  assert.equal(guestCardEyebrow(seatRow, { hasSides: true, roleNames: {} }), "Guest · Groom's side", 'everyone else is unchanged');
  // Every place the card is titled reads it: the panel over the List, the card's own page, and the card data loads it.
  const page = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));
  assert.match(page, /eyebrow=\{guestCardEyebrow\(inspectedCard\.guest, \{[^}]*plusOneOf: inspectedCard\.plusOneOf \}\)\}/);
  assert.match(page, /title=\{guestCardTitle\(inspectedGuest, inspectedCard\.plusOneOf\)\}/);
  const body = stripComments(readFileSync(join(HERE, 'guest-card-body.tsx'), 'utf8'));
  assert.match(body, /guestCardEyebrow\(guest, \{ hasSides, roleNames, plusOneOf: data\.plusOneOf \}\)/);
  assert.match(body, /\{guestCardTitle\(guest, data\.plusOneOf\)\}<\/h1>/);
  const data = stripComments(readFileSync(join(HERE, 'guest-card-data.ts'), 'utf8'));
  assert.match(data, /return plusOneOfWords\(guest, host as never, Math\.max\(0, seatIndex\)\)/);
  assert.match(data, /\n\s+plusOneOf,\n/);
});
