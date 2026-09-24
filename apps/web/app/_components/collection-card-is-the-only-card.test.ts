/**
 * collection-card-is-the-only-card.test.ts
 *
 * ⚖ OWNER, 2026-09-23: *"should be the standard look on alaga, samahan,
 * shortlist. These is a proper template…"* — one shell that every collection
 * fills, NOT four lookalikes (`build-sessions/STANDARD-collection-card.md`,
 * build order step 2: "every adopter renders through the component — no
 * forked copy").
 *
 * Two halves:
 *
 *   1. NO FORKS (source). The card shell, the attention row and the `+ New`
 *      tile each carry a class signature that exists in exactly one file —
 *      `collection-card.tsx`. A copy-and-restyle in another collection trips it
 *      the moment the copied markup lands. Each signature is ALSO required to
 *      be present in the component itself, so renaming a class there cannot
 *      make this guard vacuous.
 *
 *   2. UNKNOWN IS NOT ZERO (rendered). Rule 2 of the standard, executed — the
 *      component is rendered and its HTML read, because "a null renders
 *      couldn't-load" is a claim about pixels, not about source text.
 *
 * 🪤 `globalThis.React` is set before DYNAMIC imports because the repo's
 * tsconfig uses `"jsx": "preserve"`, so tsx emits classic
 * `React.createElement` with no import of its own (see
 * `byline-renders-as-a-door.test.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const COMPONENT = join(HERE, 'collection-card.tsx');

/** Class runs that ARE the card. Found nowhere else in `app/` when written. */
const SIGNATURES: ReadonlyArray<{ what: string; needle: string }> = [
  { what: 'the card shell', needle: 'min-h-[196px] flex-col overflow-hidden rounded-2xl' },
  {
    what: 'the attention row',
    needle: 'bg-[color:var(--sn-warning-soft)] px-[9px] py-[5px]',
  },
  { what: 'the + New tile', needle: 'border-dashed border-ink/20 bg-white/[0.35] px-4 py-3.5' },
  {
    what: 'the collection grid',
    needle: 'grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4',
  },
];

/**
 * Every collection that has adopted the standard. Adding one here is how a new
 * adopter is enrolled; each must import the component and mount it.
 */
const ADOPTERS: ReadonlyArray<string> = ['dashboard/(launcher)/page.tsx'];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      sourceFiles(p, out);
    } else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

test('the card lives in ONE file — no collection carries a forked copy', () => {
  const own = stripComments(readFileSync(COMPONENT, 'utf8'));
  for (const { what, needle } of SIGNATURES) {
    // Non-vacuity: the signature must still describe the real component.
    assert.ok(
      own.includes(needle),
      `collection-card.tsx no longer contains ${what}'s signature "${needle}". ` +
        'Update SIGNATURES to the new markup — otherwise this guard checks nothing.',
    );
  }
  const files = sourceFiles(APP).filter((f) => f !== COMPONENT);
  assert.ok(files.length > 500, `walked only ${files.length} files — the walk broke`);
  const forks: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const { what, needle } of SIGNATURES) {
      if (src.includes(needle)) forks.push(`${relative(APP, f)} carries ${what}`);
    }
  }
  assert.deepEqual(
    forks,
    [],
    'A forked copy of the collection card. Render it through ' +
      '`@/app/_components/collection-card` and fill its slots instead:\n  ' +
      forks.join('\n  '),
  );
});

test('every adopter renders through the component', () => {
  for (const rel of ADOPTERS) {
    const src = stripComments(readFileSync(join(APP, rel), 'utf8'));
    assert.match(
      src,
      /from '@\/app\/_components\/collection-card'/,
      `${rel} no longer imports the collection card`,
    );
    const cards = (src.match(/<CollectionCard\b/g) ?? []).length;
    const grids = (src.match(/<CollectionGrid>/g) ?? []).length;
    assert.ok(cards >= 1, `${rel} mounts no <CollectionCard>`);
    assert.ok(grids >= 1, `${rel} lays its cards out in no <CollectionGrid>`);
    // The inline shell it was extracted from must not come back beside it.
    assert.doesNotMatch(src, /function CardShell\b/, `${rel} grew its own CardShell again`);
  }
});

async function render(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

async function card(props: Record<string, unknown>): Promise<string> {
  const { CollectionCard } = await import('@/app/_components/collection-card');
  return render(React.createElement(CollectionCard, { href: '/x', title: 'T', ...props } as never));
}

test('attention: unknown renders "couldn’t load", never a number and never silence', async () => {
  const html = await card({ attention: { count: null } });
  assert.match(html, /Couldn’t load what needs you/);
  assert.doesNotMatch(html, /need you<\/span>/, 'an unknown count printed a total');
  assert.doesNotMatch(html, />0</, 'an unknown count printed a zero');
});

test('attention: a known zero is no row at all — nothing is waiting', async () => {
  const html = await card({ attention: { count: 0, label: '0 tasks overdue', labelCount: 0 } });
  assert.doesNotMatch(html, /need you|tasks overdue|Couldn’t load/);
});

test('attention: the total leads only when it says more than the label', async () => {
  const one = await card({ attention: { count: 9, label: '9 tasks overdue', labelCount: 9 } });
  assert.match(one, /9 tasks overdue/);
  assert.doesNotMatch(one, /need you/, '"9 need you · 9 tasks overdue" — the same number twice');

  const many = await card({ attention: { count: 24, label: '9 tasks overdue', labelCount: 9 } });
  assert.match(many, />24 need you</);
  assert.match(many, /9 tasks overdue/);
});

test('attention: absent means the collection does not track it — no row', async () => {
  const html = await card({});
  assert.doesNotMatch(html, /need you|Couldn’t load/);
});

test('progress: unknown renders "couldn’t load" and no ring; a number renders the ring', async () => {
  const unknown = await card({ progress: { pct: null, remainder: '86 days to go' } });
  assert.match(unknown, /86 days to go/);
  assert.match(unknown, /Progress couldn’t load/);
  assert.doesNotMatch(unknown, /<svg[^>]*role="img"|stroke-dasharray/, 'a ring drew for an unknown figure');

  const known = await card({ progress: { pct: 7, remainder: '86 days to go', srLabel: 'planned' } });
  assert.match(known, /stroke-dasharray|<svg/);
  assert.match(known, /<span class="sr-only"> planned<\/span>/);
  assert.doesNotMatch(known, /couldn’t load/);

  const none = await card({ progress: { remainder: 'Celebrated', note: 'Kept for good' } });
  assert.doesNotMatch(none, /couldn’t load/);
  assert.match(none, /Kept for good/);
});

test('an inert card is a div without press affordances, and says why', async () => {
  const html = await card({ href: null, inertReason: 'The host hasn’t opened their page yet' });
  assert.doesNotMatch(html, /<a /, 'an inert card rendered a link');
  assert.doesNotMatch(html, /sn-press|sn-lift-4|hover:/, 'a dead card still animates under the finger');
  assert.match(html, /The host hasn’t opened their page yet/);
});

test('rule 4 — a card with only a title still renders a deliberate head', async () => {
  const html = await card({});
  assert.match(html, /<span class="truncate">T<\/span>/);
  assert.match(html, /bg-gradient-to-br/, 'no cover must fall back to the house wash, not a blank box');
});
