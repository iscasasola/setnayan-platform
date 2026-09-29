/**
 * THE MAKER'S LOGO NEVER SAVES ON OPEN, OPENS ON THE COUPLE'S OWN LOGO AND
 * NAMES, AND THE HERO PAGE IS THE HERO ALONE (owner 2026-09-27).
 *
 * Measured on the owner's own event: opening the Logo page mounted the studio on
 * a sample "M & J" over his uploaded logo, and the draft got that design with
 * no edit from him — then the Hero page previewed it, under the rest of the
 * page. Four holds:
 *
 *   (a) mounting writes nothing: the save gate refuses every canvas until the
 *       couple touches the studio, and then any canvas equal to how it stood;
 *   (b) the page opens on the couple's own logo / initials, never a sample;
 *   (c) the Hero canvas asks for the hero alone, and only the host canvas
 *       honours it — a guest's `?only=hero` is ignored;
 *   (d) no "Back to …" button on any made-once page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { createLogoSaveGate } from './maker-logo-save-gate';
import { makerLogoOpening } from './maker-logo-opening';
import { makerPageCanvasSrc } from './maker-made-once-pages';
import { canvasOnlyScene, canvasOnlyCss } from '../app/[slug]/_lib/editor-canvas';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const L = 'app/dashboard/[eventId]/launch/_components';
/** Code only — a comment explaining a removed thing must not convict the file. */
const code = (src: string) => stripComments(src);

const SVG_DEFAULT = '<svg viewBox="0 0 10 10"><path d="M0 0h1"/></svg>';
const SVG_EDITED = '<svg viewBox="0 0 10 10"><path d="M0 0h2"/></svg>';

/* ── (a) nothing saves on open ─────────────────────────────────────────── */

test('(a) the save gate refuses every canvas until the couple touches the studio', () => {
  const gate = createLogoSaveGate();
  // Mount, typeface, first layout, a tab switch, leaving — none of them touch.
  for (const svg of [SVG_DEFAULT, SVG_EDITED, 'anything']) {
    assert.equal(gate.shouldSave(svg), false, `saved "${svg}" before the couple touched anything`);
  }
  assert.equal(gate.touched(), false);
  // A touch while the studio is still loading (no canvas yet) is not a baseline.
  gate.touch(null);
  assert.equal(gate.touched(), false);
  gate.touch(SVG_DEFAULT);
  assert.equal(gate.shouldSave(SVG_DEFAULT), false, 'a tap that changed nothing must not save');
  assert.equal(gate.shouldSave(SVG_EDITED), true, 'a real edit must save');
  gate.touch(SVG_EDITED); // later touches never move the baseline
  assert.equal(gate.shouldSave(SVG_EDITED), true);
  gate.saved(SVG_EDITED);
  assert.equal(gate.shouldSave(SVG_EDITED), false, 'the same canvas is not saved twice');
  assert.equal(gate.shouldSave(''), false);
});

test('(a) the Logo page saves only through the gate, touched by the couple’s own input', () => {
  const src = code(read(`${L}/maker-logo.tsx`));
  const flush = src.slice(src.indexOf('const flush = useCallback('), src.indexOf('const onReach = '));
  assert.ok(flush.length > 100, 'anti-vacuity: the flush body was not found');
  const gateAt = flush.indexOf('gate.current.shouldSave(svg)');
  const postAt = flush.indexOf('hubDraftAction(');
  assert.ok(gateAt > 0, 'the flush no longer asks the gate before saving');
  assert.ok(postAt > gateAt, 'the draft is posted before the gate is asked');
  assert.match(flush, /if \(!gate\.current\.shouldSave\(svg\)[^)]*\) return;/, 'the gate answer is not what stops the save');
  // …and the autosave after a change asks it too.
  assert.match(src, /if \(!composed \|\| !ready \|\| !gate\.current\.shouldSave\(composed\)\) return;/);
  // The old "differs from the last save" test is what saved on open.
  assert.doesNotMatch(src, /lastSvg/, 'the last-saved comparison is back — an untouched canvas differs from null');
  // The baseline is taken on the couple's own input, before the edit lands.
  assert.match(src, /if \(!e\.isTrusted \|\| !readyRef\.current\) return;/);
  assert.match(src, /gate\.current\.touch\(composedRef\.current\)/);
  assert.match(src, /addEventListener\(t, onReach, true\)/, 'the touch must be caught in the capture phase');
});

/* ── (b) the couple's own logo and names ───────────────────────────────── */

const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1h8v8H1z"/></svg>';
/** The owner's event as measured: an uploaded logo, a leftover config with `text: ""`. */
const OWNER_ROW = {
  display_name: 'Indalecio & Claire',
  monogram_text: null,
  monogram_color: null,
  monogram_custom_svg: null,
  monogram_studio_config: { text: '', st: [], ink: '#5C2542', anim: { kind: 'handwriting', dur: 3 }, font: 'cardo' },
  monogram_uploaded_svg: LOGO,
};

test('(b) an event with an uploaded logo opens on THAT logo, not a studio design', () => {
  const o = makerLogoOpening(OWNER_ROW);
  assert.equal(o.source, 'upload', 'the uploaded logo is not what opens');
  assert.ok(o.svg, 'the uploaded logo is not shown');
  assert.equal(o.anim, null, 'a config with no composition beside it was read as a design');
  assert.equal(o.names, 'I & C');
});

test('(b) a named couple gets their own initials — never "M & J"', () => {
  for (const [display, want] of [
    ['Indalecio & Claire', 'I & C'],
    ['Aira and Boy', 'A & B'],
    ['Setnayan', 'S'],
  ] as const) {
    const o = makerLogoOpening({ ...OWNER_ROW, display_name: display, monogram_uploaded_svg: null });
    assert.equal(o.names, want, display);
    assert.notEqual(o.names, 'M & J');
  }
  // A composition opens as the couple's logo (and outranks the upload).
  const designed = makerLogoOpening({ ...OWNER_ROW, monogram_custom_svg: LOGO });
  assert.equal(designed.source, 'mark', 'a real design must reopen');
  assert.equal(designed.svg, LOGO);
  // Nothing at all → their own initials, never a sample.
  const empty = makerLogoOpening({ ...OWNER_ROW, monogram_uploaded_svg: null });
  assert.equal(empty.source, 'names');
});

test('(b) no sample couple can reach a real event through the studio', () => {
  const engine = read('lib/monogram-studio/engine.ts');
  assert.doesNotMatch(engine, /\[\s*'M'\s*,\s*'&'\s*,\s*'J'\s*\]/, 'the engine falls back to M & J again');
  assert.doesNotMatch(engine, /first\(parts\[\d\], '[MJ]'\)/, 'the engine defaults a missing initial to M/J');
  // Empty saved names never overwrite the couple's initials.
  assert.match(engine, /cfg\.text\.trim\(\) \|\| !initialNames/);
  assert.match(engine, /if \(initialNames && !\(initialConfig && typeof initialConfig\.text === 'string' && initialConfig\.text\.trim\(\)\)\)/);
  // The Names box starts empty and asks — no sample couple in either editor DOM.
  for (const rel of ['lib/monogram-studio/markup.ts', 'lib/monogram-studio/markup-v2.ts']) {
    const markup = read(rel);
    assert.match(markup, /id="names" type="text" value="" placeholder="Add your names"/, `${rel}: the Names box has a sample value`);
    assert.doesNotMatch(markup, /Maria|Juan/, `${rel}: a sample couple is back`);
  }
  const studio = code(read('app/dashboard/[eventId]/monogram/studio.tsx'));
  assert.doesNotMatch(studio, /M & J/, 'the studio preview falls back to a sample couple');
  // And the Maker's panel reads the opening rule, not its own copy of it.
  const panel = code(read(`${L}/maker-made-once.tsx`));
  assert.match(panel, /makerLogoOpening\(m\.drafted\)/);
  assert.doesNotMatch(panel, /sanitizeStudioConfig\(/, 'the panel re-decides which config counts');
});

/* ── (c) the Hero page is the hero alone — host canvas only ────────────── */

test('(c) the Hero page’s canvas asks for the hero alone', () => {
  const src = makerPageCanvasSrc('/ana-ben', 'hero', 'rsvp');
  assert.ok(src && /[?&]editor=1(&|$)/.test(src), 'the hero page is not the host canvas');
  assert.match(src ?? '', /[?&]only=hero(&|#|$)/, 'the hero page no longer asks for the hero alone');
  // No other page is cut down.
  for (const key of ['love-story', 'rsvp-page', 'reveal'] as const) {
    assert.doesNotMatch(makerPageCanvasSrc('/ana-ben', key, 'rsvp') ?? '', /only=/, key);
  }
});

test('(c) `only=hero` is honoured by the host canvas and ignored for a guest', () => {
  assert.equal(canvasOnlyScene({ only: 'hero' }, true), 'hero');
  assert.equal(canvasOnlyScene({ only: 'hero' }, false), null, 'a guest’s ?only=hero cut their page down');
  assert.equal(canvasOnlyScene({ only: 'constructor' }, true), null);
  assert.equal(canvasOnlyScene({ only: 'story' }, true), null);
  assert.equal(canvasOnlyScene(undefined, true), null);

  const css = canvasOnlyCss('hero');
  // Fail-visible: applies only while the hero marker is on the page.
  assert.ok(css.startsWith('body:has([data-maker-section="f:hero"]) *'), css);
  for (const keep of [
    ':not(:has([data-maker-section="f:hero"] + *))',
    ':not([data-maker-section="f:hero"] + *)',
    ':not([data-maker-section="f:hero"] + * *)',
    ':not([data-main-ground])',
  ]) {
    assert.ok(css.includes(keep), `the hero-only CSS no longer keeps ${keep}`);
  }

  // page.tsx resolves it ONLY through the host-verified flag; site-body emits
  // the style ONLY on the host canvas.
  const page = read('app/[slug]/page.tsx');
  assert.match(page, /canvasOnly: canvasOnlyScene\(search, isEditorCanvas\)/);
  assert.equal((page.match(/search\.only\b/g) ?? []).length, 0, 'page.tsx reads ?only= around the host check');
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /\{isEditorCanvas && canvasOnly \? <style>\{canvasOnlyCss\(canvasOnly\)\}<\/style> : null\}/);
  assert.equal((body.match(/canvasOnlyCss\(/g) ?? []).length, 1, 'a second, unguarded hero-only mount');
});

/* ── (d) no "Back to …" on a made-once page ────────────────────────────── */

test('(d) no made-once page carries a "Back to …" button', () => {
  const FILES = [
    `${L}/maker-page.tsx`,
    `${L}/maker-logo.tsx`,
    `${L}/maker-made-once.tsx`,
    `${L}/maker-details.tsx`,
    `${L}/maker-reveal.tsx`,
    `${L}/maker-rsvp-ask.tsx`,
    `${L}/maker-shell.tsx`,
    // Details part 3: the Logo, Hero and Reveal are drawn inside Details now.
    `${L}/details-look-pages.tsx`,
    `${L}/details-workspace.tsx`,
  ];
  for (const rel of FILES) {
    const src = code(read(rel));
    assert.doesNotMatch(src, /Back to\b/, `${rel} says "Back to …" again`);
    assert.doesNotMatch(src, /closeLabel/, `${rel} has a close label again`);
  }
  const page = code(read(`${L}/maker-page.tsx`));
  assert.doesNotMatch(page, /onClose/, 'MakerPage takes a close handler again');
  console.log(`[logo/hero] made-once files free of "Back to": ${FILES.length}`);
});
