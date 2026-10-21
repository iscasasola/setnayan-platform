/**
 * a-seat-with-no-name-can-be-released.test.ts — 🪑 FINALIZING THE LIST: WHICH +1 HAS A NAME, AND RELEASE SEAT.
 *
 * Owner, verbatim, 2026-10-21: *"when we finalize the guest list. how do I know which +1 has names and has no names? so
 * we can alot the seat to another person in case they said no or they will not add a +1 anymore"* → approved: *"Yes,
 * build it: count at the top, +1 ▾ Named / No name yet filter, Release seat with Undo and bulk Select, and
 * auto-release when they decline or say no +1."* (Auto-release is NOT built here — see the PR body: it contradicts
 * the 2026-09-29 plus-one rulings and is waiting on the owner.)
 *
 * The PROPERTIES, each held by what the code DOES (the real pure rule, the real server action over an in-memory
 * database, the real screen rendered), never by how a line is spelled:
 *   1 · the count is the filter — "+1s: N named · M no name yet" equals the rows "+1 ▾ Named / No name yet" leaves, for
 *       every roster and every search, and the screen draws those numbers (none at all with no +1s);
 *   2 · a NAMED +1 never shows Release seat; every +1 with no name yet does (and never Remove);
 *   3 · Release removes ONLY a seat with no name yet — a named +1, a guest, or a mixed selection is refused and NOTHING
 *       moves — and lowers its guest's "+N" by EXACTLY one per seat, chair released;
 *   4 · Undo restores it — the same row (guest_id, ticket), the chair, and the guest's "+N" — byte-for-byte;
 *   5 · a seat named between the check and the write is NOT taken (the reply stamps it).
 *
 * 🛡 SABOTAGE (each seen RED, then restored — 2026-10-21, see the PR body): `plusOneTally` counts every +1 as no
 * name · `seatReleaseRefusal` lets everyone through · the action's `if (release)` gate deleted ·
 * `seatNumbersFollowTheRows` dropped from the remove · dropped from the Undo · `rowVerbsFor` gives a named +1
 * Release · the release write drops its `.is('plus_one_name_confirmed_at', null)`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestRow as baseRow, renderGuestsScreen } from './render-guests-screen';
import { plusOneHasNoName, plusOneIsNamed, seatReleaseRefusal } from '@/lib/extra-seats';
import { plusOneFilterMatches, plusOneTally, rosterSearchMatches, rowVerbsFor, withTheirPlusOnes, type RosterFacts } from '@/lib/guest-roster-view';
import type { GuestRow } from '@/lib/guests';

/** A list row as the page sends it (the search spreads `custom_tags`). */
const guestRow = (over: Partial<GuestRow> = {}): GuestRow => baseRow({ custom_tags: [], ...over });

import { DB } from './guests-db.harness';

const EV = 'ev-1';
/** Ana brings +2 (one seat with no name yet, one named Ben); Bert brings +1 (no name yet); Cora brings nobody. */
function seed() {
  const g = (over: Row): Row => ({
    event_id: EV,
    role: 'guest',
    rsvp_status: 'pending',
    last_name: 'Cruz',
    display_name: null,
    plus_one_of_guest_id: null,
    plus_one_name_confirmed_at: null,
    plus_one_count: 0,
    plus_one_allowed: false,
    deleted_at: null,
    ...over,
  });
  DB.guests = [
    g({ guest_id: 'ana', first_name: 'Ana', plus_one_count: 2, plus_one_allowed: true, qr_token: 'q-ana' }),
    g({ guest_id: 'ana-1', first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA', plus_one_of_guest_id: 'ana', qr_token: 'q-ana-1' }),
    g({ guest_id: 'ana-2', first_name: 'Ben', last_name: 'Reyes', plus_one_of_guest_id: 'ana', plus_one_name_confirmed_at: '2026-10-01T00:00:00Z', qr_token: 'q-ana-2' }),
    g({ guest_id: 'bert', first_name: 'Bert', plus_one_count: 1, plus_one_allowed: true, qr_token: 'q-bert' }),
    g({ guest_id: 'bert-1', first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA', plus_one_of_guest_id: 'bert', qr_token: 'q-bert-1' }),
    g({ guest_id: 'cora', first_name: 'Cora', qr_token: 'q-cora' }),
  ];
  DB.event_seat_assignments = [
    { event_id: EV, guest_id: 'ana-1', table_id: 't1', seat_number: 3, locked: false },
    { event_id: EV, guest_id: 'ana-2', table_id: 't1', seat_number: 4, locked: false },
    { event_id: EV, guest_id: 'bert-1', table_id: 't2', seat_number: 1, locked: true },
  ];
  DB.afterFirstGuestRead = null;
}
/** The list as a host would compare it — every column but the write's own clock (`updated_at`). */
const snapshot = () =>
  JSON.stringify({
    g: DB.guests.map(({ updated_at: _clock, ...r }) => r),
    s: [...DB.event_seat_assignments].sort((a, b) => String(a.guest_id).localeCompare(String(b.guest_id))),
  });
const row = (id: string) => DB.guests.find((g) => g.guest_id === id)!;
const count = (id: string) => row(id).plus_one_count as number;

async function actions() {
  return import('../groups-actions');
}
const quiet = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
};

/* ── 1 · the count is the filter ───────────────────────────────────────────────────────────────────────────────── */

/** A roster of every kind of row, varied deterministically. */
function roster(seedN: number): GuestRow[] {
  const out: GuestRow[] = [];
  const hosts = ['h1', 'h2', 'h3'];
  for (const h of hosts) out.push(guestRow({ guest_id: h, first_name: `Host${h}`, last_name: 'Lim', plus_one_count: 2 }));
  const kinds = [
    { first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA' }, // no name yet
    { first_name: 'tba ', last_name: '+1', display_name: '+ TBA · brought by Host' }, // an older label, no name yet
    { first_name: 'Ben', last_name: 'Reyes', plus_one_name_confirmed_at: '2026-10-02T00:00:00Z' }, // named by the reply
    { first_name: 'Paulo', last_name: 'Cruz' }, // named, never stamped (an older host add)
    { first_name: 'TBA', last_name: 'Santos', plus_one_name_confirmed_at: '2026-10-03T00:00:00Z' }, // a name given (stamped)
  ];
  for (let i = 0; i < 7 + seedN; i++) {
    const k = kinds[(i + seedN) % kinds.length]!;
    out.push(guestRow({ guest_id: `s${seedN}-${i}`, plus_one_of_guest_id: hosts[i % hosts.length]!, ...k } as Partial<GuestRow>));
  }
  // A guest who is not a +1 but is called "TBA" is never a seat; nor is a row pointing at itself.
  out.push(guestRow({ guest_id: `tba-guest-${seedN}`, first_name: 'TBA', last_name: 'Ocampo' }));
  out.push(guestRow({ guest_id: `self-${seedN}`, first_name: 'TBA', plus_one_of_guest_id: `self-${seedN}` }));
  return out;
}
const FACTS: RosterFacts = { hasSides: true, groupsOf: () => [], tableOf: () => null };

test('1 · "+1s: N named · M no name yet" is the filter’s rows, counted — every roster, every search', () => {
  let checked = 0;
  for (let n = 0; n < 6; n++) {
    const r = roster(n);
    for (const q of ['', 'TBA', 'Hosth1', 'Ben', 'Lim', 'nobody-at-all']) {
      const found = q ? withTheirPlusOnes(q, r.filter((g) => rosterSearchMatches(q, g, FACTS)), r) : r;
      const tally = plusOneTally(found);
      assert.equal(tally.unnamed, found.filter((g) => plusOneFilterMatches(g, 'unnamed')).length, `roster ${n} "${q}": no name yet`);
      assert.equal(tally.named, found.filter((g) => plusOneFilterMatches(g, 'named')).length, `roster ${n} "${q}": named`);
      // The two halves are every +1 seat, once each — never a guest, never a row counted twice.
      const seats = found.filter((g) => g.plus_one_of_guest_id && g.plus_one_of_guest_id !== g.guest_id);
      assert.equal(tally.named + tally.unnamed, seats.length, `roster ${n} "${q}": the halves are not the +1s`);
      checked += 1;
    }
    // Anti-vacuity: the fixture has both kinds, and a guest named TBA is no seat.
    const t = plusOneTally(r);
    assert.ok(t.named > 0 && t.unnamed > 0, `roster ${n} lacks a kind`);
    assert.equal(plusOneHasNoName(r.find((g) => g.guest_id === `tba-guest-${n}`)!), false, 'a guest named TBA counted as a seat');
    assert.equal(plusOneHasNoName(r.find((g) => g.guest_id === `self-${n}`)!), false, 'a row pointing at itself counted as a seat');
  }
  assert.ok(checked >= 30);
  // A stamped "TBA Santos" is a name given; an unstamped "Paulo" is named; "tba " is no name yet.
  assert.equal(plusOneHasNoName({ guest_id: 'x', plus_one_of_guest_id: 'h', first_name: 'TBA', plus_one_name_confirmed_at: '2026-10-03' }), false);
  assert.equal(plusOneIsNamed({ guest_id: 'x', plus_one_of_guest_id: 'h', first_name: 'Paulo' }), true);
  assert.equal(plusOneHasNoName({ guest_id: 'x', plus_one_of_guest_id: 'h', first_name: ' tba ' }), true);
});

test('1b · the screen draws the tally in the counts line — and nothing of it when the list has no +1s', async () => {
  const r = roster(2);
  const t = plusOneTally(r);
  const html = await renderGuestsScreen({ guests: r });
  const half = (k: 'named' | 'unnamed') => {
    const m = new RegExp(`<button[^>]*data-plus-filter="${k}"[^>]*>([\\s\\S]*?)</button>`).exec(html);
    assert.ok(m, `the counts line has no "${k}" door`);
    return m![1]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  };
  assert.equal(half('named'), `${t.named} named`);
  assert.equal(half('unnamed'), `${t.unnamed} no name yet`);
  assert.match(html, /data-roster-plus-ones=""[^>]*>\s*· \+1s:/, 'the line does not say "+1s:"');
  const none = await renderGuestsScreen({ guests: [guestRow({ first_name: 'Ana' }), guestRow({ first_name: 'Bert' })] });
  assert.doesNotMatch(none, /data-roster-plus-ones|data-plus-filter/, 'a list with no +1s draws a +1 count');
});

/* ── 2 · Release seat is offered on exactly the seats with no name yet ─────────────────────────────────────────── */

test('2 · a named +1 never shows Release seat; every seat with no name yet does, in place of Remove', async () => {
  for (let n = 0; n < 6; n++) {
    for (const g of roster(n)) {
      const verbs = rowVerbsFor(g, { linked: false, chatHref: null });
      if (plusOneHasNoName(g)) {
        assert.ok(verbs.includes('release'), `${g.guest_id} (no name yet) is not offered Release seat`);
        assert.ok(!verbs.includes('remove'), `${g.guest_id} (no name yet) is offered Remove and Release`);
      } else {
        assert.ok(!verbs.includes('release'), `${g.guest_id} (${g.first_name}) is offered Release seat`);
      }
    }
  }
  // Rendered: a search that opens the seats' section shows Release on the unnamed seat, never on Ben.
  const r = [
    guestRow({ guest_id: 'h', first_name: 'Rosa', last_name: 'Lim', plus_one_count: 2 }),
    guestRow({ guest_id: 'h-1', first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA', plus_one_of_guest_id: 'h' }),
    guestRow({ guest_id: 'h-2', first_name: 'Ben', last_name: 'Reyes', plus_one_of_guest_id: 'h', plus_one_name_confirmed_at: '2026-10-02' } as Partial<GuestRow>),
  ];
  const html = await renderGuestsScreen({ guests: r, initialQuery: 'Rosa' });
  const rowOf = (id: string) => {
    const at = html.indexOf(`data-guest-id="${id}"`);
    assert.ok(at > 0, `row ${id} is not drawn (the probe would pass vacuously)`);
    const next = html.indexOf('data-guest-row=""', at + 10);
    return html.slice(at, next > 0 ? next : undefined);
  };
  assert.match(rowOf('h-1'), /aria-label="Release [^"]*"[^>]*>[\s\S]*?Release seat/, 'the seat with no name yet has no Release seat');
  assert.doesNotMatch(rowOf('h-2'), /Release seat|aria-label="Release /, 'a named +1 shows Release seat');
  assert.match(rowOf('h-2'), /aria-label="Remove /, 'a named +1 lost the shipped Remove');
});

/* ── 3–5 · the server action, over the in-memory database ─────────────────────────────────────────────────────── */

test('3 · Release takes ONLY seats with no name yet — a named +1, a guest or a mixed pick is refused and nothing moves', async () => {
  const { bulkSoftDeleteGuestsForUndo } = await actions();
  for (const ids of [['ana-2'], ['cora'], ['ana-1', 'ana-2'], ['bert-1', 'cora'], ['ana']]) {
    seed();
    const before = snapshot();
    const res = await quiet(() => bulkSoftDeleteGuestsForUndo(EV, ids, { release: true }));
    assert.equal(res.ok, false, `releasing ${ids.join(' + ')} was allowed`);
    assert.equal(snapshot(), before, `a refused release of ${ids.join(' + ')} still changed the list`);
  }
  // The pure gate says the same, in words a host reads.
  assert.match(seatReleaseRefusal([{ guest_id: 'b', plus_one_of_guest_id: 'a', first_name: 'Ben', plus_one_name_confirmed_at: 'x' }]) ?? '', /has a name/);
  assert.equal(seatReleaseRefusal([{ guest_id: 'b', plus_one_of_guest_id: 'a', first_name: 'TBA', plus_one_name_confirmed_at: null }]), null);
});

test('3b · Release lowers its guest’s "+N" by exactly one per seat, frees the chair, and touches nobody else', async () => {
  const { bulkSoftDeleteGuestsForUndo } = await actions();
  seed();
  const res = await quiet(() => bulkSoftDeleteGuestsForUndo(EV, ['ana-1'], { release: true }));
  assert.ok(res.ok, `the release was refused: ${!res.ok ? res.error : ''}`);
  assert.ok(row('ana-1').deleted_at, 'the seat is still on the list');
  assert.equal(count('ana'), 1, 'Ana’s +2 is not +1 after one seat went');
  assert.equal(row('ana').plus_one_allowed, true);
  assert.equal(row('ana-2').deleted_at, null, 'Ben (named) went with the seat');
  assert.equal(count('bert'), 1, 'Bert’s number moved');
  assert.ok(!DB.event_seat_assignments.some((s) => s.guest_id === 'ana-1'), 'the seat’s chair is still taken');
  assert.ok(DB.event_seat_assignments.some((s) => s.guest_id === 'ana-2'), 'Ben lost his chair');
  // Many at once (Select): each guest one lower per seat.
  seed();
  const many = await quiet(() => bulkSoftDeleteGuestsForUndo(EV, ['ana-1', 'bert-1'], { release: true }));
  assert.ok(many.ok);
  assert.deepEqual([count('ana'), count('bert'), row('bert').plus_one_allowed], [1, 0, false]);
});

test('4 · Undo restores it — the same row, its ticket, its chair, and the guest’s "+N" — exactly as before', async () => {
  const { bulkSoftDeleteGuestsForUndo, restoreDeletedGuests } = await actions();
  for (const ids of [['ana-1'], ['ana-1', 'bert-1']]) {
    seed();
    const before = snapshot();
    const res = await quiet(() => bulkSoftDeleteGuestsForUndo(EV, ids, { release: true }));
    assert.ok(res.ok);
    assert.notEqual(snapshot(), before, 'the release changed nothing (the Undo would pass vacuously)');
    const back = await quiet(() => restoreDeletedGuests(EV, res.removedIds, res.releasedSeats));
    assert.ok(back.ok, 'the Undo was refused');
    assert.equal(snapshot(), before, `Undo of ${ids.join(' + ')} did not put the list back as it was`);
  }
});

test('5 · a seat named between the check and the write is not taken (the reply stamps it first)', async () => {
  const { bulkSoftDeleteGuestsForUndo } = await actions();
  seed();
  // The guest names their +1 the moment after the release read it.
  DB.afterFirstGuestRead = () => Object.assign(row('ana-1'), { first_name: 'Carla', last_name: 'Diaz', plus_one_name_confirmed_at: '2026-10-21T01:00:00Z' });
  const res = await quiet(() => bulkSoftDeleteGuestsForUndo(EV, ['ana-1'], { release: true }));
  assert.equal(res.ok, false, 'a seat named in between was released');
  assert.equal(row('ana-1').deleted_at, null, 'Carla was taken off the list');
  assert.equal(count('ana'), 2, 'Ana’s number moved for a seat that stayed');
  assert.ok(DB.event_seat_assignments.some((s) => s.guest_id === 'ana-1'), 'Carla lost her chair');
});

test('3c · the shipped Remove is unchanged: a named +1 is removed with their seat, the number following', async () => {
  const { bulkSoftDeleteGuestsForUndo } = await actions();
  seed();
  const res = await quiet(() => bulkSoftDeleteGuestsForUndo(EV, ['ana-2']));
  assert.ok(res.ok, 'Remove of a named +1 is refused');
  assert.ok(row('ana-2').deleted_at);
  assert.equal(count('ana'), 1);
});
