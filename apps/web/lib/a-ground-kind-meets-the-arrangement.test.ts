/**
 * WHERE #5934'S GROUND KINDS MEET #5948'S ARRANGEMENTS.
 *
 * The two were built apart: #5934 (photo · snippet · colour) was silently
 * reverted by the #5937 merge before #5948 added `hubPhotoPlacement`
 * (behind · beside · none), so neither suite ever saw the other. The restore
 * had to decide the crossing; this pins what it decided.
 *
 *   colour  → behind in EVERY arrangement. It is the ground, not a picture:
 *             nothing to put beside the words, nothing to hide under
 *             "Words only".
 *   snippet → behind under left / right. The beside column is a still-picture
 *             layer painted from `--hub-media`, which a snippet never sets.
 *   none    → no `hub-bg-*` class, so a snippet's frame-level scrim can never
 *             wash over words with no video under them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { PUBLIC_R2_BUCKET } from './r2-client-ref';
import { HUB_ARRANGEMENTS, hubCanvasClass, hubPhotoPlacement } from './hub-canvas';

// The frame compiles to classic `React.createElement` under tsx.
(globalThis as unknown as { React: unknown }).React = React;

const REF = `r2://${PUBLIC_R2_BUCKET}/events/E1/clip.mp4`;
const cls = (c: Parameters<typeof hubCanvasClass>[0], m: boolean) => hubCanvasClass(c, m).split(' ');

test('a colour paints behind in every arrangement', () => {
  for (const arrangement of HUB_ARRANGEMENTS) {
    const c = { kind: 'color' as const, color: '#a9834b', arrangement };
    assert.equal(hubPhotoPlacement(c, true), 'behind', arrangement);
    assert.ok(cls(c, true).includes('hub-bg-color'), `${arrangement}: the colour class`);
    assert.ok(!cls(c, true).includes('hub-photo-beside'), `${arrangement}: never a beside column`);
  }
});

test('a snippet stays behind under left / right — at the PLACEMENT level, unaffected by screening', () => {
  for (const arrangement of ['left', 'right'] as const) {
    assert.equal(hubPhotoPlacement({ kind: 'snippet', media: REF, arrangement }, true), 'behind');
  }
});

/**
 * SEC-6 (Event Hub Maker Phase 4) — `HubCanvasFrame` closes the snippet
 * bypass this test used to assume open. A snippet's ONLY source is the
 * couple's `landing_page_hero_video_r2_key` (`setWidgetBackground`'s own
 * docblock), the same unscreened clip `GUEST_HERO_VIDEO_PLAYBACK`/
 * `heroVideoRefForGuests` keeps off every other guest surface — so
 * `HubCanvasFrame` now gates it identically. While the flag is CLOSED (it is,
 * today: `lib/guest-hero-video.ts`), no snippet reaches a guest `<video>` at
 * all, however valid its signed URL — it renders exactly like a ref whose
 * signing failed: no video, no empty still-picture column either.
 */
test('a snippet does NOT draw its video while hero-video playback is closed (SEC-6)', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubCanvasFrame } = await import('../app/[slug]/_components/hub-canvas-frame');
  const { GUEST_HERO_VIDEO_PLAYBACK } = await import('./guest-hero-video');
  assert.equal(GUEST_HERO_VIDEO_PLAYBACK, false, 'this test documents behaviour while the flag is closed');
  const Frame = HubCanvasFrame as unknown as React.FunctionComponent<Record<string, unknown>>;
  const html = renderToStaticMarkup(
    React.createElement(
      Frame,
      {
        widget: { widget_id: 'W', event_id: 'E', widget_type: 'custom_1', config_json: { canvas: { media: REF, kind: 'snippet', arrangement: 'left' } } },
        mediaUrls: { [REF]: 'https://example.test/clip.mp4' },
      },
      React.createElement('p', null, 'words'),
    ),
  );
  assert.doesNotMatch(html, /<video/, 'the unscreened snippet must not reach a guest <video>');
  assert.doesNotMatch(html, /hub-canvas-photo/, 'no empty still-picture column either');
  assert.match(html, /hub-no-media/, 'falls back exactly like a ref whose signing failed');
});

test('nothing drawn means no ground class — the snippet scrim needs its video', () => {
  const words = cls({ kind: 'snippet', media: REF, arrangement: 'text' }, true);
  assert.ok(words.includes('hub-no-media'));
  assert.ok(!words.some((c) => c.startsWith('hub-bg-')), `words only claimed a ground: ${words}`);
  const unsigned = cls({ kind: 'snippet', media: REF }, false);
  assert.ok(!unsigned.some((c) => c.startsWith('hub-bg-')), `an unsigned snippet claimed a ground: ${unsigned}`);
});
