/**
 * menu-opens-where-you-pressed.test.ts — the account menu appears in the corner
 * of the control that opened it.
 *
 * ─── WHAT THE OWNER ASKED (2026-08-17) ───────────────────────────────────
 * He pressed the account button at the TOP RIGHT of the bar and a full-height
 * panel flew in from the FAR LEFT: *"sign in is a pop up on the upper left?"*
 *
 * 🔑 THE TRIGGER MOVED AND THE PANEL'S GEOMETRY STAYED. The left drawer was
 * RIGHT when it was written. The avatar pill was `lg:hidden` — a phone control
 * — and desktop opened this same panel from the RAIL plaque in the bottom-left,
 * where a left drawer is the natural answer. Then the pill was promoted to
 * every width and became THE desktop account menu on all six top bars, and
 * nobody re-derived where its panel should land. Nothing broke on the day it
 * changed; the geometry just stopped matching the question.
 *
 * `SwitcherPlaqueTrigger` still has its own left drawer and is DELIBERATELY
 * untouched — its trigger really is on the left rail. Test 3 holds that line in
 * both directions, so a future "unify the two panels" pass has to read this
 * first.
 *
 * ⚠ THIS IS THE SAME SHAPE AS TWO OTHER ENTRIES IN THIS FAMILY — a decision
 * that outlived the premise it was decided on. It is worth more than the fix:
 * when a control moves, re-derive everything that was positioned relative to
 * where it used to be.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..');
const SRC = readFileSync(resolve(HERE, 'account-switcher.tsx'), 'utf8');
const FD_CSS = readFileSync(
  resolve(APP, '_components', 'frontdoor', 'front-door.css'),
  'utf8',
);

/** Strip comments — the component's own docblock QUOTES `lg:left-0` to explain
 *  why the pill no longer uses it, and a raw scan reads that as the defect. */
function code(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, '');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/.*$/gm, blank);
}

const CODE = code(SRC);

/**
 * The pill's panel is the one built inside `renderPanel()`; the plaque's is the
 * separate `<div role="dialog" aria-label="Account menu">` further down. They
 * are located by their own anchors because a file-level match cannot tell two
 * dialogs apart — the mistake this file's sibling guard already made once.
 */
function pillPanelClasses(): string {
  const at = CODE.indexOf('function renderPanel()');
  assert.ok(at >= 0, 'renderPanel() is gone from account-switcher.tsx — anchor moved.');
  const window = CODE.slice(at, at + 2200);
  const m = window.match(/'(lg:inset-x-auto[^']*)'/);
  assert.ok(m, `no desktop class line inside renderPanel(). Window:\n${window.slice(0, 400)}`);
  return m![1]!;
}

function plaquePanelClasses(): string {
  const at = CODE.indexOf(`aria-label="Account menu"`);
  assert.ok(at >= 0, 'the plaque panel\'s aria-label moved — anchor gone.');
  const m = CODE.slice(at, at + 700).match(/className="([^"]*fixed[^"]*)"/);
  assert.ok(m, 'no fixed-position className on the plaque panel.');
  return m![1]!;
}

/* ─── 1 · THE PILL'S PANEL IS ON THE RIGHT, UNDER THE BAR ────────────────── */

test('the top-bar menu opens on the right, where the pill is', () => {
  const desktop = pillPanelClasses();

  assert.ok(
    /\blg:right-\d/.test(desktop),
    `the pill's desktop panel has no right anchor. Its desktop classes: ${desktop}`,
  );
  assert.ok(
    !/\blg:left-0\b/.test(desktop),
    'the pill\'s desktop panel is pinned to the LEFT again — that is the far side of the ' +
      'screen from the control that opens it, which is what the owner photographed.',
  );
  assert.ok(
    !/\blg:inset-y-0\b/.test(desktop),
    'the pill\'s desktop panel is a full-height drawer again. It is a card under the bar; a ' +
      'full-height column reads as a second navigation, not as a menu.',
  );
  assert.ok(
    /\blg:top-\[calc\(var\(--fd-bar,\s*\d+px\)/.test(desktop),
    `the panel no longer clears the shared bar from the bar's own height token. ` +
      `Its desktop classes: ${desktop}`,
  );
});

/* ─── 2 · THE FALLBACK IS NOT A SECOND, DRIFTING MEASUREMENT ─────────────── */

test('the bar-height fallback equals what front-door.css actually declares', () => {
  const declared = FD_CSS.match(/--fd-bar:\s*(\d+)px/);
  assert.ok(declared, '`--fd-bar` is no longer declared as a px value in front-door.css.');

  const used = pillPanelClasses().match(/var\(--fd-bar,\s*(\d+)px\)/);
  assert.ok(used, 'the panel stopped carrying a fallback for `--fd-bar`.');

  assert.equal(
    used![1],
    declared![1],
    `the panel falls back to ${used![1]}px while the bar is ${declared![1]}px. THE FALLBACK IS ` +
      `WHAT RENDERS: \`--fd-bar\` is declared on \`.fd\`, and this panel is portaled to ` +
      `document.body, so it can never inherit the token. Two hand-typed numbers for one ` +
      `measurement is exactly the drift this repo keeps paying for — move both or neither.`,
  );
});

/* ─── 3 · THE calc() IS SPACED, OR THE PANEL GOES OFF SCREEN ─────────────── */

test('the bar-clearance calc() carries underscores, because CSS calc needs the spaces', () => {
  const desktop = pillPanelClasses();
  const m = desktop.match(/lg:top-\[calc\(([^\]]+)\)\]/);
  assert.ok(m, `no \`lg:top-[calc(...)]\` on the pill's desktop panel: ${desktop}`);

  const expr = m![1]!;
  assert.ok(
    /_\+_/.test(expr),
    `the calc() reads \`${expr}\` — the \`+\` has no underscores around it, so Tailwind emits ` +
      `\`calc(…+8px)\` with no whitespace. CSS calc REQUIRES whitespace around \`+\`, and the ` +
      `failure is SILENT: measured on the live stylesheet in a real browser, the unspaced form ` +
      `is kept by the parser and computes \`top: 2213.2px\` — the menu lands thousands of ` +
      `pixels down an empty page — while the spaced form computes 64px. Nothing throws, ` +
      `nothing logs, and the only symptom is a panel nobody can find.`,
  );

  // No RAW spaces either: Tailwind cannot emit a class name containing a space,
  // so the utility would simply never be generated and `top` would be unset.
  assert.ok(
    !/\s/.test(expr),
    `the calc() contains a real space (\`${expr}\`). Tailwind splits class names on whitespace, ` +
      `so this utility is never generated at all — use underscores.`,
  );
});

/* ─── 4 · THE RAIL PLAQUE KEEPS ITS LEFT DRAWER ─────────────────────────── */

test('the rail plaque still opens a left drawer — its trigger really is on the left', () => {
  const plaque = plaquePanelClasses();
  assert.ok(
    /\bleft-0\b/.test(plaque) && /\binset-y-0\b/.test(plaque),
    'the plaque\'s panel stopped being a full-height left drawer. That was NOT part of this ' +
      'change: the plaque sits in the left rail, so a left drawer opens where it was pressed. ' +
      'If unifying the two is intended, delete this test rather than loosening it.',
  );
});
