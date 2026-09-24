/**
 * readout.test.ts — A READ THAT FAILED IS NOT A ZERO.
 *
 * `<Readout value={null}>` must say it could not load, and must never print
 * `0` or `₱0` — the fail-soft that told a couple "₱0 committed" against a real
 * budget and a supplier "Paid ₱0" (house rule; see
 * `app/vendor-dashboard/reads-are-honest.test.ts`). A MEASURED zero must still
 * print as 0: honesty cuts both ways.
 *
 * 🛡 Sabotage (watched go red before this shipped): change `readoutDisplay`'s
 * null branch to `value ?? 0` → the first two tests fail.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { formatPhp } from '@/lib/php';

(globalThis as unknown as { React: unknown }).React = React;

const load = () => import('./readout');

test('null renders a failed dash — never 0, never ₱0', async () => {
  const { readoutDisplay } = await load();
  for (const format of ['count', 'php'] as const) {
    const shown = readoutDisplay(null, format);
    assert.equal(shown.failed, true);
    assert.equal(shown.text, '—');
    assert.doesNotMatch(shown.text, /0/, `${format}: a failed read printed a zero`);
  }
  // NaN / Infinity are failed measurements too, not figures.
  assert.equal(readoutDisplay(Number.NaN).failed, true);
  assert.equal(readoutDisplay(Number.POSITIVE_INFINITY, 'php').failed, true);
});

test('the rendered Readout says it could not load, and shows no zero', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Readout } = await load();
  const html = renderToStaticMarkup(
    React.createElement(Readout, { value: null, label: 'Committed', format: 'php' }),
  );
  assert.match(html, /Couldn(’|&#x27;|&rsquo;|')t load/);
  assert.match(html, /data-failed="true"/);
  assert.doesNotMatch(html, /₱0|>0</, 'a failed read rendered as a zero');
  assert.match(html, /class="sn-eye">Committed</, 'the micro-label is the house eyebrow');
  assert.doesNotMatch(html, /<header/, 'a Readout never brings its own <header> (lint:masthead)');
});

test('a MEASURED zero still prints 0 — null and 0 are different claims', async () => {
  const { readoutDisplay } = await load();
  assert.deepEqual(readoutDisplay(0), { text: '0', failed: false });
  assert.deepEqual(readoutDisplay(0, 'php'), { text: formatPhp(0), failed: false });
});

test('money goes through the one peso formatter, centavos intact', async () => {
  const { readoutDisplay } = await load();
  // The owner's own row (PR #5744): ₱837.50 must never print as ₱838.
  assert.equal(readoutDisplay(837.5, 'php').text, formatPhp(837.5));
  assert.equal(readoutDisplay(837.5, 'php').text, '₱837.50');
  assert.equal(readoutDisplay(1234).text, '1,234');
});

test('with info, the (i) sits beside the visible label', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Readout } = await load();
  const html = renderToStaticMarkup(
    React.createElement(Readout, { value: 180, label: 'Guests', info: 'Everyone invited.' }),
  );
  assert.match(html, /class="sn-eye">Guests</);
  assert.match(html, /aria-label="About Guests"/);
  assert.match(html, />180</);
});
