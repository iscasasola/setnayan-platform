/**
 * ME HAS THE PAGE'S OWN GUTTER — WHOEVER DRAWS IT.
 *
 * A guest's walk, 2026-10-11 (fault N11), on an event in its Save the Date stage: every line of Me — "Reply to the
 * invitation", the guest's name, Face tagging, the Terms, "Save to my account" — ran edge to edge at 320, 375, 390
 * and 768. The tabbed Me (Invitation · The Day) had been given its gutter on 2026-10-01 (`data-me-stage`,
 * site-body.tsx); on a page that is ONE scroll, Me is drawn by `GuestHubBar` instead, as a SIBLING of the page —
 * outside the shell's column, and on the Save the Date outside the film's page column — and had none.
 *
 * WHAT IS HELD (a property of the two places Me is drawn, rendered where it can be):
 *   (1) drawn by the bar (`GuestMeSection` without `asTab`), the section is set in a column that is centred, capped
 *       at the plate, and has a side gutter at the phone width and at `sm`;
 *   (2) that gutter is the page's own — every class of it is on the column the Save the Date's page sits in
 *       (`std-film-handoff.tsx`) and on the shell's column (`invitation-shell.tsx`), not a new number;
 *   (3) drawn as the tab (`asTab`), the section adds none — its stage in `site-body.tsx` already has it, and that
 *       stage still does (two gutters would be 32px at 375).
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): the column taken off the bar-drawn section
 * → (1) (2) red; `px-4` taken off `data-me-stage` → (3) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PLATE } from '../_lib/measures';

(globalThis as unknown as { React: unknown }).React = React;
// `server-only` stubbed — the same trap `each-guest-page-has-one-main-action.test.ts` names.
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const read = (rel: string) => stripComments(readFileSync(join(__dirname, rel), 'utf8'));
const classesOf = (html: string, opening: RegExp): string[] => {
  const tag = html.match(opening)?.[0] ?? '';
  return (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean);
};
/** The classes that make a side gutter and a centred, capped column. */
const COLUMN = (c: string) => /^(?:sm:|md:|lg:|xl:|2xl:)?(?:px-|pl-|pr-|mx-auto$|w-full$|max-w-)/.test(c);

async function meSection(asTab: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestMeSection } = await import('./guest-hub-bar');
  return renderToStaticMarkup(
    React.createElement(GuestMeSection, { meSlot: React.createElement('p', null, 'Bean Banlag'), galleryCount: 0, asTab }),
  );
}

test('(1) drawn by the bar, Me is a centred column with a side gutter — never edge to edge', async () => {
  const html = await meSection(false);
  assert.match(html, /^<div data-me-column=""[^>]*><section id="site-me"/, `Me's section is not set in a column: ${html.slice(0, 200)}`);
  const cls = classesOf(html, /^<div data-me-column=""[^>]*>/);
  assert.ok(cls.includes('px-4'), `Me has no side gutter at a phone's width (${cls.join(' ')})`);
  assert.ok(cls.includes('sm:px-6'), 'Me does not take the page’s wider gutter from 640px');
  assert.ok(cls.includes('mx-auto') && cls.includes('w-full') && cls.includes(PLATE), 'Me is not the page’s centred, capped column');
});

test('(2) that gutter is the page’s own column, not a new number', async () => {
  const mine = classesOf(await meSection(false), /^<div data-me-column=""[^>]*>/).filter(COLUMN);
  assert.ok(mine.length >= 5, `anti-vacuity: only ${mine.join(' ')} were read off Me`);
  // The column the Save the Date's page sits in, and the shell's own.
  const handoff = read('std-film-handoff.tsx').match(/<div className="(mx-auto w-full max-w-3xl px-4[^"]*)">\{children\}<\/div>/)?.[1];
  assert.ok(handoff, 'the Save the Date page’s column was not found — this guard is pointing at nothing');
  const shell = read('invitation-shell.tsx').match(/: '(mx-auto w-full max-w-3xl px-4[^']*)'/)?.[1];
  assert.ok(shell, 'the shell’s column was not found — this guard is pointing at nothing');
  for (const c of mine) {
    assert.ok(handoff!.split(/\s+/).includes(c), `Me's "${c}" is not on the Save the Date page's column (${handoff})`);
    assert.ok(shell!.split(/\s+/).includes(c), `Me's "${c}" is not on the shell's column (${shell})`);
  }
});

test('(3) as the tab, the section adds no gutter — its stage has it, once', async () => {
  const tab = await meSection(true);
  assert.match(tab, /^<section id="site-me"/, 'the tabbed Me is wrapped in a second column');
  const cls = classesOf(tab, /^<section id="site-me"[^>]*>/);
  assert.deepEqual(cls.filter(COLUMN), [], `the tabbed Me would have two gutters (${cls.join(' ')})`);
  const body = read('site-body.tsx');
  const stage = body.match(/<div data-me-stage="" className=\{`([^`]*)`\}>/)?.[1];
  assert.ok(stage, 'the tabbed Me’s stage was not found in site-body.tsx');
  assert.match(stage!, /(?:^|\s)px-4(?:\s|$)/, 'the tabbed Me lost its gutter');
  assert.match(stage!, /\$\{PLATE\}/, 'the tabbed Me is no longer the plate');
});
