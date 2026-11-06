/**
 * studio-info-has-one-hairline.test.ts — STUDIO › INFO DRAWS ONE KIND OF LINE BETWEEN ITS ROWS (owner 2026-10-09: "no lines on row?").
 *
 * The template's row (`control_templates_2026-10-08.html` § 6, `.fr`) is a `border-top` on every row but the first. On a screen
 * narrower than 1024 px the Studio's phone skin also gave every FORM FIELD a full-width `border-top` (its band runs edge to edge,
 * `margin: 0 -16px`), while a boundary INSIDE a field is the Form row's own line, which sits inside the field's 16 px of
 * padding — so Info alternated: edge to edge under Event name · Date · Venue · Start from · What to bring · More for guests, inset
 * under Opening line · Special message · Restore · Reset. (Measured in a real browser on the dev Maker lab, 800 px.)
 *
 * This guard holds the cure in two halves, the two things a browser would measure:
 *  (A) the rows Info draws (rendered, not read): every element in them that draws a horizontal boundary wears the ONE Form-row
 *      signature — no row of Info brings a line of its own;
 *  (B) the skin's CSS (parsed with postcss, not matched by string): an Info field's own top line is drawn INSET by exactly the
 *      skin's own side padding, in exactly the row line's colour, for BOTH shapes of Info field (one that holds Form rows, one that
 *      holds the quiet Restore · Reset · About rows), after the skin's rule; the first Info field draws none; and the skin's
 *      edge-to-edge line is still what every OTHER Studio form field gets.
 *
 * SABOTAGE (each seen RED, then restored): the override removed · the inset 16 → 0 · a different colour · the quiet shape left out ·
 * the first-field rule removed · a row of Info given its own `border-b`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import postcss from 'postcss';

// `server-only` / `client-only` resolve to an empty module (Info's rows reach the draft door), as in the guest card's tests.
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_info_hairline__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}
(globalThis as { React?: unknown }).React = React;

/** The Form row's own boundary, as the template draws it: a line above every row, none above the first. */
const ROW_LINE = 'border-t border-ink/10 first:border-t-0';
/** A utility that draws a horizontal boundary. */
const HORIZONTAL_LINE = /^(border-t|border-b|border-y|divide-y|border-t-\d+|border-b-\d+)$/;

test('(A) the rows Info draws bring ONE kind of boundary — the Form row’s — and nothing of their own', async () => {
  const { StudioOpeningLine, StudioWords } = await import('@/app/dashboard/[eventId]/launch/_components/studio-info');
  const { StudioReadOnlyFact } = await import('@/app/dashboard/[eventId]/launch/_components/studio-tools');
  const pages = [
    createElement(StudioReadOnlyFact, { label: 'Date', value: 'December 18, 2026', line: 'Set when you book your venue in Suppliers', data: 'date' }),
    createElement(StudioReadOnlyFact, { label: 'Venue', value: 'The Garden', line: 'Set when you book your venue in Suppliers', data: 'venue' }),
    createElement(StudioOpeningLine, { eventId: 'E', value: 'Together with their families' }),
    createElement(StudioWords, { eventId: 'E', fact: 'special_message', value: 'See you' }),
    createElement(StudioWords, { eventId: 'E', fact: 'what_to_bring', value: 'A jacket' }),
  ];
  let rows = 0;
  for (const page of pages) {
    const html = renderToStaticMarkup(page);
    for (const m of html.matchAll(/class="([^"]*)"/g)) {
      const tokens = m[1]!.split(/\s+/).filter(Boolean).map((t) => t.replace(/^(sm|md|lg|xl):/, ''));
      const lines = tokens.filter((t) => HORIZONTAL_LINE.test(t));
      if (lines.length === 0) continue;
      assert.equal(m[1]!.includes(ROW_LINE), true, `an element of Info draws a boundary that is not the Form row's: class="${m[1]}"`);
      assert.deepEqual(lines, ['border-t'], `an element of Info draws more than the one line above it: class="${m[1]}"`);
      rows += 1;
    }
  }
  assert.ok(rows >= 5, `only ${rows} boundaries were seen — the render is no longer exercising Info's rows`);
});

const css = async () => {
  const { studioFullScreenCss } = await import('@/lib/studio-details');
  return postcss.parse(studioFullScreenCss());
};

/** The declarations of a rule, by property. */
const decls = (rule: postcss.Rule) => Object.fromEntries(rule.nodes.filter((n): n is postcss.Declaration => n.type === 'decl').map((d) => [d.prop, d.value.replace(/\s+/g, '')]));

test('(B) an Info field’s own top line is drawn INSET by the skin’s own padding, in the row line’s colour — for both shapes of Info field', async () => {
  const root = await css();
  const media = root.nodes.find((n): n is postcss.AtRule => n.type === 'atrule' && n.name === 'media' && /max-width:1023/.test(n.params))!;
  assert.ok(media, 'the phone skin’s media block is gone');
  const rules = media.nodes!.filter((n): n is postcss.Rule => n.type === 'rule');

  /* The skin's rule for every form field: its side padding and the colour of its line. */
  const skinIdx = rules.findIndex((r) => /(^|,)\[data-maker-studio-full\] \[data-details-workspace\] \[data-details-form-field\]$/.test(r.selector) && decls(r)['border-top']);
  assert.ok(skinIdx >= 0, 'the skin’s rule for a form field (its edge-to-edge line) is gone — every other Studio form relies on it');
  const skin = decls(rules[skinIdx]!);
  const pad = /^\d+px(\d+)px$/.exec(skin['padding']!)?.[1];
  assert.ok(pad, `the skin's padding was not read: ${skin['padding']}`);
  const colour = /solid(rgb\(var\(--color-ink\)\/\.\d+\))$/.exec(skin['border-top']!)?.[1];
  assert.ok(colour, `the skin's line colour was not read: ${skin['border-top']}`);

  /* The Info override: one rule, AFTER the skin, for BOTH shapes of Info field. */
  const idx = rules.findIndex((r, i) => i > skinIdx && /\[data-studio-info-rows\]/.test(r.selector) && /\[data-studio-quiet\]/.test(r.selector) && decls(r)['background-image']);
  assert.ok(idx > skinIdx, 'no rule after the skin draws an Info field’s own line inset (for the Form-row field AND the quiet-rows field)');
  const d = decls(rules[idx]!);
  assert.equal(d['border-top-color'], 'transparent', 'the full-width border still shows through');
  assert.equal(d['background-image'], `linear-gradient(${colour},${colour})`, 'the inset line is not the row line’s colour');
  assert.equal(d['background-repeat'], 'no-repeat');
  assert.equal(d['background-origin'], 'border-box');
  assert.equal(d['background-position'], `${pad}px0`, 'the inset line does not start where the rows’ text starts');
  assert.equal(d['background-size'], `calc(100%-${Number(pad) * 2}px)1px`, 'the inset line does not stop where the rows’ text stops');
  assert.match(rules[idx]!.selector, /^\[data-maker-studio-full\] \[data-details-workspace\] :is\(/, 'the override is not scoped like the skin, so it may lose to it');

  /* The first Info field has no line above it (the template's first row has none). */
  const { STUDIO_TILE_ITEM } = await import('@/lib/studio-tile-defs');
  const first = rules.findIndex((r, i) => i > idx && r.selector.includes(`[data-details-editor="${STUDIO_TILE_ITEM.info}"]`) && decls(r)['background-image'] === 'none');
  assert.ok(first > idx, `the Info form's first field (${STUDIO_TILE_ITEM.info}) still draws a line above it`);
});

test('(B2) …and nothing else gives an Info field a full-width line: the only full-width rule is the skin’s, and the Info override stands over it', async () => {
  const root = await css();
  const all: postcss.Rule[] = [];
  root.walkRules((r) => {
    all.push(r);
  });
  const withBorder = all.filter((r) => /\[data-details-form-field\]/.test(r.selector) && /border-top(?!-color)/.test(r.toString()) && !/transparent/.test(r.toString()));
  assert.equal(withBorder.length, 1, `${withBorder.length} rules draw a form field's own border — more than one kind of line is back: ${withBorder.map((r) => r.selector).join(' | ')}`);
});
