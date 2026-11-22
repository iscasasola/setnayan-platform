/**
 * 🔒 GUIDE & HELP — THE GUIDES ARE THE TOURS, AND EVERY DOOR LANDS (the Guide & Help drawing, owner "Approved" 21 Nov
 * 2026; corpus `prototypes/guide_help_2026-11-20/index.html`).
 *
 *   1  a guide's steps are its page's spotlight tour, read through TOURS — never words typed in lib/help/guides.ts;
 *   2  its help topics exist and are in its own help; its picture is a real capture on disk; its Take me there is a
 *      real event page;
 *   3  its page mounts that tour with replay="page" — the ⓘ sheet's Show me can only fire a tour that is there;
 *   4  the ⓘ sheet draws Show me only when <html data-spotlight-page> names its tour, and Guests mounts the ⓘ;
 *   5  Help's doors reach every new page (Start here · Topics · All N · Full guide), each through lib/routes.ts, and each
 *      new page has a home in lib/page-home.ts;
 *   6  no client file imports the guides (lib/tours.ts stays on the server), and no topic or guide page has a
 *      loading.tsx (they notFound() — a loading boundary would make that a soft 404).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { TOURS } from '@/lib/tours';
import { HELP_TOPICS, ALL_HELP_ARTICLES } from '@/lib/help';
import { topicsForCoverage } from '@/lib/help-ask-core';
import { HELP_GUIDES, guideSteps, guideShot, guidesFor, minutesLine, stepsLine } from '@/lib/help/guides';
import { coverageFor, helpPlace, inHelp } from '@/lib/help/help-place';
import { HOMES } from '@/lib/page-home';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

function filesUnder(dir: string): string[] {
  const abs = join(WEB, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((f) => {
    const p = join(abs, f);
    return statSync(p).isDirectory() ? filesUnder(relative(WEB, p)) : [relative(WEB, p)];
  });
}

test('1 · a guide’s steps ARE its tour’s stops — no step words live in guides.ts', () => {
  const src = code('lib/help/guides.ts');
  for (const g of HELP_GUIDES) {
    const script = TOURS[g.tourKey]?.spotlight;
    assert.ok(script, `${g.key}: tour ${g.tourKey} has no spotlight script — the guide would be empty`);
    const steps = guideSteps(g);
    assert.ok(steps.length > 0, `${g.key}: no steps`);
    assert.deepEqual(
      steps,
      script.steps.filter((s) => !s.welcome).map((s) => ({ title: s.title, body: s.body })),
      `${g.key}: the steps drifted from the tour`,
    );
    for (const s of steps) assert.equal(src.includes(s.body), false, `${g.key}: a step's words were typed into guides.ts`);
  }
  assert.equal(stepsLine(1), '1 step');
  assert.equal(stepsLine(4), '4 steps');
  assert.equal(minutesLine(4), 'about 2 minutes');
  assert.equal(minutesLine(1), 'about 1 minute');
});

test('2 · topics exist in the guide’s own help · the picture is on disk · Take me there is a real page · keys are unique', () => {
  const keys = HELP_GUIDES.map((g) => g.key);
  assert.equal(new Set(keys).size, keys.length, 'two guides share a page key');
  const slugs = new Set(ALL_HELP_ARTICLES.map((a) => a.article.slug));
  for (const reserved of ['topics', 'guides']) assert.equal(slugs.has(reserved), false, `an answer's /help/${reserved} would be hidden by the new pages`);
  for (const g of HELP_GUIDES) {
    for (const c of g.coverage) {
      const inHelpKeys = new Set(topicsForCoverage(HELP_TOPICS, c).map((t) => t.key));
      for (const t of g.topicKeys) assert.ok(inHelpKeys.has(t), `${g.key}: topic ${t} is not in the ${c} help`);
    }
    const shot = guideShot(g);
    assert.ok(shot, `${g.key}: feature page ${g.shotFrom} has no shot`);
    assert.ok(existsSync(join(WEB, 'public', shot.src)), `${g.key}: ${shot.src} is not on disk`);
    assert.ok(shot.alt.length > 10, `${g.key}: the picture has no words for a screen reader`);
    const page = `app/dashboard/[eventId]/${g.eventPath ? `${g.eventPath}/` : ''}page.tsx`;
    assert.ok(existsSync(join(WEB, page)), `${g.key}: Take me there opens ${page}, which does not exist`);
  }
});

test('3 · each guide’s page mounts its tour with replay="page" (Show me has a tour to play)', () => {
  const PROP: Record<string, string> = {
    customer_guest_list_v2: 'guests',
    customer_seat_plan_v2: 'seatPlan',
    customer_budget_v2: 'budget',
    customer_suppliers_v1: 'suppliers',
    customer_mood_board_v1: 'moodBoard',
    customer_memories_v2: 'memories',
  };
  for (const g of HELP_GUIDES) {
    const prop = PROP[g.tourKey];
    assert.ok(prop, `${g.key}: ${g.tourKey} is not a host page tour`);
    const dir = `app/dashboard/[eventId]/${g.eventPath}`;
    const mounts = filesUnder(dir).filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f)).some((f) => {
      const src = code(f);
      return new RegExp(`tourKey=\\{HOST_PAGE_TOURS\\.${prop}\\}[^>]*replay="page"`).test(src);
    });
    assert.ok(mounts, `${g.key}: nothing under ${dir} mounts HOST_PAGE_TOURS.${prop} with replay="page"`);
  }
});

test('4 · the ⓘ sheet: Show me only where the tour can replay · Guests mounts the ⓘ', () => {
  const sheet = code('app/_components/help-ask/page-info-sheet.tsx');
  assert.match(sheet, /getAttribute\('data-spotlight-page'\) === tourKey/, 'Show me is drawn without asking whether the tour is mounted');
  assert.match(sheet, /\{canShow \? \(/, 'Show me is not gated');
  assert.match(sheet, /SPOTLIGHT_REPLAY_EVENT, \{ detail: \{ tourKey \} \}/, 'Show me does not fire the shipped replay');
  assert.match(sheet, /<Sheet\b/, 'the ⓘ opens the house Sheet');
  assert.doesNotMatch(sheet, /Practice/, 'a Practice row is drawn with no practice frame behind it');
  const guests = code('app/dashboard/[eventId]/guests/page.tsx');
  assert.match(guests, /info=\{<PageInfo pageKey="guests" eventId=\{eventId\} \/>\}/, 'Guests lost its ⓘ');
  assert.match(code('app/dashboard/[eventId]/guests/_components/guests-screen.tsx'), /props\.info/, 'the Guests row does not draw its ⓘ');
});

test('5 · Help reaches every new page through lib/routes.ts, and each has a home', () => {
  const start = code('app/_components/help-ask/help-start.tsx');
  assert.match(start, /routes\.help\.guide\(/, 'Start here does not open guides');
  assert.match(start, /routes\.help\.topic\(/, 'Topics do not open topic pages');
  assert.match(start, /routes\.help\.topics\(\)/, 'no way to All topics');
  assert.match(code('app/(shell)/help/page.tsx'), /<HelpStart\b/, '/help does not draw Start here and Topics');
  assert.match(code('app/(shell)/help/page.tsx'), /guideFor:/, 'the best answer has no Full guide');
  assert.match(code('app/(shell)/(help-pages)/help/topics/[key]/topic-view.tsx'), /routes\.help\.guide\(/, 'a topic does not open its guides');
  assert.match(code('app/_components/help-ask/page-info.tsx'), /routes\.help\.guide\(/, 'the ⓘ does not open the guide');
  for (const r of ['/help/topics', '/help/topics/[key]', '/help/guides/[key]']) {
    assert.ok(HOMES[r], `${r} has no home in lib/page-home.ts`);
  }
  for (const f of ['app/(shell)/(help-pages)/help/topics/page.tsx', 'app/(shell)/(help-pages)/help/topics/[key]/page.tsx', 'app/(shell)/(help-pages)/help/guides/[key]/page.tsx']) {
    assert.ok(existsSync(join(WEB, f)), `${f} is missing`);
  }
  // Every Help page keeps the account it was opened in.
  const shop = helpPlace({ for: 'shop', refer: 'S89EVT-ABC' }, true);
  assert.equal(inHelp('/help/topics/x', shop), '/help/topics/x?for=shop&refer=S89EVT-ABC');
  assert.equal(inHelp('/help', helpPlace({}, true), {}, 'contact'), '/help#contact');
  assert.equal(helpPlace({ refer: '"><script>' }, true).referEvent, null, 'a refer that is not an id was kept');
  assert.equal(coverageFor({ role: 'vendor' }, true), 'supplier');
  assert.equal(coverageFor({}, false), 'public');
  // Guides are the host's; a shop, a guest or a stranger is not shown one.
  assert.ok(guidesFor('user').length >= 3, 'Start here has fewer than three guides');
  for (const c of ['supplier', 'guest', 'public'] as const) assert.equal(guidesFor(c).length, 0, `${c} help lists a host guide`);
});

test('6 · the guides never reach the browser · topic and guide pages have no loading boundary', () => {
  const clientImporters = filesUnder('app')
    .concat(filesUnder('components'))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .filter((f) => {
      const src = read(f);
      return /^\s*['"]use client['"]/.test(src) && /from '@\/lib\/help\/guides'/.test(src);
    });
  assert.deepEqual(clientImporters, [], 'a client file imports lib/help/guides (it carries lib/tours.ts)');
  // A loading.tsx wraps every route under its folder, so no folder from the group down to these pages may hold one —
  // that is why they live in their own route group, away from app/(shell)/help/loading.tsx.
  const chain = ['app/(shell)', 'app/(shell)/(help-pages)', 'app/(shell)/(help-pages)/help', 'app/(shell)/(help-pages)/help/topics',
    'app/(shell)/(help-pages)/help/topics/[key]', 'app/(shell)/(help-pages)/help/guides', 'app/(shell)/(help-pages)/help/guides/[key]'];
  for (const dir of chain) {
    assert.equal(existsSync(join(WEB, dir, 'loading.tsx')), false, `${dir}/loading.tsx would turn the topic and guide pages' notFound() into a soft 404`);
  }
  assert.equal(existsSync(join(WEB, 'app/(shell)/help/topics')), false, 'a topic page moved back under the /help loading boundary');
  assert.equal(existsSync(join(WEB, 'app/(shell)/help/guides')), false, 'a guide page moved back under the /help loading boundary');
});
