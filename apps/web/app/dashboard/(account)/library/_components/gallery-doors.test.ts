/**
 * gallery-doors.test.ts — Memories gives every HOSTED event a door into its
 * Gallery, whether or not the event has Papic.
 *
 * Owner 2026-10-02 (DECISION_LOG "MEMORIES LISTS EVERY EVENT WITH ITS
 * GALLERY"). The failure this guards is silent: Memories renders fine with no
 * Gallery link at all, and an event without Papic then has no normal door to
 * its photos.
 *
 * RENDER-LEVEL: the component is rendered to HTML and the markup is read, so a
 * comment or an unused export cannot satisfy it. The fixture carries NO Papic
 * field of any kind — the door must not depend on one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GalleryDoors, type GalleryDoorEvent } from './gallery-doors';

// tsx compiles the component with the classic JSX runtime (tsconfig keeps JSX
// as `preserve` for Next), which reads a global `React` at render time.
(globalThis as { React?: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const SHELF = strip(readFileSync(resolve(HERE, 'album-shelf.tsx'), 'utf8'));
const DOORS_SRC = strip(readFileSync(resolve(HERE, 'gallery-doors.tsx'), 'utf8'));

const hostNoPapic: GalleryDoorEvent = {
  event_id: 'ev-host-no-papic',
  display_name: 'Mae and Jun',
  role: 'couple',
};
const attended: GalleryDoorEvent = {
  event_id: 'ev-attended',
  display_name: 'Someone Else’s Wedding',
  role: 'guest',
};

const render = (events: GalleryDoorEvent[]) =>
  renderToStaticMarkup(createElement(GalleryDoors, { events }));

test('a host’s event with no Papic still shows a Gallery door to its gallery', () => {
  const html = render([hostNoPapic]);
  assert.ok(
    html.includes('href="/dashboard/ev-host-no-papic/galleries"'),
    'Memories shows no way into the Gallery for a hosted event without Papic.',
  );
  assert.ok(html.includes('Mae and Jun'), 'The row must name the event.');
});

test('an event the person only attends gets no Gallery door', () => {
  const html = render([hostNoPapic, attended]);
  assert.equal(html.includes('ev-attended'), false, 'Hosts only — attended events are not listed.');
});

test('no hosted events renders nothing', () => {
  assert.equal(render([attended]), '');
});

test('each row is one tap target at least 44px tall', () => {
  const html = render([hostNoPapic]);
  const anchors = html.match(/<a [^>]*>/g) ?? [];
  assert.equal(anchors.length, 1, 'One link per event row.');
  assert.ok(/\bmin-h-(11|12|14)\b/.test(anchors[0]), 'The row link must carry min-h-11 or taller (44px).');
});

test('the door is not gated on Papic, and says supplier-safe plain words', () => {
  assert.equal(/papic/i.test(DOORS_SRC), false, 'The door must not know about Papic.');
  assert.equal(/\b(website|site|vendor)\b/i.test(render([hostNoPapic])), false);
});

test('the shelf mounts the doors from the same event list', () => {
  assert.ok(/<GalleryDoors events=\{/.test(SHELF), 'GalleryDoors is not mounted on Memories.');
});
