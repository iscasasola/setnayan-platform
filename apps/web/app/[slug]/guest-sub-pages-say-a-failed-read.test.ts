/**
 * GUEST SUB-PAGES SAY A FAILED READ (final check, area 4, fixer batch 1 · 25 Nov 2026).
 *
 * Each claim below is one finding from `build-sessions/final-check/area-4.md`: a read whose failure was drawn as a
 * fact about the guest or the hosts ("the floor plan is on its way", "hasn't set up e-gifts yet", a 404 for an
 * event that exists, a stranger's redirect). The fix is the same every time — the failure reaches an honest
 * state (the guest error boundary or a "couldn't" line) — and this file holds each one so it cannot drift back.
 *
 * Red if:
 *   seat: a guestsMaySeeSeatsFor call drops throwOnReadError ............ A4-51
 *   seat: the personal pass is drawn without consulting tablesFailed ..... A4-50
 *   seat: a ₱ amount is written into the file ............................ A4-53
 *   find-seat: the check-in read's error is not consulted ................ A4-37
 *   welcome: an unknown ?error= draws its own text ....................... A4-27
 *   welcome: the save puts a sentence in the address ..................... A4-27
 *   welcome: a failed read in the save bounces to the Hub ................ A4-26
 *   welcome: an unread inviter's first word becomes "the" ................ A4-25
 *   avatar: the guest read no longer throws on failure ................... A4-28
 *   pabuya: the ways-to-give read folds a failure into "none" ............ A4-44
 *   print: the event read drops its error (a 404 for a real event) ....... A4-45
 *   print: the story reads swallow a failure ............................. A4-46
 *   request: a failed request-key read redirects as a stranger ........... A4-49
 *   join-flow: any of its three reads drops its error .................... A4-38
 *   a guest link or QR falls back to a *.vercel.app address .............. A4-S01 (second pass)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('A4-51 · /seat asks the seat gate to throw on a failed read, both times', () => {
  const src = code('app/[slug]/seat/page.tsx');
  const calls = src.match(/guestsMaySeeSeatsFor\([^)]*\)/g) ?? [];
  assert.ok(calls.length >= 2, `expected the table view and the personal pass to ask the gate, found ${calls.length}`);
  for (const c of calls) assert.match(c, /throwOnReadError:\s*true/, `a seat gate call answers "show on the day" on a failed read: ${c}`);
});

test('A4-50 · /seat consults tablesFailed before the personal pass', () => {
  const src = code('app/[slug]/seat/page.tsx');
  const pass = src.indexOf('<PersonalPass');
  assert.ok(pass > 0, 'the personal pass is drawn');
  const before = src.slice(Math.max(0, src.lastIndexOf('fetchTables(', pass)), pass);
  assert.match(before, /if \(tablesFailed\) return <SeatCouldNotLoad/, 'a failed table read must not draw "the floor plan is on its way"');
});

test('A4-53 · /seat writes no ₱ amount, not even in a comment', () => {
  assert.doesNotMatch(raw('app/[slug]/seat/page.tsx'), /₱\s?\d/);
});

test('A4-37 · /find-seat consults the check-in read', () => {
  const src = code('app/[slug]/find-seat/page.tsx');
  assert.match(src, /\{ data: checkin, error: checkinErr \}/);
  assert.match(src, /checkInUnread: Boolean\(checkinErr\)/);
  assert.match(code('app/[slug]/find-seat/_components/door-pass.tsx'), /pass\.checkInUnread \?/);
});

test('A4-27 · /welcome draws only known error keys, and the save sends keys, never sentences', () => {
  const page = code('app/[slug]/welcome/page.tsx');
  assert.match(page, /ERROR_COPY\[errorKey\] \?\? null/);
  assert.doesNotMatch(page, /ERROR_COPY\[errorKey\] \?\? errorKey/);
  const actions = code('app/[slug]/welcome/actions.ts');
  assert.doesNotMatch(actions, /welcome\?error=\$\{encodeURIComponent/, 'the address carries a key, never text');
  for (const key of actions.matchAll(/welcome\?error=([a-z_]+)/g)) {
    assert.match(page, new RegExp(`\\b${key[1]}:\\s*'`), `?error=${key[1]} has no words in ERROR_COPY`);
  }
});

test('A4-26 · /welcome save: a failed read stays on the door with save_failed', () => {
  const actions = code('app/[slug]/welcome/actions.ts');
  assert.match(actions, /if \(eventErr \|\| guestErr\) redirect\(`\/\$\{slug\}\/welcome\?error=save_failed`\)/);
  assert.ok(
    actions.indexOf('if (eventErr || guestErr)') < actions.indexOf('if (!event?.slug || !guest?.guest_id)'),
    'the failure is answered before "no such guest"',
  );
});

test('A4-25 · /welcome: an unread inviter keeps the whole phrase (never "from the …")', () => {
  const page = code('app/[slug]/welcome/page.tsx');
  assert.match(page, /const primaryFirst = primary\s*\?[\s\S]*?:\s*primaryName;/);
});

test('A4-28 · /avatar reads the guest through guestRead', () => {
  const src = code('app/[slug]/avatar/page.tsx');
  assert.match(src, /const guest = await guestRead\('avatar \(guest\)'/);
});

test('A4-44 · the guest gift page throws on an unread list of ways to give', () => {
  const src = code('app/[slug]/pabuya/_lib/gift-page.server.ts');
  assert.match(src, /readEgiftMethods\(admin, event\.event_id/);
  assert.match(src, /if \(!methodsRead\.read\) throw/);
  assert.doesNotMatch(src, /fetchEgiftMethods\(/, 'fetchEgiftMethods folds a failed read into "none"');
});

test('A4-45 / A4-46 · /print: the event read and the story reads fail honestly', () => {
  const src = code('app/[slug]/print/page.tsx');
  const fetchEvent = src.slice(src.indexOf('const fetchEvent'), src.indexOf('export async function generateMetadata'));
  assert.match(fetchEvent, /\{ data, error \}/);
  assert.match(fetchEvent, /if \(error\) throw/);
  assert.doesNotMatch(src, /loadEditorialData\(event\.event_id\);\s*\}\s*catch/, 'a throw must not become "not ready yet"');
  assert.doesNotMatch(src, /loadStoryPages\([\s\S]{0,200}?\)\s*\.catch\(\(\) => \[\]\)/, 'a failed arrangement read must not print the automatic layout');
});

test('A4-49 · /request asks the request-key read to throw', () => {
  assert.match(code('app/[slug]/request/page.tsx'), /readRememberedRequest\([^)]*\{ throwOnReadError: true \}\)/);
  assert.match(code('lib/request-key.server.ts'), /if \(opts\.throwOnReadError\) throw/);
});

test('A4-38 · the join flow throws on each of its three reads', () => {
  const src = code('app/join/[eventId]/_components/join-flow.tsx');
  for (const name of ['askErr', 'existingErr', 'claimErr']) {
    assert.match(src, new RegExp(`error: ${name} \\}`), `${name} is bound`);
    assert.match(src, new RegExp(`if \\(${name}\\) throw`), `${name} is consulted`);
  }
});

test('A4-S01 · a guest link or QR never falls back to a *.vercel.app address', () => {
  for (const rel of [
    'app/[slug]/_lib/plus-one-seats.server.ts',
    'app/[slug]/_lib/loaders.ts',
    'app/[slug]/request/page.tsx',
    'app/[slug]/find-seat/page.tsx',
    'app/[slug]/welcome/page.tsx',
    'app/[slug]/invite/enter/page.tsx',
  ]) {
    assert.doesNotMatch(code(rel), /vercel\.app/, `${rel} prints a preview address into a guest's QR`);
  }
});
