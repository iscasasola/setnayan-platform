/**
 * Setnayan AI Bespoke Monogram engine invariants (Node built-in test runner,
 * run via tsx). Guards the two load-bearing behaviors of the pure engine
 * (lib/bespoke-monogram-engine.ts):
 *
 *  1. SECURITY — sanitizeBespokeSvg is a strict REJECT-don't-repair
 *     allowlist. Generated SVGs come from a third-party API and render on
 *     couple + guest pages; any hostile primitive (script, handlers, hrefs,
 *     foreignObject, CSS url(), nested data URIs…) must nullify the whole
 *     candidate, never "get cleaned".
 *  2. NORMALIZATION — the model bakes the requested white background in as a
 *     full-viewBox path; stripCanvasBackground must remove exactly that path
 *     and nothing else, and the root tag must lose fixed width/height so the
 *     mark scales by viewBox.
 *
 * The GOOD fixture mirrors the real model output shape captured live
 * 2026-06-11 (root <svg> with viewBox 0 0 2048 2048 + a full-canvas
 * background path + flat content paths).
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBespokePrompt,
  sanitizeBespokeSvg,
  stripCanvasBackground,
} from './bespoke-monogram-engine';
import { BESPOKE_STYLES, isBespokeStyleKey } from './bespoke-monogram-shared';

// Mirrors the live output shape: prolog-less root, baked white background
// path walking the four corners, then flat content paths.
const GOOD_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" height="1024" preserveAspectRatio="none" style="display: block;" version="1.1" viewBox="0 0 2048 2048" width="1024">' +
  '<path d="M 0 0 L 2048 0 L 2048 2048 L 0 2048 Z" fill="#FFFFFF"/>' +
  '<path d="M 612 480 C 640 470 700 520 712 580 L 690 640 Z" fill="#5C2542"/>' +
  '<path d="M 1024 300 L 1100 360 L 1024 420 Z" fill="#C5A059"/>' +
  '</svg>';

test('good model output passes and is normalized', () => {
  const out = sanitizeBespokeSvg(GOOD_SVG);
  assert.ok(out, 'real-shaped output must survive sanitation');
  // Background path stripped…
  assert.ok(!out.includes('M 0 0 L 2048 0'), 'full-canvas background path must be stripped');
  // …content paths intact…
  assert.ok(out.includes('M 612 480'), 'content path 1 must survive');
  assert.ok(out.includes('M 1024 300'), 'content path 2 must survive');
  // …fixed dimensions + root style dropped, viewBox kept.
  assert.ok(!/<svg[^>]*\swidth=/.test(out), 'fixed width must be dropped from root');
  assert.ok(!/<svg[^>]*\sheight=/.test(out), 'fixed height must be dropped from root');
  assert.ok(!/<svg[^>]*\sstyle=/.test(out), 'root style attribute must be dropped');
  assert.ok(out.includes('viewBox="0 0 2048 2048"'), 'viewBox must survive');
});

test('XML prolog is stripped before validation', () => {
  const out = sanitizeBespokeSvg(`<?xml version="1.0" encoding="UTF-8"?>\n${GOOD_SVG}`);
  assert.ok(out);
  assert.ok(out.startsWith('<svg'));
});

test('hostile primitives are rejected outright (not repaired)', () => {
  const inject = (payload: string) =>
    GOOD_SVG.replace('</svg>', `${payload}</svg>`);
  const hostile = [
    inject('<script>alert(1)</script>'),
    inject('<foreignObject><body>x</body></foreignObject>'),
    inject('<image href="https://evil.example/x.png"/>'),
    inject('<use href="#x"/>'),
    inject('<style>path{fill:url(http://evil.example)}</style>'),
    inject('<animate attributeName="d" to="M0,0"/>'),
    inject('<a href="javascript:alert(1)">x</a>'),
    GOOD_SVG.replace('<path d="M 612', '<path onclick="alert(1)" d="M 612'),
    GOOD_SVG.replace('fill="#5C2542"', 'fill="url(https://evil.example/x)"'),
    inject('<path d="M0,0" fill="data:text/html,<script>1</script>"/>'),
  ];
  for (const [i, svg] of hostile.entries()) {
    assert.equal(sanitizeBespokeSvg(svg), null, `hostile case #${i} must be rejected`);
  }
});

test('internal gradient references pass; external url() rejects', () => {
  // The vector model fills shapes with local gradients — captured live
  // 2026-06-11 (fill="url(#Gradient2)" → <linearGradient id="Gradient2">).
  const withGradient = GOOD_SVG.replace(
    '</svg>',
    '<defs><linearGradient id="Gradient2"><stop offset="0" stop-color="#C5A059"/><stop offset="1" stop-color="#5C2542"/></linearGradient></defs>' +
      '<path d="M 10 10 L 20 20 Z" fill="url(#Gradient2)"/></svg>',
  );
  assert.ok(sanitizeBespokeSvg(withGradient), 'local gradient fill must pass');

  for (const evil of [
    'url(http://evil.example/x)',
    'url(//evil.example/x)',
    'url(  https://evil.example)',
    "url('http://evil.example')",
  ]) {
    const svg = GOOD_SVG.replace('fill="#5C2542"', `fill="${evil}"`);
    assert.equal(sanitizeBespokeSvg(svg), null, `${evil} must reject`);
  }
});

test('structural garbage is rejected', () => {
  assert.equal(sanitizeBespokeSvg(''), null);
  assert.equal(sanitizeBespokeSvg('not svg at all'), null);
  assert.equal(sanitizeBespokeSvg('<svg>truncated'), null);
  // Missing viewBox → cannot scale responsively → reject.
  assert.equal(
    sanitizeBespokeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0"/></svg>'),
    null,
  );
  // Oversize.
  const huge = GOOD_SVG.replace('</svg>', '<path d="M0,0 L1,1"/>'.repeat(20000) + '</svg>');
  assert.equal(sanitizeBespokeSvg(huge), null);
});

test('stripCanvasBackground only removes full-canvas paths', () => {
  const kept = stripCanvasBackground(
    '<svg viewBox="0 0 100 100"><path d="M 0 0 L 50 0 L 50 50 L 0 50 Z"/></svg>',
    100,
    100,
  );
  assert.ok(kept.includes('<path'), 'partial-canvas path must be kept');
  const stripped = stripCanvasBackground(
    '<svg viewBox="0 0 100 100"><path d="M 0 0 L 100 0 L 100 100 L 0 100 Z"/></svg>',
    100,
    100,
  );
  assert.ok(!stripped.includes('<path'), 'full-canvas path must be stripped');
});

test('prompt builder: caps, motif weaving, feedback clause, vendor never named', () => {
  for (const s of BESPOKE_STYLES) {
    const p = buildBespokePrompt({
      initialsA: 'M',
      initialsB: 'J',
      styleKey: s.key,
      motif: 'sampaguita blossoms',
      feedback: 'thinner lines, more negative space',
    });
    assert.ok(p.length <= 1000, `${s.key}: API hard-caps prompts at 1000 chars`);
    assert.ok(p.includes('M and J'), `${s.key}: initials must be present`);
    assert.ok(p.includes('sampaguita'), `${s.key}: motif must weave in`);
    assert.ok(p.includes('Refinement: thinner lines'), `${s.key}: feedback must append`);
    assert.ok(p.includes('plain white background'), `${s.key}: background ask enables the strip`);
    assert.ok(!/recraft/i.test(p), `${s.key}: vendor must never be named`);
  }
  // Single-initial brief reads naturally.
  const single = buildBespokePrompt({ initialsA: 'S', initialsB: '', styleKey: 'crest' });
  assert.ok(single.includes('letters S '), 'single initial must not read "S and "');
  // Oversized motif/feedback cannot bust the cap.
  const big = buildBespokePrompt({
    initialsA: 'A',
    initialsB: 'K',
    styleKey: 'botanical',
    motif: 'x'.repeat(500),
    feedback: 'y'.repeat(500),
  });
  assert.ok(big.length <= 1000);
});

test('style registry is closed + validated', () => {
  assert.equal(BESPOKE_STYLES.length, 4);
  for (const s of BESPOKE_STYLES) assert.ok(isBespokeStyleKey(s.key));
  assert.ok(!isBespokeStyleKey('dalle'));
  assert.ok(!isBespokeStyleKey(null));
});
