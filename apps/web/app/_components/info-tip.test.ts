/**
 * info-tip.test.ts — the `(i)` opens and closes by the brief's rules, and can
 * never be a lone circle.
 *
 * The decisions are EXECUTED through `tipReducer` as the event sequences a
 * mouse, a finger and a keyboard actually produce — not read off the JSX. The
 * rendered markup is then checked for the label and the aria wiring.
 *
 * 🛡 Sabotage (each watched go red before this shipped): make `click` a plain
 * toggle of `open` → "a finger's tap" fails (the tap's focus opens it and its
 * click shuts it again — the tip flashes and is gone); make `pointerleave`
 * close for any pointer type → the same test fails on the finger lifting off;
 * make `blur` close a pinned tip → "reading a pinned tip" fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { TIP_CLOSED, tipReducer, type TipEvent, type TipState } from './info-tip-state';

(globalThis as unknown as { React: unknown }).React = React;

const run = (events: TipEvent[], from: TipState = TIP_CLOSED) => events.reduce(tipReducer, from);

test('a mouse: hover opens, leaving closes', () => {
  const hovered = run([{ type: 'pointerenter', pointerType: 'mouse' }]);
  assert.deepEqual(hovered, { open: true, pinned: false });
  assert.deepEqual(run([{ type: 'pointerleave', pointerType: 'mouse' }], hovered), TIP_CLOSED);
});

test('a mouse: hover then click PINS — leaving no longer closes; a second click does', () => {
  const pinned = run([
    { type: 'pointerenter', pointerType: 'mouse' },
    { type: 'focus' },
    { type: 'click' },
  ]);
  assert.deepEqual(pinned, { open: true, pinned: true });
  assert.deepEqual(run([{ type: 'pointerleave', pointerType: 'mouse' }], pinned), pinned);
  assert.deepEqual(run([{ type: 'click' }], pinned), TIP_CLOSED);
});

test("a finger's tap opens it, and the next tap closes it", () => {
  // What a touchscreen fires for ONE tap: enter (touch) → focus → click.
  const tap: TipEvent[] = [
    { type: 'pointerenter', pointerType: 'touch' },
    { type: 'focus' },
    { type: 'click' },
  ];
  const afterTap = run(tap);
  assert.equal(afterTap.open, true, 'a tap must open the tip');
  // Second tap on the same, still-focused button: enter (touch) → click.
  const afterSecond = run(
    [{ type: 'pointerenter', pointerType: 'touch' }, { type: 'click' }],
    afterTap,
  );
  assert.equal(afterSecond.open, false, 'a second tap must close it');
  // A finger lifting off never counts as "leaving" a hover — not even from a
  // tip only focus opened (iOS Safari does not focus a tapped button at all).
  const focusOpened = { open: true, pinned: false };
  assert.deepEqual(run([{ type: 'pointerleave', pointerType: 'touch' }], focusOpened), focusOpened);
});

test('reading a pinned tip: tapping its text blurs the button but must not close it', () => {
  const pinned = run([{ type: 'focus' }, { type: 'click' }]);
  assert.equal(run([{ type: 'blur' }], pinned).open, true);
  // …whereas an unpinned (focus-opened) tip closes when focus leaves.
  assert.equal(run([{ type: 'focus' }, { type: 'blur' }]).open, false);
});

test('Escape and an outside press always close — pinned or not', () => {
  for (const from of [
    { open: true, pinned: true },
    { open: true, pinned: false },
  ]) {
    assert.deepEqual(tipReducer(from, { type: 'escape' }), TIP_CLOSED);
    assert.deepEqual(tipReducer(from, { type: 'outside' }), TIP_CLOSED);
  }
});

test('it renders its own visible label beside the (i) — never a lone circle', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { InfoTip } = await import('./info-tip');
  const html = renderToStaticMarkup(
    React.createElement(InfoTip as never, { label: 'Budget' }, 'What counts toward the total.'),
  );
  assert.match(html, />Budget</, 'the label must be printed');
  assert.match(html, /aria-label="About Budget"/);
  assert.match(html, /role="tooltip"/);
  assert.match(html, /data-open="false"/, 'closed until asked');
  const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1];
  assert.ok(describedBy && html.includes(`id="${describedBy}"`), 'the (i) is described by its tooltip');

  const heading = renderToStaticMarkup(
    React.createElement(InfoTip as never, { label: 'Your inspirations', labelAs: 'h2' }, 'x'),
  );
  assert.match(heading, /^<div[^>]*><h2>Your inspirations<\/h2>/, 'a heading label gets a block wrapper');
});

test('the mood board renders the shared InfoTip; its local copy is gone', () => {
  const dir = join(__dirname, '..', 'dashboard', '[eventId]', 'studio', 'mood-board');
  for (const file of ['page.tsx', '_components/make-it-real.tsx']) {
    const code = stripComments(readFileSync(join(dir, file), 'utf8'));
    assert.match(code, /from '@\/app\/_components\/info-tip'/, `${file} imports the shared InfoTip`);
    assert.match(code, /<InfoTip\b/, `${file} renders it`);
    assert.doesNotMatch(code, /InfoButton/, `${file} still names the retired InfoButton`);
  }
});
