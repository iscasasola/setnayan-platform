/**
 * collection-card-poster.test.ts — the template's POSTER layout, rendered.
 *
 * ⚖ Owner-approved 2026-09-24 ("the template is good"): the cover fills a 3:4
 * card and prints the names and the date ONCE; the private glass strip over
 * its foot carries ONE attention item and the remainder; unknown ≠ zero.
 *
 * Rendered with `renderToStaticMarkup`, because "printed once" and "couldn't
 * load" are claims about the markup a person meets, not about the source.
 * 🪤 `globalThis.React` before DYNAMIC imports — tsconfig `"jsx": "preserve"`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

async function poster(props: Record<string, unknown>): Promise<string> {
  const { CollectionCard } = await import('@/app/_components/collection-card');
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(
    React.createElement(CollectionCard, {
      layout: 'poster',
      href: '/dashboard/e1',
      title: 'Maria & Jose',
      meta: 'KASAL, You organise this · Saturday 12 December 2026',
      cover: React.createElement('div', { 'data-art': 'poster', 'aria-hidden': true }, 'Maria and Jose'),
      progress: { pct: 18, remainder: '79 days to go' },
      ...props,
    } as never),
  );
}

const visible = (html: string) =>
  html
    .replace(/<span class="sr-only">[\s\S]*?<\/span>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

test('the names are printed ONCE — by the poster — and the link still has a name', async () => {
  const html = await poster({});
  assert.match(html, /data-art="poster"/);
  assert.doesNotMatch(visible(html), /Maria &amp; Jose|Maria & Jose/, 'the body re-printed the title');
  assert.doesNotMatch(visible(html), /12 December 2026/, 'the body re-printed the date');
  assert.match(
    html,
    /^<a [^>]*href="\/dashboard\/e1"[^>]*><span class="sr-only">Maria &amp; Jose · KASAL, You organise this · Saturday 12 December 2026 · 79 days to go<\/span>/,
  );
  // The strip and the chips repeat facts that sentence already carries, so
  // they are hidden from assistive tech — the sentence IS the link's name.
  const withChips = await poster({ kicker: ['KASAL'] });
  assert.match(withChips, /<span aria-hidden="true" class="absolute left-2 top-2/, 'the chips are announced twice');
  assert.match(withChips, /<span aria-hidden="true" class="absolute inset-x-0 bottom-0/, 'the strip is announced twice');
  assert.match(html, /aspect-\[3\/4\]/);
});

test('the strip: ONE attention item, the total leading only when it says more', async () => {
  const many = await poster({ attention: { count: 25, label: '1 payment to settle', labelCount: 1 } });
  assert.match(visible(many), /25 need you/);
  assert.doesNotMatch(visible(many), /payment/, 'two items in the strip — a list is not a card');

  const one = await poster({ attention: { count: 17, label: '17 tasks overdue', labelCount: 17 } });
  assert.match(one, /<b[^>]*>17<\/b><small[^>]*>tasks overdue<\/small>/);
  assert.doesNotMatch(visible(one), /need you/);
});

test('unknown is not zero: a null count says it could not load; a known zero says nothing', async () => {
  const unknown = await poster({ attention: { count: null } });
  assert.match(visible(unknown), /Couldn’t load what needs you/);
  assert.doesNotMatch(visible(unknown), /\b0\b/);
  assert.match(unknown, /<span class="sr-only">[^<]*Couldn’t load what needs you/);

  const zero = await poster({ attention: { count: 0, label: '0 tasks overdue', labelCount: 0 } });
  assert.doesNotMatch(visible(zero), /need you|overdue|Couldn’t load/);

  const pctUnknown = await poster({ progress: { pct: null, remainder: '79 days to go' } });
  assert.match(visible(pctUnknown), /–/);
  assert.match(pctUnknown, /<span class="sr-only">[^<]*progress couldn’t load/);
});

test('the remainder is plain language: "79 days" over "to go"', async () => {
  const html = await poster({});
  assert.match(visible(html), /79 days to go/);
  assert.match(visible(html), /18%/);
});

test('the default layout is the extracted glass card, untouched', async () => {
  const { CollectionCard } = await import('@/app/_components/collection-card');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(
    React.createElement(CollectionCard, { href: '/x', title: 'T', meta: 'Dec 18' } as never),
  );
  assert.match(html, /min-h-\[196px\]/);
  assert.doesNotMatch(html, /sr-only/);
});
