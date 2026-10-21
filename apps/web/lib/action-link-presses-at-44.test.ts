/**
 * An ActionButton rendered AS A LINK (`href` → `<a class="ab">`) presses at 44px,
 * like its button form, without changing its 40px look.
 *
 * Why: the button form paints 44 (globals' base `button { min-height: 44px }`
 * beats `.ab { height: 40px }`); the link form had no floor, so every
 * link-button app-wide was a 40px press (controller sweep, 2026-10-13). The
 * fix is an `a.ab::after` expander — measured here by arithmetic: the drawn
 * height plus twice the expander's inset must reach 44. It must NOT bleed
 * sideways: `useFitRow` reads a row's scrollWidth, and 2px of horizontal bleed
 * would read as overflow and strip words from a row that fits.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { pressReach, ruleBody } from './press-reach';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));

test('an ActionButton — link or button — carries a press expander that reaches 44px, vertically only', () => {
  const base = css.match(/(?:^|\n)\.ab \{([^}]*)\}/)?.[1] ?? '';
  const h = Number(base.match(/\bheight:\s*(\d+)px/)?.[1]);
  assert.ok(h > 0, 'the .ab base rule lost its height — did the drawing change?');
  const border = Number(base.match(/\bborder:\s*(\d+)px/)?.[1] ?? 0);
  // Since dark-mode PR 4 the expander is the BUTTON's too (`.ab::after`): a panel that resets the base floor
  // (`button { min-height: 0 }`) left a <button class="ab"> a 40px press. A link-only rule may not come back.
  assert.equal(ruleBody(css, 'a.ab::after'), null, 'the expander is the link form only again — a floorless <button class="ab"> presses at 40');
  const after = ruleBody(css, '.ab::after');
  assert.ok(after, '.ab::after is gone — every ActionButton without the base floor presses at its 40px paint again');
  const reach = pressReach(after!, h, border);
  assert.ok(reach, 'the expander is not a rule this guard can read (content, position:absolute, an inset or the shared min() reach)');
  assert.ok(reach!.height >= 44, `ActionButton press height ${reach!.height}px < 44`);
  assert.ok(!reach!.sideways, 'the expander bleeds sideways — useFitRow will read it as overflow');
  assert.match(css, /:where\(\.ab\)\s*\{\s*position:\s*relative/, 'an ActionButton is not a positioning box for its expander');
});

test('the producer still renders a link for href — the rule above has something to hold', () => {
  const src = stripComments(readFileSync(join(WEB, 'components/action-button.tsx'), 'utf8'));
  assert.ok(/props\.href !== undefined/.test(src) && /<Link\b/.test(src), 'ActionButton no longer renders <Link> for href');
});

// ── NOTHING CLIPS THE EXPANDER (fits-every-phone 2026-10-21) ───────────────────────────────────────────────────
// The expander is an `::after` that reaches past the pill; an `overflow: hidden` ON the pill clips it back to the
// paint. The Home's three doors ("Edit your Event Hub / Guest list / Suppliers") pressed at 40px for exactly that
// reason (`.home-doors > :is(button, a).ab.ab-neutral { overflow: hidden }`), measured by pressing in the sweep.
// Read from every stylesheet: no rule whose subject is an ActionButton (`.ab` in the LAST compound of a selector)
// may clip its overflow. Clip the word (`.ab .lbl`) instead.
function cssFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) cssFiles(rel, out);
    else if (rel.endsWith('.css')) out.push(rel);
  }
  return out;
}
/** Split a selector list on top-level commas only — `:is(button, a)` stays whole. */
function selectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

test('no stylesheet clips an ActionButton — the overflow would swallow its own 44px expander', () => {
  const files = ['app', 'components', 'lib'].flatMap((d) => cssFiles(d));
  assert.ok(files.includes('app/globals.css') && files.length > 5, `only ${files.length} stylesheets found — the walk is broken`);
  const bad: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(join(WEB, f), 'utf8'));
    for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/(?:^|[;\s])overflow(?:-[xy])?\s*:\s*(?:hidden|clip)/.test(m[2]!)) continue;
      for (const sel of selectors(m[1]!)) {
        const subject = sel.split(/\s+|>|\+|~/).filter(Boolean).pop() ?? '';
        if (/\.ab(?![\w-])/.test(subject.replace(/:global\(([^)]*)\)/g, '$1'))) bad.push(`${f}: ${sel}`);
      }
    }
  }
  assert.deepEqual(bad, [], `an ActionButton is clipped, so it presses at its paint:\n${bad.join('\n')}`);
});
