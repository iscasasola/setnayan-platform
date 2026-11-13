/**
 * help-ask-finds-the-answer.test.ts — THE ASK-FIRST HELP (owner "help approved", 13 Nov 2026; prototype
 * `Setnayan-specs/prototypes/approved_2026-11-13/help-page-fable.html` v5).
 *
 * Held here, each executed against the real answers:
 *   1. the prototype's questions find what it promised — Taglish (magkano, paano mag-RSVP), the app's own words,
 *      typos (one letter off from 5 letters; never fee → free), and an honest miss (no fake answer);
 *   2. COVERAGE = THE ACTIVE ACCOUNT — a user reads host AND guest answers (14 topics), a shop reads supplier answers
 *      (7), a guest the guest ones, signed out About Setnayan only; a shop never sees a couple-only answer;
 *   3. the app's words stay true — every word on the right of the word list appears in the answers;
 *   4. every "Take me there" is a page that exists, and an event door with no event draws no button;
 *   5. the iPhone app's ask answers in the app's words and keeps the "not included" line instead of a miss;
 *   6. the log keeps no name and no email, and is closed to anon and signed-in readers (service role only);
 *   7. no programmer captions on the page (DECISION_LOG 2026-11-13 "No programmer labels").
 *
 * Seen to fail once: (1) the floor removed (`s.matched >= floor &&` → `true &&`) → the dog question got a "best"
 * answer → red; (2) `HELP_TAGLISH`'s magkano row deleted → red; (4) a door pointed at `/dashboard/[eventId]/guest` →
 * red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
{
  // `server-only` refuses a plain import outside Next; the log's pure halves are tested here.
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}
import { HELP_NOT_IN_THE_APP, HELP_TOPICS, type HelpRole } from '@/lib/help';
import {
  COVERAGE_ROLES,
  HELP_APP_WORDS,
  HELP_TAGLISH,
  askHelp,
  askTopicsFor,
  leadOf,
  topicsForCoverage,
  typoAllowance,
  withinEdits,
} from '@/lib/help-ask-core';
import { allHelpDoorHrefs, helpDoorFor, TOPIC_TILES } from '@/app/_components/help-ask/help-ask-places';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ask = (q: string, c: Parameters<typeof topicsForCoverage>[1]) => askHelp(q, topicsForCoverage(HELP_TOPICS, c));

test('1 · the prototype’s questions find what it promised', () => {
  const fee = ask('magkano booking fee', 'supplier');
  assert.equal(fee.best?.topicKey, 'supplier-fees', `"magkano booking fee" in a shop → ${fee.best?.title}`);

  const rsvp = ask('paano mag-RSVP', 'guest');
  assert.match(rsvp.best?.title ?? '', /RSVP/, `"paano mag-RSVP" → ${rsvp.best?.title}`);

  const photos = ask('how do guests upload photos', 'user');
  assert.ok(photos.best, 'premise: an answer for guests uploading photos');
  assert.ok(['papic', 'people-memories', 'about-setnayan'].includes(photos.best!.topicKey), `photos → ${photos.best!.topicKey}`);

  const dog = ask('can my dog be the ring bearer', 'user');
  assert.equal(dog.best, null, 'a question nobody answered was given a fake best answer');
  assert.ok(dog.outcome === 'near' || dog.outcome === 'none');

  const what = ask('what is setnayan', 'public');
  assert.equal(what.best?.title, 'What is Setnayan?', 'the question that IS a title does not lead');

  // Typos: one letter off from 5 letters, two from 9; under 5 letters exact.
  assert.ok(ask('suplier', 'supplier').best, '"suplier" found nothing');
  assert.equal(typoAllowance('fee'), 0);
  assert.equal(withinEdits('fee', 'free', typoAllowance('fee')), false, 'fee became free');
  assert.equal(typoAllowance('invitaton'), 2);
  assert.ok(withinEdits('invitaton', 'invitation', 2));
  assert.deepEqual(askHelp(' ', HELP_TOPICS), { outcome: 'none', best: null, more: [], near: [] });
});

test('1 · the best answer is cut from the answer itself — its first sentences, no new writing', () => {
  for (const t of HELP_TOPICS) {
    for (const a of t.articles) {
      const lead = leadOf(a.body);
      const flat = a.body.replace(/\s+/g, ' ').trim();
      assert.ok(flat.startsWith(lead.replace(/…$/, '')), `${a.slug}: the lead is not the answer's own opening`);
    }
  }
});

test('2 · coverage is the active account — no picker, and a shop never sees a couple-only answer', () => {
  const keys = (c: Parameters<typeof topicsForCoverage>[1]) => topicsForCoverage(HELP_TOPICS, c).map((t) => t.key);
  assert.equal(keys('user').length, 14, 'the user account reads host AND guest topics');
  assert.equal(keys('supplier').length, 7, 'a shop reads its seven topics');
  assert.deepEqual(keys('public'), ['about-setnayan'], 'signed out reads About Setnayan only');
  for (const t of topicsForCoverage(HELP_TOPICS, 'supplier')) assert.ok(t.roles.includes('vendor'), `${t.key} in a shop's help`);
  for (const t of topicsForCoverage(HELP_TOPICS, 'guest')) assert.ok(t.roles.includes('guest'), `${t.key} in a guest's help`);
  assert.ok(!keys('user').includes('supplier-fees'), 'a user reads the supplier fee answers');
  const roles: ReadonlyArray<HelpRole> = COVERAGE_ROLES.user;
  assert.deepEqual([...roles].sort(), ['couple', 'guest'], 'user help includes guest questions (owner 13 Nov)');
  // Every topic an account covers has a tile with words.
  for (const [account, coverage] of [['user', 'user'], ['shop', 'supplier']] as const) {
    for (const k of keys(coverage)) assert.ok(TOPIC_TILES[account][k], `${account}: topic ${k} has no tile`);
  }
  // The page reads the account from the sheet, not from a picker; the old role tiles are gone.
  const page = code('app/(shell)/help/page.tsx');
  assert.match(page, /function coverageFor\(/);
  assert.doesNotMatch(page, /HELP_ROLES|aria-label="Help by role"/, 'the role picker is back on /help');
  assert.match(code('app/_components/account-switcher/account-switcher.tsx'), /supplierSheet \? '\/help\?for=shop'/);
});

test('2 · the team’s guides never reach the public help — read only inside Setnayan HQ', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : /\.(tsx?|mjs)$/.test(e.name) && !e.name.includes('.test.') ? [join(dir, e.name)] : [],
    );
  const importers = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]
    .filter((f) => /from ['"]@\/lib\/help-admin['"]/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(WEB.length + 1));
  for (const f of importers) assert.match(f, /^app\/admin\//, `${f} imports the team guides outside Setnayan HQ`);
  assert.ok(importers.includes('app/admin/help/guides/page.tsx'), 'the team help does not read the team guides');
});

test('3 · the app’s words stay true — every word on the right appears in the answers', () => {
  const corpus = HELP_TOPICS.flatMap((t) => [t.label, ...t.articles.flatMap((a) => [a.title, a.body])]).join(' ').toLowerCase();
  for (const w of HELP_APP_WORDS) for (const also of w.also) assert.ok(corpus.includes(also), `"${also}" appears in no answer`);
  for (const t of HELP_TAGLISH) for (const r of t.reads) assert.ok(corpus.includes(r), `"${r}" appears in no answer`);
});

test('4 · every "Take me there" is a page that exists; an event door with no event draws no button', () => {
  for (const href of allHelpDoorHrefs()) {
    const segs = href.replace(/^\//, '').split('/');
    const candidates = [join(WEB, 'app', ...segs, 'page.tsx')];
    if (segs[0] === 'dashboard' && segs[1] !== '[eventId]') {
      candidates.push(join(WEB, 'app', 'dashboard', '(account)', ...segs.slice(1), 'page.tsx'));
      candidates.push(join(WEB, 'app', 'dashboard', '(launcher)', ...segs.slice(1), 'page.tsx'));
    }
    assert.ok(candidates.some((c) => existsSync(c)), `${href}: no page`);
  }
  assert.equal(helpDoorFor('user', 'guests'), null, 'an event door with no event');
  assert.equal(helpDoorFor('user', 'guests', { eventId: 'S89E-ABCDEFGHJK' })?.href, '/dashboard/S89E-ABCDEFGHJK/guests');
  assert.equal(helpDoorFor('shop', 'supplier-fees')?.href, '/vendor-dashboard/booking-fees');
});

test('5 · in the iPhone app the ask keeps the "not included" line instead of a miss, and sells nothing', () => {
  const app = askTopicsFor(topicsForCoverage(HELP_TOPICS, 'user'), true);
  const notIn = app.flatMap((t) => t.articles).filter((a) => a.body === HELP_NOT_IN_THE_APP);
  assert.ok(notIn.length > 0, 'premise: some answers are about parts the app does not include');
  const q = notIn[0]!.title;
  const r = askHelp(q, app);
  assert.equal(r.best?.slug, notIn[0]!.slug, `"${q}" in the app was not answered with the app's line`);
  assert.equal(r.best?.notInApp, true);
  // The view draws no door for it.
  assert.match(code('app/_components/help-ask/help-ask-view.tsx'), /hit\.notInApp \? null : <Door/);
});

test('6 · the log keeps no name and no email, and only the server reads or writes it', () => {
  const mig = readdirSync(join(WEB, '../../supabase/migrations')).find((f) => f.endsWith('_help_questions_nobody_answered_yet.sql'));
  assert.ok(mig, 'the help_asks migration is missing');
  const sql = readFileSync(join(WEB, '../../supabase/migrations', mig!), 'utf8').replace(/--.*$/gm, '');
  const table = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS public.help_asks'), sql.indexOf(');', sql.indexOf('public.help_asks')));
  assert.doesNotMatch(table, /email|name\s+TEXT|user_id/i, 'the log keeps who asked');
  assert.match(sql, /ALTER TABLE public\.help_asks ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(sql, /CREATE POLICY/i, 'a policy opens the log to a reader');
  assert.match(sql, /REVOKE ALL ON TABLE public\.help_asks FROM anon, authenticated/);
  const io = code('lib/help-asks.server.ts');
  assert.match(io, /^import 'server-only';/);
  assert.match(io, /createAdminClient\(\)/);
});

test('6 · the "No answer yet" list and the "People ask" chips count honestly', async () => {
  const { groupNoAnswerYet, groupPeopleAsk } = await import('@/lib/help-asks.server');
  const at = (d: number) => new Date(Date.UTC(2026, 10, d)).toISOString();
  const rows = [
    { words: 'where is the venue', coverage: 'guest' as const, outcome: 'closest' as const, created_at: at(1) },
    { words: 'where is the venue', coverage: 'guest' as const, outcome: 'none' as const, created_at: at(2) },
    { words: 'can my dog be the ring bearer', coverage: 'user' as const, outcome: 'near' as const, created_at: at(3) },
    { words: 'how to rsvp', coverage: 'guest' as const, outcome: 'best' as const, created_at: at(3) },
    { words: 'how to rsvp', coverage: 'guest' as const, outcome: 'yes' as const, created_at: at(4) },
  ];
  const list = groupNoAnswerYet(rows);
  assert.equal(list[0]?.words, 'where is the venue');
  assert.equal(list[0]?.asked, 2);
  assert.equal(list[0]?.outcome, 'none', 'the weakest result is the one shown');
  assert.ok(!list.some((r) => r.words === 'how to rsvp'), 'an answered question is on the No answer yet list');
  assert.deepEqual(groupPeopleAsk(rows, 'guest'), ['how to rsvp']);
  assert.deepEqual(groupPeopleAsk(rows, 'user'), [], 'a question nobody answered became a chip');
});

test('7 · no programmer captions on the Help page', () => {
  const page = code('app/(shell)/help/page.tsx');
  for (const caption of [/Pick your role/, /Showing \{/, /scroll for everything/, /Tap a tile/, /This section shows/, /Useful for anything not covered above/]) {
    assert.doesNotMatch(page, caption, `the page explains itself: ${caption}`);
  }
});
