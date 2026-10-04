/**
 * event-poster-fits.test.ts — every line of the paper card fits; the date is
 * never cut off.
 *
 * Owner, 2026-10-04 (dashboard event cards at phone width): the paper
 * invitation card printed "12 December 2026" across the card's foot. The paper
 * (`app/_components/event-poster.module.css`, `.paper`) is a fixed-height flex
 * column whose words were sized only in `cqw`, while the chips' clearance, the
 * private strip and the date's floor are px — so the words ran out of room on
 * almost every card size (measured in a browser: 4–46 px over, the date under
 * the strip from 221 px to 245 px wide).
 *
 * The fix sizes the paper's words AS A GROUP from the room it has (`--f`). This
 * file EVALUATES that CSS — it reads the declarations out of the module and
 * does the arithmetic the browser does — at every card width from a 120 px
 * Maker thumbnail to a 420 px desktop column, and asserts the stacked lines fit
 * the paper's content box. A precise layout engine is not in the unit runner,
 * so two facts make the arithmetic honest:
 *
 *   • every line declares a UNITLESS `line-height` (asserted below), so each
 *     line box is `font-size × line-height` whatever face sets it — the
 *     "worst-case tall face" is exactly the declared box;
 *   • the date never wraps (`white-space: nowrap`, asserted) and its size is
 *     capped so the longest date fits the width (asserted with the measured
 *     advance of "30 September 2026" in Fraunces).
 *
 * MANUAL CHECK (what the arithmetic cannot see — a name long enough to wrap):
 * open the dashboard on a 375 px phone, two cards across, and a desktop at
 * 1024 px (four across); every card's date sits above the white strip.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'app', '_components', 'event-poster.module.css'),
  'utf8',
);

/** The declarations of the FIRST top-level rule whose selector is exactly `sel`. */
function rule(sel: string, css = CSS): Record<string, string> {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(m, `no \`${sel}\` rule in event-poster.module.css`);
  const out: Record<string, string> = {};
  for (const d of stripComments(m[1]!).split(';')) {
    const i = d.indexOf(':');
    if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
  }
  return out;
}

/** The narrow container block's body (the rule that drops the minor lines). */
function narrowBlock(): string {
  const at = CSS.indexOf('@container (max-width: 220px)');
  assert.ok(at > 0, 'the narrow-card container rule is gone');
  let depth = 0;
  for (let i = CSS.indexOf('{', at); i < CSS.length; i++) {
    if (CSS[i] === '{') depth++;
    if (CSS[i] === '}' && --depth === 0) return CSS.slice(CSS.indexOf('{', at) + 1, i);
  }
  throw new Error('unbalanced narrow block');
}

// ── a tiny CSS length evaluator: calc · min · max · clamp · var, px/cqw/cqh/rem/em ──
type Ctx = { cqw: number; cqh: number; em: number; vars: Record<string, string> };

function evaluate(expr: string, ctx: Ctx): number {
  let s = expr.trim();
  let i = 0;
  const ws = () => {
    while (s[i] === ' ' || s[i] === '\n') i++;
  };
  const sum = (): number => {
    let v = product();
    for (;;) {
      ws();
      if (s[i] === '+' || (s[i] === '-' && s[i + 1] === ' ')) {
        const op = s[i++];
        const r = product();
        v = op === '+' ? v + r : v - r;
      } else return v;
    }
  };
  const product = (): number => {
    let v = atom();
    for (;;) {
      ws();
      if (s[i] === '*' || s[i] === '/') {
        const op = s[i++];
        const r = atom();
        v = op === '*' ? v * r : v / r;
      } else return v;
    }
  };
  const args = (): number[] => {
    const out: number[] = [];
    for (;;) {
      out.push(sum());
      ws();
      if (s[i] === ',') i++;
      else if (s[i] === ')') {
        i++;
        return out;
      } else throw new Error(`bad args at ${i} in ${s}`);
    }
  };
  const atom = (): number => {
    ws();
    const fn = /^(calc|min|max|clamp|var)\(/.exec(s.slice(i));
    if (fn) {
      i += fn[0].length;
      if (fn[1] === 'var') {
        const name = /^--[\w-]+/.exec(s.slice(i))![0];
        i += name.length;
        ws();
        assert.equal(s[i], ')', `var() fallback not supported in ${s}`);
        i++;
        const val = ctx.vars[name];
        assert.ok(val !== undefined, `${name} is not declared`);
        return evaluate(val, ctx);
      }
      const a = args();
      if (fn[1] === 'calc') return a[0]!;
      if (fn[1] === 'min') return Math.min(...a);
      if (fn[1] === 'max') return Math.max(...a);
      return Math.max(a[0]!, Math.min(a[1]!, a[2]!)); // clamp
    }
    if (s[i] === '(') {
      i++;
      const v = sum();
      ws();
      i++;
      return v;
    }
    const num = /^-?\d*\.?\d+(px|cqw|cqh|rem|em)?/.exec(s.slice(i));
    assert.ok(num, `cannot read "${s.slice(i)}"`);
    i += num[0].length;
    const n = parseFloat(num[0]);
    switch (num[1]) {
      case 'px':
        return n;
      case 'cqw':
        return (n * ctx.cqw) / 100;
      case 'cqh':
        return (n * ctx.cqh) / 100;
      case 'rem':
        return n * 16;
      case 'em':
        return n * ctx.em;
      default:
        return n;
    }
  };
  const v = sum();
  ws();
  assert.equal(i, s.length, `trailing input in "${expr}"`);
  return v;
}

/** `line-height` must be a bare number — the box is then font-size × it, in any face. */
function unitlessLh(decls: Record<string, string>, what: string): number {
  const lh = decls['line-height'];
  assert.ok(lh && /^\d*\.?\d+$/.test(lh), `${what} has no unitless line-height — a taller face would make it taller than the sum says`);
  return parseFloat(lh);
}

const paper = rule('.paper');
const narrow = rule('.paper', narrowBlock());
const eb = rule('.eb');
const circ = rule('.circ');
const names = rule('.paper .names');
const amp = rule('.paper .amp');
const ln = rule('.ln');
const dt = rule('.paper .dt');
const SB = rule('.poster')['--sb']!;

/** Height the paper's visible lines take, and the room it has, at card width `w`. */
function stack(w: number) {
  const isNarrow = w <= 220;
  const vars: Record<string, string> = { '--sb': SB };
  for (const [k, v] of Object.entries(paper)) if (k.startsWith('--')) vars[k] = v;
  if (isNarrow) for (const [k, v] of Object.entries(narrow)) if (k.startsWith('--')) vars[k] = v;
  const ctx: Ctx = { cqw: w, cqh: (w * 4) / 3, em: 16, vars };
  const ev = (e: string, em = 16) => evaluate(e, { ...ctx, em });

  const [pt, , pb] = paper.padding!.split(/\s+(?![^(]*\))/);
  const room = ctx.cqh - ev(pt!) - ev(pb!);

  const namesFs = ev(names['font-size']!);
  const namesLh = unitlessLh(names, '.paper .names');
  const ampFs = ev(amp['font-size']!, namesFs);
  const ampMargin = ev(amp.margin!.split(/\s+(?![^(]*\))/)[0]!);
  const dtFs = ev(dt['font-size']!);
  let h =
    ev(circ.width!) + // aspect-ratio 1 — its height is its width
    ev(circ['margin-bottom']!) +
    2 * namesFs * namesLh + // two names, one line each
    ampFs * unitlessLh(amp, '.paper .amp') +
    2 * ampMargin +
    ev(dt['margin-top']!) +
    dtFs * unitlessLh(dt, '.paper .dt');
  if (!isNarrow) {
    h += ev(eb['font-size']!) * unitlessLh(eb, '.eb') + ev(eb['margin-bottom']!);
    h += ev(ln['margin-top']!) + ev(ln['font-size']!) * unitlessLh(ln, '.ln');
  }
  return { room, h, namesFs, dtFs, cqw: w / 100 };
}

test('every line of the paper fits inside it, at every card width from a Maker thumbnail to a desktop column', () => {
  const over: string[] = [];
  for (let w = 120; w <= 420; w += 0.5) {
    const { room, h } = stack(w);
    if (h > room + 0.01) over.push(`${w}px: ${h.toFixed(1)} > ${room.toFixed(1)}`);
  }
  assert.deepEqual(over, [], `the paper's words overrun it — the date is cut off:\n${over.slice(0, 12).join('\n')}`);
});

test('the dashboard card at phone width (two across) fits with the date at its legible size', () => {
  // `CollectionGrid` 'poster': two columns, gap-3, inside px-4 — one card is
  // (viewport − 32 − 12) / 2.
  for (const vw of [320, 360, 375, 390, 414, 430]) {
    const w = (vw - 32 - 12) / 2;
    const { room, h, dtFs, namesFs } = stack(w);
    assert.ok(h <= room, `${vw}px phone: ${h.toFixed(1)} px of words in ${room.toFixed(1)} px`);
    assert.ok(dtFs >= 12, `${vw}px phone: the date shrank to ${dtFs.toFixed(1)} px`);
    // On a 320 px phone the 138 px card is the Maker-thumbnail case: the date
    // holds its ~12 px and the names give way first, so this holds from 360 up.
    if (vw >= 360) assert.ok(namesFs > dtFs, `${vw}px phone: the names (${namesFs.toFixed(1)} px) set smaller than the date`);
  }
});

test('the group keeps the approved size when there is room — it only shrinks when it must', () => {
  // A 360 px column has room to spare: --f resolves to 1cqw, the 09-24 look.
  const { namesFs, cqw } = stack(360);
  assert.ok(Math.abs(namesFs - 11 * cqw) < 0.01, `a roomy card no longer sets the names at 11cqw (${namesFs})`);
});

test('the date is never clipped: no overflow on it, it never shrinks, it never wraps, and it fits the width', () => {
  for (const [sel, d] of [['.dt', rule('.dt')], ['.paper .dt', dt]] as const) {
    assert.doesNotMatch(Object.entries(d).map(([k, v]) => `${k}:${v}`).join(';'), /overflow|text-overflow|line-clamp|max-height|flex-shrink:\s*[1-9]/, `${sel} can clip or shrink the date`);
  }
  assert.doesNotMatch(Object.entries(paper).map(([k, v]) => `${k}:${v}`).join(';'), /overflow/, '.paper clips its own lines');
  assert.match(rule('.paper > *')['flex-shrink'] ?? '', /^0$/, 'a paper line can be squashed by flex');
  assert.equal(dt['white-space'], 'nowrap', 'the date can wrap onto a second line');
  // "30 September 2026" measured 9.17 em wide in Fraunces 400 (the longest
  // month); the paper's text column is 100 − 2 × 9 = 82 cqw.
  const cap = /(\d*\.?\d+)cqw\)\s*$/.exec(paper['--dt-fs'] ?? '')?.[1];
  assert.ok(cap, '--dt-fs lost its cqw cap — a date could run past the card');
  assert.ok(9.17 * parseFloat(cap) <= 82, `the date's ${cap}cqw cap lets "30 September 2026" run past the paper`);
});

test('--big is at least the units the scaling lines actually take (narrow and wide)', () => {
  const f = (e: string) => {
    const m = /^calc\(var\(--f\) \* (\d*\.?\d+)\)$/.exec(e);
    assert.ok(m, `"${e}" is not written as calc(var(--f) * n) — the sum cannot be checked`);
    return parseFloat(m[1]!);
  };
  const namesU = f(names['font-size']!);
  const lh = unitlessLh(names, '.paper .names');
  const ampU = namesU * 0.5 * unitlessLh(amp, '.paper .amp');
  const core =
    f(circ.width!) + f(circ['margin-bottom']!) + 2 * namesU * lh + ampU + 2 * f(amp.margin!.split(/\s+(?![^(]*\))/)[0]!) + f(dt['margin-top']!);
  const wide = core + f(eb['margin-bottom']!) + f(ln['margin-top']!);
  assert.ok(parseFloat(narrow['--big']!) >= core, `narrow --big ${narrow['--big']} < ${core.toFixed(2)} units of lines`);
  assert.ok(parseFloat(paper['--big']!) >= wide, `wide --big ${paper['--big']} < ${wide.toFixed(2)} units of lines`);
});
