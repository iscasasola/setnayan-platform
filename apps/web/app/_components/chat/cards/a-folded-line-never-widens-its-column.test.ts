/**
 * 📏 A FOLDED LINE NEVER WIDENS ITS COLUMN (ship review of #8044 / #8053, 20 Nov 2026). A settled card folds to ONE
 * truncated line. Inside an auto-width grid column (the chat stream), a grid item's automatic minimum width is its
 * min-content — and a `truncate` (nowrap) line's min-content is the WHOLE sentence, so a long "₱40,000 · accepted ·
 * …" pushed the column past the phone and the right gutter lost 3 px. `min-width: 0` on the folded frame (and on its
 * line) lets the column stay the screen's width and the words truncate instead.
 * Rendered, not grepped: both faces of the folded card (plain line · line that opens) and the line inside.
 * Run from apps/web: node --import tsx --test app/_components/chat/cards/a-folded-line-never-widens-its-column.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

async function render(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

const classOf = (html: string, tag: string) => new RegExp(`<${tag}\\b[^>]*class="([^"]*)"`).exec(html)?.[1] ?? '';
const words = (cls: string) => cls.split(/\s+/);

test('the folded frame and its line both carry min-width:0, so a long line truncates instead of widening the column', async () => {
  const { KindCard } = await import('./card-bits');
  const long = 'Lights and sound for the whole reception, second floor → ₱40,000 · accepted · after three counters';
  const plain = await render(React.createElement(KindCard, { kind: 'counter', topic: 'payment', kicker: 'x', title: 't', turn: 'done', settled: long }));
  const opens = await render(
    React.createElement(KindCard, { kind: 'counter', topic: 'payment', kicker: 'x', title: 't', turn: 'old', settled: long }, React.createElement('p', null, 'details')),
  );
  assert.ok(plain.includes(long) && opens.includes(long), 'both faces drew the folded line');
  assert.ok(words(classOf(plain, 'div')).includes('min-w-0'), `the plain folded line: ${classOf(plain, 'div')}`);
  assert.ok(words(classOf(opens, 'details')).includes('min-w-0'), `the folded card that opens: ${classOf(opens, 'details')}`);
  for (const html of [plain, opens]) {
    const line = /<span class="([^"]*\btruncate\b[^"]*)"/.exec(html)?.[1] ?? '';
    assert.ok(words(line).includes('min-w-0') && words(line).includes('truncate'), `the line itself truncates: ${line}`);
  }
});
