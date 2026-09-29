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
 * SEC-6 → OWNER 2026-09-29 (*"make it move"*): a SCENE clip now plays for
 * guests through its own switch (`GUEST_SCENE_CLIP_PLAYBACK`), while the hero's
 * own clip switch stays closed. Held both ways: open, the guest frame draws the
 * clip BEHIND the words (never in a still-picture column, even under
 * left / right); closed (`sceneClipsOpen: false`), it draws nothing — exactly
 * like a ref whose signing failed.
 */
test('a snippet draws its video behind the words (scene switch open) — and nothing when it is closed', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubCanvasFrame } = await import('../app/[slug]/_components/hub-canvas-frame');
  const { GUEST_HERO_VIDEO_PLAYBACK, GUEST_SCENE_CLIP_PLAYBACK } = await import('./guest-hero-video');
  const { sceneGround } = await import('./scene-ground');
  assert.equal(GUEST_HERO_VIDEO_PLAYBACK, false, 'the hero clip switch stays closed');
  assert.equal(GUEST_SCENE_CLIP_PLAYBACK, true, 'the scene clip switch is open (owner 2026-09-29)');
  const Frame = HubCanvasFrame as unknown as React.FunctionComponent<Record<string, unknown>>;
  const canvas = { media: REF, kind: 'snippet', arrangement: 'left' };
  const html = renderToStaticMarkup(
    React.createElement(
      Frame,
      {
        widget: { widget_id: 'W', event_id: 'E', widget_type: 'custom_1', config_json: { canvas } },
        mediaUrls: { [REF]: 'https://example.test/clip.mp4' },
      },
      React.createElement('p', null, 'words'),
    ),
  );
  assert.match(html, /<video[^>]*class="hub-canvas-media"/, 'the clip is the background');
  assert.doesNotMatch(html, /hub-canvas-photo/, 'never a still-picture column');
  const closed = sceneGround({ config_json: { canvas } }, { [REF]: 'https://example.test/clip.mp4' }, { sceneClipsOpen: false });
  assert.equal(closed.mediaUrl, null, 'closed: falls back exactly like a ref whose signing failed');
  assert.equal(closed.painted, false);
});

test('nothing drawn means no ground class — the snippet scrim needs its video', () => {
  const words = cls({ kind: 'snippet', media: REF, arrangement: 'text' }, true);
  assert.ok(words.includes('hub-no-media'));
  assert.ok(!words.some((c) => c.startsWith('hub-bg-')), `words only claimed a ground: ${words}`);
  const unsigned = cls({ kind: 'snippet', media: REF }, false);
  assert.ok(!unsigned.some((c) => c.startsWith('hub-bg-')), `an unsigned snippet claimed a ground: ${unsigned}`);
});
