/**
 * the-sign-in-cards-wear-the-house-shape.test.ts — the sign-in (/login), create-account (/signup) and You
 * (/signup/you) cards are shaped like the rest of the app (owner 2026-10-22, "do both", on a screenshot of the live
 * /signup at 375 px).
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * The three cards had SQUARE corners, square email / password fields and a thin terracotta stripe on top, while every
 * other sheet and popup in the app is rounded and every field is too. Nobody chose square: `.hr-ov-card` asks for
 * `var(--hr-r22)` and `.hr-si-input` for `var(--hr-r10)`, but that scale is declared on `.home-reskin` only and the
 * cards render inside `.home-reskin-ov` — a portal (or a page) OUTSIDE it. An undefined var makes the declaration
 * invalid at computed-value time, so both radii computed to 0, in every browser, silently.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 *   1. The card's radius IS the app's popup radius and the fields' radius IS the app's field radius — read from the
 *      app itself (ConfirmDialog's `rounded-*`, `.input-field`'s `rounded-*`, mapped through tailwind.config), never
 *      re-typed here, and through tokens declared on `:root` so they resolve wherever the card renders.
 *   2. No top stripe — not on the card, not in dark.
 *   3. All three cards wear the one class that carries the shape.
 *
 * Comments stripped before matching, so the explanation of the fix is never the finding.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const stripCss = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const CSS = stripCss(read('app/_components/home/home-reskin.css'));
const GLOBALS = stripCss(read('app/globals.css'));
const TAILWIND = stripComments(read('tailwind.config.ts'));

/** Every `{ … }` rule whose selector list mentions `needle`: [selector, body]. Flat CSS only — this file has no nesting
 *  inside the rules this reads. */
function rules(css: string, needle: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1]!.trim();
    if (sel.includes(needle)) out.push([sel, m[2]!]);
  }
  return out;
}

/** The token a Tailwind `rounded-<key>` resolves to, read from tailwind.config's borderRadius block. */
function roundedToken(key: string): string {
  const block = TAILWIND.slice(TAILWIND.indexOf('borderRadius: {'));
  const body = block.slice(0, block.indexOf('}'));
  const quoted = key === 'DEFAULT' ? 'DEFAULT' : `'?${key}'?`;
  const m = body.match(new RegExp(`(?:^|\\n)\\s*${quoted}:\\s*'var\\((--[\\w-]+)\\)'`));
  assert.ok(m, `tailwind.config has no borderRadius.${key} token — this guard is pointed at nothing`);
  return m[1]!;
}

/** The `rounded-*` key an element's class list wears (corner-less: `rounded-2xl`, not `rounded-t-2xl`). */
function roundedKey(classes: string, what: string): string {
  const m = classes.match(/(?:^|\s)rounded-(none|sm|md|lg|xl|2xl|3xl|full)(?=\s|$)/);
  assert.ok(m, `${what} wears no rounded-* class — this guard is pointed at nothing`);
  return m[1]!;
}

/** The radius a `.hr-ov-card.sn-signin-terra` / `.sn-signin-terra .hr-si-input` rule sets — the LAST one wins. */
function radiusOf(selectorTest: (sel: string) => boolean): string | null {
  let last: string | null = null;
  for (const [sel, body] of rules(CSS, 'sn-signin-terra')) {
    if (sel.startsWith('html.dark')) continue;
    if (!sel.split(',').some((s) => selectorTest(s.trim()))) continue;
    const m = body.match(/(?:^|;|\s)border-radius:\s*([^;]+);?/);
    if (m) last = m[1]!.trim();
  }
  return last;
}

// The app's popup: ConfirmDialog, the centred box every "are you sure" in the app opens.
const POPUP_TOKEN = (() => {
  const dialog = stripComments(read('app/_components/confirm-dialog.tsx'));
  const cls = dialog.match(/<dialog\b[\s\S]*?className="([^"]+)"/)?.[1] ?? '';
  return roundedToken(roundedKey(cls, 'ConfirmDialog'));
})();
// The app's field: `.input-field`, the input every form in the app wears.
const FIELD_TOKEN = (() => {
  const apply = GLOBALS.match(/\.input-field\s*\{\s*@apply([^;]+);/)?.[1] ?? '';
  return roundedToken(roundedKey(apply.trim(), '.input-field'));
})();

// SABOTAGE: set the card back to `var(--hr-r22)` → RED (undefined in the overlay — the square corners).
// SABOTAGE: set the card to `var(--m-r-xl)` → RED (not the popup's token).
test('the card wears the app popup radius, through a token that resolves where the card renders', () => {
  const radius = radiusOf((s) => /\.hr-ov-card\.sn-signin-terra$/.test(s));
  assert.equal(radius, `var(${POPUP_TOKEN})`, `the sign-in card's radius must be the popup's own token (${POPUP_TOKEN})`);
  assert.match(GLOBALS, new RegExp(`:root\\s*\\{[^}]*${POPUP_TOKEN}:\\s*\\d+px`), `${POPUP_TOKEN} must be declared on :root`);
});

// SABOTAGE: drop the `.sn-signin-terra .hr-si-input` radius rule → RED (falls back to the undefined --hr-r10).
// SABOTAGE: set it to `var(--m-r-md)` → RED.
test('the fields wear the app field radius', () => {
  const radius = radiusOf((s) => /\.sn-signin-terra \.hr-si-input$/.test(s));
  assert.equal(radius, `var(${FIELD_TOKEN})`, `the sign-in fields' radius must be the field's own token (${FIELD_TOKEN})`);
  assert.match(GLOBALS, new RegExp(`:root\\s*\\{[^}]*${FIELD_TOKEN}:\\s*\\d+px`), `${FIELD_TOKEN} must be declared on :root`);
});

// SABOTAGE: put `border-top: 3px solid #c24e25` back on the card → RED.
// SABOTAGE: put `border-top-color: #c24e25` back in the dark rule → RED.
test('no top stripe — light or dark', () => {
  const offenders = rules(CSS, 'sn-signin-terra')
    .filter(([sel]) => /\.hr-ov-card/.test(sel))
    .filter(([, body]) => /(?:^|;|\s)border-top(?:-width|-color|-style)?\s*:/.test(body))
    .map(([sel]) => sel);
  assert.deepEqual(offenders, [], `the sign-in card must carry no top stripe:\n${offenders.join('\n')}`);
});

// SABOTAGE: drop `sn-signin-terra` from the You card → RED.
test('all three cards wear the class that carries the shape', () => {
  for (const rel of [
    'app/signup/page.tsx',
    'app/signup/you/_components/you-card.tsx',
    'app/login/_components/sign-in-card-modal.tsx',
  ]) {
    assert.match(stripComments(read(rel)), /className="hr-ov-card sn-signin-terra"/, `${rel} does not wear the house-shaped card`);
  }
});

// SABOTAGE: delete the `scrollIntoView` from termsFirst → RED (the box is below the buttons now; off screen on a phone).
// SABOTAGE: make the dim `pointer-events: none` → RED (a press must land, so it can nudge the box).
test('the tick below Google / Apple still gates them — dimmed, pressable, and the press brings the box into view', () => {
  const gate = stripComments(read('app/_components/auth/terms-first.tsx'));
  const branch = gate.slice(gate.indexOf('if (!box.checked)'), gate.indexOf('return false;', gate.indexOf('if (!box.checked)')));
  assert.ok(branch.length > 0, 'the unticked branch moved — this guard is pointed at nothing');
  assert.match(branch, /\.scrollIntoView\(/, 'an unticked press must bring the box (now below the buttons) into view');
  assert.match(branch, /box\.focus\(/, 'and focus it');
  const dim = rules(CSS, '[data-terms-first]').filter(([sel]) => /:has\(\[data-terms-box\]:not\(:checked\)\)/.test(sel));
  assert.ok(dim.length > 0, 'Google / Apple are no longer dimmed while the box is empty');
  for (const [, body] of dim) {
    assert.match(body, /opacity:\s*0?\.\d+/, 'the dim is an opacity');
    assert.doesNotMatch(body, /pointer-events:\s*none/, 'dimmed, never dead — the press must land so TermsFirst can nudge');
  }
});
