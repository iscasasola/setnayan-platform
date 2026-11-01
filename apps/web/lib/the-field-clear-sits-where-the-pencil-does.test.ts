/**
 * the-field-clear-sits-where-the-pencil-does.test.ts — 🔒 the ✕ inside an open Field (`FormRowField`) is centred on its
 * box and stands where a resting row's pencil stands.
 *
 * Owner, live iPhone, 1 Nov 2026 (guest card › Basic Info › First, editing "Ronald"): the clear ✕ inside the pill sat
 * LOW and was not pinned at the right end with even padding. It was the app-wide ✕ (`GlobalClearField`), measured
 * against the input's own line box and portaled beside it. The fix is the template's: the open field draws the shared
 * `ClearButton` itself, as the LAST item of its box. The property, on the REAL rendered field:
 *   · CENTRED — the box is a 44-px flex row with `items-center`; the ✕'s press target fills its height (`h-full`) and
 *     centres its disc (`items-center`), so the disc's centre is the box's centre;
 *   · THE PENCIL'S INSET — the ✕'s disc is pinned to the target's right (`justify-end`) and the box's right padding and
 *     border are the resting pill's (`FORM_PILL_CLASS`), so the disc's right edge sits exactly where a resting row's
 *     pencil's does, inside its own pill;
 *   · ONE ✕ — the button carries `data-clear-x`, the mark `isClearableField` reads to keep the app-wide ✕ away;
 *   · NOT on an amount, an empty box or a long note (a number is corrected, not emptied; a note is never one tap from
 *     gone) — `components/clear-field.tsx`.
 * The geometry itself (centre within 1 px, right inset equal to the pencil's) was measured in WebKit at 390, light and
 * dark, on the /dev labs — see the PR's proof.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

const classOf = (tag: string) => (/class="([^"]*)"/.exec(tag)?.[1] ?? '').split(/\s+/);
const rightPad = (classes: string[]) => classes.filter((c) => /^(?:pr|px|p)-/.test(c)).pop();

test('the ✕ inside the open field: centred on its box, at the resting pencil’s right inset, one of it', async () => {
  const { FormRowField, FORM_PILL_CLASS } = await import('../app/_components/form-row');
  const open = (extra: Record<string, unknown>) =>
    paint(h(FormRowField as React.FC<Record<string, unknown>>, { handle: { current: null }, name: 'First', nameId: 'n1', start: 'Ronald', placeholder: 'First', long: false, maxLength: 80, mark: null, leaving: false, onEnd: () => {}, onGone: () => {}, ...extra }));
  const html = await open({});

  const boxAt = html.indexOf('data-form-row-box=""');
  assert.ok(boxAt > 0, 'the open field has no box');
  const boxTag = html.slice(html.lastIndexOf('<span', boxAt), html.indexOf('>', boxAt) + 1);
  const box = classOf(boxTag);
  const boxEnd = html.indexOf('</span>', html.indexOf('data-form-row-clear', boxAt));
  const inside = html.slice(boxAt, boxEnd);

  // ONE ✕, inside the box, its last item, marked so the app-wide ✕ stays away.
  const clears = inside.match(/<button[^>]*data-form-row-clear=""[^>]*>/g) ?? [];
  assert.equal(clears.length, 1, 'the box holding words has no ✕ inside it (or two)');
  const clear = clears[0]!;
  assert.match(clear, /data-clear-x=""/, 'the ✕ is not the shared ClearButton — the app-wide ✕ would draw a second one');
  assert.ok(inside.indexOf('<input') < inside.indexOf('data-form-row-clear'), 'the ✕ is not after the words (at the right end)');

  // CENTRED: a 44-px box that centres its items; the ✕'s target fills that height and centres its disc.
  for (const c of ['flex', 'h-11', 'items-center', 'rounded-full', 'border']) assert.ok(box.includes(c), `the box lost \`${c}\`: ${boxTag}`);
  const target = classOf(clear);
  for (const c of ['flex', 'h-full', 'items-center', 'justify-end', 'flex-none']) assert.ok(target.includes(c), `the ✕'s target lost \`${c}\`: ${clear}`);
  assert.ok(!target.some((c) => /^(?:m[tby]?|-m[tby]?)-/.test(c) || /^(?:self-|translate-y|top-|bottom-|absolute)/.test(c)), `the ✕ is nudged off centre: ${clear}`);

  // THE PENCIL'S INSET: the box's right padding and border are the resting pill's.
  const pill = FORM_PILL_CLASS.split(/\s+/);
  assert.equal(rightPad(box), rightPad(pill), `the ✕ is not at the pencil's inset: box ${rightPad(box)} vs pill ${rightPad(pill)}`);
  assert.ok(pill.includes('border') && box.includes('border'), 'the box and the pill do not wear the same 1-px border');
  assert.ok(!target.some((c) => /^p[rxl]?-/.test(c) && c !== 'p-0'), `the ✕'s target pads its disc off the inset: ${clear}`);

  // Not on an amount, an empty box, or a long note.
  for (const [what, extra] of [
    ['an amount', { mark: '₱', start: '250000' }],
    ['an empty box', { start: '' }],
    ['a numeric box', { inputMode: 'numeric', start: '12' }],
    ['a long note', { long: true, start: 'We can’t wait.' }],
  ] as const) {
    assert.doesNotMatch(await open(extra), /data-form-row-clear/, `${what} has a clear ✕`);
  }
  // And without the ✕ the words keep the left's even padding.
  const emptyBox = classOf((await open({ start: '' })).match(/<span[^>]*data-form-row-box=""[^>]*>/)![0]);
  assert.ok(emptyBox.includes('pl-[18px]') && emptyBox.includes('pr-[18px]'), 'an empty box is not evenly padded');
});
