/**
 * every-widget-is-one-section.test.ts — THE LEVEL THE PARTS LIVE ON.
 *
 * "One part after another" animates `.hub-canvas-body > * > *` — the
 * grandchildren of the frame. That works because every widget renders ONE
 * top-level element whose direct children are its parts:
 *
 *     .hub-canvas-body      the frame's inner layer
 *       └ <section>         the widget's own root
 *           ├ eyebrow       ← these are the parts
 *           ├ heading
 *           └ words
 *
 * 🔴 IF A WIDGET EVER RETURNS TWO TOP-LEVEL NODES, that selector addresses
 * their CHILDREN instead of themselves. The wrong things animate, in the wrong
 * order, and nothing anywhere goes red: the page still renders, the classes are
 * still right, and the couple simply sees a section that moves oddly. This is
 * the guard for that, and it RENDERS each widget rather than reading its source
 * — a fragment is invisible in JSX and obvious in the DOM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;

const COMPONENTS = join(__dirname, '..', 'app', '[slug]', '_components');

/** Direct-child element count of `html`'s outermost element, and its tag. */
function shape(html: string): { top: string | null; roots: number; parts: number } {
  let depth = 0;
  let roots = 0;
  let parts = 0;
  let top: string | null = null;
  for (const m of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*?)(\/?)>/g)) {
    const closing = m[1] === '/';
    const self = m[4] === '/' || ['br', 'img', 'hr', 'input'].includes(m[2] ?? '');
    if (closing) {
      depth -= 1;
      continue;
    }
    if (depth === 0) {
      roots += 1;
      top ??= m[2] ?? null;
    } else if (depth === 1) {
      parts += 1;
    }
    if (!self) depth += 1;
  }
  return { top, roots, parts };
}

/* Each widget with one set of props that makes it render something. A widget
   that returns null for these is skipped and SAID so — a silent skip would let
   a whole component drift out of the shape unobserved. */
const CASES: Array<{ file: string; name: string; props: Record<string, unknown> }> = [
  {
    file: 'our-love-story-widget',
    name: 'OurLoveStoryWidget',
    props: { config: { how_we_met: 'We met in 2019.', proposal: 'In Baguio.', milestones: [{ year: 2019, title: 'Met' }] } },
  },
  {
    file: 'custom-section-widget',
    name: 'CustomSectionWidget',
    props: { config: { custom: { title: 'Our vows', body: 'Line one\nLine two' } } },
  },
];

test('⭐ precondition: the widgets under test do render', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  for (const c of CASES) {
    const mod = (await import(join(COMPONENTS, c.file))) as Record<string, unknown> & {
      default?: Record<string, unknown>;
    };
    const Cmp = (mod[c.name] ?? mod.default?.[c.name]) as React.FunctionComponent<
      Record<string, unknown>
    >;
    assert.ok(Cmp, `${c.file} exports ${c.name}`);
    const html = renderToStaticMarkup(React.createElement(Cmp, c.props));
    assert.ok(html.length > 0, `${c.file} rendered nothing for its sample props`);
  }
});

test('🔴 ONE top-level element per widget — the level the sequence addresses', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  for (const c of CASES) {
    const mod = (await import(join(COMPONENTS, c.file))) as Record<string, unknown> & {
      default?: Record<string, unknown>;
    };
    const Cmp = (mod[c.name] ?? mod.default?.[c.name]) as React.FunctionComponent<
      Record<string, unknown>
    >;
    const { top, roots, parts } = shape(renderToStaticMarkup(React.createElement(Cmp, c.props)));
    assert.equal(
      roots,
      1,
      `${c.file} rendered ${roots} top-level elements. "One part after another" ` +
        `addresses the grandchildren of the frame, so a second root shifts it one ` +
        `level down and the wrong things animate, silently.`,
    );
    assert.equal(top, 'section', `${c.file}'s root should be a <section>`);
    assert.ok(parts >= 1, `${c.file} has no parts to sequence`);
  }
});

test('⛔ the CSS addresses the grandchildren, and only when the parts carry it', () => {
  const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  assert.match(
    css,
    /\.hub-seq-parts\s*>\s*\.hub-canvas-body\s*>\s*\*\s*>\s*\*\s*\{/,
    'the parts are the grandchildren of the body',
  );
  // 🔑 Exclusive levels: both animating would multiply two opacities and the
  // section would arrive muddy.
  assert.match(css, /\.hub-seq-whole\.hub-tl-time\s*>\s*\.hub-canvas-body\s*\{/);
  assert.match(css, /\.hub-seq-whole\.hub-tl-scrub\s*>\s*\.hub-canvas-body\s*\{/);
  assert.doesNotMatch(
    css,
    /\n\s*\.hub-tl-(time|scrub)\s*>\s*\.hub-canvas-body\s*\{/,
    'no rule animates the block without first asking which level carries the arrival',
  );
});

test('⭐ every part up to the eighth gets its own gap', () => {
  const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  for (let n = 2; n <= 8; n += 1) {
    assert.match(
      css,
      new RegExp(`\\.hub-seq-parts\\.hub-tl-time[^{]*nth-child\\(${n}\\)[^}]*animation-delay`),
      `part ${n} has no delay — it would arrive with the first`,
    );
    assert.match(
      css,
      new RegExp(`\\.hub-seq-parts\\.hub-tl-scrub[^{]*nth-child\\(${n}\\)[^}]*animation-range`),
      `part ${n} has no range offset — scrubbed, a delay does nothing`,
    );
  }
});

test('⛔ no widget component was edited to make this work', () => {
  // The whole reason this was cheap. A `data-hub-part` appearing in a widget
  // means somebody started marking parts by hand — which is a different design
  // and should be a deliberate one, not a drift.
  const offenders: string[] = [];
  for (const f of readdirSync(COMPONENTS)) {
    if (!f.endsWith('-widget.tsx')) continue;
    const src = readFileSync(join(COMPONENTS, f), 'utf8');
    if (/data-hub-part|hub-canvas-body/.test(src)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `widgets must stay ignorant of the canvas: ${offenders.join(', ')}`);
});
