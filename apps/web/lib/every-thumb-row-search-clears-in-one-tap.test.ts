/**
 * EVERY THUMB-ROW SEARCH HAS ONE ✕, INSIDE THE FIELD, THAT CLEARS IT IN ONE TAP (owner 2026-10-30, on the approved final
 * Suppliers design: "on the thumb row. this search bar needs to have an x inside to clear the text with one click" —
 * the prototype `suppliers-final/_build-src/extra.css` `.thumb .sx`, "× on every thumb-row search, shown only with
 * text"). Properties, not phrasings:
 *
 *  1. RENDERED: the shared row's own search field carries a ✕ button INSIDE its field (after the input, before the
 *     field closes) — on every host, since every host draws its field through `ThumbRow`. A date field has none.
 *  2. ONE ✕: the row draws no second, separate "clear" seat (the old riding-only one), and the browser's own search ✕
 *     is hidden everywhere — never two.
 *  3. SHOWN ONLY WITH WORDS: the stylesheet shows it from `:not(:placeholder-shown)` (so a host's reset or fill keeps
 *     it right) and, with no words, it takes NO width and no press — the placeholders measured whole at 320 stay whole.
 *  4. ONE TAP, NO KEYBOARD: the press keeps the focus where it was (mousedown default prevented) and clears through the
 *     input's own event (the host's onChange/onInput hear it); it never calls `.focus()` (that would raise the keyboard
 *     and, on Find, open "Go to a category").
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type * as RowMod from '@/components/thumb-row';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}
const { ThumbRow } = require('@/components/thumb-row') as typeof RowMod;

const ROOT = join(__dirname, '..');
const ROW = stripComments(readFileSync(join(ROOT, 'components/thumb-row.tsx'), 'utf8'));
const CSS = readFileSync(join(ROOT, 'components/thumb-row.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('every thumb-row search clears in one tap', () => {
  it('draws the ✕ INSIDE the search field, after the input — and none on a date field', () => {
    const html = renderToStaticMarkup(createElement(ThumbRow, { name: 'probe', field: { placeholder: 'Search guests' } }));
    const field = /<label[^>]*data-thumb-seat="field"[^>]*>([\s\S]*?)<\/label>/.exec(html);
    assert.ok(field, 'the row lost its field');
    const inner = field[1];
    const input = inner.indexOf('<input');
    const clear = inner.search(/<button[^>]*data-thumb-clear=""/);
    assert.ok(input >= 0, 'the field lost its input');
    assert.ok(clear > input, 'the ✕ is not inside the field after the input');
    assert.match(inner, /<button type="button" aria-label="Clear the search"/, 'the ✕ must be a plain button that names itself');

    const date = renderToStaticMarkup(createElement(ThumbRow, { name: 'probe', field: { placeholder: 'Check a date', kind: 'date' } }));
    assert.doesNotMatch(date, /data-thumb-clear/, 'a date field has no words to clear');
  });

  it('is the ONE ✕: no separate clear seat, and the browser’s own search ✕ is hidden everywhere', () => {
    assert.doesNotMatch(ROW, /data-thumb-seat="clear"/, 'a second ✕ seat came back beside the field');
    assert.match(CSS, /\.input::-webkit-search-cancel-button\s*\{\s*display:\s*none;\s*\}/, 'the browser’s own ✕ shows beside ours');
    assert.doesNotMatch(CSS, /\[data-riding\][^{]*-webkit-search-cancel-button/, 'the browser ✕ is hidden only while riding — two ✕ when not');
  });

  it('shows only with words, and takes no room or press without them', () => {
    const base = /\.clearIn\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    for (const d of [/width:\s*0;/, /visibility:\s*hidden;/, /pointer-events:\s*none;/, /opacity:\s*0;/]) {
      assert.match(base, d, `the empty ✕ lost ${d}`);
    }
    const shown = /\.input:not\(:placeholder-shown\)\s*~\s*\.clearIn\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    assert.ok(shown, 'the ✕ is not shown by :placeholder-shown');
    for (const d of [/width:\s*44px;/, /visibility:\s*visible;/, /pointer-events:\s*auto;/, /opacity:\s*1;/]) {
      assert.match(shown, d, `the shown ✕ lost ${d}`);
    }
    assert.match(CSS, /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.clearIn\s*\{\s*transition:\s*none;/, 'the ✕ must not animate for reduced motion');
  });

  it('clears through the input’s own event, keeps the focus where it was, and never raises the keyboard', () => {
    const btn = ROW.slice(ROW.indexOf('data-thumb-clear'), ROW.indexOf('</button>', ROW.indexOf('data-thumb-clear')));
    assert.match(btn, /onMouseDown=\{keepFocus\}/, 'a press on the ✕ takes the focus from the field');
    assert.match(btn, /setTyped\(el, ''\)/, 'the ✕ must clear through the input’s own event (the host hears it)');
    assert.doesNotMatch(btn, /\.focus\(/, 'the ✕ raised the keyboard');
  });
});
