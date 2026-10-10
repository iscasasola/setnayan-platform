import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/* `tsx --test` compiles a `.tsx` component to the classic runtime (bare `React.createElement`), so React is put in
   scope BEFORE the component is loaded — as `hub-stage-renders.test.ts` does. */
(globalThis as unknown as { React: unknown }).React = React;
const load = () => import('./slug-field');

/**
 * 🔤 THE EVENT HUB'S ADDRESS IS CALLED ITS ADDRESS, AND ITS CHECK IS A CHECK (the walk of 2026-10-11, P08).
 *
 * Studio › Info › More for guests showed a couple "SLUG", "Save slug", "That's your current slug", "3–32 chars…"
 * under the Maker's own heading "Event Hub address"; and "Your page is private … make your wedding page public …
 * Preview your page" (a 138 × 20 px link) beside it. Opening the section also logged
 * "Pattern attribute value [a-z0-9-]{3,32} is not a valid regular expression" — browsers compile `pattern` with the
 * `v` flag, a bare hyphen in a class is an error there, and the browser DROPS the check (measured:
 * `validity.patternMismatch` was false for "AB!").
 */

const APP = join(process.cwd(), 'app');
const visible = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('the field is drawn in plain words — no "slug", no "chars"', async () => {
  const { SlugField } = await load();
  const html = renderToStaticMarkup(createElement(SlugField, { eventId: 'e', initialSlug: 'maria-and-jose', saveAction: async () => {} }));
  const words = visible(html);
  assert.match(words, /Address/);
  assert.match(words, /Save address/);
  assert.match(words, /3 to 32 characters: small letters, numbers and hyphens\. Old links keep working for/);
  assert.doesNotMatch(words, /slug|chars\b|lowercase|redirect/i, `developer words are shown: ${words}`);
  /* The two lines the field says as it checks. */
  const src = readFileSync(join(APP, 'dashboard', '[eventId]', 'invitation', '_components', 'slug-field.tsx'), 'utf8');
  assert.match(src, />Available — tap Save address to keep it\.</);
  assert.match(src, />This is your address now\.</);
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ''), />[^<{]*\bslug\b[^<{]*</i, 'a line of the field still says "slug"');
});

test('the format check is one the browser can run', async () => {
  const { SLUG_INPUT_PATTERN, SlugField } = await load();
  /* As the browser compiles it: anchored, with the `v` flag. The old value throws right here. */
  assert.throws(() => new RegExp('^(?:[a-z0-9-]{3,32})$', 'v'), /Invalid character class/);
  const check = new RegExp(`^(?:${SLUG_INPUT_PATTERN})$`, 'v');
  for (const ok of ['maria-and-jose', 'abc', 'a1-b2', 'a'.repeat(32)]) assert.equal(check.test(ok), true, ok);
  for (const no of ['AB!', 'ab', 'a'.repeat(33), 'maria and jose', 'maría']) assert.equal(check.test(no), false, no);
  /* …and it is the same shape the server enforces (`invitation/actions.ts`). */
  const server = /^[a-z0-9-]{3,32}$/;
  for (const s of ['maria-and-jose', 'ab', 'AB!', '---', 'a_b']) assert.equal(check.test(s), server.test(s), s);
  const html = renderToStaticMarkup(createElement(SlugField, { eventId: 'e', initialSlug: 'x', saveAction: async () => {} }));
  assert.match(html, /pattern="\[a-z0-9\\-\]\{3,32\}"/);
  /* No other field in the app carries the bare-hyphen class. */
  assert.doesNotMatch(readFileSync(join(APP, 'admin', 'corrections', 'page.tsx'), 'utf8'), /pattern="\[a-z0-9-\]/);
});

test('Go live says "Event Hub", and its preview link is a finger tall', () => {
  const src = readFileSync(join(APP, 'dashboard', '[eventId]', 'studio', 'save-the-date', '_components', 'launch-std-button.tsx'), 'utf8');
  const jsx = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\*|\/\/).*$/gm, '');
  assert.doesNotMatch(jsx, /your page|wedding page|Your page/, 'the guest page is called a "page" again');
  for (const line of ['Your Event Hub is private', 'to make your Event Hub public — now, or at a time you choose.', 'Make your Event Hub public now?', 'Preview your Event Hub', 'your Event Hub is live.', 'View your Event Hub', 'Your Event Hub becomes public on'])
    assert.ok(jsx.includes(line), `missing: ${line}`);
  assert.match(src, /className="inline-flex min-h-11 items-center gap-1\.5 text-sm font-medium text-terracotta[^"]*"\s*>\s*<Eye[^>]*\/>\s*Preview your Event Hub/);
});
