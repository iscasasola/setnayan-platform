/**
 * 🔓 SWITCHED OFF 2026-11-14 (owner: "just remove that rule for everyone") — the tests below hold it off.
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

/* 🔓 The floor is switched OFF for everyone (owner 2026-11-14: "just remove that rule for everyone"), so the
   sentence is never drawn and the picker starts today. The field keeps its slot for the day it is switched back on. */

test('the floor is off: December 18, 2026 says nothing, for a normal account too', async () => {
  for (const d of ['2026-12-18', '2026-11-05', '2026-12-19']) {
    const html = await render(d, false);
    assert.ok(!html.includes(SAID), d);
  }
});

test('the founders’ account may pick any date — nothing is said', async () => {
  for (const d of ['2026-12-18', '2026-11-05']) {
    const html = await render(d, true);
    assert.ok(!html.includes(SAID), d);
  }
});

test('the picker no longer starts on December 19, 2026 for a normal account', async () => {
  const html = await render('', false);
  assert.doesNotMatch(html, /min="2026-12-19"/);
});
