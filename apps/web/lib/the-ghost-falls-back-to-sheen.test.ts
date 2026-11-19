/**
 * the-ghost-falls-back-to-sheen.test.ts — 👻 SKELETON STYLE "D · GHOST" (owner 18 Nov 2026, *"Ghost + all six"*;
 * motion standard § 9): what is already known shows at once, as itself; only the unknown parts are grey blocks under
 * the Sheen; when nothing is known it falls back to the Sheen alone.
 *
 * Held here (the shared parts are RENDERED, not read):
 *   1. `Ghost`: known text → the text, with no grey block; nothing known (absent, empty, blank, `false`) → the grey
 *      `.skeleton` block and no text;
 *   2. a template's `title`: its own words → shown; `true` → grey; absent → nothing at all;
 *   3. a list's `names`: the first rows carry the known names, the rest stay grey;
 *   4. THE FALLBACK: with nothing known, every template draws grey blocks only — no known part anywhere;
 *   5. a known title is the page's OWN words: every loader that passes one names a heading its route really draws;
 *   6. last visit's names come from the one shipped cache: the skeletons read no storage of their own.
 *
 * Seen RED once each (2026-11-18), then restored — see the changelog fragment `claude-motion-loading.md`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;

import { stripComments } from '@/lib/strip-comments';
/* eslint-disable-next-line import/first */
import * as SK from '@/components/skeletons';

const WEB = join(__dirname, '..');
const h = React.createElement;
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const greys = (s: string) => (s.match(/class="skeleton /g) ?? []).length;
const knowns = (s: string) => (s.match(/data-ghost="known"/g) ?? []).length;

test('1 · Ghost: known → the text and no grey; nothing known → the grey block and no text', () => {
  const known = html(h(SK.Ghost, { known: 'Guests', className: 'h-8 w-56' }));
  assert.match(known, />Guests</);
  assert.equal(greys(known), 0, 'a known part still drew a grey block');
  assert.equal(knowns(known), 1);
  for (const nothing of [undefined, null, '', '   ', false] as const) {
    const out = html(h(SK.Ghost, { known: nothing, className: 'h-8 w-56' }));
    assert.equal(greys(out), 1, `known=${JSON.stringify(nothing)} did not fall back to the grey block`);
    assert.equal(knowns(out), 0, `known=${JSON.stringify(nothing)} drew a known part`);
    assert.match(out, /class="skeleton h-8 w-56"/, 'the fallback block lost its size');
  }
});

test('2 · a title: its own words are shown; `true` is grey; absent draws nothing', () => {
  const words = html(h(SK.HeaderSkeleton, { title: 'Add a guest' }));
  assert.match(words, />Add a guest</);
  assert.equal(greys(words), 0);
  const unknown = html(h(SK.HeaderSkeleton, { title: true }));
  assert.equal(knowns(unknown), 0);
  assert.equal(greys(unknown), 1);
  assert.equal(html(h(SK.HeaderSkeleton, {})), '', 'a page with no title and no buttons reserved a strip');
  // Same reserved height either way, so nothing jumps when a title becomes known.
  assert.match(words, /min-h-8[^"]*leading-8|leading-8[^"]*min-h-8/, 'the known title is not the height of the block it replaces (h-8)');
  assert.match(unknown, /class="skeleton h-8 /);
});

test('3 · a list: the first rows carry the names already known; the rest stay grey', () => {
  const none = html(h(SK.ListPageSkeleton, { rows: 4, toolbar: false }));
  const some = html(h(SK.ListPageSkeleton, { rows: 4, toolbar: false, names: ['Maria Santos', 'Jose Cruz'] }));
  assert.match(some, />Maria Santos</);
  assert.match(some, />Jose Cruz</);
  assert.equal(knowns(some), 2);
  assert.equal(greys(none) - greys(some), 2, 'a known name did not REPLACE its grey line (or replaced more than it)');
  assert.ok(some.indexOf('Maria Santos') < some.indexOf('Jose Cruz'), 'the names are out of order');
  const more = html(h(SK.ListPageSkeleton, { rows: 1, toolbar: false, names: ['A', 'B', 'C'] }));
  assert.equal(knowns(more), 3, 'a known name was dropped because the loader asked for fewer rows');
  const named = html(h(SK.SkSection, { name: 'Decisions', children: h(SK.Sk, { className: 'h-24' }) }));
  assert.match(named, />Decisions</);
  assert.equal(greys(named), 1);
  assert.equal(greys(html(h(SK.SkSection, { children: h(SK.Sk, { className: 'h-24' }) }))), 2);
});

test('4 · THE FALLBACK — nothing known: every template is grey blocks only (the Sheen)', () => {
  const templates = Object.entries(SK).filter(([k]) => k.endsWith('PageSkeleton'));
  assert.ok(templates.length >= 7, `only ${templates.length} templates found — this rule would be vacuous`);
  for (const [name, T] of templates) {
    const bare = html(h(T as React.FC<{ title?: boolean }>, {}));
    assert.equal(knowns(bare), 0, `${name} drew a "known" part with nothing known`);
    assert.ok(greys(bare) >= 3, `${name} has no grey blocks to carry the Sheen`);
    const titled = html(h(T as React.FC<{ title?: boolean | string }>, { title: true }));
    assert.equal(knowns(titled), 0, `${name}: title={true} is not known words, yet a known part was drawn`);
    assert.equal(greys(titled), greys(bare) + 1, `${name}: an unknown title is not ONE grey block`);
    const ghost = html(h(T as React.FC<{ title?: boolean | string }>, { title: 'Known title' }));
    assert.equal(knowns(ghost), 1, `${name} does not show a known title`);
    assert.equal(greys(ghost), greys(bare), `${name}: a known title still drew its grey block`);
  }
});

test('5 · a known title is the page’s own words', () => {
  let found = '';
  try {
    found = execFileSync('grep', ['-rlE', 'PageSkeleton[^>]*\\stitle="', 'app', '--include=loading.tsx'], { cwd: WEB, encoding: 'utf8' });
  } catch {
    /* none */
  }
  const loaders = found.trim().split('\n').filter(Boolean);
  assert.ok(loaders.length >= 5, `only ${loaders.length} loaders pass a known title — Ghost is not adopted anywhere`);
  for (const loader of loaders) {
    const title = /\stitle="([^"]+)"/.exec(stripComments(readFileSync(join(WEB, loader), 'utf8')))![1]!;
    let drawn = '';
    try {
      drawn = execFileSync('grep', ['-rhoE', '<h1[^>]*>[^<{]+<', dirname(loader), '--include=*.tsx'], { cwd: WEB, encoding: 'utf8' });
    } catch {
      /* none */
    }
    const headings = drawn.split('\n').filter((l) => l && !/sr-only/.test(l)).map((l) => l.replace(/^<h1[^>]*>/, '').replace(/<$/, '').trim());
    assert.ok(
      headings.includes(title),
      `${loader} shows "${title}" as known, but its route draws no visible <h1> with those words (found: ${headings.join(' · ') || 'none'}). A ghost title must be the page's own words — otherwise pass title (grey).`,
    );
  }
});

test('6 · the skeletons keep no cache of their own — last visit’s names come from last-seen', () => {
  const sk = stripComments(readFileSync(join(WEB, 'components/skeletons/index.tsx'), 'utf8'));
  assert.ok(!/localStorage|sessionStorage|indexedDB|caches\.|document\.cookie/.test(sk), 'the skeletons read a store of their own — a second cache');
  assert.ok(!/^'use client'/.test(sk.trim()), 'the shared skeletons became a client module — they must draw before any script runs');
  // The five kept pages wrap their skeleton in the one shipped cache.
  let wrapped = '';
  try {
    wrapped = execFileSync('grep', ['-rl', '<LastSeenFallback', 'app', '--include=loading.tsx'], { cwd: WEB, encoding: 'utf8' });
  } catch {
    /* none */
  }
  assert.ok(wrapped.trim().split('\n').filter(Boolean).length >= 4, 'the kept pages no longer wrap their skeleton in LastSeenFallback');
});
