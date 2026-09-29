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
import { GUEST_PAGE_KEYS, GUEST_PAGE_STAGES, makerGuestPages, ME_NOT_ON_CANVAS } from './maker-guest-pages';
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
const tilesOf = (stage: MakerStageInput['stage']) => makerStageList({ ...PAGE, stage }).shown.map((t) => t.key);

/** The bar a guest holding their key sees once they have answered — the one
 *  whose last tab is Me (before they answer, RSVP holds Me's place). */
function guestBar(stage: MakerStageInput['stage']) {
  return resolveSiteNav({
    viewer: { kind: 'guest' },
    phase: 'before',
    hostAllowsCamera: true,
    anyChapterPublic: false,
    hasStory: true,
    hasDetails: true,
    replied: true,
    liveBroadcast: false,
    destinations: { camera: '/c', rsvp: '/x/invite/reply' },
    stageSlots: STAGE_BAR[stage].slots,
  }).filter((s) => s.href.startsWith('#'));
}

test('1 · the Invitation offers Home · Details · Story · Me — the guest bar’s own pages and words', () => {
  const pages = makerGuestPages('rsvp', tilesOf('rsvp'));
  assert.ok(pages);
  console.log(`  Invitation: ${pages!.map((p) => `${p.label}[${p.tiles.length}]`).join(' · ')}`);
  assert.deepEqual(pages!.map((p) => p.label), ['Home', 'Details', 'Story', 'Me']);
});

test('1 · on every stage before the day, the pages ARE the guest bar’s in-page tabs — keys, words and order', () => {
  for (const stage of GUEST_PAGE_STAGES) {
    const pages = makerGuestPages(stage, tilesOf(stage));
    assert.ok(pages, `${stage}: no Page ▾`);
    const bar = guestBar(stage);
    assert.deepEqual(pages!.map((p) => p.key), bar.map((s) => s.key), `${stage}: the dropdown offers a page the guest does not have, or misses one`);
    assert.deepEqual(pages!.map((p) => p.label), bar.map((s) => s.label), `${stage}: the dropdown's words are not the guest bar's`);
  }
  // The Save the Date has no Details.
  assert.deepEqual(makerGuestPages('save_the_date', tilesOf('save_the_date'))!.map((p) => p.label), ['Home', 'Story', 'Me']);
  // On the day and after it the bar is Now… / Recap…, so the stage keeps its own menu.
  for (const stage of PUBLIC_STAGE_ORDER) {
    if (!GUEST_PAGE_STAGES.includes(stage)) assert.equal(makerGuestPages(stage, tilesOf(stage)), null, `${stage}: not a guest-pages stage`);
  }
  // Never RSVP, Camera, Gallery or Watch — pages a guest scrolls, nothing that leaves.
  assert.deepEqual([...GUEST_PAGE_KEYS], ['home', 'details', 'story', 'me']);
});

test('1 · the icons are the guest bar’s icons', () => {
  const BAR = read('app/[slug]/_components/site-menu-bar.tsx');
  const barIcons = /const ICONS[^=]*=\s*\{([\s\S]*?)\};/.exec(BAR)?.[1];
  const pickIcons = /GUEST_PAGE_ICON[^=]*=\s*\{([\s\S]*?)\};/.exec(PICK)?.[1];
  assert.ok(barIcons && pickIcons, 'an icon map moved — re-anchor this test');
  const iconOf = (src: string, key: string) => new RegExp(`\\b${key}:\\s*(\\w+)`).exec(src)?.[1];
  for (const key of GUEST_PAGE_KEYS) {
    assert.ok(iconOf(barIcons!, key), `the guest bar has no ${key} icon`);
    assert.equal(iconOf(pickIcons!, key), iconOf(barIcons!, key), `${key}: the dropdown's icon is not the guest bar's`);
  }
});

test('2 · a pick jumps and never filters: every scene sits under exactly one page, in page order', () => {
  for (const stage of GUEST_PAGE_STAGES) {
    const tiles = tilesOf(stage);
    const pages = makerGuestPages(stage, tiles)!;
    const flat = pages.flatMap((p) => p.tiles);
    assert.deepEqual([...flat].sort(), [...tiles].sort(), `${stage}: a scene was lost or doubled`);
    for (const p of pages) {
      const idx = p.tiles.map((k) => tiles.indexOf(k));
      assert.deepEqual(idx, [...idx].sort((a, b) => a - b), `${stage}/${p.label}: scenes out of page order`);
    }
    assert.ok(pages.filter((p) => p.tiles.length > 0).length >= 2, `${stage}: the scenes must span pages for this to mean anything`);
    assert.deepEqual(pages.find((p) => p.key === 'me')?.tiles, [], 'Me is each guest’s own — no scene of the couple’s sits under it');
  }
  const pages = makerGuestPages('rsvp', tilesOf('rsvp'))!;
  assert.ok(pages.find((p) => p.key === 'story')!.tiles.includes('f:story'), 'the love story sits under Story');
  assert.ok(pages.find((p) => p.key === 'details')!.tiles.includes('w:venue_map'), 'the sections sit under Details');
  assert.ok(pages.find((p) => p.key === 'home')!.tiles.includes('f:hero'), 'the names sit under Home');
});

test('2 · SOURCE: the dropdown is the navigator’s one control before the day, and the list still draws every scene', () => {
  const nav = SHELL.slice(SHELL.indexOf('aria-label="Scenes"'), SHELL.indexOf('</nav>'));
  assert.match(nav, /\{guestPages && shownPage \? \(\s*<MakerPagePick pages=\{guestPages\} value=\{shownPage\.key\} onPick=\{jumpToPage\} \/>\s*\) : tabs \? \(/);
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
  const start = SHELL.indexOf('const jumpToPage = (key: GuestPageKey) => {');
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

test('3 · Me says what it is instead of a pick that silently does nothing', () => {
  assert.match(SHELL, /\{shownPage\?\.key === 'me' \? \(\s*<li[^>]*data-maker-page-me="">/);
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
