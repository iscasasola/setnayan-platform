/**
 * guest-bars-frame-the-slide.test.ts — owner 2026-09-26, verbatim: *"guest bars
 * should only show on the slide and not the actual whole stage openning. that
 * role is for the preview stage"*.
 *
 * Two host doors render the couple's page with no host chrome, and they have
 * two different jobs:
 *
 *   · THE MAKER'S CANVAS (`?editor=1`) — the scenes, one after another, to edit.
 *     Its "Guest bars" switch puts the guest's header and tab bar over whichever
 *     SLIDE is in view. It must never play the stage's opening (the reveal), the
 *     full-screen film takeover, or the hand-over to the page — a Guest bars tap
 *     reloads the canvas, and every reload used to replay all three.
 *   · "PREVIEW THE WHOLE STAGE" (`?preview=draft`, a new tab) — the complete
 *     guest experience: the guest's bars, the opening, the film, Auto.
 *
 * Held here: RENDERED (the handoff and the film in each mode) and SOURCE (which
 * door each gate follows), plus the Maker's own half — a canvas reload returns
 * to the scene being edited, and "Play the opening" opens the preview tab.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const read = (rel: string) => stripComments(readFileSync(join(import.meta.dirname, rel), 'utf8'));
const BODY = read('../app/[slug]/_components/site-body.tsx');

test('the two doors are told apart once: the canvas is `editor=1`, the preview is the host door without it', () => {
  assert.match(BODY, /const isMakerCanvas = isEditorCanvas && editorBridge;/);
  assert.match(BODY, /const isStagePreview = isEditorCanvas && !editorBridge;/);
});

test('guest bars: on for guests, on in the preview tab, and in the canvas ONLY when its switch is on', () => {
  assert.match(BODY, /const showGuestBars = !isEditorCanvas \|\| canvasGuestBars \|\| isStagePreview;/);
  // the logic, row by row
  const bars = (isEditorCanvas: boolean, editorBridge: boolean, canvasGuestBars: boolean) =>
    !isEditorCanvas || canvasGuestBars || (isEditorCanvas && !editorBridge);
  assert.equal(bars(false, false, false), true, 'a guest has bars');
  assert.equal(bars(true, false, false), true, 'the preview tab has the guest’s bars');
  assert.equal(bars(true, true, false), false, 'the canvas has none by default');
  assert.equal(bars(true, true, true), true, 'the canvas has them when its switch is on');
});

test('the stage OPENING plays for guests and the preview tab — never in the Maker’s canvas', () => {
  assert.match(BODY, /enabled=\{plan\.revealEnabled && !isMakerCanvas\}/);
  // the host's try-before-you-buy opening still plays in the preview tab
  assert.match(BODY, /hostTrial=\{isEditorCanvas\}/);
  const bars = BODY.slice(BODY.indexOf('<RevealOverlayServer'), BODY.indexOf('/>', BODY.indexOf('<RevealOverlayServer')));
  assert.doesNotMatch(bars, /canvasGuestBars|showGuestBars/, 'the Guest bars switch must never turn the opening on');
});

test('the film: a slide in the canvas, the full stage everywhere else — and Guest bars cannot change that', () => {
  assert.match(BODY, /asSlide=\{isMakerCanvas\}\s*autoplay=\{!isMakerCanvas\}/);
  assert.match(BODY, /slide=\{isMakerCanvas\}/);
  const film = BODY.slice(BODY.indexOf('<StdFilmHandoff'), BODY.indexOf('</StdFilmHandoff>'));
  assert.doesNotMatch(film, /canvasGuestBars|showGuestBars/);
});

test('RENDERED: the handoff draws the film as the first slide in the canvas, and the takeover elsewhere', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const mod = await import('../app/[slug]/_components/std-film-handoff');
  const StdFilmHandoff = (mod as { StdFilmHandoff?: typeof mod.StdFilmHandoff }).StdFilmHandoff
    ?? (mod as unknown as { default: typeof mod }).default.StdFilmHandoff;
  const film = React.createElement('div', { 'data-the-film': '' }, 'FILM');
  const page = React.createElement('p', null, 'THE-PAGE');
  const marker = React.createElement('span', { hidden: true, 'data-maker-section': 'f:film' });

  type HandoffProps = React.ComponentProps<typeof StdFilmHandoff>;
  const canvas = renderToStaticMarkup(
    React.createElement(StdFilmHandoff, { film, marker, asSlide: true } as HandoffProps, page),
  );
  assert.ok(canvas.indexOf('data-maker-section="f:film"') < canvas.indexOf('data-the-film'), 'the handle sits before the film');
  assert.ok(canvas.indexOf('data-the-film') < canvas.indexOf('THE-PAGE'), 'in the canvas the film is the first slide, above the page');
  assert.match(canvas, /<span hidden="" data-maker-section="f:film"><\/span><div data-the-film="">/, 'the handle’s next element IS the film');

  const guest = renderToStaticMarkup(
    React.createElement(StdFilmHandoff, { film, marker, autoplay: true } as HandoffProps, page),
  );
  assert.ok(guest.indexOf('THE-PAGE') < guest.indexOf('data-the-film'), 'for a guest the film is the takeover over the page');
  assert.match(guest, /<span hidden="" data-maker-section="f:film"><\/span><div data-the-film="">/, 'the handle points at the film there too');
});

test('RENDERED: the Save-the-Date film in the canvas is a slide in the page’s flow, not a full-screen layer', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const mod = await import('../app/[slug]/_components/save-the-date');
  const SaveTheDateView = (mod as { SaveTheDateView?: typeof mod.SaveTheDateView }).SaveTheDateView
    ?? (mod as unknown as { default: typeof mod }).default.SaveTheDateView;
  const props = {
    displayName: 'Cale & Ice',
    dateIso: '2026-12-18',
    venueName: 'Sample Garden',
    venueAddress: 'Tagaytay',
    publicId: 'S89E-SAMPLE0001',
    showTextHero: false,
    film: true,
    themeId: 'botanical',
  };
  const slide = renderToStaticMarkup(React.createElement(SaveTheDateView, { ...props, slide: true }));
  const stage = renderToStaticMarkup(React.createElement(SaveTheDateView, props));
  assert.match(slide, /data-std-slide=""/);
  assert.doesNotMatch(slide, /fixed inset-0 z-\[50\]/, 'the canvas film must not cover the canvas');
  assert.match(stage, /fixed inset-0 z-\[50\]/, 'guests still get the full-screen film');
  assert.doesNotMatch(stage, /data-std-slide/);
});

test('the Maker: a canvas reload returns to the scene being edited, and "Play the opening" opens the preview tab', () => {
  const SHELL = read('../app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  const ready = SHELL.slice(SHELL.indexOf("data.t !== 'ready'"), SHELL.indexOf("window.addEventListener('message', onReady)"));
  assert.match(ready, /const key = selectedKeyRef\.current;/);
  assert.match(ready, /t: 'scrollTo', key/, 'after a reload (a Guest bars tap among them) the canvas goes back to the selected scene');
  const REVEAL = read('../app/dashboard/[eventId]/launch/_components/maker-reveal.tsx');
  assert.match(REVEAL, /window\.open\(`\$\{path\}\?phase=save_the_date&preview=draft`, '_blank', 'noopener'\)/);
  assert.doesNotMatch(REVEAL, /location\.reload\(\)/, 'the opening no longer replays by reloading the canvas');
});
