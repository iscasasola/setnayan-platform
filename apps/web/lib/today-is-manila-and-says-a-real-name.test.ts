/**
 * THE SUPPLIER'S TODAY PAGE SAYS THE RIGHT DAY, AND A REAL NAME.
 *
 * Three defects seen on the LIVE site on 2026-09-10, all on the first screen a
 * shop meets at /vendor-dashboard.
 *
 * 🔴 1 · THE DATE WAS A DAY BEHIND. `todayLabel()` passed the Philippine LOCALE
 * (`en-PH`) and NO time zone, so it formatted the SERVER's instant in Filipino
 * wording — and the server runs in UTC. Measured at the moment of observation:
 * Manila 2026-09-10 02:33 · UTC 2026-09-09 18:33 · the page said "Wednesday,
 * September 9". Every Filipino supplier opening the app after 8pm was shown
 * YESTERDAY, and every "today" on that page moved with it.
 * 🔑 **A LOCALE IS NOT A TIME ZONE.** `en-PH` is a language, not a place.
 * ⚠ CI runs in UTC — the one clock on which this cannot be seen. Same family as
 * the 2026-08-04 wall-clock sweep; this page was not in it.
 *
 * 🔴 2 · THE ONLY CARD UNDER "What's new" PRINTED ITS OWN MARKDOWN. The excerpt
 * was the raw message body, so a shop read
 * `**Setnayan Exclusive unlocked 🎁** live_band: …` — asterisks included.
 * `conversation-list.ts` already owned the rule for shortening a generated body;
 * it was simply private. It is exported now and consumed, rather than copied.
 *
 * 🔴 3 · AND THAT `live_band` WAS A DATABASE COLUMN REACHING A PERSON. The label
 * falls back to `vendor_services.category` when the card has no title — and BOTH
 * production cards have a NULL title, so the fallback WAS the live path. Same
 * family as the 187 raw option keys fixed 2026-08-20.
 *
 * ⚖ The missing titles are their own fix, being built separately. This makes the
 * fallback safe for the next time one is missing.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { perkUnlockBody } from './perk-unlock-message';
import { stripComments } from './strip-comments';
import { shortenGeneratedBody } from './conversation-list';

const WEB = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

test('1 · the supplier’s day is Manila’s day, not the server’s', () => {
  const src = read('app/vendor-dashboard/page.tsx');
  const fn = src.slice(src.indexOf('function todayLabel'), src.indexOf('function todayLabel') + 400);
  assert.match(fn, /timeZone:\s*'Asia\/Manila'/, 'todayLabel dropped its time zone — the page shows the server’s day again');
  // …and the locale stays, because it is what makes the wording Filipino.
  assert.match(fn, /'en-PH'/, 'the Philippine locale was lost with the fix');
});

test('1b · the bug is reproducible without the zone, and gone with it', () => {
  // The exact instant observed on the live site: 2026-09-09T18:33Z.
  // In Manila that is already Thursday the 10th.
  const observed = new Date('2026-09-09T18:33:00Z');
  const withoutZone = observed.toLocaleDateString('en-PH', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric',
  });
  const withZone = observed.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric',
  });
  assert.match(withoutZone, /Wednesday/, 'the server’s clock no longer reads Wednesday — fixture drifted');
  assert.match(withZone, /Thursday/, 'Asia/Manila no longer moves that instant to Thursday');
  assert.notEqual(withZone, withoutZone, 'the two clocks agree, so this test proves nothing');
});

test('2 · the shortener is shared, not copied — and the card consumes it', () => {
  const list = read('lib/conversation-list.ts');
  assert.match(list, /export function shortenGeneratedBody/, 'the shortener went private again');
  const overview = read('lib/vendor-overview.ts');
  assert.match(overview, /shortenGeneratedBody\(body\)/, 'the What’s-new excerpt renders the raw body again');
  assert.match(overview, /import \{ shortenGeneratedBody \}/, 'it stopped importing the shared rule');
  // ⛔ and nobody re-implements it. Since the owner's test round 1 (2026-09-11)
  // ONE module owns the perk line — it writes the new shape and reads the old
  // one still stored in production — and the writer, the list, the stream and
  // the What's-new card all go through it.
  const owners = [
    'lib/conversation-list.ts',
    'lib/vendor-overview.ts',
    'lib/chat-actions.ts',
    'app/_components/chat-message-stream.tsx',
    'lib/perk-unlock-message.ts',
  ].filter((f) => stripComments(read(f)).includes('Setnayan Exclusive unlocked')); // code, not the history in its comments
  assert.deepEqual(
    owners,
    ['lib/perk-unlock-message.ts'],
    'a second module now knows that message shape — lib/perk-unlock-message owns it',
  );
  assert.match(list, /shortPerkUnlock\(body\)/, 'the list stopped shortening the perk line through its owner');
});

test('2b · the shortener actually removes the asterisks a person was reading', () => {
  const raw = '**Setnayan Exclusive unlocked 🎁** Live Band: Free 1-hour extension for Setnayan couples';
  const out = shortenGeneratedBody(raw);
  assert.ok(!out.includes('**'), `the card would still print asterisks: ${out}`);
  assert.match(out, /Live Band/, 'the shortener lost which exclusive unlocked');
});

test('3 · a card with no title never shows a database word', () => {
  const src = read('lib/chat-actions.ts');
  assert.match(
    src,
    /body: perkUnlockBody\(label, s\.exclusive_perk_text\)/,
    'the perk line is composed by hand again — lib/perk-unlock-message owns its words',
  );
  // …and what it composes from an untitled card is the card's LABEL. (It used to
  // title-case the key, which turned `host_mc` into "Host Mc".)
  const live = perkUnlockBody('live_band', 'Free 1-hour extension');
  const host = perkUnlockBody('host_mc', 'FREE');
  assert.ok(!/live_band|host_mc/.test(live + host), `a database word reached a person: ${live} / ${host}`);
  assert.match(live, /Live band/i);
  assert.match(host, /Host \/ MC/);
  assert.ok(!/\*\*|Exclusive/.test(live), `markdown or the retired name is back: ${live}`);
});
