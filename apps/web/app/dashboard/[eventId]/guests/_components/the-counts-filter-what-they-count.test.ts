/**
 * the-counts-filter-what-they-count.test.ts — 👆 THE COUNTS ARE DOORS · ✋ A HOST SETS A REPLY · 🖐 "MARKED BY YOU".
 *
 * Owner, verbatim, 2026-10-21: *"so our guest list will have counts for those who accepted only? How do we double check
 * those who did not answer yet. so we can manually accept them in case they just forgot to say yes?"* → approved:
 * *"Yes, add all three: tappable counts that filter, Select → Set reply ▾ Attending / Not coming, and "Marked by you" on
 * replies I set."*
 *
 * The PROPERTIES, each held by what the code DOES:
 *   1 · a tap filters to exactly the count — "N attending · N not coming · N no reply" equal the rows their filter leaves
 *       (`replyFilterMatches`), and the typed search words for the same replies leave the SAME rows; the screen draws
 *       each count as a door carrying its number;
 *   2 · Select → Set reply runs the ONE host reply write (`setGuestRsvp`), for N guests in one statement: the couple and
 *       the honoree are skipped; Not coming frees each chair and releases only +1 seats with NO name (a named +1 stays,
 *       their guest's "+N" one lower per released seat); ONE Undo puts every reply, date, mark, chair and seat back;
 *   3 · a host's write marks 'host' (and "No reply" carries no mark); a guest's own write marks 'guest' — every writer of
 *       a reply in the app says who it is, so a new writer that forgets is caught here;
 *   4 · the mark is drawn: the card's RSVP row "Attending · Marked by you", the row's quiet "marked", Excel's "Reply set
 *       by" (You / Guest), and a row that does not say (NULL — every row before the column) shows nothing.
 *
 * 🛡 SABOTAGE (each seen RED, then restored — 2026-10-21, see the PR body): `rosterStats` counts `yes` without
 * `countsTowardEvent` · the search's "attending" stops reading `replyFilterMatches` · `setGuestRsvp` writes no
 * `rsvp_set_by` · it stops skipping honorees · its +1 release drops the no-name filter · the Undo stops restoring
 * `rsvp_set_by` · `submitRsvp` drops `rsvp_set_by: 'guest'` · `replyMarkedByHost` stops excluding "No reply".
 */
import { DB, type Row } from './guests-db.harness';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { guestRow as baseRow, renderGuestsScreen } from './render-guests-screen';
import { replyFilterMatches, rosterSearchMatches, rosterStats, type ReplyFilter, type RosterFacts } from '@/lib/guest-roster-view';
import { replyMarkedByHost, type GuestRow } from '@/lib/guests';
import { guestListCsv, replySetByWord } from '@/lib/guest-export-file';
import { stripComments } from '@/lib/strip-comments';

const guestRow = (over: Partial<GuestRow> = {}): GuestRow => baseRow({ custom_tags: [], ...over });
const WEB = path.join(__dirname, '..', '..', '..', '..', '..');
const FACTS: RosterFacts = { hasSides: true, groupsOf: () => [], tableOf: () => null };

/* ── 1 · a tap filters to exactly the count ─────────────────────────────────────────────────────────────────────── */

function roster(n: number): GuestRow[] {
  const replies = ['attending', 'declined', 'pending', 'maybe'] as const;
  const out: GuestRow[] = [
    guestRow({ guest_id: `b${n}`, role: 'bride', rsvp_status: 'attending' }),
    guestRow({ guest_id: `gr${n}`, role: 'groom', rsvp_status: 'attending', side: 'groom' }),
    // Said yes but not counted — a request to join, and the passed-away — in no count, so in no filter.
    guestRow({ guest_id: `req${n}`, rsvp_status: 'attending', entry_source: 'self_added_unlisted' }),
    guestRow({ guest_id: `mem${n}`, rsvp_status: 'attending', passed_away: true }),
  ];
  for (let i = 0; i < 9 + n; i++) {
    out.push(
      guestRow({
        guest_id: `g${n}-${i}`,
        rsvp_status: replies[(i + n) % 4]!,
        // Not counted: a request to join, and the passed-away — in no count, so in no filter.
        entry_source: i % 5 === 3 ? 'self_added_unlisted' : 'host_seeded',
        passed_away: i % 7 === 6,
        // 💬 Two in three never stamped, so every roster holds a guest still TO INVITE (nothing sent AND no answer —
        // owner 2026-10-29: a guest who replied is not "to invite") beside unstamped guests who did answer.
        invitation_sent_at: i % 3 !== 2 ? null : '2026-10-01T00:00:00Z',
      }),
    );
  }
  return out;
}

test('1 · each count IS its filter’s rows — and the search words for the same reply leave the same rows', () => {
  const words: Record<ReplyFilter, string[]> = {
    attending: ['attending', 'accepted', 'coming'],
    declined: ['not coming', 'declined', 'regrets'],
    none: ['no reply', 'pending', 'waiting'],
    // 🎠 The carousel's fourth door (2026-10-27): "To invite" filters to the rows its number counts.
    toinvite: ['to invite', 'not invited'],
  };
  for (let n = 0; n < 6; n++) {
    const r = roster(n);
    const stats = rosterStats(r);
    const by = (f: ReplyFilter) => r.filter((g) => replyFilterMatches(g, f)).map((g) => g.guest_id);
    assert.equal(stats.yes, by('attending').length, `roster ${n}: attending`);
    assert.equal(stats.no, by('declined').length, `roster ${n}: not coming`);
    assert.equal(stats.none, by('none').length, `roster ${n}: no reply`);
    assert.equal(stats.toInvite, by('toinvite').length, `roster ${n}: to invite`);
    assert.ok(n === 0 || stats.toInvite > 0, `roster ${n} has nobody to invite — the to-invite door is untested`);
    for (const f of Object.keys(words) as ReplyFilter[]) {
      for (const w of words[f]) {
        assert.deepEqual(r.filter((g) => rosterSearchMatches(w, g, FACTS)).map((g) => g.guest_id), by(f), `roster ${n}: "${w}" ≠ the ${f} filter`);
      }
    }
    // Anti-vacuity: the fixture has guests who are not counted, and replies of every kind.
    assert.ok(r.some((g) => g.entry_source !== 'host_seeded' && g.rsvp_status === 'attending'), `roster ${n} has no uncounted yes`);
    assert.ok(stats.yes > 2 && stats.no > 0 && stats.none > 0);
  }
});

test('1b · the screen draws each count as a door holding its number; "to invite" keeps its door to the send run', async () => {
  const r = roster(3);
  const stats = rosterStats(r);
  const html = await renderGuestsScreen({ guests: r });
  for (const [f, n, word] of [['attending', stats.yes, 'Attending'], ['declined', stats.no, 'Not coming'], ['none', stats.none, 'No reply']] as const) {
    const m = new RegExp(`<button[^>]*data-reply-filter="${f}"[^>]*>([\\s\\S]*?)</button>`).exec(html);
    assert.ok(m, `the "${word}" count is not a door`);
    assert.equal(m![1]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), `${n} ${word}`);
  }
  const door = /<a\b[^>]*data-roster-to-invite="door"[^>]*>/.exec(html);
  assert.ok(door && /href="\/dashboard\/e1\/guests\/send"/.test(door[0]), '"to invite" lost its door to the send run');
  assert.doesNotMatch(html, /data-roster-clear-filter/, 'a Clear shows with no filter on');
});

/* ── 2 · Set reply: the one host write, over the in-memory database ─────────────────────────────────────────────── */

const EV = 'ev-r';
function seed() {
  const g = (over: Row): Row => ({
    event_id: EV,
    role: 'guest',
    rsvp_status: 'pending',
    rsvp_responded_at: null,
    rsvp_set_by: null,
    first_name: 'X',
    plus_one_of_guest_id: null,
    plus_one_name_confirmed_at: null,
    plus_one_count: 0,
    plus_one_allowed: false,
    deleted_at: null,
    ...over,
  });
  DB.guests = [
    g({ guest_id: 'bride', role: 'bride', rsvp_status: 'attending' }),
    g({ guest_id: 'celeb', role: 'celebrant', rsvp_status: 'attending' }),
    g({ guest_id: 'ana', first_name: 'Ana', plus_one_count: 2, plus_one_allowed: true }),
    g({ guest_id: 'ana-1', first_name: 'TBA', plus_one_of_guest_id: 'ana' }),
    g({ guest_id: 'ana-2', first_name: 'Ben', plus_one_of_guest_id: 'ana', plus_one_name_confirmed_at: '2026-10-01T00:00:00Z' }),
    g({ guest_id: 'bert', first_name: 'Bert', rsvp_status: 'attending', rsvp_responded_at: '2026-10-05T00:00:00Z', rsvp_set_by: 'guest' }),
    g({ guest_id: 'cora', first_name: 'Cora' }),
  ];
  DB.event_tables = [{ event_id: EV, table_id: 't1' }];
  DB.event_seat_assignments = [
    { event_id: EV, guest_id: 'ana', table_id: 't1', seat_number: 1, locked: false },
    { event_id: EV, guest_id: 'ana-1', table_id: 't1', seat_number: 2, locked: false },
    { event_id: EV, guest_id: 'ana-2', table_id: 't1', seat_number: 3, locked: false },
  ];
  DB.afterFirstGuestRead = null;
}
const row = (id: string) => DB.guests.find((x) => x.guest_id === id)!;
const snapshot = () =>
  JSON.stringify({
    g: DB.guests.map(({ updated_at: _c, ...r }) => r),
    s: [...DB.event_seat_assignments].sort((a, b) => String(a.guest_id).localeCompare(String(b.guest_id))),
  });
const quiet = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
};
const actions = () => import('../inline-actions');

test('2 · Set reply Attending: every selected guest but the couple and the honoree, marked by the host, one Undo', async () => {
  const { setGuestRsvp, restoreGuestRsvpAndSeat } = await actions();
  seed();
  const before = snapshot();
  const res = await quiet(() => setGuestRsvp(EV, ['bride', 'celeb', 'ana', 'cora', 'bert'], 'attending'));
  assert.ok(res.ok, `refused: ${!res.ok ? res.error : ''}`);
  assert.deepEqual(res.changed.map((c) => c.guest_id).sort(), ['ana', 'cora'], 'the couple / honoree were moved, or someone was missed');
  assert.equal(res.skipped, 3, 'the bride, the celebrant and Bert (already attending) are the skipped three');
  for (const id of ['ana', 'cora']) {
    assert.equal(row(id).rsvp_status, 'attending');
    assert.equal(row(id).rsvp_set_by, 'host', `${id}'s reply is not marked as the host's`);
    assert.ok(row(id).rsvp_responded_at, `${id}'s answer has no date`);
  }
  assert.equal(row('bert').rsvp_set_by, 'guest', 'Bert’s own yes was re-marked as the host’s');
  assert.equal(row('celeb').rsvp_set_by, null, 'the honoree was marked');
  const undo = await quiet(() => restoreGuestRsvpAndSeat(EV, res.changed, res.seats));
  assert.ok(undo.ok);
  assert.equal(snapshot(), before, 'Undo did not put every reply back exactly');
});

test('2b · Set reply Not coming: chairs freed, only seats with NO name released (their "+N" one lower), named +1 stays — Undo restores all', async () => {
  const { setGuestRsvp, restoreGuestRsvpAndSeat } = await actions();
  seed();
  const before = snapshot();
  const res = await quiet(() => setGuestRsvp(EV, ['ana', 'bride', 'celeb'], 'declined'));
  assert.ok(res.ok);
  assert.deepEqual([row('bride').rsvp_status, row('celeb').rsvp_status], ['attending', 'attending'], 'the couple or the honoree was set Not coming');
  assert.deepEqual(res.changed.map((c) => c.guest_id), ['ana']);
  assert.equal(row('ana').rsvp_status, 'declined');
  assert.equal(row('ana').rsvp_set_by, 'host');
  assert.ok(!DB.event_seat_assignments.some((x) => x.guest_id === 'ana'), 'Ana’s chair was not freed');
  assert.ok(row('ana-1').deleted_at, 'Ana’s +1 with no name was not released');
  assert.equal(row('ana-2').deleted_at, null, 'Ben (a named +1) was released');
  assert.equal(row('ana').plus_one_count, 1, 'Ana’s +2 is not one lower');
  assert.deepEqual(res.seats.removedIds, ['ana-1']);
  assert.equal(res.changed[0]!.freedSeat?.table_id, 't1', 'the freed chair was not read before the write');
  const undo = await quiet(() => restoreGuestRsvpAndSeat(EV, res.changed, res.seats));
  assert.ok(undo.ok, 'the Undo was refused');
  assert.equal(snapshot(), before, 'Undo did not put the reply, the chair, the seat and the +2 back');
});

test('3 · "No reply" carries no mark; a refused reply value writes nothing', async () => {
  const { setGuestRsvp } = await actions();
  seed();
  await quiet(() => setGuestRsvp(EV, ['bert'], 'pending'));
  assert.equal(row('bert').rsvp_set_by, null, '"No reply" was marked');
  assert.equal(row('bert').rsvp_responded_at, null);
  seed();
  const before = snapshot();
  const bad = await quiet(() => setGuestRsvp(EV, ['cora'], 'yes' as never));
  assert.equal(bad.ok, false);
  assert.equal(snapshot(), before);
});

/* ── 3b · every writer of a reply says who it is ───────────────────────────────────────────────────────────────── */

/** The object literal starting at `open` (a `{`), by its braces. */
function objectAt(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
}

/** The `{` of the object literal that holds position `at`. */
function enclosingOpen(src: string, at: number): number {
  let depth = 0;
  for (let i = at; i >= 0; i--) {
    if (src[i] === '}') depth++;
    else if (src[i] === '{' && depth-- === 0) return i;
  }
  return -1;
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || p.endsWith(path.join('app', 'dev'))) continue;
      out.push(...sources(p));
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|fixture|harness)\./.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

test('3b · every write of a reply in the app also says who gave it (a NEW insert at "pending" says nothing — there is no reply)', () => {
  const writers: string[] = [];
  for (const file of [...sources(path.join(WEB, 'app')), ...sources(path.join(WEB, 'lib'))]) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    // A write's object: an `.update({…})` / `.insert({…})` / `.upsert({…})` literal, or any object that stamps an answer's
    // date (`rsvp_responded_at:` — only a write does), wherever it is built (`answerColumns` in the join door).
    const opens = new Set<number>();
    for (const m of src.matchAll(/\.(update|insert|upsert)\(\s*\{/g)) opens.add(src.indexOf('{', m.index!));
    for (const m of src.matchAll(/\brsvp_responded_at:/g)) opens.add(enclosingOpen(src, m.index!));
    for (const at of opens) {
      if (at < 0) continue;
      const body = objectAt(src, at);
      const reply = /\brsvp_status:\s*([^,\n]+)/.exec(body);
      if (!reply) continue;
      if (/^'pending'/.test(reply[1]!.trim())) continue;
      if (/;/.test(reply[0])) continue; // a TYPE literal (`rsvp_status: RsvpStatus;`), not a value
      if (/^[[{]/.test(reply[1]!.trim())) continue; // a table OF columns (`rsvp_status: ['rsvp_status', …]`), not a row
      const rel = path.relative(WEB, file).split(path.sep).join('/');
      writers.push(rel);
      assert.match(body, /\brsvp_set_by:/, `${rel} writes a reply (${reply[0]}) without saying who set it — "Marked by you" would lie`);
    }
  }
  for (const known of ['app/[slug]/actions.ts', 'app/dashboard/[eventId]/guests/inline-actions.ts', 'app/join/[eventId]/actions.ts', 'app/dashboard/[eventId]/sponsors/actions.ts']) {
    assert.ok(writers.includes(known), `the scan no longer sees ${known} — it would pass vacuously`);
  }
  // The guest's own reply marks 'guest', in the branch that writes the answer.
  const reply = stripComments(fs.readFileSync(path.join(WEB, 'app/[slug]/actions.ts'), 'utf8'));
  assert.match(reply, /rsvp_status: status,\s*rsvp_set_by: 'guest',/, 'the guest’s own reply does not replace a host’s mark');
  // The card (`updateGuest`) builds its columns as `wholeCard` (the scan cannot see it as a write); its reply change marks
  // 'host', its untouched answer nothing — held here by the line itself.
  const card = stripComments(fs.readFileSync(path.join(WEB, 'app/dashboard/[eventId]/guests/[guestId]/actions.ts'), 'utf8'));
  assert.match(
    card,
    /writes\('rsvp_status'\) && answerChanged \? \{ rsvp_set_by: effectiveRsvp === 'pending' \? null : 'host' \} : \{\}/,
    'the card’s Reply pick does not mark the host — or marks an answer it did not change',
  );
  // The screen's Set reply is the one write — no second path to the reply.
  const screen = stripComments(fs.readFileSync(path.join(__dirname, 'guests-screen.tsx'), 'utf8'));
  assert.match(screen, /await setGuestRsvp\(eventId, \[\.\.\.movingIds\], rsvp\)/, 'Set reply no longer goes through setGuestRsvp');
  assert.match(screen, /restoreGuestRsvpAndSeat\(eventId, done\.changed, done\.seats\)/, 'Set reply’s Undo is not the one restore');
});

/* ── 4 · the mark is drawn ─────────────────────────────────────────────────────────────────────────────────────── */

test('4 · "Marked by you" — the predicate, the row, the card and Excel; NULL (never guessed) shows nothing', async () => {
  assert.equal(replyMarkedByHost({ rsvp_status: 'attending', rsvp_set_by: 'host' }), true);
  assert.equal(replyMarkedByHost({ rsvp_status: 'pending', rsvp_set_by: 'host' }), false, '"No reply" read as marked');
  assert.equal(replyMarkedByHost({ rsvp_status: 'attending', rsvp_set_by: 'guest' }), false);
  assert.equal(replyMarkedByHost({ rsvp_status: 'attending', rsvp_set_by: null }), false, 'an old row was guessed');
  assert.deepEqual(
    [replySetByWord({ rsvp_status: 'declined', rsvp_set_by: 'host' }), replySetByWord({ rsvp_status: 'attending', rsvp_set_by: 'guest' }), replySetByWord({ rsvp_status: 'attending', rsvp_set_by: null })],
    ['You', 'Guest', ''],
  );
  const base = { guest_id: 'x', name_prefix: null, first_name: 'Ana', middle_name: null, last_name: 'Cruz', name_suffix: null, side: 'bride' as const, group_category: null, role: 'guest' as const, plus_one_count: 0, mobile: null };
  const csv = guestListCsv([{ ...base, rsvp_status: 'attending', rsvp_set_by: 'host' }, { ...base, guest_id: 'y', rsvp_status: 'attending', rsvp_set_by: null }], { hasSides: true });
  const lines = csv.replace(/^﻿/, '').trim().split('\r\n').map((l) => l.split(','));
  const at = lines[0]!.indexOf('Reply set by');
  assert.ok(at > 0, 'no "Reply set by" column');
  assert.deepEqual([lines[1]![at], lines[2]![at]], ['You', '']);
  // The list row: a quiet "marked" on the host's, nothing on the guest's own or on an old row.
  const r = [
    guestRow({ guest_id: 'm1', first_name: 'Mara', rsvp_status: 'attending', rsvp_set_by: 'host' }),
    guestRow({ guest_id: 'm2', first_name: 'Mila', rsvp_status: 'attending', rsvp_set_by: 'guest' }),
    guestRow({ guest_id: 'm3', first_name: 'Mona', rsvp_status: 'attending' }),
  ];
  const html = await renderGuestsScreen({ guests: r, initialQuery: 'attending' });
  const rowOf = (id: string) => {
    const at2 = html.indexOf(`data-guest-id="${id}"`);
    assert.ok(at2 > 0, `row ${id} not drawn (vacuous)`);
    return html.slice(at2, html.indexOf('data-guest-row=""', at2 + 10) >>> 0 || undefined);
  };
  assert.match(rowOf('m1'), /data-reply-marked=""[^>]*> · marked</, 'a host-set reply does not say "marked"');
  assert.doesNotMatch(rowOf('m2'), /data-reply-marked/, 'the guest’s own reply says "marked"');
  assert.doesNotMatch(rowOf('m3'), /data-reply-marked/, 'an old row was guessed as marked');
});
