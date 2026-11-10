/**
 * 🔁 A REFUSED SAVE GETS ITS OWN LINE — app-wide (Build 5 F1; owner screenshot 10 Nov, "Toggle issue").
 *
 * `StayForm` / `StayConfirmForm` print a refusal (`<p role="alert" data-stay-error>`) as a SIBLING of their form. Inside a
 * flex ROW that paragraph is one more flex item and crushes its neighbours (the Shop card row became a one-word column;
 * #7427 patched that one row). The fix lives once, in `app/globals.css`: a row holding a refusal wraps, and the refusal
 * takes the full width on the last line. This guard fails if any half of that goes:
 *   1. StayForm stops marking its refusal `data-stay-error` (the hook the CSS reads),
 *   2. the refusal moves INSIDE the form (a `flex` form would crush it the same way, out of reach of the rule),
 *   3. the globals.css rule loses the wrap, the full basis or the last place, or starts reaching column parents.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const stay = readFileSync(join(__dirname, 'stay-form.tsx'), 'utf8');
const css = readFileSync(join(__dirname, '..', 'globals.css'), 'utf8');

/** Every top-level rule `selector { body }` in globals.css whose selector mentions `data-stay-error`. */
function stayErrorRules(): Array<{ selector: string; body: string }> {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Array<{ selector: string; body: string }> = [];
  for (const m of noComments.matchAll(/([^{}]*data-stay-error[^{}]*)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1]!.trim(), body: m[2]! });
  }
  return out;
}

const decl = (body: string, prop: string) => body.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`))?.[1]?.trim();

test('StayForm marks its refusal with data-stay-error, outside the form', () => {
  assert.match(stay, /<p role="alert"[^>]*data-stay-error=\{door\}/, 'the refusal lost its data-stay-error hook');
  // The refusal is drawn after the form closes (`</form>` then `{stay.refusal}`), never among the form's children.
  assert.match(stay, /<\/form>\s*\{stay\.refusal\}/, 'StayForm no longer prints its refusal right after the form');
  assert.doesNotMatch(stay, /\{children\}\s*\{stay\.refusal\}/, 'the refusal moved INSIDE the form');
  assert.match(stay, /<ConfirmForm [^>]*\/>\s*\{stay\.refusal\}/, 'StayConfirmForm no longer prints its refusal after the form');
});

test('a flex row holding a refusal wraps', () => {
  const rule = stayErrorRules().find((r) => /:has\(\s*>\s*\[data-stay-error\]\s*\)/.test(r.selector));
  assert.ok(rule, 'no globals.css rule wraps the row that holds a refusal — the refusal sits inline again');
  assert.match(rule!.selector, /\.flex\b/, 'the wrap rule does not reach `.flex` rows');
  assert.match(rule!.selector, /\.inline-flex\b/, 'the wrap rule does not reach `.inline-flex` rows');
  assert.equal(decl(rule!.body, 'flex-wrap'), 'wrap', 'the row holding a refusal does not wrap');
});

test('the refusal takes the full width on the last line of a flex row', () => {
  const rule = stayErrorRules().find((r) => /\.flex\b/.test(r.selector) && />\s*\[data-stay-error\]\s*$/.test(r.selector));
  assert.ok(rule, 'no globals.css rule sizes the refusal inside a flex row');
  assert.equal(decl(rule!.body, 'flex-basis'), '100%', 'the refusal no longer takes the whole row');
  assert.equal(decl(rule!.body, 'order'), '9999', 'the refusal no longer sits under everything in the row');
});

test('a column parent is left alone, and a grid gives the refusal every column', () => {
  for (const r of stayErrorRules().filter((x) => /\.flex\b/.test(x.selector))) {
    assert.match(r.selector, /:not\([^)]*\.flex-col\b/, `"${r.selector}" also reaches flex-col parents (order would drop the line to the column's end)`);
  }
  const grid = stayErrorRules().find((r) => /^\[data-stay-error\]$/.test(r.selector));
  assert.ok(grid, 'no bare [data-stay-error] rule');
  assert.equal(decl(grid!.body, 'grid-column'), '1 / -1', 'in a grid the refusal no longer spans the row');
});

test('no rule makes the refusal inline again', () => {
  for (const r of stayErrorRules()) {
    const display = decl(r.body, 'display');
    assert.ok(!display || !/inline/.test(display), `"${r.selector}" sets display: ${display} on the refusal`);
    assert.notEqual(decl(r.body, 'flex-wrap'), 'nowrap', `"${r.selector}" stops the row from wrapping`);
  }
});
