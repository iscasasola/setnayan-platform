/**
 * the-page-dropdown-is-the-guest-bar.test.ts — owner 2026-09-30, pointing at
 * the guest Event Hub's bottom bar, verbatim: *"on the navigator, there should
 * be Home, Details, Story, Me on top dropdown so we can fix and improve the
 * event hub itself for invitation."*
 *
 * Holds four things:
 *   1. the Maker's Page ▾ offers EXACTLY the pages the guest's bar offers on
 *      that stage — same keys, same words (`resolveSiteNav`), same icons
 *      (`site-menu-bar.tsx`), nothing the guest does not have;
 *   2. a pick JUMPS and never filters — every scene stays in the navigator, and
 *      the pages only group them (`every-scene-is-in-the-navigator.test.ts`);
 *   3. a pick is instant: one message to the loaded canvas, never a reload,
 *      a refresh, a stage change or a page that opens;
 *   4. the guest's render is untouched: nothing under `app/[slug]` reads the
 *      dropdown's code.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { guestBarForStage, makerGuestPages, ME_NOT_ON_CANVAS } from './maker-guest-pages';
import { makerStageList, type MakerStageInput } from './maker-scene-list';
import { PUBLIC_STAGE_ORDER } from './public-site-stage-labels';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import { resolveSiteNav } from '../app/[slug]/_lib/site-nav';
import { STAGE_BAR } from '../app/[slug]/_lib/stage-bar';

const WEB = join(__dirname, '..');
const EDITOR = 'app/dashboard/[eventId]/website/editor/_components';
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const SHELL = read(`${EDITOR}/editor-shell.tsx`);
const PICK = read(`${EDITOR}/page-pick.tsx`);
const LIB = read('lib/maker-guest-pages.ts');

/* An owner-shaped page: names, six sections, the entourage, the love story. */
const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ORDER: WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map',
  'dress_code', 'photo_moments', 'special_message', 'what_to_bring', 'our_photos', 'our_love_story',
];
const widgets: InvitationWidgetRow[] = ORDER.map((t, i) => ({
  widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: true,
  is_always_on: ALWAYS.has(t), tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
}));
const PAGE: Omit<MakerStageInput, 'stage'> = {
  widgets,
  openBrowse: false,
  content: { schedule: true, venue_map: true, our_love_story: true, our_photos: true, special_message: true, what_to_bring: true, countdown: true },
  solemn: false,
  hasHeroMedia: false,
  hasEntourage: true,
  storyRenders: true,
};
const tilesOf = (stage: MakerStageInput['stage']) => makerStageList({ ...PAGE, stage }).shown.map((t): string => t.key);

test('1 · for every stage, Page ▾ offers exactly the guest bar’s pages — keys, words, order — ending in Me', () => {
  for (const stage of PUBLIC_STAGE_ORDER) {
    const pages = makerGuestPages(stage, tilesOf(stage));
    const bar = guestBarForStage(stage);
    console.log(`  ${stage}: ${pages.map((p) => `${p.label}${p.leaves ? '↗' : `[${p.tiles.length}]`}`).join(' · ')}`);
    assert.deepEqual(pages.map((p) => [p.key, p.label]), bar.map((s) => [s.key, s.label]), `${stage}: not the guest bar`);
    // every page the stage's config allows, and nothing it does not
    for (const p of pages) assert.ok(STAGE_BAR[stage].slots.includes(p.key), `${stage}: ${p.key} is not on this stage's bar`);
    // the guest who has answered: Me, never the RSVP it replaces
    assert.equal(pages.at(-1)?.key, 'me', `${stage}: the guest's Me is missing`);
    assert.ok(!pages.some((p) => p.key === 'rsvp'), `${stage}: RSVP is replaced by Me once answered`);
  }
});

test('1 · the guest bar asked is the REAL one — the same function a guest’s page draws, not a copy', () => {
  // A guest's own bar, asked independently: the dropdown equals it.
  const direct = resolveSiteNav({
    viewer: { kind: 'guest' }, phase: 'before', hostAllowsCamera: true, anyChapterPublic: true, hasStory: true,
    hasDetails: true, replied: true, liveBroadcast: false, destinations: { camera: '/c', rsvp: '/r' },
    stageSlots: STAGE_BAR.rsvp.slots,
  }).map((s) => s.label);
  assert.deepEqual(makerGuestPages('rsvp', tilesOf('rsvp')).map((p) => p.label), direct);
  // …and nothing in the Maker names a page: no label literal survives in the lib or the picker.
  for (const [name, src] of [['maker-guest-pages.ts', LIB], ['page-pick.tsx', PICK]] as const) {
    assert.doesNotMatch(
      src,
      /['"`](Home|Welcome|Details|Story|Our Love Story|Me|Now|Live|Schedule|Camera|Gallery|Recap)['"`]/,
      `${name} types a page's name — take it from resolveSiteNav`,
    );
  }
  assert.match(LIB, /return resolveSiteNav\(\{/);
});

test('1 · the icons are the guest bar’s icons', () => {
  const BAR = read('app/[slug]/_components/site-menu-bar.tsx');
  const barIcons = /const ICONS[^=]*=\s*\{([\s\S]*?)\};/.exec(BAR)?.[1];
  const pickIcons = /GUEST_PAGE_ICON[^=]*=\s*\{([\s\S]*?)\};/.exec(PICK)?.[1];
  assert.ok(barIcons && pickIcons, 'an icon map moved — re-anchor this test');
  const iconOf = (src: string, key: string) => new RegExp(`\\b${key}:\\s*(\\w+)`).exec(src)?.[1];
  const offered = new Set(PUBLIC_STAGE_ORDER.flatMap((s) => guestBarForStage(s).map((b) => b.key)));
  for (const key of offered) {
    assert.ok(iconOf(pickIcons!, key), `${key}: offered in Page ▾ with no icon`);
    assert.equal(iconOf(pickIcons!, key), iconOf(barIcons!, key), `${key}: the dropdown's icon is not the guest bar's`);
  }
});

test('2 · a pick jumps and never filters: every scene sits under exactly one page, in page order', () => {
  for (const stage of PUBLIC_STAGE_ORDER) {
    const tiles = tilesOf(stage);
    const pages = makerGuestPages(stage, tiles);
    const flat = pages.flatMap((p) => p.tiles);
    assert.deepEqual([...flat].sort(), [...tiles].sort(), `${stage}: a scene was lost or doubled`);
    for (const p of pages) {
      const idx = p.tiles.map((k) => tiles.indexOf(k));
      assert.deepEqual(idx, [...idx].sort((a, b) => a - b), `${stage}/${p.label}: scenes out of page order`);
    }
    assert.deepEqual(pages.find((p) => p.key === 'me')?.tiles, [], 'Me is each guest’s own — no scene of the couple’s sits under it');
    for (const p of pages) if (p.leaves) assert.deepEqual(p.tiles, [], `${stage}/${p.label} opens its own page — it holds no scenes`);
  }
  const pages = makerGuestPages('rsvp', tilesOf('rsvp'));
  assert.ok(pages.filter((p) => p.tiles.length > 0).length >= 3, 'the Invitation’s scenes must span pages for this to mean anything');
  assert.ok(pages.find((p) => p.key === 'story')!.tiles.includes('f:story'), 'the love story sits under Story');
  assert.ok(pages.find((p) => p.key === 'details')!.tiles.includes('w:venue_map'), 'the sections sit under Details');
  assert.ok(pages.find((p) => p.key === 'home')!.tiles.includes('f:hero'), 'the names sit under Home');
});

test('2 · SOURCE: the dropdown is the navigator’s one control, and the list still draws every scene', () => {
  const nav = SHELL.slice(SHELL.indexOf('aria-label="Scenes"'), SHELL.indexOf('</nav>'));
  assert.match(nav, /\{shownPage \? <MakerPagePick pages=\{guestPages\} value=\{shownPage\.key\} onPick=\{jumpToPage\} \/> : null\}/);
  assert.equal((nav.match(/<PickMenu\b|<MakerPagePick\b/g) ?? []).length, 1, 'one dropdown at the top of the navigator');
  assert.match(SHELL, /const guestPages = makerGuestPages\(stage, list\.shown\.map\(\(t\) => t\.key\)\);/);
  // The navigator's loop reads no page — nothing the dropdown picks can hide a tile.
  const loop = SHELL.slice(SHELL.indexOf('{list.shown.map((tile, i) => {'), SHELL.indexOf('data-maker-tile={tile.key}'));
  assert.ok(loop.length > 0, 'the navigator loop moved — re-anchor this test');
  assert.doesNotMatch(loop, /shownPage|guestPages|tabKey|return null/, 'a page pick must not decide which scenes are listed');
  // One PickMenu, never a pill row.
  assert.match(PICK, /<PickMenu\s+label="Page"\s+dataAttr="data-maker-page-pick"/);
  assert.doesNotMatch(PICK, /role="tab"/);
});

test('3 · a pick is instant: one message to the loaded canvas — no reload, refresh, stage change or page', () => {
  const start = SHELL.indexOf('const jumpToPage = (page: MakerGuestPage) => {');
  assert.ok(start >= 0, 'jumpToPage moved — re-anchor this test');
  const body = SHELL.slice(start, SHELL.indexOf('\n  };', start));
  assert.match(body, /scrollPreviewTo\(first\)/, 'the canvas is not moved to the page');
  assert.match(body, /scrollIntoView/, 'the navigator is not moved to the page');
  assert.doesNotMatch(
    body,
    /router\.|refresh|revalidatePath|location\.|\.src\s*=|setStage|setCanvasStamp|kind: 'tool'|window\.open|fetch\(/,
    'a page pick must not reload, navigate or open anything',
  );
  // …and what `scrollPreviewTo` sends is the bridge's existing `scrollTo`.
  assert.match(SHELL, /postToShownCanvases\(\{ source: 'setnayan-editor', t: 'scrollTo', key: anchor \}\)/);
});

test('3 · Me, and a page that leaves, say what they are instead of a pick that silently does nothing', () => {
  assert.match(SHELL, /\{shownPage\?\.key === 'me' \? \(\s*<li[^>]*data-maker-page-me="">/);
  assert.match(SHELL, /\{shownPage\?\.leaves \? \(\s*<li[^>]*data-maker-tab-leaves="">/);
  assert.match(SHELL, /label=\{ME_NOT_ON_CANVAS\.label\}/);
  assert.match(ME_NOT_ON_CANVAS.body, /guest list/);
  assert.doesNotMatch(`${ME_NOT_ON_CANVAS.label} ${ME_NOT_ON_CANVAS.body}`, /website|\bsite\b|↗/i);
});

test('4 · the guest’s render is untouched — nothing under app/[slug] reads the dropdown', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
    });
  const guestFiles = walk(join(WEB, 'app/[slug]'));
  assert.ok(guestFiles.length > 20, 'the guest route moved — re-anchor this test');
  for (const f of guestFiles) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /maker-guest-pages|page-pick|MakerPagePick/, `${f} reads the Maker's Page ▾`);
  }
});
