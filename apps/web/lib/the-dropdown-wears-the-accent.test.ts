/**
 * the-dropdown-wears-the-accent.test.ts — THE DROPDOWN'S COLOURS: AN ACCENT ▾, AND A PICKED
 * OPTION SAID BY ACCENT WORDS AND AN ACCENT ✓ — EVERYWHERE BUT THE GUEST'S EVENT HUB.
 *
 * Owner, 2026-10-08 (the approved template gallery; `INTERACTION_RULES.md` § 9):
 * *"Dropdown — Chevron should be teracota color?"* · "The dropdown's chevron and
 * its ticked choice are terracotta" · "the small mark that says 'you can tap
 * this' is terracotta". And the one exemption: *"the only part that does not
 * follow our rules is their customized event hub"*.
 *
 * Held, each where it can be EXECUTED:
 *   (1) the looks — the ▾, the picked row, its ✓, a multi-pick's ✓ — are the
 *       accent token; the picked row is no longer a filled ink row;
 *   (2) Tailwind really EMITS those classes, from the real config — and inside
 *       `.sn-editorial` the ▾'s rule gives the page's own ink back;
 *   (3) the guest's hub keeps the list exactly as it was (the filled ink row,
 *       the green ✓), told by where the BUTTON is — the list is portalled out;
 *   (4) shape and behaviour are untouched: the same row, the same sizes, the
 *       same open / close — only colours moved; and the file stays under the
 *       size that keeps it inlined in every route.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const E = 'app/dashboard/[eventId]/website/editor/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const has = (cls: string, c: string) => cls.split(/\s+/).includes(c);

test('(1) the ▾, the picked option and its ✓ are the accent — the picked row is no longer filled ink', async () => {
  const M = await import(`../${E}/pick-menu-place`);
  // THE ▾: the accent; it turns over while open.
  assert.ok(has(M.pickArrowClass(false), 'text-sn-accent'), 'the ▾ is not the accent');
  assert.ok(!has(M.pickArrowClass(false), 'rotate-180') && has(M.pickArrowClass(true), 'rotate-180'));
  // THE PICKED OPTION: accent words, NOT a filled row.
  const picked = M.pickOptionClass(false, true);
  assert.ok(has(picked, 'text-sn-accent'), 'the picked option’s words are not the accent');
  assert.ok(!has(picked, 'bg-ink') && !has(picked, 'text-cream'), 'the picked option is still a filled ink row');
  // An option that is not picked: ink words, no accent.
  const rest = M.pickOptionClass(false, false);
  assert.ok(has(rest, 'text-ink') && !/accent/.test(rest), 'an option that is not picked wears the accent');
  // THE ✓: the accent, at the row's end — beside a trail when there is one, never pushed apart from it.
  assert.ok(has(M.pickTickClass(false), 'text-sn-accent') && has(M.pickTickClass(false), 'ml-auto'));
  assert.ok(has(M.pickTickClass(false, true), 'text-sn-accent') && !has(M.pickTickClass(false, true), 'ml-auto'), 'two marks at the row’s end are spread across it');
  assert.doesNotMatch(M.pickTickClass(false) + M.pickTickClass(false, true), /success|green/, 'a ✓ is still green');
  // A trail keeps its own tone on the unfilled row (✓ Ready is green, Missing is its own colour, ◆ is quiet).
  assert.ok(has(M.pickTrailClass('ok', false), 'text-success-700') && has(M.pickTrailClass('left', false), 'text-terracotta-700') && has(M.pickTrailClass('muted', false), 'text-ink/50'));

  // RENDERED — the button, as every page draws it.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PickMenu } = await import(`../${E}/pick-menu`);
  const html = renderToStaticMarkup(
    React.createElement(PickMenu, { label: 'Source', value: 'b', options: [{ key: 'a', label: 'Colour' }, { key: 'b', label: 'Scene' }], onPick: () => {} }),
  );
  const arrow = /<svg[^>]*class="([^"]*lucide-chevron-down[^"]*)"/.exec(html)?.[1] ?? '';
  assert.ok(arrow, 'anti-vacuity: the ▾ was not found in the button');
  assert.ok(has(arrow, 'text-sn-accent'), `the ▾ on the page is not the accent: ${arrow}`);
  assert.match(html, /<button[^>]*aria-haspopup="listbox"[^>]*aria-expanded="false"/);
  // The wiring of the list (it is drawn only while open): the picked row, its ✓, and a multi-pick's ✓.
  const src = read(`${E}/pick-menu.tsx`);
  assert.match(src, /const chosen = !picked && o\.key === value;/);
  assert.match(src, /className=\{pickOptionClass\(Boolean\(o\.hint \|\| o\.preview\), chosen, plain\)\}/);
  assert.match(src, /\{\(picked \? picked\.includes\(o\.key\) : chosen && !plain\) \? \(\s*<span aria-hidden data-pick-tick="" className=\{pickTickClass\(plain, Boolean\(o\.trail\)\)\}>\s*✓\s*<\/span>\s*\) : null\}/, 'the picked option has no ✓, or a multi-pick lost its own');
  assert.match(src, /<ChevronDown aria-hidden className=\{pickArrowClass\(open\)\} strokeWidth=\{2\} \/>/);
});

test('(2) Tailwind emits the classes from the real config — and inside the guest’s hub the ▾’s rule gives the page’s ink back', async () => {
  const M = await import(`../${E}/pick-menu-place`);
  const used = [M.pickArrowClass(true), M.pickOptionClass(false, true), M.pickTickClass(false), M.pickTickClass(true)].join(' ');
  const postcss = (await import('postcss')).default;
  const tailwind = (await import('tailwindcss')).default;
  const config = (await import('../tailwind.config')).default;
  const out = await postcss([tailwind({ ...config, content: [{ raw: used, extension: 'html' }] })]).process('@tailwind utilities;', { from: undefined });
  const css = out.css;
  // The accent, read from the ONE setting.
  assert.match(css, /\.text-sn-accent\s*\{[^}]*color:\s*rgb\(var\(--sn-accent\) \/ var\(--tw-text-opacity[^)]*\)\)/, 'Tailwind does not emit text-sn-accent from the accent setting');
  // The exemption: a rule that only matches INSIDE `.sn-editorial`, and wins there (one class more than `.text-sn-accent`).
  const hub = /\.sn-editorial \.\\\[\\\.sn-editorial_\\&\\\]\\:text-inherit\s*\{\s*color:\s*inherit;?\s*\}/.exec(css);
  assert.ok(hub, `Tailwind does not emit the hub’s rule for the ▾ — it would be the app’s accent on a guest’s page:\n${css.slice(0, 600)}`);
  assert.ok(css.indexOf(hub[0]) > css.indexOf('.text-sn-accent'), 'the hub’s rule comes before the accent’s — at equal weight it would lose');
  // Anti-vacuity: a class that does not exist emits nothing.
  const none = await postcss([tailwind({ ...config, content: [{ raw: 'text-no-such-colour', extension: 'html' }] })]).process('@tailwind utilities;', { from: undefined });
  assert.doesNotMatch(none.css, /no-such-colour/);
});

test('(3) the guest’s Event Hub keeps the list exactly as it was — told by where the button is', async () => {
  const M = await import(`../${E}/pick-menu-place`);
  // The picked row there: the filled ink row it always was; the multi-pick ✓: green, as it was. No accent at all.
  const hubRow = M.pickOptionClass(false, true, true);
  assert.ok(has(hubRow, 'bg-ink') && has(hubRow, 'text-cream'), 'the hub’s picked row changed');
  assert.ok(has(M.pickTickClass(true), 'text-success-700') && has(M.pickTickClass(true), 'ml-auto'));
  assert.doesNotMatch(hubRow + M.pickTickClass(true) + M.pickTrailClass('ok', true), /accent/, 'the app’s accent reaches the guest’s list');
  assert.ok(has(M.pickTrailClass('ok', true), 'opacity-80'), 'a trail on the hub’s filled row lost that row’s ink');
  // Byte for byte what the hub's list wore before this change (the shipped strings).
  assert.equal(
    hubRow,
    'flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] transition-colors duration-300 ease-in-out disabled:cursor-default disabled:text-ink/40  bg-ink text-cream',
  );
  assert.equal(M.pickTickClass(true), 'ml-auto pl-3 shrink-0 text-[14px] font-semibold text-success-700');
  // WHERE: the button's own place — the list is portalled to <body>, outside the hub's box.
  const inHub = { closest: (sel: string) => (sel === '.sn-editorial' ? {} : null) } as unknown as Element;
  const inApp = { closest: () => null } as unknown as Element;
  assert.equal(M.pickInHub(inHub), true);
  assert.equal(M.pickInHub(inApp), false);
  assert.equal(M.pickInHub(null), false);
  const src = read(`${E}/pick-menu.tsx`);
  assert.match(src, /const plain = pickInHub\(btnRef\.current\);/, 'the list is not told where its button is');
  // No single-pick ✓ is added in the hub (its filled row already says it).
  assert.match(src, /chosen && !plain/);
  // The two hub pages that draw a dropdown are still the only ones (a third would need looking at).
  assert.ok(has(M.pickArrowClass(false), '[.sn-editorial_&]:text-inherit'));
});

test('(4) shape and behaviour are untouched — only colours moved; the file stays small enough to stay inlined', async () => {
  const M = await import(`../${E}/pick-menu-place`);
  // The row: the same box for a picked option, an unpicked one and the hub's — sizes, radius, padding, motion.
  const SHAPE = ['flex', 'min-h-11', 'w-full', 'items-center', 'gap-2', 'rounded-xl', 'px-3', 'text-left', 'text-[14px]', 'transition-colors', 'duration-300', 'ease-in-out', 'disabled:cursor-default', 'disabled:text-ink/40'];
  for (const cls of [M.pickOptionClass(false, true), M.pickOptionClass(false, false), M.pickOptionClass(false, true, true)]) {
    for (const c of SHAPE) assert.ok(has(cls, c), `an option lost ${c}`);
  }
  assert.ok(has(M.pickOptionClass(true, true), 'py-2'));
  // The ▾: the same size and turn.
  for (const c of ['h-3.5', 'w-3.5', 'shrink-0', 'transition-transform', 'duration-300']) assert.ok(has(M.pickArrowClass(false), c), `the ▾ lost ${c}`);
  // Behaviour: a ▾ always OPENS its choices (never steps to the next), one list, closes on a pick, Escape, a tap outside.
  const src = read(`${E}/pick-menu.tsx`);
  assert.match(src, /onClick=\{\(\) => setOpen\(\(o\) => !o\)\}/);
  assert.match(src, /if \(!picked\) setOpen\(false\);\s*onPick\(o\.key\);/);
  assert.match(src, /if \(e\.key === 'Escape'\) \{\s*setOpen\(false\);/);
  assert.match(src, /useOneOpen\(open, setOpen\);/);
  assert.doesNotMatch(src, /mulberry|text-white|#[0-9a-fA-F]{3,8}\b/, 'the dropdown writes a colour of its own');
  // `pick-menu-stays-inline` holds the ceiling; said here too so a colour change is never the reason it is crossed.
  assert.ok(statSync(join(WEB, `${E}/pick-menu.tsx`)).size <= 9_800, 'pick-menu.tsx grew past the size that stays inlined');
});
