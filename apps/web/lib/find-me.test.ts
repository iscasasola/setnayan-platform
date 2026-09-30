/**
 * 🔎 THE GENERIC QR FINDS YOU — THE LAST 4 DIGITS OF YOUR MOBILE LET YOU
 * STRAIGHT IN (owner, DECISION_LOG 2026-09-30). The rules are pure
 * (lib/find-me.ts) and executed here; the source checks below pin the doors:
 *
 *   1. nothing about the guest is drawn before the check;
 *   2. a couple row (and a request, a bound seat, a removed guest) is never found;
 *   3. the tries are spent BEFORE the digits are looked at, per connection AND
 *      per guest;
 *   4. a correct last-4 goes through the personal QR's own redeem hop — this
 *      door mints no session of its own;
 *   5. no mobile / several matches → an ordinary request, pre-matched on the
 *      couple's Requests page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  exactNameMatches,
  findOutcome,
  isFindable,
  lastFourMatches,
  lastFourOf,
  namesMatchExactly,
  preMatchFor,
  readTypedLastFour,
  type FindableRow,
} from './find-me';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
/** The body of `export async function <name>` (or `function <name>`) up to the next top-level function. */
function fn(src: string, name: string): string {
  const start = src.search(new RegExp(`(?:export )?(?:async )?function ${name}\\b`));
  assert.ok(start >= 0, `function ${name} not found — the guard is looking at the wrong file`);
  const rest = src.slice(start + 1);
  const next = rest.search(/\n(?:export )?(?:async )?function \w+/);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

const row = (over: Partial<FindableRow> = {}): FindableRow => ({
  guest_id: 'g1',
  first_name: 'Maria',
  middle_name: 'Reyes',
  last_name: 'Santos',
  name_suffix: null,
  role: 'guest',
  extra_roles: null,
  entry_source: 'host_seeded',
  deleted_at: null,
  passed_away: false,
  mobile: '+63 917 555 4421',
  qr_token: 'a'.repeat(32),
  ...over,
});
const typed = (first: string, last: string, middle: string | null = null, suffix: string | null = null) => ({
  first_name: first,
  middle_name: middle,
  last_name: last,
  name_suffix: suffix,
});
const none = new Set<string>();

test('exact match: case, spacing and accents do not count; a typed middle/suffix must agree; prefix never compared', () => {
  assert.ok(namesMatchExactly(typed('  maria ', 'SANTOS'), row()));
  assert.ok(namesMatchExactly(typed('María', 'Santos', 'reyes'), row()));
  assert.ok(!namesMatchExactly(typed('Maria', 'Santos', 'Cruz'), row()), 'a wrong typed middle name matched');
  assert.ok(!namesMatchExactly(typed('Marla', 'Santos'), row()), 'a near-miss matched — this is exact, not fuzzy');
  assert.ok(!namesMatchExactly(typed('Maria', ''), row()), 'first name alone matched');
  assert.ok(!namesMatchExactly(typed('Maria', 'Santos', null, 'Jr.'), row()), 'a typed suffix the row lacks matched');
  assert.ok(namesMatchExactly(typed('Jose', 'Rizal', null, 'jr'), row({ first_name: 'Jose', last_name: 'Rizal', name_suffix: 'Jr.' })));
});

test('🔒 never findable: a couple seat (primary OR extra role), a request, a bound seat, a removed or passed-away guest', () => {
  assert.ok(isFindable(row(), none));
  for (const role of ['bride', 'groom', 'celebrant']) assert.ok(!isFindable(row({ role }), none), `${role} was findable`);
  assert.ok(!isFindable(row({ extra_roles: ['groom'] }), none), 'a guest who is also the groom was findable');
  assert.ok(!isFindable(row({ entry_source: 'self_added_unlisted' }), none), 'a pending request was findable — ask under a name with your own mobile, then walk in');
  assert.ok(!isFindable(row(), new Set(['g1'])), 'a seat an account holds was findable');
  assert.ok(!isFindable(row({ deleted_at: '2026-09-30T00:00:00Z' }), none));
  assert.ok(!isFindable(row({ passed_away: true }), none));
});

test('the verdict: mobile → digits · no mobile → confirm (pre-matched) · several → confirm (none) · none → form', () => {
  assert.deepEqual(findOutcome(typed('Maria', 'Santos'), [row()], none), { kind: 'digits', guestId: 'g1' });
  assert.deepEqual(findOutcome(typed('Maria', 'Santos'), [row({ mobile: null })], none), { kind: 'confirm', guestId: 'g1' });
  assert.deepEqual(findOutcome(typed('Maria', 'Santos'), [row({ mobile: '4421' })], none), { kind: 'confirm', guestId: 'g1' }, 'a stub number is not a mobile to ask about');
  assert.deepEqual(
    findOutcome(typed('Maria', 'Santos'), [row(), row({ guest_id: 'g2', middle_name: 'Cruz' })], none),
    { kind: 'confirm', guestId: null },
    'two people with that name → the couple decides',
  );
  assert.deepEqual(findOutcome(typed('Maria', 'Santos', 'Cruz'), [row(), row({ guest_id: 'g2', middle_name: 'Cruz' })], none), {
    kind: 'digits',
    guestId: 'g2',
  });
  assert.deepEqual(findOutcome(typed('Ana', 'Lim'), [row()], none), { kind: 'none' });
  assert.deepEqual(findOutcome(typed('Maria', 'Santos'), [row({ role: 'bride' })], none), { kind: 'none' }, 'the bride was found');
  assert.equal(exactNameMatches(typed('Maria', 'Santos'), [row({ entry_source: 'self_added_unlisted' })], none).length, 0);
});

test('last 4: only a real number is asked about; exactly four digits; a wrong one never matches', () => {
  assert.equal(lastFourOf('+63 917 555 4421'), '4421');
  assert.equal(lastFourOf('09175554421'), '4421');
  assert.equal(lastFourOf('12345'), null);
  assert.equal(lastFourOf(null), null);
  assert.equal(readTypedLastFour(' 44-21 '), '4421');
  assert.equal(readTypedLastFour('442'), null);
  assert.equal(readTypedLastFour('44211'), null);
  assert.equal(readTypedLastFour('abcd'), null);
  assert.ok(lastFourMatches('+63 917 555 4421', '4421'));
  assert.ok(!lastFourMatches('+63 917 555 4421', '4420'));
  assert.ok(!lastFourMatches(null, '4421'));
  assert.ok(!lastFourMatches('+63 917 555 4421', null));
});

test('the Requests page pre-match: the one exact name, else nothing', () => {
  const cands = [
    { guest_id: 'g1', first_name: 'Maria', middle_name: 'Reyes', last_name: 'Santos', name_suffix: null },
    { guest_id: 'g2', first_name: 'Ben', middle_name: null, last_name: 'Cruz', name_suffix: null },
  ];
  assert.equal(preMatchFor(typed('Maria', 'Santos'), cands)?.guest_id, 'g1');
  assert.equal(preMatchFor(typed('Maria', 'Santos'), [...cands, { ...cands[0]!, guest_id: 'g3' }]), null);
  assert.equal(preMatchFor(typed('Mario', 'Santos'), cands), null);
  const page = read('app/dashboard/[eventId]/guests/claims/page.tsx');
  assert.match(page, /const exact = preMatchFor\(g, candidates\);\s*if \(exact\) return \{ g, name, match: exact \};/, 'Requests no longer shows the pre-match');
  assert.match(page, /\.select\('guest_id, first_name, middle_name, last_name, name_suffix, display_name,/, 'the request’s own name parts are not read');
});

test('🔒 1 · nothing about the guest is drawn before the check', () => {
  const flow = read('app/join/[eventId]/_components/join-flow.tsx');
  const digits = fn(flow, 'FindMeDigitsStep');
  assert.doesNotMatch(digits, /maskMobile|lastFourOf|\.mobile\b|plus_one|outfit|attire|guestId|first_name|display_name/i, 'the digits screen draws a detail of the guest');
  // The door reads only the find state's verdict — never the guest row.
  assert.doesNotMatch(flow, /FINDABLE_COLUMNS|loadFindableRows/, 'the door reads the matched guest’s row to draw its screen');
  // The digits screen asks nothing but the four digits.
  assert.equal((digits.match(/<input\b/g) ?? []).length, 1, 'the digits screen shows or asks more than the four digits');
  // The find state is ENCRYPTED, not merely signed — it carries the guest's id.
  const srv = read('lib/find-me.server.ts');
  assert.match(srv, /new EncryptJWT\(/);
  assert.match(srv, /httpOnly: true/);
  assert.doesNotMatch(srv, /new SignJWT\(/, 'the find state is only signed — its payload is readable');
});

test('🔒 2 · the door and the digits check both ask isFindable — the couple seat rule lives in one place', () => {
  const a = read('app/join/[eventId]/find-me-actions.ts');
  const check = fn(a, 'checkLastFourAction');
  assert.match(check, /isFindable\(live, bound\)/, 'the digits check opens a row it did not re-check live');
  assert.match(check, /namesMatchExactly\(state!\.parts, live\)/);
  const find = fn(a, 'findMeAction');
  assert.match(find, /findOutcome\(parts, read\.rows, read\.bound\)/);
  assert.match(read('lib/find-me.ts'), /if \(isCoupleSeat\(row\.role, row\.extra_roles\)\) return false;/);
  assert.match(read('lib/find-me.ts'), /if \(row\.entry_source !== 'host_seeded'\) return false;/);
});

test('🔒 3 · the tries are spent BEFORE the digits are compared — per connection and per guest', () => {
  const a = read('app/join/[eventId]/find-me-actions.ts');
  const check = fn(a, 'checkLastFourAction');
  const spend = check.indexOf('await spendDigitsTry(');
  const compare = check.indexOf('lastFourMatches(');
  assert.ok(spend > 0 && compare > spend, 'a try is compared before it is counted — the guessing loop is free');
  assert.match(check, /if \(!allowed\) \{[\s\S]{0,200}outcome: 'confirm'[\s\S]{0,80}redirect\(doorPath\(slug\)\)/, 'out of tries no longer falls back to the couple');
  const srv = read('lib/find-me.server.ts');
  const tries = fn(srv, 'spendDigitsTry');
  assert.match(tries, /'guest_find_me_digits_row', `\$\{eventId\}:\$\{guestId\}`/, 'the per-guest budget is gone — a botnet gets unlimited tries on one guest');
  assert.match(tries, /'guest_find_me_digits_ip'/);
  assert.match(tries, /return byIp && byRow;/);
  assert.match(fn(srv, 'spend'), /catch[\s\S]{0,120}return false;/, 'the limiter fails OPEN on a throw');
  const lib = read('lib/find-me.ts');
  assert.match(lib, /export const FIND_ME_ROW_LIMIT = 5;/);
  assert.match(lib, /export const FIND_ME_WINDOW_SECS = 15 \* 60;/);
  // A wrong answer never says which part was wrong.
  assert.match(check, /if \(!ok\) redirect\(doorPath\(slug, 'no_match'\)\);/);
  assert.match(read('lib/join-door-refusal-copy.ts'), /no_match: `That doesn’t match\. Try again, or ask \$\{w\.theOrganizer\} to confirm you\.`/);
});

test('🔒 4 · a correct last-4 is the personal QR’s own redeem hop — this door mints nothing', () => {
  const a = read('app/join/[eventId]/find-me-actions.ts');
  assert.doesNotMatch(a, /setGuestSession|signGuestSession|event_members'\)\.insert|\.insert\(/, 'the find-me door issues a key of its own');
  const check = fn(a, 'checkLastFourAction');
  assert.match(
    check,
    /redirect\(`\/\$\{slug\}\/redeem\?slug=\$\{encodeURIComponent\(slug\)\}&token=\$\{encodeURIComponent\(live!\.qr_token!\)\}`\)/,
    'a correct last-4 no longer goes through the redeem hop',
  );
  // …and only AFTER the verdict.
  assert.ok(check.indexOf('if (!ok) redirect(') < check.indexOf('/redeem?slug='));
});

test('🔒 5 · no mobile / several → an ordinary request, name as found; no match → the form, unchanged', () => {
  const flow = read('app/join/[eventId]/_components/join-flow.tsx');
  assert.match(flow, /found\.outcome === 'confirm' \?[\s\S]{0,400}We found you![\s\S]{0,300}will confirm it&rsquo;s you/);
  assert.match(flow, /<RequestForm action=\{selfAction\} ask=\{ask\} organizer=\{w\.theOrganizer\} fixedParts=\{found\.parts\} \/>/);
  assert.match(flow, /<AskToJoinIntro organizer=\{w\.theOrganizer\} \/>\s*<RequestForm action=\{selfAction\} ask=\{ask\} organizer=\{w\.theOrganizer\} defaultParts=\{found\.parts\} \/>/);
  assert.match(flow, /\{!found \? \(\s*<FindMeNameStep/, 'the name no longer comes first');
});
