/**
 * the-private-page-line-is-one-string.test.ts — ✂ "THIS EVENT’S PAGE IS PRIVATE", WITH NO SEAM TO SPACE.
 *
 * Owner walk 2026-11-27 (MASTER-PLAN B9): the private Event Hub read "This event ’s page". Written as
 * `This {word}&rsquo;s page`, the line was three text nodes, and a browser's own translate or a chat app's reader
 * spaces nodes apart. The line is one string now — and so is its sibling on the Story.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { privatePageLine } from './_lib/private-page-line';

test('the line is one string, the word joined to its apostrophe', () => {
  assert.equal(privatePageLine('event'), 'This event’s page is private');
  assert.equal(privatePageLine('wedding '), 'This wedding’s page is private');
});

test('no guest line splits a word from its ’s across text nodes', () => {
  for (const rel of ['_components/private-landing.tsx', '_components/editorial/editorial-content.tsx']) {
    const src = readFileSync(join(__dirname, rel), 'utf8');
    assert.doesNotMatch(src, /(?<!\$)\{[\w.]+\}(?:&rsquo;|’)s\b/, `${rel}: a {word}’s split across text nodes again`);
  }
});
