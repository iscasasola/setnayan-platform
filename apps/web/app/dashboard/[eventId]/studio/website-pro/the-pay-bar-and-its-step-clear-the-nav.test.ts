/**
 * the-pay-bar-and-its-step-clear-the-nav.test.ts — 🔒 ON EVENT SERVICES IN THE IPHONE APP, THE NAV NEVER COVERS THE PAY
 * BAR OR THE "1 OF 2 · EVENT PRO" STEP.
 *
 * The iPhone walk (25 Nov, 1.0 build 9) found the bottom nav covering the foot of the Pay bar, where the reviewer buys
 * the three plans. Two causes, both measured on the live page at 390 px:
 *
 *   A · The clearance went stale. The nav's dock publishes its height to `--sn-bottomdock-h`, and every bar standing on
 *       the nav (the Pay bar's ThumbDock among them) sits on that number. The dock's home-indicator room is its padding,
 *       and an iPhone WebView can report that inset after the first paint. The dock's ResizeObserver watched the content
 *       box, which padding does not change, so the number stayed short by the home indicator. With a 34 px inset the Pay
 *       bar sat 34 px into the nav's pill.
 *   B · The step was trapped. The event layout's `<main class="sn-vt-page">` carries a view-transition-name (globals.css),
 *       which makes it a stacking context, so a fixed layer drawn inside it sits under the nav and the thumb dock. The
 *       step that names each Apple payment was drawn there, and the nav and the Pay bar covered it.
 *
 *   1 · the step is drawn into <body> (createPortal), never inside the page's <main>;
 *   2 · on <body> it sits at the pop layer, above the nav, and its rules hang on its own hook (it has left the page's tree);
 *   3 · its sheet stands clear of the home indicator (the safe-area inset under its own room), as frame 08b draws;
 *   4 · the pop layer really is above the nav and the thumb dock in the one z scale;
 *   5 · the nav's dock publishes its height from its BORDER box, so a late home-indicator inset reaches every bar.
 *
 * SABOTAGE (each seen red once, 25 Nov, then restored): the step drawn inline again (1) · `z-index: 40` typed back (2) ·
 * the safe-area inset dropped from the sheet (3) · the dock observed with no box option again (5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const view = () => stripComments(readFileSync(join(HERE, '_components', 'event-services-view.tsx'), 'utf8'));
const sheet = () => stripComments(readFileSync(join(HERE, '_components', 'event-services-website.css'), 'utf8'));
const rule = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `no rule for ${selector}`);
  return css.slice(at, css.indexOf('}', at));
};

test('1 · the step is drawn into <body>, never inside the page’s <main>', () => {
  const v = view();
  assert.match(v, /import \{ createPortal \} from 'react-dom';/, 'the view no longer imports createPortal');
  assert.match(
    v,
    /createPortal\(\s*<div className="es-step"[^>]*data-event-services-apple-step=[\s\S]*?<\/div>,\s*document\.body,?\s*\)/,
    'the Apple step is drawn inside the page again: the nav covers it in the app',
  );
});

test('2 · on <body> it sits at the pop layer, on its own hook', () => {
  const css = sheet();
  assert.doesNotMatch(css, /\[data-event-services\] \.es-step\b/, 'a step rule still hangs on the page, which the layer has left');
  const step = rule(css, '[data-event-services-apple-step].es-step');
  assert.match(step, /position: fixed;/);
  assert.match(step, /z-index: var\(--sn-z-pop\);/, 'the step’s layer is not the pop layer');
  assert.match(css, /:is\(\[data-event-services\], \[data-event-services-cart\], \[data-event-services-apple-step\]\) \{/, 'the step lost the page’s colours');
});

test('3 · its sheet stands clear of the home indicator', () => {
  assert.match(
    rule(sheet(), '[data-event-services-apple-step] .es-step-sheet'),
    /padding: [^;]*env\(safe-area-inset-bottom/,
    'the step’s last line sits under the home indicator',
  );
});

test('4 · the pop layer is above the nav and the thumb dock', () => {
  const globals = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
  const z = (name: string) => {
    const m = globals.match(new RegExp(`--sn-z-${name}:\\s*(\\d+);`));
    assert.ok(m, `no --sn-z-${name}`);
    return Number(m[1]);
  };
  assert.ok(z('pop') > z('nav'), 'the pop layer is not above the nav');
  assert.ok(z('pop') > z('thumb'), 'the pop layer is not above the thumb dock');
});

test('5 · the nav’s dock publishes its height from its border box', () => {
  const nav = stripComments(readFileSync(join(WEB, 'app', '_components', 'nav', 'bottom-nav.tsx'), 'utf8'));
  assert.match(
    nav,
    /'--sn-bottomdock-h',[\s\S]{0,300}?new ResizeObserver\(publish\);\s*ro\.observe\(el, \{ box: 'border-box' \}\);/,
    'the dock watches its content box again: a late home-indicator inset leaves every bar on the nav 34 px too low',
  );
});
