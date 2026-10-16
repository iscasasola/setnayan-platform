/**
 * THE SHARED CONTROLS PRESS AT 44 — measured from their SOURCE classes (dark-mode PR 4 "shared pieces", 2026-10-13).
 *
 * Owner 2026-10-12: 44 px is the minimum press, everywhere. Every builder that day measured the same shared faults
 * in a browser: a pill selector's choice 38, a form-row pill 40, a dropdown (PickMenu) button 40, a chip 40 (its old
 * 2-px expander pressed at 42), the toast's Undo / Try again 34. They are fixed ONCE, where they are drawn, without
 * changing a pixel of the drawing: each wears `.sn-hit` (an invisible `::after` 46 px around its centre, vertical
 * only — `globals.css`).
 *
 * This guard does the arithmetic a finger does: for each control it reads the drawn height and border FROM ITS CLASS
 * STRING (`h-10`, `min-h-[38px]`, `!h-[34px]` …), reads the `.sn-hit::after` rule from the stylesheet, and requires
 * the press (`lib/press-reach.ts`) to reach 44 — and the reach to stay vertical. A control that is itself ≥ 44 tall
 * (the switch's button) is held at that height instead. The browser walk measured the same numbers with
 * `elementFromPoint` (PR body).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { pressReach, ruleBody } from './press-reach';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const css = stripComments(read('app/globals.css'));

/** Tailwind's spacing scale: `10` → 40px; `[38px]` → 38. */
function px(v: string): number | null {
  const arb = v.match(/^\[(\d+(?:\.\d+)?)px\]$/);
  if (arb) return Number(arb[1]);
  if (/^\d+(?:\.\d+)?$/.test(v)) return Number(v) * 4;
  return null;
}

/** The height a class string DRAWS (the larger of `h-*` and `min-h-*`, `!`-important or not; a variant like `sm:` is not the phone's). */
function drawnHeight(cls: string): { drawn: number; border: number } {
  let h = 0;
  let minH = 0;
  let border = 0;
  for (const raw of cls.split(/\s+/)) {
    const t = raw.replace(/^!/, '');
    if (t.includes(':')) continue;
    const hm = t.match(/^h-(.+)$/);
    if (hm && px(hm[1]!) != null) h = px(hm[1]!)!;
    const mm = t.match(/^min-h-(.+)$/);
    if (mm && px(mm[1]!) != null) minH = px(mm[1]!)!;
    if (t === 'border') border = 1;
  }
  return { drawn: Math.max(h, minH), border };
}

const HIT = ruleBody(css, '.sn-hit::after');

/** The press a class string gives a finger: its drawing, grown by `.sn-hit` when it wears it. */
function press(cls: string): { height: number; sideways: boolean } {
  const { drawn, border } = drawnHeight(cls);
  if (!cls.split(/\s+/).includes('sn-hit')) return { height: drawn, sideways: false };
  const reach = pressReach(HIT ?? '', drawn, border);
  assert.ok(reach, '.sn-hit::after is not a rule the press arithmetic can read');
  return reach!;
}

test('the shared press: .sn-hit::after reaches 46 around the centre, vertical only, and positions itself softly', () => {
  assert.ok(HIT, '.sn-hit::after is gone from globals.css');
  // A 38-px pill with no border, a 40-px pill with a 1-px border and a 34-px pill: each must reach 44.
  for (const [drawn, border] of [
    [38, 0],
    [40, 1],
    [34, 0],
  ] as const) {
    const r = pressReach(HIT!, drawn, border);
    assert.ok(r && r.height >= 44, `a ${drawn}-px control wearing .sn-hit presses at ${r?.height}px`);
    assert.ok(r && !r.sideways, '.sn-hit bleeds sideways — a fitted row (useFitRow) reads that as overflow');
  }
  // A control already taller than the reach is not grown.
  assert.equal(pressReach(HIT!, 52, 0)!.height, 52, '.sn-hit grows a control that was already tall enough');
  assert.match(css, /:where\(\.sn-hit\)\s*\{\s*position:\s*relative/, '.sn-hit is not a positioning box — or it outranks a caller’s absolute/fixed');
});

test('each shared control, as its source draws it, presses at 44', async () => {
  const { pillSegClass } = await import('../app/_components/pill-selector');
  const { CHIP_CLASS, chipClass } = await import('../app/_components/chips');
  const { FORM_PILL_CLASS, FORM_PICK_CLASS } = await import('../app/_components/form-row');
  const { pickButtonClass } = await import('../app/dashboard/[eventId]/website/editor/_components/pick-menu-place');
  const { SWITCH_BUTTON } = await import('../app/_components/switch-track');

  const controls: Array<[string, string]> = [
    ['a pill selector choice (picked)', pillSegClass(true)],
    ['a pill selector choice (not picked)', pillSegClass(false)],
    ['a chip', CHIP_CLASS],
    ['a chip (on)', chipClass(true)],
    ['a chip (off)', chipClass(false)],
    ['a form-row pill', FORM_PILL_CLASS],
    ['a dropdown button', pickButtonClass(false)],
    ['a compact dropdown button', pickButtonClass(true)],
    // The form row's dropdown: PickMenu's own button with the form pill's size laid over it (`!h-10`).
    ['a form-row dropdown', `${pickButtonClass(false)} ${FORM_PICK_CLASS}`],
    ['a switch (the button form)', SWITCH_BUTTON],
  ];
  for (const [name, cls] of controls) {
    const p = press(cls);
    assert.ok(p.height >= 44, `${name} presses at ${p.height}px — under the 44-px floor (classes: ${cls})`);
    assert.ok(!p.sideways, `${name}: its press bleeds sideways`);
    // A control that clips its own overflow clips its own ::after — the press would shrink back to the drawing.
    assert.ok(!/(^|\s)overflow-(hidden|clip)(\s|$)/.test(cls), `${name} clips its own press (overflow-hidden)`);
    // A competing `after:` geometry on the same control would fight the shared press (variants are emitted later).
    if (cls.includes('sn-hit')) assert.ok(!/(^|\s)after:(-?inset|top|bottom|absolute)/.test(cls), `${name} carries its own after: expander beside .sn-hit`);
  }
});

test('the toast’s own buttons (Undo, Try again) press at 44 inside the 48-px pill', () => {
  const src = stripComments(read('app/_components/toast/peek-toast.tsx'));
  const buttons = [...src.matchAll(/<button\b[^>]*className="([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(buttons.length >= 2, `the toast draws ${buttons.length} button(s) — Undo and Try again are expected`);
  for (const cls of buttons) {
    const p = press(cls);
    assert.ok(p.height >= 44, `a toast button presses at ${p.height}px (classes: ${cls})`);
  }
});
