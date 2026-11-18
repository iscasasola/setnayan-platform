/**
 * event-stories-read-is-honest.test.ts — Discover's Event stories shelf (part 4) and "reads are honest".
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * The shelf already had a "couldn't load" line for `stories === null` — and nothing ever handed it `null`. The
 * front door read the published editorials with `loadPublishedShowcases(24)`, which turns ANY refused step into `[]`,
 * and passed `data.stories` straight through. So a failed read drew
 *
 *   "The first event stories will land right here."
 *
 * BYTE-IDENTICAL to a platform where no couple has shared yet. The same disease `lib/guests-read-is-honest.test.ts`
 * closed for the guest list ("No guests yet" to a couple with 180 names), and the same three rules:
 *   1 · the read reports whether it ANSWERED (`loadPublishedShowcasesResult().ok` → `editorialsMeasured`);
 *   2 · the flag reaches the RENDER — a log line never changed a pixel;
 *   3 · an error is not empty: `null` draws the error line, `[]` draws the empty line, and they differ.
 *
 * Comments are stripped through the real lexer so a docblock that NAMES a rule can never satisfy it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { eventStoriesShelfInput } from '@/lib/discover-six-parts';

// The components compile with the classic JSX runtime under tsx — the house idiom (an-empty-shelf-is-one-line).
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(import.meta.dirname, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── 1 · the measurement ─────────────────────────────────────────────────────

test('a REFUSED read hands the shelf null — not an empty list', () => {
  assert.equal(eventStoriesShelfInput([], false), null, 'a refusal must be reported, not swallowed');
  // Partial rows of a refused read are not the truth either — the shelf says it could not load.
  assert.equal(eventStoriesShelfInput([{ href: '/e/a' }], false), null, 'partial rows passed off as the whole shelf');
});

test('a SUCCESSFUL empty read hands the shelf [] — genuinely none shared', () => {
  assert.deepEqual(eventStoriesShelfInput([], true), [], 'a real empty shelf is a fact, and may be stated');
  const rows = [{ href: '/e/a' }];
  assert.equal(eventStoriesShelfInput(rows, true), rows, 'a measured read passes its rows through untouched');
});

// ── 2 · the render ──────────────────────────────────────────────────────────

test('the two cases DRAW differently — which is the entire point', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EventStoriesShelf } = await import('./discover-six-parts');
  const refused = renderToStaticMarkup(
    React.createElement(EventStoriesShelf, { stories: eventStoriesShelfInput([], false) }),
  );
  const genuine = renderToStaticMarkup(
    React.createElement(EventStoriesShelf, { stories: eventStoriesShelfInput([], true) }),
  );
  assert.match(refused, /Stories couldn’t load/, 'a failed read must say it could not load');
  assert.doesNotMatch(refused, /land right here/, 'a failed read is drawn as an empty shelf');
  assert.match(genuine, /The first event stories will land right here/, 'a real empty shelf lost its line');
  assert.notEqual(refused, genuine, 'a failure renders identically to emptiness');
});

// ── 3 · the wiring — the flag must travel from the read to the shelf ────────

test('the front door reads the editorials MEASURED and carries the flag', () => {
  const DATA = src('app/_components/frontdoor/data.ts');
  assert.match(DATA, /loadPublishedShowcasesResult\(24\)/, 'the editorials read cannot say whether it answered');
  assert.doesNotMatch(DATA, /\bloadPublishedShowcases\(/, 'the array-only read is back — it turns a refusal into []');
  assert.match(DATA, /editorialsMeasured:\s*showcasesRaw\.ok\b/, 'the measurement never leaves the loader');
});

test('the Event stories shelf is handed the measurement, never the bare array', () => {
  const DOOR = src('app/_components/frontdoor/front-door.tsx');
  const shelves = DOOR.match(/<EventStoriesShelf\b[^>]*\/>/g) ?? [];
  assert.equal(shelves.length, 1, `expected one Event stories shelf, found ${shelves.length}`);
  assert.match(
    shelves[0]!,
    /stories=\{eventStoriesShelfInput\(data\.stories,\s*data\.editorialsMeasured\)\}/,
    'the shelf is handed data.stories without asking whether the read answered',
  );
});
