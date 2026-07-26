/**
 * READ-TIME monogram SVG gate invariants (Node built-in test runner, via tsx).
 *
 * The threat model these guard (SEC-3 · 2026-07-26): `events` UPDATE RLS is
 * row-level, the anon key is public, and monogram_custom_svg is a legitimately
 * host-written column — so a host can PATCH arbitrary markup into it via
 * PostgREST, skipping the write-time sanitizer entirely. Whatever they store
 * then renders in OTHER sessions (the vendor client brief inlines it), with no
 * script-src CSP to catch it. safeMonogramSvg() is the read-side gate.
 *
 * The hostile cases below are deliberately the ones that DEFEAT the write-time
 * list in lib/bespoke-monogram-engine.ts — the `/`- and quote-separated event
 * handlers, the namespaced <svg:script>, the <img> reachable through the
 * <desc>/<title> HTML integration points. If this file ever passes while those
 * regressions are reintroduced, the gate is decorative.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveEventMonogramSvg, safeMonogramSvg } from './monogram-svg-safe';
import { sanitizeBespokeSvg } from './bespoke-monogram-engine';
import { sanitizeStudioSvg } from './monogram-studio-shared';

/* ── Legitimate producers must survive the gate ─────────────────────────────
   If any of these fail, real couples lose their mark — the gate is
   fail-closed, so a false reject is a visible product regression. */

const BESPOKE_OUTPUT =
  '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 2048 2048">' +
  '<path d="M 612 480 C 640 470 700 520 712 580 L 690 640 Z" fill="#5C2542"/>' +
  '<path d="M 1024 300 L 1100 360 L 1024 420 Z" fill="#C5A059"/>' +
  '</svg>';

// The sharp-built wrapper uploadMonogram() stores for PNG/JPEG/WEBP uploads.
const RASTER_UPLOAD =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
  '<image width="512" height="512" href="data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4H"/></svg>';

test('real bespoke-engine output passes', () => {
  assert.equal(safeMonogramSvg(BESPOKE_OUTPUT), BESPOKE_OUTPUT);
});

test('output of the write-time sanitizers passes the read-time gate', () => {
  // Whatever the write path is willing to STORE, the read path must be willing
  // to RENDER — otherwise saving a monogram silently does nothing.
  const bespoke = sanitizeBespokeSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" height="1024" width="1024" viewBox="0 0 2048 2048">' +
      '<path d="M 0 0 L 2048 0 L 2048 2048 L 0 2048 Z" fill="#FFFFFF"/>' +
      '<path d="M 612 480 C 640 470 700 520 712 580 L 690 640 Z" fill="#5C2542"/></svg>',
  );
  assert.ok(bespoke, 'fixture must pass the write-time gate first');
  assert.equal(safeMonogramSvg(bespoke), bespoke, 'bespoke output must pass the read gate');

  const studio = sanitizeStudioSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="-10.5 -10.5 420 420">' +
      '<path d="M 10 10 L 90 90 Z" fill="#5C2542"/></svg>',
  );
  assert.ok(studio, 'fixture must pass the write-time gate first');
  assert.equal(safeMonogramSvg(studio), studio, 'studio output must pass the read gate');
});

test('the sharp-built raster upload wrapper still renders', () => {
  // <image> + href= + data: are otherwise all rejected. This exact machine-built
  // shape is the one admitted exception; breaking it blanks every raster mark.
  assert.equal(safeMonogramSvg(RASTER_UPLOAD), RASTER_UPLOAD);
});

test('local gradient references survive', () => {
  const withGradient =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>' +
    '<path d="M0 0 L10 10 Z" fill="url(#g)"/></svg>';
  assert.equal(safeMonogramSvg(withGradient), withGradient);
});

test('an a11y <title>/<desc> mark survives', () => {
  const withTitle =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<title>M &amp; J</title><desc>Monogram</desc><path d="M0 0 L10 10 Z"/></svg>';
  assert.equal(safeMonogramSvg(withTitle), withTitle);
});

/* ── Hostile input must be neutralised ─────────────────────────────────────── */

const HOSTILE: [string, string][] = [
  ['plain script', '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>'],
  [
    'namespaced script — /<script/i does not match `<svg:script`',
    '<svg viewBox="0 0 10 10"><svg:script>alert(1)</svg:script></svg>',
  ],
  ['onload on the root', '<svg viewBox="0 0 10 10" onload="alert(1)"><path d="M0 0"/></svg>'],
  [
    'slash-separated handler — the HTML tokenizer re-enters before-attribute-name after `/`',
    '<svg viewBox="0 0 10 10"><circle/onload=alert(1) r="1"/></svg>',
  ],
  [
    'quote-separated handler — same re-entry after a quoted value',
    '<svg viewBox="0 0 10 10"><circle fill="x"onload=alert(1) r="1"/></svg>',
  ],
  ['newline-separated handler', '<svg viewBox="0 0 10 10"><circle\nonload=alert(1)/></svg>'],
  ['mixed-case handler', '<svg viewBox="0 0 10 10"><circle OnLoAd="alert(1)"/></svg>'],
  ['handler with space before =', '<svg viewBox="0 0 10 10"><circle onload = "alert(1)"/></svg>'],
  [
    'animation-event handler',
    '<svg viewBox="0 0 10 10"><circle onanimationstart="alert(1)"/></svg>',
  ],
  ['foreignObject', '<svg viewBox="0 0 10 10"><foreignObject><b>x</b></foreignObject></svg>'],
  [
    '<img onerror> through the <desc> HTML integration point',
    '<svg viewBox="0 0 10 10"><desc><img src=x onerror=alert(1)></desc></svg>',
  ],
  [
    '<img/onerror> through <title> — no whitespace before the handler',
    '<svg viewBox="0 0 10 10"><title><img/onerror=alert(1) src=x></title></svg>',
  ],
  ['javascript: URI', '<svg viewBox="0 0 10 10"><a href="javascript:alert(1)"><path/></a></svg>'],
  [
    'whitespace-obfuscated javascript: URI',
    '<svg viewBox="0 0 10 10"><a xlink:href="java\nscript:alert(1)"><path/></a></svg>',
  ],
  [
    'numeric-entity-obfuscated scheme',
    '<svg viewBox="0 0 10 10"><a href="&#106;avascript:alert(1)"><path/></a></svg>',
  ],
  ['xlink:href', '<svg viewBox="0 0 10 10"><use xlink:href="#x"/></svg>'],
  ['<use>', '<svg viewBox="0 0 10 10"><use href="#x"/></svg>'],
  ['<style> block', '<svg viewBox="0 0 10 10"><style>*{x:y}</style></svg>'],
  ['<iframe>', '<svg viewBox="0 0 10 10"><iframe src="//evil"></iframe></svg>'],
  ['<embed>', '<svg viewBox="0 0 10 10"><embed src="//evil"/></svg>'],
  ['<object>', '<svg viewBox="0 0 10 10"><object data="//evil"></object></svg>'],
  ['<animate> SMIL', '<svg viewBox="0 0 10 10"><animate attributeName="x"/></svg>'],
  [
    '<animateTransform> — prefix match must cover it',
    '<svg viewBox="0 0 10 10"><animateTransform attributeName="transform"/></svg>',
  ],
  ['<set>', '<svg viewBox="0 0 10 10"><set attributeName="x" to="1"/></svg>'],
  ['external url()', '<svg viewBox="0 0 10 10"><path fill="url(https://evil/x)"/></svg>'],
  ['nested data URI', '<svg viewBox="0 0 10 10"><path fill="data:image/svg+xml,x"/></svg>'],
  [
    'arbitrary <image> that is NOT the machine-built raster wrapper',
    '<svg viewBox="0 0 10 10"><image href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/></svg>',
  ],
  [
    'DOCTYPE with an XXE internal subset',
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg viewBox="0 0 10 10"><path/></svg>',
  ],
  ['CDATA-wrapped script', '<svg viewBox="0 0 10 10"><![CDATA[<script>alert(1)</script>]]></svg>'],
  ['no viewBox', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'],
  ['not an svg at all', '<div onclick="alert(1)">x</div>'],
  ['truncated', '<svg viewBox="0 0 10 10"><path'],
  ['trailing markup after </svg>', '<svg viewBox="0 0 10 10"><path/></svg><script>alert(1)</script>'],
];

for (const [label, svg] of HOSTILE) {
  test(`hostile input rejected: ${label}`, () => {
    assert.equal(safeMonogramSvg(svg), null, `${label} must be rejected`);
  });
}

test('oversized input is rejected', () => {
  const huge = `<svg viewBox="0 0 10 10">${'<path d="M0 0"/>'.repeat(40_000)}</svg>`;
  assert.equal(safeMonogramSvg(huge), null);
});

test('non-strings and blanks are rejected without throwing', () => {
  for (const v of [null, undefined, 0, {}, [], '', '   ']) {
    assert.equal(safeMonogramSvg(v), null);
  }
});

/* ── The resolver ───────────────────────────────────────────────────────────
   Both columns are host-writable, so both must be gated — and a poisoned
   upload must FALL THROUGH to a clean custom mark rather than blanking it. */

test('resolver applies the gate to both columns', () => {
  assert.equal(resolveEventMonogramSvg(null), null);
  assert.equal(resolveEventMonogramSvg({}), null);

  assert.equal(
    resolveEventMonogramSvg({ monogram_custom_svg: BESPOKE_OUTPUT }),
    BESPOKE_OUTPUT,
    'a clean custom mark renders',
  );

  assert.equal(
    resolveEventMonogramSvg({
      monogram_uploaded_svg: RASTER_UPLOAD,
      monogram_custom_svg: BESPOKE_OUTPUT,
    }),
    RASTER_UPLOAD,
    'upload keeps precedence over custom',
  );

  assert.equal(
    resolveEventMonogramSvg({
      monogram_uploaded_svg: '<svg viewBox="0 0 10 10" onload="alert(1)"></svg>',
      monogram_custom_svg: BESPOKE_OUTPUT,
    }),
    BESPOKE_OUTPUT,
    'a poisoned upload falls through to the clean custom mark, it does not blank it',
  );

  assert.equal(
    resolveEventMonogramSvg({
      monogram_uploaded_svg: '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>',
      monogram_custom_svg: '<svg viewBox="0 0 10 10" onload="alert(1)"></svg>',
    }),
    null,
    'both poisoned resolves to null — the surface falls back to the initials mark',
  );
});
