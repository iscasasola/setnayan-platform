/**
 * the-maker-controls-are-compact.test.ts — owner, 2026-09-27, three rulings:
 *
 *   B. each guest's own parts (greeting, QR pass, RSVP) are drawn IN PLACE in
 *      the Maker, as "Your guest" — never sample content — and a tap opens a
 *      panel that says where each comes from;
 *   N. the navigator's tab row (it wrapped to 140px in a 168px column) is ONE
 *      control: *"this should be a tap to show option to pick or a drop down"*;
 *   T. the toolbar's stage row, clipped at laptop widths, collapses to
 *      "● Invitation ▾" + "Pages ▾" — *"convert this to a drop down/tap to show
 *      options for smaller screens"* — decided by MEASURED overflow.
 *
 * Plus the iframe count the controller measured (6 after 2 saves): see the
 * last test — those are the navigator's live thumbnails, not a leak.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { makerStageList, type MakerStageInput } from './maker-scene-list';
import { fixedScenePanel } from './maker-selection';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const BODY = read('app/[slug]/_components/site-body.tsx');
const SHELL = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
const BAR = read('app/dashboard/[eventId]/launch/_components/maker-shell.tsx');

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ORDER: WidgetType[] = ['hero', 'greeting', 'qr_card', 'countdown', 'schedule', 'rsvp', 'venue_map', 'our_love_story'];
const widgets: InvitationWidgetRow[] = ORDER.map((t, i) => ({
  widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: true,
  is_always_on: ALWAYS.has(t), tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
}));
const PAGE: MakerStageInput = {
  stage: 'rsvp', widgets, openBrowse: false,
  content: { schedule: true, venue_map: false, our_love_story: false, countdown: true },
  solemn: false, hasHeroMedia: false, hasEntourage: false, storyRenders: false,
};

/* ── B · each guest's own parts, in place ──────────────────────────────── */

test('B · the Maker lists the greeting, the pass and the RSVP right after the names — not under "Not shown"', () => {
  const list = makerStageList(PAGE);
  const keys = list.shown.map((t) => t.key);
  assert.deepEqual(keys.slice(0, 4), ['f:hero', 'f:greeting', 'f:pass', 'f:rsvp']);
  for (const t of ['greeting', 'qr_card', 'rsvp']) {
    assert.ok(!list.folded.some((f) => f.type === t), `${t} is still folded as "Not shown"`);
  }
});

test('B · each has a panel that is never blank — where it comes from, or its editor', () => {
  assert.match(fixedScenePanel('greeting').source?.text ?? '', /each guest sees their own/i);
  assert.match(fixedScenePanel('pass').source?.text ?? '', /each guest sees their own/i);
  assert.equal(fixedScenePanel('rsvp').button, 'Open RSVP editor');
});

test('B · the canvas draws them as "Your guest", with no sample content, and only in the Maker', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerGuestScenes } = await import('../app/[slug]/_components/maker-guest-scenes');
  const html = renderToStaticMarkup(
    React.createElement(MakerGuestScenes, {
      show: { greeting: true, pass: true, rsvp: true },
      eventDate: '2026-12-18',
      solemn: false,
      mark: (key: string) => React.createElement('span', { hidden: true, 'data-maker-section': key }),
    }),
  );
  for (const k of ['greeting', 'pass', 'rsvp']) {
    assert.match(html, new RegExp(`<span hidden="" data-maker-section="f:${k}"></span><section[^>]*data-maker-guest-scene="${k}"`), `${k}: not drawn right after its marker`);
  }
  assert.match(html, /Your guest/);
  assert.doesNotMatch(html, /Sample/i, 'the owner ruled out sample content');
  assert.match(BODY, /\{isMakerCanvas \? \(\s*<MakerGuestScenes/, 'drawn in the Maker canvas only');
});

/* ── N · the navigator's menu is one control ───────────────────────────── */

test('N · the tab row is ONE picker beside the palette — no wrapping pill row', () => {
  const nav = SHELL.slice(SHELL.indexOf('aria-label="Scenes"'), SHELL.indexOf('</nav>'));
  assert.match(nav, /<PickMenu\s+label="This stage's menu"\s+dataAttr="data-maker-tab-pick"/);
  assert.doesNotMatch(nav, /role="tab"/, 'the old pill row is back');
  assert.doesNotMatch(nav, /lg:flex-wrap/, 'a wrapping row is what grew to 140px');
  // It jumps; it never filters and never changes stage.
  const pick = nav.slice(nav.indexOf('onPick={(key) => {'), nav.indexOf('className="flex-1"'));
  assert.match(pick, /scrollPreviewTo\(t\.key\)/);
  assert.doesNotMatch(pick, /setStage|kind: 'tool'|return null/);
});

/* ── T · the toolbar collapses by measured overflow ────────────────────── */

test('T · the bar collapses only when its natural width does not fit', async () => {
  const { barShouldCollapse } = await import('../app/dashboard/[eventId]/launch/_components/maker-shell');
  assert.equal(barShouldCollapse(900, 1000), false);
  assert.equal(barShouldCollapse(1000, 1000), false);
  assert.equal(barShouldCollapse(1000.6, 1000), false, 'sub-pixel rounding is not overflow');
  assert.equal(barShouldCollapse(1080, 1000), true);
  assert.match(BAR, /new ResizeObserver\(check\)/, 'measured, not a breakpoint');
  // ONE picker since the owner's "combine them in 1 dropdown" (2026-09-27) —
  // `the-compact-maker-bar-is-one-picker.test.ts` holds its contents.
  assert.match(BAR, /data-maker-place-pick/);
  assert.doesNotMatch(BAR, /data-maker-stage-pick|data-maker-pages-pick/, 'the two pickers are back');
  // The picker runs the SAME onPress the buttons do.
  assert.equal((BAR.match(/const item = makerPlaceItem\(key, hasWork\);\s*if \(item\) onPress\(item\);/g) ?? []).length, 1);
});

/* ── The iframes the controller counted ────────────────────────────────── */

test('the Maker mounts ONE canvas iframe; the other src-less frames are the tiles’ live thumbnails, one per tile', () => {
  // Measured 862×539 = the canvas width at the 16:10 desktop tile ratio — the
  // thumbnail's layout box before its `transform: scale()`. Each tile reuses its
  // own frame when its copy changes, so saves do not add frames.
  assert.equal((SHELL.match(/<iframe\b/g) ?? []).length, 1, 'one canvas iframe in the shell');
  const PREVIEW = read('app/dashboard/[eventId]/website/editor/_components/scene-preview.tsx');
  assert.equal((PREVIEW.match(/<iframe\b/g) ?? []).length, 1);
  assert.match(PREVIEW, /srcDoc=\{srcDoc!\}/, 'the thumbnail is the src-less frame');
  assert.match(PREVIEW, /transform: `scale\(\$\{frame\.scale\}\)`/);
  assert.match(SHELL, /key=\{`\$\{stage\}:\$\{maker\.renderStamp\}:\$\{maker\.viewAsHref \?\? ''\}`\}/, 'the canvas is REPLACED on a save, never stacked');
});
