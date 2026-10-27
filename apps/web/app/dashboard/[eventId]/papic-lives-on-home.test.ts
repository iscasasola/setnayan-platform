/**
 * PAPIC LIVES ON HOME › TODAY — AND THE PAPIC PAGE IS GONE (owner 2026-10-26, DECISION_LOG "THE PAPIC CARD LIVES ON
 * HOME › TODAY; THE STANDALONE PAPIC PAGE IS REMOVED" + "PAPIC CHALLENGES: A LIVE SWITCH AND AN ✕; HOME PAPIC CARD
 * SHOWS THE COUNTS"). Owner, verbatim: *"this is the widget that should be at home with the count of the total, taken,
 * remaining and a button to add more"* · *"that papic frame with toggle, place that on home and remove that page"* ·
 * *"it should be on the today"*.
 *
 * What this holds — each by RENDERING or by the pure function, and each with its sabotage:
 *   1 · Home's first screen draws EXACTLY ONE Papic card, on the row after Budget (owner 2026-10-27: "Place it on the
 *       next row after the budget widget" — Budget is the control row's last tile), with Total · Taken ·
 *       Remaining and "Add more" on its face; Your services draws no second Papic.
 *   2 · a failed pot read says "Couldn't check", never 0.
 *   3 · `/dashboard/<id>/studio/papic` is not a page, and the old address forwards to Home with the card open —
 *       carrying a save's outcome; the files' answers go to Memories; its child pages are untouched.
 *   4 · every control the page offered is reachable from the card (the settings it opens) or Memories — the table.
 *   5 · nothing in the app still links to the gone page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fixtureControl } from '@/lib/home-control-fixture';
import { pickHomeNext, type HomeNextInput } from '@/lib/home-first-screen';
import { papicHomeHref, withQuery } from '@/lib/papic-home-href';
import { papicCountsWords } from '@/lib/papic-card-counts';
import { legacyRedirectTarget } from '@/lib/legacy-redirects';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

// `server-only` / `client-only` are build-time markers; under node they resolve to an empty stub (the repo's pattern).
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_papic_home__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));
const E = '00000000-0000-4000-8000-000000000000';

let Screen: typeof import('@/app/dashboard/[eventId]/_components/home-first-screen').HomeFirstScreen | null = null;
test.before(async () => {
  Screen = (await import('@/app/dashboard/[eventId]/_components/home-first-screen')).HomeFirstScreen;
});

const NOTHING: HomeNextInput = { guide: null, hasDate: true, guests: { total: 96, unsent: 0 }, noun: 'wedding', papicReady: false, aiOffer: false };
const PAPIC_SVC = { key: 'papic', name: 'Papic', brand: 'Guest photos', status: '320 credits left' };

function home(card: unknown, services: unknown[] = [PAPIC_SVC]): string {
  return renderToStaticMarkup(
    React.createElement(Screen!, {
      eventId: E,
      cover: { eyebrow: 'Wedding · December 18, 2026', name: 'Ana & Miguel' },
      next: pickHomeNext(NOTHING),
      control: fixtureControl(E, { next: pickHomeNext(NOTHING) }),
      services,
      papicLeft: 320,
      papicCard: card,
      serviceCards: true,
    } as never),
  );
}
const CARD = {
  phase: 'before',
  thankYouHref: null,
  settings: React.createElement('div', { 'data-test-settings': '' }),
  headControl: null,
  counts: { total: 500, left: 320 },
  buy: React.createElement('button', { type: 'button', 'data-test-buy': '' }, 'Add more'),
};
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

test('1 · Home draws EXACTLY ONE Papic card, on the row after Budget, with Total · Taken · Remaining and Add more on its face', () => {
  const html = home(CARD);
  assert.equal(count(html, /data-papic-home-card=/g), 1, 'one Papic card on Home');
  assert.equal(count(html, /data-home-service="papic"/g), 1, 'and no second Papic row in Your services');
  // On the row after Budget: after the whole control row (both its phone grid and its wide columns), above Your services.
  const today = html.indexOf('data-home-today=');
  const card = html.indexOf('data-papic-home-card=');
  const services = html.indexOf('data-home-services');
  const rowEnd = html.indexOf('data-home-control="detail"');
  const budget = html.lastIndexOf('data-home-card-key="budget"');
  assert.ok(today >= 0 && rowEnd > today, 'the Today line and the control row are drawn');
  assert.ok(budget > rowEnd && card > budget, 'the card sits on the row after Budget, below the control row');
  assert.ok(services === -1 || card < services, 'the card is above Your services, not inside it');
  assert.match(html, /id="papic"/, 'the card is the #papic anchor old links scroll to');
  // The face: the three counts and Add more.
  assert.match(html, /data-papic-card-count="total"[^>]*>500</);
  assert.match(html, /data-papic-card-count="taken"[^>]*>180</);
  assert.match(html, /data-papic-card-count="remaining"[^>]*>320</);
  assert.match(html, /data-papic-card-add-more=""[\s\S]*?data-test-buy/, 'Add more is on the face');
  // The Add more is OUTSIDE the head's button (a button in a button is invalid HTML).
  const head = html.match(/<button[^>]*data-papic-card-head=""[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.ok(head && !head.includes('data-test-buy') && !head.includes('data-papic-card-counts'), 'face is not inside the head button');
});

test('1b · SABOTAGE — without the card the counts and Add more are gone (the assertions above can fail)', () => {
  const html = home(null);
  assert.equal(count(html, /data-papic-home-card=/g), 0);
  assert.doesNotMatch(html, /data-papic-card-counts/);
});

test('2 · a failed pot read says "Couldn\'t check", never 0', () => {
  const html = home({ ...CARD, counts: { total: null, left: 320 } });
  assert.match(html, /data-papic-card-counts="unread"/);
  assert.match(html, /Couldn(’|&#x27;|&rsquo;|')t check/);
  assert.doesNotMatch(html, /data-papic-card-count="remaining"/, 'no Remaining number over a refused read');
  assert.equal(papicCountsWords(null, 3), null);
  assert.equal(papicCountsWords(10, null), null);
  assert.deepEqual(papicCountsWords(10, 4), [['Total', 10], ['Taken', 6], ['Remaining', 4]]);
  assert.deepEqual(papicCountsWords(10, 12), [['Total', 10], ['Taken', 0], ['Remaining', 12]], 'taken never negative');
});

test('3 · the Papic page is gone; its address forwards to Home with the card open, carrying the answer', () => {
  assert.equal(existsSync(join(WEB, 'app/dashboard/[eventId]/studio/papic/page.tsx')), false, 'studio/papic/page.tsx is deleted');
  assert.equal(existsSync(join(WEB, 'app/dashboard/[eventId]/studio/papic/loading.tsx')), false);
  assert.equal(papicHomeHref(E), `/dashboard/${E}?papic=open#papic`);
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic`), `/dashboard/${E}?papic=open#papic`);
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic/`), `/dashboard/${E}?papic=open#papic`, 'a trailing slash');
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic`, '?style_set=MONO&tab=cameras'), `/dashboard/${E}?papic=open&style_set=MONO#papic`, 'an outcome rides along; ?tab= is dropped');
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic`, '?buy=1'), `/dashboard/${E}?papic=open&buy=1#papic`);
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic`, '?drive_connected=1'), `/dashboard/${E}/memories?drive_connected=1`, 'the files answers go to Memories');
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic`, '?gallery=open'), `/dashboard/${E}/memories`);
  for (const child of ['crew', 'challenges', 'recap', 'run-of-show', 'moderation', 'magazine']) {
    assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic/${child}`), null, `${child} is still a page`);
  }
  assert.equal(withQuery(papicHomeHref(E), 'x=1'), `/dashboard/${E}?papic=open&x=1#papic`, 'a query never lands after the #');
  assert.equal(withQuery(`/dashboard/${E}/memories`, 'x=1'), `/dashboard/${E}/memories?x=1`);
});

/** Each control the page offered → where it lives now (the PR's table). Anchored per component, counted, not grepped
 *  once per file (a file-level match cannot say which component holds it). */
const CARD_SETTINGS = 'app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings.tsx';
const HOME = 'app/dashboard/[eventId]/page.tsx';
const MEMORIES = 'app/dashboard/[eventId]/memories/page.tsx';
const MOVED: ReadonlyArray<readonly [control: string, file: string, needle: RegExp]> = [
  ['Papic on/off switch', HOME, /headControl:\s*<PapicSwitch\b/],
  ['Total · Taken · Remaining + Add more', HOME, /counts:\s*\{\s*total:\s*papicNow\.total/],
  ['Add more (web sheet / Apple sheet)', HOME, /<IapPapicSheet\b[\s\S]*?<PapicBuySheet\b/],
  ['every save\'s answer (banners)', HOME, /<PapicOutcomeBanners\b/],
  ['the camera settings (opened by ›)', HOME, /<PapicCameraSettings eventId=\{eventId\} seat="home"/],
  ['Setup & help (shutter · capture defaults · DSLR)', HOME, /<PapicCameraHelp\b/],
  ['the self-heals (free cameras · free pool · uploads camera · guest sync)', HOME, /<PapicSelfHeal\b/],
  ['capture dates', CARD_SETTINGS, /<PapicWindowPicker\b/],
  ['filter / style', CARD_SETTINGS, /<StylePicker\b/],
  ['credits per guest (min / max)', CARD_SETTINGS, /<GuestAllotmentsChoice\b/],
  ['face tagging', CARD_SETTINGS, /<FaceTaggingChoice\b/],
  ['face blocking', CARD_SETTINGS, /<FaceBlockingCount\b/],
  ['when guests can shoot', CARD_SETTINGS, /<GuestCamerasChoice\b/],
  ['what guests chipped in', CARD_SETTINGS, /<GuestContributionsCard\b/],
  ['challenges (switch + ✕)', CARD_SETTINGS, /<CoupleChallengesManager\b[^>]*inCard/],
  ['supplier challenges to approve', CARD_SETTINGS, /<VendorChallengesApproval\b/],
  ['Photo Notes Magazine', MEMORIES, /<MagazineCard\b/],
  ['Your Recap', MEMORIES, /<RecapCard\b/],
  ['Life-Flash', MEMORIES, /<LifeFlashCard\b/],
];

test('4 · every control the Papic page offered is reachable — from the card, or Memories', () => {
  for (const [control, file, needle] of MOVED) {
    assert.equal(count(code(file), new RegExp(needle.source, 'g')), 1, `${control}: expected once in ${file}`);
  }
});

test('4b · SABOTAGE — the table can fail: a control that is not mounted is caught', () => {
  const without = code(CARD_SETTINGS).replace(/<StylePicker\b/g, '<NotThere');
  assert.equal(count(without, /<StylePicker\b/g), 0);
});

/** Every source file under app/ and lib/ (no tests), for the dead-link sweep. */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(WEB, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = join(dir, name);
    const st = statSync(join(WEB, rel));
    if (st.isDirectory()) sources(rel, out);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}
/** A literal to the gone page itself — `/studio/papic` followed by the end of the literal, a `?` or a `#`. */
const DEAD = /\/studio\/papic(?=[`'"?#])/;

test('5 · nothing links to the gone page any more', () => {
  const files = [...sources('app'), ...sources('lib'), 'middleware.ts'];
  assert.ok(files.length > 500, `the sweep read the tree (${files.length} files)`);
  // `lib/legacy-redirects.ts` names the old address on purpose — it is the forward.
  const hits = files.filter((f) => f !== join('lib', 'legacy-redirects.ts') && DEAD.test(code(f))).map((f) => relative(WEB, join(WEB, f)));
  assert.deepEqual(hits, [], 'a link to /studio/papic (use papicHomeHref, or Memories for the album)');
  // SABOTAGE — the pattern does catch the shapes it forbids.
  for (const s of ['`/dashboard/${e}/studio/papic`', "'/dashboard/x/studio/papic'", '`/dashboard/${e}/studio/papic?x=1`']) assert.ok(DEAD.test(s), s);
  assert.ok(!DEAD.test('`/dashboard/${e}/studio/papic/crew`'), 'a child page is not the gone page');
});
