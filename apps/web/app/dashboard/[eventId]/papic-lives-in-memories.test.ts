/**
 * PAPIC LIVES IN MEMORIES — AND THE PAPIC PAGE IS STILL GONE (THE ONE BUILD, owner 8 Nov 2026: *"Papic + Thank You into
 * Memories"*; supersedes 2026-10-26 "THE PAPIC CARD LIVES ON HOME › TODAY". Renamed from `papic-lives-on-home.test.ts`
 * with `git mv` — the same guard, its premise moved).
 *
 * What this holds — each by RENDERING or by the pure function, and each with its sabotage:
 *   1 · Memories draws EXACTLY ONE Papic card, under the keepsake row and before the grid, `id="papic"`, with Total ·
 *       Taken · Remaining and "Add more" on its face; Today draws NONE, and where the card is in Memories Today's Papic
 *       row stands down too (one Papic, never two).
 *   2 · a failed pot read says "Couldn't check", never 0.
 *   3 · `/dashboard/<id>/studio/papic` is not a page, and the old address — AND the old card address
 *       `/dashboard/<id>?papic=open…` that stored notifications carry — forward to Memories with the card open,
 *       carrying a save's outcome; the files' answers go to Memories' own notice; its child pages are untouched.
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
import { papicCardHref, withQuery } from '@/lib/papic-home-href';
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
const STUB = join(process.cwd(), '__server_only_stub_papic_memories__.js');
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
let Card: typeof import('@/app/dashboard/[eventId]/_components/home-first-screen').PapicCard | null = null;
test.before(async () => {
  const mod = await import('@/app/dashboard/[eventId]/_components/home-first-screen');
  Screen = mod.HomeFirstScreen;
  Card = mod.PapicCard;
});

const NOTHING: HomeNextInput = { guide: null, hasDate: true, guests: { total: 96, unsent: 0 }, noun: 'wedding', papicReady: false, aiOffer: false };
const PAPIC_SVC = { key: 'papic', name: 'Papic', brand: 'Guest photos', status: '320 credits left' };

function today(papicInMemories: boolean, services: unknown[] = [PAPIC_SVC]): string {
  return renderToStaticMarkup(
    React.createElement(Screen!, {
      eventId: E,
      cover: { eyebrow: 'Wedding · December 18, 2026', name: 'Ana & Miguel' },
      next: pickHomeNext(NOTHING),
      control: fixtureControl(E, { next: pickHomeNext(NOTHING) }),
      services,
      papicLeft: 320,
      papicInMemories,
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
const card = (c: unknown) => renderToStaticMarkup(React.createElement(Card!, { card: c } as never));
const GALLERY = 'app/_components/memories/event-memories-gallery.tsx';

test('1 · Memories draws EXACTLY ONE Papic card — under the keepsakes, before the grid — with its face', () => {
  // The page builds ONE card and hands it to the gallery's one slot.
  const page = code(MEMORIES);
  assert.equal(count(page, /<PapicCard\b/g), 1, 'Memories builds one Papic card');
  assert.equal(count(page, /papic=\{papicCard\}/g), 1, 'and hands it to the gallery once');
  assert.match(page, /seat="memories"/, 'its settings save back to Memories');
  assert.match(page, /thankYouHref:\s*null/, 'Thank You is the keepsake row\'s door — never two doors');
  // The gallery draws the slot under the keepsake row and before the grid.
  const g = code(GALLERY);
  const keep = g.indexOf('{host ? keepsakes : null}');
  const slot = g.indexOf('{host && papic ? <div data-tour="memories-papic">{papic}</div> : null}');
  const grid = g.indexOf('data-tour="memories-grid"');
  assert.ok(keep >= 0 && slot > keep && grid > slot, 'keepsakes → the Papic card → the grid');
  assert.equal(count(g, /\{host && papic \? <div data-tour="memories-papic">\{papic\}<\/div> : null\}/g), 1, 'one slot — and the Memories tour lights it');
  // The card itself: the #papic anchor, the three counts and Add more on its face, outside the head's button.
  const html = card(CARD);
  assert.equal(count(html, /data-papic-home-card=/g), 1);
  assert.match(html, /id="papic"/, 'the card is the #papic anchor old links scroll to');
  assert.match(html, /data-memories-papic=""/);
  assert.match(html, /data-papic-card-count="total"[^>]*>500</);
  assert.match(html, /data-papic-card-count="taken"[^>]*>180</);
  assert.match(html, /data-papic-card-count="remaining"[^>]*>320</);
  assert.match(html, /data-papic-card-add-more=""[\s\S]*?data-test-buy/, 'Add more is on the face');
  const head = html.match(/<button[^>]*data-papic-card-head=""[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.ok(head && !head.includes('data-test-buy') && !head.includes('data-papic-card-counts'), 'face is not inside the head button');
});

test('1a · Today draws NO Papic card, and where the card is in Memories no Papic row either', () => {
  const html = today(true);
  assert.equal(count(html, /data-papic-home-card=/g), 0, 'no Papic card on Today');
  assert.equal(count(html, /data-home-service="papic"/g), 0, 'and no Papic row — one Papic, in Memories');
  assert.doesNotMatch(code(HOME), /<PapicCard\b|<PapicHomeCard\b|seat="home"/, 'the Today page builds no card');
});

test('1b · SABOTAGE — the assertions can fail: a viewer whose card is NOT in Memories keeps the shipped row on Today', () => {
  const html = today(false);
  assert.equal(count(html, /data-home-service="papic"/g), 1, 'the row is drawn, so the zero above is a real zero');
  assert.equal(count(html, /data-papic-home-card=/g), 0);
  // …and without the gallery's slot the order check has nothing to find.
  assert.equal(code(GALLERY).replace('{host ? papic : null}', '').indexOf('{host ? papic : null}'), -1);
});

test('2 · a failed pot read says "Couldn\'t check", never 0', () => {
  const html = card({ ...CARD, counts: { total: null, left: 320 } });
  assert.match(html, /data-papic-card-counts="unread"/);
  assert.match(html, /Couldn(’|&#x27;|&rsquo;|')t check/);
  assert.doesNotMatch(html, /data-papic-card-count="remaining"/, 'no Remaining number over a refused read');
  assert.equal(papicCountsWords(null, 3), null);
  assert.equal(papicCountsWords(10, null), null);
  assert.deepEqual(papicCountsWords(10, 4), [['Total', 10], ['Taken', 6], ['Remaining', 4]]);
  assert.deepEqual(papicCountsWords(10, 12), [['Total', 10], ['Taken', 0], ['Remaining', 12]], 'taken never negative');
});

test('3 · the Papic page is gone; its address AND the old card address forward to Memories with the card open', () => {
  assert.equal(existsSync(join(WEB, 'app/dashboard/[eventId]/studio/papic/page.tsx')), false, 'studio/papic/page.tsx is deleted');
  assert.equal(existsSync(join(WEB, 'app/dashboard/[eventId]/studio/papic/loading.tsx')), false);
  assert.equal(papicCardHref(E), `/dashboard/${E}/memories?papic=open#papic`);
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic`), `/dashboard/${E}/memories?papic=open#papic`);
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic/`), `/dashboard/${E}/memories?papic=open#papic`, 'a trailing slash');
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic`, '?style_set=MONO&tab=cameras'), `/dashboard/${E}/memories?papic=open&style_set=MONO#papic`, 'an outcome rides along; ?tab= is dropped');
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic`, '?buy=1'), `/dashboard/${E}/memories?papic=open&buy=1#papic`);
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic`, '?drive_connected=1'), `/dashboard/${E}/memories?drive_connected=1`, 'the files answers go to Memories');
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic`, '?gallery=open'), `/dashboard/${E}/memories`);
  // 📬 The OLD CARD ADDRESS — stored notification rows, e-mails, bookmarks (2026-10-26 → 2026-11-08).
  assert.equal(legacyRedirectTarget(`/dashboard/${E}`, '?papic=open'), `/dashboard/${E}/memories?papic=open#papic`);
  assert.equal(legacyRedirectTarget(`/dashboard/${E}`, '?papic=open&papic_pool_error=event_over'), `/dashboard/${E}/memories?papic=open&papic_pool_error=event_over#papic`, 'its outcome rides along');
  assert.equal(legacyRedirectTarget(`/dashboard/${E}/`, '?papic=open'), `/dashboard/${E}/memories?papic=open#papic`, 'a trailing slash');
  // …and Today itself, without `papic=open`, is never touched.
  assert.equal(legacyRedirectTarget(`/dashboard/${E}`), null, 'Today is a page');
  assert.equal(legacyRedirectTarget(`/dashboard/${E}`, '?settings=1'), null, 'Today with its own query is a page');
  assert.equal(legacyRedirectTarget(`/dashboard/${E}`, '?papic=closed'), null);
  for (const child of ['crew', 'challenges', 'recap', 'run-of-show', 'moderation', 'magazine']) {
    assert.equal(legacyRedirectTarget(`/dashboard/${E}/studio/papic/${child}`), null, `${child} is still a page`);
  }
  assert.equal(withQuery(papicCardHref(E), 'x=1'), `/dashboard/${E}/memories?papic=open&x=1#papic`, 'a query never lands after the #');
  assert.equal(withQuery(`/dashboard/${E}/memories`, 'x=1'), `/dashboard/${E}/memories?x=1`);
});

/** Each control the page offered → where it lives now (the PR's table). Anchored per component, counted, not grepped
 *  once per file (a file-level match cannot say which component holds it). */
const CARD_SETTINGS = 'app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings.tsx';
const HOME = 'app/dashboard/[eventId]/page.tsx';
const MEMORIES = 'app/dashboard/[eventId]/memories/page.tsx';
const MOVED: ReadonlyArray<readonly [control: string, file: string, needle: RegExp]> = [
  // 📷 THE HEAD (owner 2026-10-30): ONE dropdown — Papic on/off and when guests can shoot, together.
  ['the head control (Off · On — event day · On — everyone, now)', MEMORIES, /headControl:\s*\(\s*<Suspense fallback=\{null\}>\s*<PapicHeadControl\b/],
  ['Papic Off · On — event day · On — everyone, now (the head\'s one dropdown)', CARD_SETTINGS, /return <PapicHeadPicker eventId=\{eventId\}/],
  ['Total · Taken · Remaining + Add more', MEMORIES, /counts:\s*\{\s*total:\s*now\.total/],
  ['Add more (web sheet / Apple sheet)', MEMORIES, /const cardBuy = iap\.iap \? \(\s*<IapPapicSheet\b[\s\S]*?<PapicBuySheet\b/],
  ['every save\'s answer (banners)', MEMORIES, /<PapicOutcomeBanners\b/],
  ['the camera settings (opened by ›)', MEMORIES, /<PapicCameraSettings eventId=\{eventId\} seat="memories"/],
  ['Setup & help (shutter · capture defaults · DSLR)', MEMORIES, /<PapicCameraHelp\b/],
  ['the self-heals (free cameras · free pool · uploads camera · guest sync)', MEMORIES, /<PapicSelfHeal\b/],
  ['capture dates', CARD_SETTINGS, /<PapicWindowPicker\b/],
  ['filter / style', CARD_SETTINGS, /<StylePicker\b/],
  ['credits per guest (min / max)', CARD_SETTINGS, /<GuestAllotmentsChoice\b/],
  ['face tagging', CARD_SETTINGS, /<FaceTaggingChoice\b/],
  ['face blocking', CARD_SETTINGS, /<FaceBlockingCount\b/],
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
  assert.deepEqual(hits, [], 'a link to /studio/papic (use papicCardHref, or Memories for the album)');
  // SABOTAGE — the pattern does catch the shapes it forbids.
  for (const s of ['`/dashboard/${e}/studio/papic`', "'/dashboard/x/studio/papic'", '`/dashboard/${e}/studio/papic?x=1`']) assert.ok(DEAD.test(s), s);
  assert.ok(!DEAD.test('`/dashboard/${e}/studio/papic/crew`'), 'a child page is not the gone page');
});
