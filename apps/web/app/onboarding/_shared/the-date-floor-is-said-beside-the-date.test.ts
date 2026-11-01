/**
 * 💍 THE FIRST-EVENT-DAY RULE IS SAID BESIDE THE DATE (owner 2026-11-01,
 * DECISION_LOG "NO EVENT BEFORE DECEMBER 19, 2026"; `lib/event-date-floor.ts`).
 *
 * The real "When" field (`NeedsStep`, the Simple Event and every typed
 * onboarding's one-screen shape), painted: a normal account that picks
 * December 18, 2026 reads the owner's sentence UNDER that field; December 19
 * says nothing; the founders' account says nothing for any day. The picker
 * itself starts on December 19 for a normal account.
 *
 * 🪤 `globalThis.React` before the dynamic import (tsconfig `jsx: preserve`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { EVENT_DATE_FLOOR_MESSAGE } from '@/lib/event-date-floor';
import { needRows, needsForPreset } from '@/lib/event-needs';

(globalThis as unknown as { React: unknown }).React = React;

async function render(value: string, dateExempt: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { NeedsStep } = await import('./needs-step');
  const scope = { marketplace: false };
  return renderToStaticMarkup(
    React.createElement(NeedsStep, {
      title: 'New get-together',
      limitLine: null,
      name: 'Barkada night',
      onName: () => {},
      where: '',
      onWhere: () => {},
      when: { value, onChange: () => {}, dateExempt },
      preset: 'simple',
      onPreset: () => {},
      needs: needsForPreset('simple', scope),
      rows: needRows(scope),
      onToggle: () => {},
      cta: null,
    }),
  );
}

/** The owner's sentence as React escapes it into HTML. */
const SAID = EVENT_DATE_FLOOR_MESSAGE.replace(/'/g, '&#x27;');

test('a normal account picking December 18, 2026 reads the owner’s words beside the date', async () => {
  const html = await render('2026-12-18', false);
  assert.ok(html.includes(SAID), 'the refusal is not drawn beside the When field');
  assert.match(html, /data-event-date-floor/);
});

test('December 19, 2026 is allowed — nothing is said', async () => {
  const html = await render('2026-12-19', false);
  assert.ok(!html.includes(SAID));
});

test('the founders’ account may pick any date — nothing is said', async () => {
  for (const d of ['2026-12-18', '2026-11-05']) {
    const html = await render(d, true);
    assert.ok(!html.includes(SAID), d);
  }
});

test('the picker starts on December 19, 2026 for a normal account', async () => {
  const html = await render('', false);
  // Until that day passes, the floor IS the first pickable day.
  if (new Date().toISOString().slice(0, 10) < '2026-12-19') assert.match(html, /min="2026-12-19"/);
});
