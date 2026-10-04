/**
 * a-save-landing-here-is-shown-here.test.ts — every save that lands on the
 * Mood Board's own page with `?saved=1` / `?error=…` is SHOWN there.
 *
 * The Do's and Don'ts save (`updateDressCodeLists`) sends a coordinator or
 * planner back to `/studio/mood-board?error=…` when the write is refused, and
 * the page read neither param — a refused save looked exactly like a quiet one.
 *
 * Three things, none enough alone:
 *   1. THE RENDER — `<MoodBoardSaveNotice>` paints the error as an alert, a
 *      save as a status line, and nothing when there is nothing to say.
 *   2. THE MOUNT — the page reads `searchParams` and renders the notice from
 *      them (not from a literal).
 *   3. THE DOORS — every action in the app that redirects to this page with
 *      `?error=` or `?saved=` is found by scanning, so a new door that lands
 *      here is covered by (2) without anyone remembering this file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodBoardSaveNotice, readSaveNotice } from './_components/save-notice';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = __dirname;
const PAGE = path.join(HERE, 'page.tsx');
const APP = path.resolve(HERE, '../../../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

test('1 · the notice renders an error as an alert, a save as a status, and nothing otherwise', () => {
  const err = renderToStaticMarkup(
    React.createElement(MoodBoardSaveNotice, { saved: false, error: 'The dress code could not be read just now.' }),
  );
  assert.match(err, /role="alert"/);
  assert.match(err, /The dress code could not be read just now\./);

  const ok = renderToStaticMarkup(React.createElement(MoodBoardSaveNotice, { saved: true, error: null }));
  assert.match(ok, /role="status"/);
  assert.match(ok, /Saved/);

  // An error wins over a stale saved=1 — a refused save is never shown as saved.
  const both = renderToStaticMarkup(React.createElement(MoodBoardSaveNotice, { saved: true, error: 'Refused' }));
  assert.match(both, /role="alert"/);
  assert.doesNotMatch(both, /role="status"/);

  assert.equal(renderToStaticMarkup(React.createElement(MoodBoardSaveNotice, { saved: false, error: null })), '');
});

test('1b · the params read as the notice wants them', () => {
  assert.deepEqual(readSaveNotice({}), { saved: false, error: null });
  assert.deepEqual(readSaveNotice({ saved: '1' }), { saved: true, error: null });
  assert.deepEqual(readSaveNotice({ error: '  ' }), { saved: false, error: null });
  assert.deepEqual(readSaveNotice({ error: ['first', 'second'] }), { saved: false, error: 'first' });
});

test('2 · the Mood Board page renders the notice from its own searchParams', () => {
  const src = fs.readFileSync(PAGE, 'utf8');
  assert.match(src, /readSaveNotice\(await searchParams\)/, 'the page does not read ?saved / ?error');
  assert.match(
    src,
    /<MoodBoardSaveNotice saved=\{notice\.saved\} error=\{notice\.error\} \/>/,
    'the page does not render the notice from what it read',
  );
});

test('3 · every action that lands on this page with ?error= or ?saved= is one the page shows', () => {
  const doors: string[] = [];
  for (const file of walk(APP)) {
    const src = fs.readFileSync(file, 'utf8');
    // `${back}?error=` with back = …/studio/mood-board, or the literal path.
    const back = /const back = `\/dashboard\/\$\{eventId\}\/studio\/mood-board`;/.test(src);
    const literal = /\/studio\/mood-board\?(error|saved)=/.test(src);
    const viaBack = back && /\$\{back\}\?(error|saved)=/.test(src);
    if (literal || viaBack) doors.push(path.relative(APP, file));
  }
  // The detector can fire: the Do's and Don'ts save is such a door today.
  assert.ok(doors.length >= 1, 'found no action landing on the Mood Board page — the scan is blind');
  // Every such door is covered by test 2, because the page — not each door — shows the notice.
  assert.ok(fs.existsSync(PAGE));
});
