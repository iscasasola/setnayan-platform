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

/*
 * ⓘ THE INFO DOT PRESSES AT 44 × 44 AND IS STILL DRAWN AT ITS OWN SIZE (quality sweep 2026-10-19, row B11).
 *
 * InfoTip's circle is drawn 16 × 16 (`h-4 w-4`, a 1-px hairline). Its press is `.sn-dot-btn`'s invisible `::after`
 * halo. The sweep measured "About Target" / "About Agreed" (Budget) and "About Waiting for their yes" (Suppliers ·
 * Booked) pressing at ~30 with the old fixed 8-px halo. This does the same arithmetic as above, on BOTH axes — a dot
 * is a square target — and holds the drawing at 16 so the fix can never be "draw a bigger circle".
 */
const DOT = ruleBody(css, '.sn-dot-btn::after');

/** The size a class string DRAWS on one axis (`h-*`/`min-h-*` or `w-*`/`min-w-*`; a variant like `lg:` is not the phone's). */
function drawnAxis(cls: string, axis: 'h' | 'w'): number {
  let size = 0;
  let min = 0;
  for (const raw of cls.split(/\s+/)) {
    const t = raw.replace(/^!/, '');
    if (t.includes(':')) continue;
    const m = t.match(new RegExp(`^${axis}-(.+)$`));
    if (m && px(m[1]!) != null) size = px(m[1]!)!;
    const mm = t.match(new RegExp(`^min-${axis}-(.+)$`));
    if (mm && px(mm[1]!) != null) min = px(mm[1]!)!;
  }
  return Math.max(size, min);
}

/** A `.sn-dot-btn`'s press on both axes. */
function dotPress(cls: string): { w: number; h: number; drawnW: number; drawnH: number } {
  const border = cls.split(/\s+/).includes('border') ? 1 : 0;
  const drawnW = drawnAxis(cls, 'w');
  const drawnH = drawnAxis(cls, 'h');
  const h = pressReach(DOT ?? '', drawnH, border);
  const w = pressReach(DOT ?? '', drawnW, border);
  assert.ok(h && w, '.sn-dot-btn::after is not a rule the press arithmetic can read');
  return { w: w!.height, h: h!.height, drawnW, drawnH };
}

/** Every className string in a source file that wears `sn-dot-btn` (a quoted string, or a template up to its first `${`). */
function dotClassStrings(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`$]*))/g)) {
    const cls = (m[1] ?? m[2] ?? '').trim();
    if (cls.split(/\s+/).includes('sn-dot-btn')) out.push(cls);
  }
  return out;
}

test('ⓘ the halo rule: a 16-px circle with a hairline presses at 44 × 44; a bigger dot button keeps the press it had', () => {
  assert.ok(DOT, '.sn-dot-btn::after is gone from globals.css');
  const r16 = pressReach(DOT!, 16, 1)!;
  assert.ok(r16 && r16.height >= 44, `a 16-px ⓘ presses at ${r16?.height}px — under the 44-px floor`);
  // `h-10` (40 px) pressed at 56 with the old fixed 8-px halo; the floor keeps it there instead of shrinking it to 46.
  assert.ok(pressReach(DOT!, 40, 0)!.height >= 56, 'a 40-px dot button lost the 8-px halo it had');
});

test('ⓘ InfoTip: its circle is still DRAWN 16 × 16, and presses at 44 × 44', () => {
  const src = stripComments(read('app/_components/info-tip.tsx'));
  const classes = dotClassStrings(src);
  assert.equal(classes.length, 1, `InfoTip draws ${classes.length} .sn-dot-btn buttons — the one ⓘ is expected`);
  const cls = classes[0]!;
  const p = dotPress(cls);
  assert.equal(p.drawnW, 16, `the ⓘ is drawn ${p.drawnW} wide — the fix is the invisible halo, never a bigger circle`);
  assert.equal(p.drawnH, 16, `the ⓘ is drawn ${p.drawnH} tall — the fix is the invisible halo, never a bigger circle`);
  assert.ok(p.w >= 44 && p.h >= 44, `the ⓘ presses at ${p.w}×${p.h}px — under the 44-px floor`);
  assert.ok(!/(^|\s)overflow-(hidden|clip)(\s|$)/.test(cls), 'the ⓘ clips its own halo (overflow-hidden)');
  assert.ok(!/(^|\s)after:/.test(cls), 'the ⓘ carries an after: utility that would fight the halo');
});

test('ⓘ every .sn-dot-btn button in app/ presses at 44 × 44', async () => {
  const { readdirSync } = await import('node:fs');
  const files = (readdirSync(join(WEB, 'app'), { recursive: true }) as string[]).filter((f) => f.endsWith('.tsx'));
  let n = 0;
  for (const f of files) {
    const src = stripComments(read(join('app', f)));
    for (const cls of dotClassStrings(src)) {
      n++;
      const p = dotPress(cls);
      assert.ok(p.drawnW > 0 && p.drawnH > 0, `${f}: a .sn-dot-btn with no drawn size the guard can read (${cls})`);
      assert.ok(p.w >= 44 && p.h >= 44, `${f}: a .sn-dot-btn presses at ${p.w}×${p.h}px (classes: ${cls})`);
      // The halo IS the press: a button that clips its own overflow, or sets its own `after:` geometry, shrinks it.
      assert.ok(!/(^|\s)overflow-(hidden|clip)(\s|$)/.test(cls), `${f}: a .sn-dot-btn clips its own halo (classes: ${cls})`);
      assert.ok(!/(^|\s)after:(-?inset|top|bottom|left|right|absolute|hidden|content-none)/.test(cls), `${f}: a .sn-dot-btn carries an after: utility that fights its halo (classes: ${cls})`);
    }
  }
  // InfoTip + the schedule's hand-drawn ⓘ and its icon buttons: a count of 0 would mean the scan read nothing.
  assert.ok(n >= 5, `found only ${n} .sn-dot-btn buttons — the scan is not reading the tree`);
});
