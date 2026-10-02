/**
 * every-preview-has-a-way-back.test.ts — DECISION_LOG 2026-09-28, *"EVERY
 * PREVIEW HAS A WAY BACK TO THE MAKER"*. Owner, verbatim: *"no way to get back.
 * event when we played the preview, it has no way to return to the event hub
 * maker"*.
 *
 * What this holds:
 *   1. THE GATE — a way back exists for a verified host's `?preview=draft` tab
 *      and for nothing else: not a guest, not the Maker's canvas (`?editor=1`),
 *      not a tile (`?theme=`) or a one-scene page (`?only=`).
 *   2. THE ADDRESS — it lands on the Maker at the same stage and scene, and a
 *      value that is not one of ours is dropped, never echoed into the link.
 *   3. THE MOUNT — `site-body.tsx` draws it only for the stage preview, from
 *      the page's verified answer, as a sibling of the chapters article.
 *   4. NO FRAME — the server HTML never carries it; after mount it draws only
 *      in its own tab (the Maker's Reveal page frames `?preview=draft` too).
 *   5. SAME VIEW — on a phone and in any installed shell the preview opens in
 *      the same view; only a desktop browser keeps the new tab.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { previewWayBackHref } from './editor-canvas';
import { previewCarriesPlace, previewOpensInSameView } from '@/lib/maker-preview-way-back';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = import.meta.dirname;
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const BODY = read('../_components/site-body.tsx');
const PAGE = read('../page.tsx');
const PLAY = read('../../dashboard/[eventId]/launch/_components/maker-play-menu.tsx');

const EVENT = 'evt-123';

test('THE GATE: a verified host on the preview tab gets a way back — and nobody else does', () => {
  const preview = { preview: 'draft', phase: 'rsvp' };
  assert.equal(previewWayBackHref(preview, EVENT, true), '/dashboard/evt-123/launch?stage=rsvp');
  // A guest (or a stranger typing the param) never passes the host check.
  assert.equal(previewWayBackHref(preview, EVENT, false), null, 'a guest must never see the way back');
  // The Maker's own canvas is already inside the Maker.
  assert.equal(previewWayBackHref({ editor: '1', phase: 'rsvp' }, EVENT, true), null, 'never in the canvas');
  assert.equal(previewWayBackHref({ editor: '1', preview: 'draft' }, EVENT, true), null, 'editor=1 wins');
  // Frames the Maker draws: a theme tile and a one-scene page.
  assert.equal(previewWayBackHref({ preview: 'draft', theme: 'house' }, EVENT, true), null, 'never in a tile');
  assert.equal(previewWayBackHref({ preview: 'draft', only: 'hero' }, EVENT, true), null, 'never in a one-scene page');
  // No param at all: the ordinary page.
  assert.equal(previewWayBackHref({}, EVENT, true), null);
  assert.equal(previewWayBackHref(undefined, EVENT, true), null);
});

test('THE ADDRESS: the same stage and scene — and nothing that is not ours', () => {
  assert.equal(
    previewWayBackHref({ preview: 'draft', phase: 'save_the_date', scene: 'a1B2-c3_d4' }, EVENT, true),
    '/dashboard/evt-123/launch?stage=save_the_date&scene=a1B2-c3_d4',
  );
  assert.equal(
    previewWayBackHref({ preview: 'draft', phase: 'editorial', tool: 'love-story' }, EVENT, true),
    '/dashboard/evt-123/launch?stage=editorial&tool=love-story',
  );
  // Unknown stage / hostile scene / unknown tool: dropped, not echoed.
  const hostile = previewWayBackHref(
    { preview: 'draft', phase: 'javascript:alert(1)', scene: '"><script>', tool: 'admin' },
    EVENT,
    true,
  );
  assert.equal(hostile, '/dashboard/evt-123/launch');
  // The Maker side writes the place in; anything it does not recognise adds nothing.
  const href = '/our-day?phase=rsvp&preview=draft';
  assert.equal(previewCarriesPlace(href, { kind: 'scene', id: 'w-1' }), `${href}&scene=w-1`);
  assert.equal(previewCarriesPlace(href, { kind: 'tool', key: 'reveal' }), `${href}&tool=reveal`);
  assert.equal(previewCarriesPlace(href, { kind: 'tool', key: 'post-event' }), href);
  assert.equal(previewCarriesPlace(href, { kind: 'main' }), href);
  assert.equal(previewCarriesPlace(href, null), href);
});

test('THE MOUNT: site-body draws it for the stage preview only, from the page’s verified answer', () => {
  const mounts = BODY.match(/<PreviewWayBack\b/g) ?? [];
  console.log(`  PreviewWayBack mounts in site-body: ${mounts.length}`);
  assert.equal(mounts.length, 1, 'exactly one mount');
  assert.match(
    BODY,
    /\{isStagePreview && makerWayBack \? <PreviewWayBack href=\{makerWayBack\} \/> : null\}/,
    'the mount is gated on the stage preview AND the verified address',
  );
  assert.match(BODY, /const isStagePreview = isEditorCanvas && !editorBridge;/, 'the stage preview is the verified host minus the canvas');
  assert.match(
    PAGE,
    /makerWayBack: previewWayBackHref\(search, event\.event_id, isEditorCanvas\)/,
    'page.tsx hands SiteBody the gate’s answer, keyed on the VERIFIED flag',
  );
  // A sibling of the trees, never inside the chapters article.
  const at = BODY.indexOf('<PreviewWayBack');
  const tree = BODY.indexOf("identity.kind === 'anonymous' ? anonymousTree(identity) : guestTree(identity)");
  assert.ok(at > 0 && tree > at, 'mounted beside the ribbon, before the tier fork — outside both trees');
});

test('NO FRAME: the server HTML never carries it, and a frame never draws it', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PreviewWayBack, PreviewWayBackLink, isTopWindow } = await import('../_components/preview-way-back');
  assert.equal(
    renderToStaticMarkup(React.createElement(PreviewWayBack, { href: '/dashboard/x/launch' })),
    '',
    'nothing before mount — a frame (the Maker’s Reveal page) never flashes it',
  );
  const a = {};
  assert.equal(isTopWindow({ self: a, top: a }), true, 'its own tab draws it');
  assert.equal(isTopWindow({ self: a, top: {} }), false, 'a frame does not');
  const throwing = Object.defineProperty({ self: a }, 'top', {
    get() {
      throw new Error('cross-origin');
    },
  }) as { self: unknown; top: unknown };
  assert.equal(isTopWindow(throwing), false, 'a cross-origin parent is a frame');

  const html = renderToStaticMarkup(React.createElement(PreviewWayBackLink, { href: '/dashboard/x/launch?stage=rsvp' }));
  assert.match(html, /href="\/dashboard\/x\/launch\?stage=rsvp"/);
  assert.match(html, /Back to the Maker/);
  assert.match(html, /min-h-11/, 'a 44px tap target');
  assert.match(html, /print:hidden/, 'never in a print');
  assert.doesNotMatch(html, /website/i, 'Event Hub words, never "website"');
});

test('SAME VIEW: a phone or an installed shell opens the preview in place; a desktop browser keeps the tab', () => {
  const desktop = { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/140', cookie: 'setnayan-client-type=web', standalone: false, narrow: false };
  assert.equal(previewOpensInSameView(desktop), false, 'desktop browser: a new tab');
  assert.equal(previewOpensInSameView({ ...desktop, narrow: true }), true, 'phone width: same view');
  assert.equal(previewOpensInSameView({ ...desktop, storeShell: true }), true, 'the Maker says store shell');
  assert.equal(
    previewOpensInSameView({ ...desktop, userAgent: 'Mozilla/5.0 (iPhone) SetnayanApp' }),
    true,
    'the App Store shell by its UA',
  );
  assert.equal(previewOpensInSameView({ ...desktop, cookie: 'a=b; setnayan-client-type=capacitor' }), true, 'capacitor cookie');
  assert.equal(previewOpensInSameView({ ...desktop, cookie: 'setnayan-client-type=tauri' }), true, 'the desktop app');
  assert.equal(previewOpensInSameView({ ...desktop, cookie: 'setnayan-client-type=pwa' }), true, 'an installed PWA');
  assert.equal(previewOpensInSameView({ ...desktop, standalone: true }), true, 'display-mode standalone');

  // The link itself: the tab is conditional, never unconditional.
  assert.doesNotMatch(PLAY, /target="_blank"/, 'no unconditional new tab left in the Play menu');
  assert.match(PLAY, /target=\{sameView \? undefined : '_blank'\}/);
  assert.match(PLAY, /href=\{href\}/);
  // ✂ The Maker in 4 (2026-10-02): the Preview link is a row of the toolbar's ⋯, drawn by the shell.
  const SHELL = read('../../dashboard/[eventId]/launch/_components/maker-shell.tsx');
  assert.match(SHELL, /href=\{previewCarriesPlace\(playHref, selection\)\}/, 'the preview carries the Maker’s place');
});
