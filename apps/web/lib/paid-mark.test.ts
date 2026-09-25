/**
 * paid-mark.test.ts — the mark FOLLOWS THE ENTITLEMENT, and the store shell
 * rule holds.
 *
 * Owner (2026-09-25): padlock while a paid part is locked, diamond once it is
 * unlocked. The failure this guards is the one `lib/event-hub-pro.ts` warns
 * about: a mark that can only ever answer one way renders exactly like a mark
 * that works. So every case below is asserted in BOTH directions — an owning
 * couple must get the diamond, not merely a non-owning couple the padlock —
 * and the real Maker surfaces are PAINTED, not grepped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { paidMarkLabel, paidMarkState } from './paid-mark';

(globalThis as unknown as { React: unknown }).React = React;

const count = (html: string, needle: string) => html.split(needle).length - 1;

test('paidMarkState: owned is a diamond everywhere; not-owned is a padlock, absent in the store shell', () => {
  assert.equal(paidMarkState({ owns: true }), 'unlocked');
  assert.equal(paidMarkState({ owns: true, storeShell: true }), 'unlocked', 'an owned mark is not a purchase hint');
  assert.equal(paidMarkState({ owns: false }), 'locked');
  assert.equal(paidMarkState({ owns: false, storeShell: true }), null, 'no padlock in the app-store shell');
});

test('paidMarkLabel names the state for a screen reader', () => {
  assert.match(paidMarkLabel('locked', 'Event Hub Pro'), /^Locked .*Event Hub Pro/);
  assert.match(paidMarkLabel('unlocked', 'Event Hub Pro'), /^Unlocked .*Event Hub Pro/);
});

test('PaidMark draws a padlock when locked and a diamond when unlocked', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PaidMark } = await import('../app/_components/paid-mark');
  const locked = renderToStaticMarkup(React.createElement(PaidMark, { state: 'locked', label: 'L' }));
  const unlocked = renderToStaticMarkup(React.createElement(PaidMark, { state: 'unlocked', label: 'U', text: 'Pro' }));
  console.log(`[paid-mark] locked=${locked.length}b unlocked=${unlocked.length}b`);
  assert.match(locked, /data-paid-mark="locked"/);
  assert.match(locked, /lucide-lock/);
  assert.doesNotMatch(locked, /lucide-gem/);
  assert.match(locked, /aria-label="L"/);
  assert.match(unlocked, /data-paid-mark="unlocked"/);
  assert.match(unlocked, /lucide-gem/);
  assert.doesNotMatch(unlocked, /lucide-lock/);
  assert.match(unlocked, />Pro</, 'the optional word sits beside the mark');
});

async function paintPrints(ownsPro: boolean, storeShell: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerPrints } = await import('../app/dashboard/[eventId]/launch/_components/maker-prints');
  const { PRINT_FORMATS } = await import('./print-pieces');
  const { INVITE_THEME_IDS } = await import('./invite-themes');
  const first = (f: string) => Object.values(PRINT_FORMATS).find((x) => x.for === f)!;
  const theme = INVITE_THEME_IDS[0];
  return renderToStaticMarkup(
    React.createElement(MakerPrints, {
      eventId: 'E1',
      theme,
      savedTheme: theme,
      ownsPro,
      storeShell,
      flash: null,
      formats: { pass: first('pass'), invitation: first('invitation'), card: first('card') } as never,
    }),
  );
}

test('the themed prints wear the mark their owner has earned — both directions', async () => {
  const owned = await paintPrints(true, false);
  const free = await paintPrints(false, false);
  const shellFree = await paintPrints(false, true);
  const marks = (h: string) => `locked=${count(h, 'data-paid-mark="locked"')} unlocked=${count(h, 'data-paid-mark="unlocked"')}`;
  console.log(`[paid-mark] prints owned{${marks(owned)}} free{${marks(free)}} shell-free{${marks(shellFree)}}`);
  assert.equal(count(owned, 'data-paid-mark="unlocked"'), 1);
  assert.equal(count(owned, 'data-paid-mark="locked"'), 0);
  assert.equal(count(free, 'data-paid-mark="locked"'), 1);
  assert.equal(count(free, 'data-paid-mark="unlocked"'), 0);
  assert.equal(count(shellFree, 'data-paid-mark='), 0, 'no padlock and no purchase hint in the store shell');
});

async function paintEditorial(ownsPro: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EditorialPanel } = await import('../app/dashboard/[eventId]/website/editor/_components/authoring-panels');
  return renderToStaticMarkup(
    React.createElement(EditorialPanel, { eventId: 'E1', ownsPro, unlockHref: '/buy', priceLabel: null }),
  );
}

test('the editor’s desk heading follows ownsPro — padlock free, diamond owned', async () => {
  const owned = await paintEditorial(true);
  const free = await paintEditorial(false);
  assert.match(owned, /data-paid-mark="unlocked"/);
  assert.doesNotMatch(owned, /data-paid-mark="locked"/);
  assert.match(free, /data-paid-mark="locked"/);
  assert.doesNotMatch(free, /data-paid-mark="unlocked"/);
});
