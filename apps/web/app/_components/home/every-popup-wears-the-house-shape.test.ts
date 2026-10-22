/**
 * every-popup-wears-the-house-shape.test.ts — the popups that render in `.home-reskin-ov` are rounded (owner
 * 2026-10-22: popups wear the house rounded shape).
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * The Prices, Download and Suppliers popups (and Sign in, the demos, and the /login · /signup · /signup/you cards)
 * drew SQUARE: square card, square tier boxes, square store buttons, square "Soon" pills. Nobody chose square. Their
 * rules ask for `var(--hr-r22)`, `var(--hr-r14)`… — a radius scale declared on `.home-reskin` only — and they render
 * in `.home-reskin-ov`, a portal at document.body (or a page wrapper) OUTSIDE `.home-reskin`. An undefined custom
 * property makes the declaration invalid at computed-value time, so 19 overlay rules computed `border-radius: 0`, in
 * every browser, with no error anywhere. Measured at 375 px before the fix: every `.hr-*` piece in all four nav
 * popups read `0px`.
 *
 * ── THE FIX, AND WHY NOT THE OTHER ONE ──────────────────────────────────────
 * The scale is declared on BOTH roots (`.home-reskin, .home-reskin-ov`) — one block, the same values. The other
 * option was to rewrite the 19 overlay rules onto the global `--m-r-*` scale; that scale has six steps (4 · 8 · 14 ·
 * 22 · 36 · 999) and the prototype's pieces are drawn at 2 · 10 · 11 · 12 · 14 · 20, so the rewrite would have
 * re-drawn the approved prototype rather than restored it, and the next overlay rule written against `--hr-r*` would
 * have gone square again. Declaring the scale where the rules render fixes every one at once and leaves nothing for a
 * future rule to miss. The popup CARD itself takes the app's own popup token (`--m-r-lg`, ConfirmDialog's
 * `rounded-2xl`) so the outside shape is literally the house's.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 *   1. Every `--hr-*` token a rule under `.home-reskin-ov` reads is declared on `.home-reskin-ov` itself — and the
 *      same for `.home-reskin`. (Radius, colour, font: an undeclared token is the same silent failure whatever it
 *      holds.)
 *   2. Every `--hr-*` token a component reads inline is declared on BOTH roots — a component cannot know which one
 *      it renders in.
 *   3. The popup card's radius is the app's popup token, read from ConfirmDialog through tailwind.config — never
 *      re-typed here — and that token is declared on `:root`.
 *
 * Comments stripped before matching, so the explanation of the fix is never the finding.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const CSS = stripComments(read('app/_components/home/home-reskin.css'));
const GLOBALS = stripComments(read('app/globals.css'));
const TAILWIND = stripComments(read('tailwind.config.ts'));

/** Every innermost `selector { body }` rule — @media / @supports wrappers peeled, @keyframes steps skipped. */
function rules(css: string): Array<{ sel: string; body: string }> {
  const out: Array<{ sel: string; body: string }> = [];
  const stack: string[] = [];
  for (const m of css.matchAll(/([^{}]*)([{}])/g)) {
    if (m[2] === '{') {
      stack.push(m[1]!.trim());
      continue;
    }
    const sel = stack.pop() ?? '';
    if (stack.some((s) => s.startsWith('@keyframes'))) continue;
    if (sel && !sel.startsWith('@')) out.push({ sel, body: m[1]! });
  }
  return out;
}

const ALL = rules(CSS);
const ROOTS = ['.home-reskin', '.home-reskin-ov'] as const;
type Root = (typeof ROOTS)[number];

/** The root a single selector (one comma part) renders under, or null for a rule outside both. */
function rootOf(part: string): Root | null {
  if (/(?:^|[\s>+~])\.home-reskin-ov(?![\w-])/.test(part)) return '.home-reskin-ov';
  if (/(?:^|[\s>+~])\.home-reskin(?![\w-])/.test(part)) return '.home-reskin';
  return null;
}

/** Tokens declared on a rule whose selector list names the root ALONE (`.home-reskin-ov`, not `.home-reskin-ov .x`). */
function declaredOn(root: Root): Set<string> {
  const out = new Set<string>();
  for (const { sel, body } of ALL) {
    if (!sel.split(',').some((p) => p.trim() === root)) continue;
    for (const d of body.matchAll(/(--hr-[\w-]+)\s*:/g)) out.add(d[1]!);
  }
  return out;
}
const DECLARED: Record<Root, Set<string>> = {
  '.home-reskin': declaredOn('.home-reskin'),
  '.home-reskin-ov': declaredOn('.home-reskin-ov'),
};

/** `var(--hr-x)` reads with NO fallback — a fallback is a deliberate answer for "not declared here". */
const reads = (s: string) => [...s.matchAll(/var\(\s*(--hr-[\w-]+)\s*\)/g)].map((m) => m[1]!);

// SABOTAGE: move the --hr-rN scale back onto `.home-reskin` alone → RED (19 overlay rules, the square popups).
// SABOTAGE: add `.home-reskin-ov .hr-x { border-radius: var(--hr-r5); }` → RED (a radius declared on neither root).
test('every --hr-* token an overlay rule reads is declared where the overlay renders', () => {
  const missing: string[] = [];
  let overlayRadiusReads = 0;
  for (const { sel, body } of ALL) {
    const used = reads(body);
    if (!used.length) continue;
    for (const part of sel.split(',').map((p) => p.trim())) {
      const root = rootOf(part);
      if (!root) continue;
      for (const t of used) {
        if (root === '.home-reskin-ov' && /^--hr-r\d/.test(t)) overlayRadiusReads++;
        if (!DECLARED[root].has(t)) missing.push(`${part} reads ${t}, which is not declared on ${root}`);
      }
    }
  }
  // Pointed at something: the overlays DO read the radius scale (19 rules on 2026-10-22).
  console.log(`overlay rule × radius-token reads checked: ${overlayRadiusReads}`);
  assert.ok(overlayRadiusReads >= 10, `only ${overlayRadiusReads} overlay radius reads found — this guard is pointed at nothing`);
  assert.deepEqual(missing, [], `an undeclared token computes to nothing — the corner goes square:\n  ${missing.join('\n  ')}`);
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

// SABOTAGE: give a component `borderRadius: 'var(--hr-r14)'` after removing --hr-r14 from `.home-reskin-ov` → RED.
test('every --hr-* token a component reads inline is declared on both roots', () => {
  const missing: string[] = [];
  let seen = 0;
  for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('--hr-')) continue;
    for (const t of reads(stripComments(src))) {
      seen++;
      for (const root of ROOTS) {
        if (!DECLARED[root].has(t)) missing.push(`${relative(WEB, file)} reads ${t}, not declared on ${root}`);
      }
    }
  }
  console.log(`inline --hr-* reads checked: ${seen}`);
  assert.deepEqual(missing, [], missing.join('\n'));
});

/** The token a Tailwind `rounded-<key>` resolves to, read from tailwind.config's borderRadius block. */
function roundedToken(key: string): string {
  const block = TAILWIND.slice(TAILWIND.indexOf('borderRadius: {'));
  const body = block.slice(0, block.indexOf('}'));
  const m = body.match(new RegExp(`(?:^|\\n)\\s*'?${key}'?:\\s*'var\\((--[\\w-]+)\\)'`));
  assert.ok(m, `tailwind.config has no borderRadius.${key} token — this guard is pointed at nothing`);
  return m[1]!;
}

// The app's popup: ConfirmDialog, the centred box every "are you sure" in the app opens.
const POPUP_TOKEN = (() => {
  const dialog = stripComments(read('app/_components/confirm-dialog.tsx'));
  const cls = dialog.match(/<dialog\b[\s\S]*?className="([^"]+)"/)?.[1] ?? '';
  const key = cls.match(/(?:^|\s)rounded-(none|sm|md|lg|xl|2xl|3xl|full)(?=\s|$)/)?.[1];
  assert.ok(key, 'ConfirmDialog wears no rounded-* class — this guard is pointed at nothing');
  return roundedToken(key);
})();

// SABOTAGE: set `.home-reskin-ov .hr-ov-card` back to `var(--hr-r22)` → RED (a reskin copy, not the house token).
// SABOTAGE: drop its border-radius → RED.
test('the popup card wears the app popup radius, through a token declared on :root', () => {
  const card = ALL.filter(({ sel }) => sel.split(',').some((p) => p.trim() === '.home-reskin-ov .hr-ov-card'));
  assert.ok(card.length, '`.home-reskin-ov .hr-ov-card` is gone — this guard is pointed at nothing');
  const radius = card
    .map(({ body }) => body.match(/(?:^|[;\s])border-radius:\s*([^;]+);?/)?.[1]?.trim())
    .filter(Boolean)
    .at(-1);
  assert.equal(radius, `var(${POPUP_TOKEN})`, `the popup card's radius must be the popup's own token (${POPUP_TOKEN})`);
  assert.match(GLOBALS, new RegExp(`:root\\s*\\{[^}]*${POPUP_TOKEN}:\\s*\\d+px`), `${POPUP_TOKEN} must be declared on :root`);
});
