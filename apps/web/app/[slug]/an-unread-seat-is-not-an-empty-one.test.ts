/**
 * an-unread-seat-is-not-an-empty-one.test.ts — on the event page, a guest whose
 * seat read FAILED is never shown what a guest with no seat is shown.
 * (The rule: lib/guests.ts + lib/guests-read-is-honest.test.ts. The sibling
 * guard for the day pages: ./a-failed-read-is-not-an-absence.test.ts.)
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `loadGuestContext` (_lib/loaders.ts) reads the guest's table with
 * `const { data } = await admin.from('event_seat_assignments')…` and
 * `…from('event_tables')…` — the error thrown away. A refused read resolves
 * `data: null`, the same value as "not seated yet", so `tableLabel` came out
 * null and the seat surfaces drew "Find your seat →" — byte-identical to a
 * guest the couple has not seated, sending a seated guest off to look
 * themselves up on the wedding day.
 *
 * The /hub screen's seat tile said "Couldn't load your seat" with a Reload
 * (2026-11-02, audit #34 — `seatUnreadable` in hub/page.tsx). /hub folds into
 * the event page's tabs (PR "one guest bar per stage"), so that honest state
 * moves HERE: the loader carries `seatUnreadable`, and `SeatDoorLine` — the
 * line that stands wherever the seat block is not drawn, on Details and on
 * Me — says it.
 *
 * ── What is pinned ─────────────────────────────────────────────────────────
 *   1 · the loader's seat reads each BIND `error`, and each bound error raises
 *       the flag; a throw raises it too; the flag reaches `guestHubData`.
 *   2 · the flag is in the type, and hiding the seat part clears it with the
 *       label (a hidden seat says nothing — not even "couldn't load").
 *   3 · EVERY `<SeatDoorLine` on the event page passes the flag.
 *   4 · the door line answers the flag BEFORE it can say "Find your seat", and
 *       its Reload re-runs the reads.
 *
 * ── Caveats — read before trusting a green run ─────────────────────────────
 *   · Source-level: nothing here runs the page. That a refused read reaches a
 *     phone as the "Couldn't load" line needs a real run (a revoked grant on a
 *     branch DB, or a stubbed client in the loader).
 *   · § 3 walks app/[slug] for `<SeatDoorLine`; a door line mounted from
 *     another tree is not seen.
 *   · `your-own-day.server.ts` (the story's "were you there" table) reads the
 *     table on its own and is NOT covered here.
 *
 * Sabotage (2026-11-20, each on the real file, restored after):
 *   loaders: the assignment read back to `const { data: assignmentRow }` ....... § 1 red
 *   loaders: drop `guestSeatUnreadable = true` from the table-read branch ...... § 1 red
 *   loaders: drop `guestSeatUnreadable = true` from the catch .................. § 1 red
 *   loaders: drop `seatUnreadable: guestSeatUnreadable` ........................ § 1 red
 *   site-body: drop `seatUnreadable: false` from the hidden-seat override ...... § 2 red
 *   page.tsx: Me's door line without `unreadable=` ............................. § 3 red
 *   seat-door-line: move the unreadable branch below the label ................. § 4 red
 *   seat-reload-button: drop `router.refresh()` from the handler ............... § 4 red
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = __dirname;
const src = (file: string) => stripComments(readFileSync(join(HERE, file), 'utf8'));

const loaders = src('_lib/loaders.ts');
/** The seat block of `loadGuestContext`: from the flag's declaration to the object that carries it out. */
const seatStart = loaders.indexOf('let guestSeatUnreadable = false;');
const seatEnd = loaders.indexOf('const guestHubData: GuestHubData', seatStart);
const seatBlock = seatStart > -1 && seatEnd > seatStart ? loaders.slice(seatStart, seatEnd) : '';

test('1 · the loader’s seat reads bind their error, and every failure raises `seatUnreadable`', () => {
  assert.ok(seatBlock.length > 0, 'precondition: the seat block (`let guestSeatUnreadable = false;` … `const guestHubData`) moved');

  // Every read in the block binds `error` — read from each destructure, so a new read cannot slip in bare.
  const reads = [...seatBlock.matchAll(/const \{([^}]*)\} = await admin\s*\.from\('(\w+)'\)/g)];
  const tables = reads.map((m) => m[2]).sort();
  assert.deepEqual(tables, ['event_seat_assignments', 'event_tables'], `anti-vacuity: the seat block reads ${tables.join(', ') || 'nothing'}`);
  assert.equal((seatBlock.match(/\.from\('/g) ?? []).length, reads.length, 'a read in the seat block is not a `const { … } = await admin.from(…)` the walker can see');
  for (const [, pattern, table] of reads) {
    const bound = /\berror:\s*(\w+)/.exec(pattern ?? '')?.[1];
    assert.ok(bound, `the \`${table}\` seat read throws its error away — a refused read would draw as "not seated yet"`);
    assert.match(
      seatBlock,
      new RegExp(`if \\(${bound}\\) \\{\\s*guestSeatUnreadable = true;`),
      `the \`${table}\` seat read binds \`${bound}\` but a failure does not raise guestSeatUnreadable`,
    );
  }

  // A throw is a failed read too.
  assert.match(seatBlock, /catch \{[^}]*guestSeatUnreadable = true;[^}]*\}/, 'a thrown seat read is not marked unreadable');
  // The seat is only read where it may be shown — so "couldn't load" is only ever said there.
  assert.match(seatBlock, /if \(doorway\.seatingPublished\) try \{/, 'the seat read is no longer gated on guestsMaySeeSeatsFor');

  // …and the flag reaches the page.
  const hub = loaders.slice(seatEnd, loaders.indexOf('};', seatEnd));
  assert.match(hub, /seatUnreadable: guestSeatUnreadable,/, 'guestHubData does not carry the flag — a log line never changed a pixel');
});

test('2 · the flag is typed, and hiding the seat part clears it with the label', () => {
  const card = src('_components/guest-hub-card.tsx');
  assert.match(card, /seatUnreadable\?: boolean;/, 'GuestHubData does not declare seatUnreadable');
  const body = src('_components/site-body.tsx');
  assert.match(
    body,
    /partsOff\.has\('seat'\) \? \{[^}]*guestHubData: \{ \.\.\.identity\.guestHubData, tableLabel: null, seatUnreadable: false, seatsOpen: false \}/,
    'a hidden seat part leaves seatUnreadable on — the page would say "Couldn’t load your seat" for a part the couple turned off',
  );
});

/** Every .tsx under app/[slug], walked. */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

test('3 · every SeatDoorLine on the event page is told when the seat could not be read', () => {
  const mounts: { file: string; tag: string }[] = [];
  for (const full of tsxFiles(HERE)) {
    const text = stripComments(readFileSync(full, 'utf8'));
    for (const m of text.matchAll(/<SeatDoorLine\b[^>]*\/>/g)) mounts.push({ file: relative(HERE, full), tag: m[0] });
  }
  // Anti-vacuity: Details (site-body) and Me (page.tsx) both mount one.
  const files = new Set(mounts.map((m) => m.file));
  assert.ok(files.has('page.tsx') && files.has(join('_components', 'site-body.tsx')), `anti-vacuity: SeatDoorLine mounts found in ${[...files].join(', ') || 'nothing'}`);
  const blind = mounts.filter((m) => !/\bunreadable=\{guestHubData\.seatUnreadable\}/.test(m.tag));
  assert.deepEqual(
    blind.map((m) => `${m.file}: ${m.tag}`),
    [],
    'these seat lines would say "Find your seat" to a guest whose seat read failed',
  );
});

test('4 · the door line says "couldn’t load" before it can say "Find your seat", and Reload re-reads', () => {
  const line = src('_components/seat-door-line.tsx');
  const branch = line.indexOf('if (unreadable && !tableLabel?.trim())');
  assert.ok(branch > -1, 'SeatDoorLine no longer answers the unreadable flag');
  const findYourSeat = line.indexOf("'Find your seat'");
  assert.ok(findYourSeat > -1, 'anti-vacuity: the "Find your seat" wording moved');
  assert.ok(branch < findYourSeat, 'the unreadable answer comes after the line has already chosen "Find your seat"');
  const answer = line.slice(branch, findYourSeat);
  assert.match(answer, /Couldn&rsquo;t load your seat/, 'the unreadable line does not say the seat could not be loaded');
  assert.match(answer, /<SeatReloadButton \/>/, 'the unreadable line offers no way to try again');
  // Reload re-runs the server reads and keeps the guest on their tab.
  const reload = src('_components/seat-reload-button.tsx');
  assert.match(reload, /const reload = \(\) => \{\s*router\.refresh\(\);\s*\};/, 'Reload does not re-run the page’s reads');
  assert.match(reload, /onClick=\{reload\}/, 'the Reload button is not wired to the re-read');
});
