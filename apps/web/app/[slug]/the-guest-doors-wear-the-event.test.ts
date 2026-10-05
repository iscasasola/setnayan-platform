/**
 * 🎨 THE GUEST'S REPLY PAGES WEAR THE EVENT — AND SETNAYAN SIGNS AT THE FOOT.
 *
 * Owner, 2026-10-05 (DECISION_LOG "consistency-first owner calls", (3)): *"the
 * guests' RSVP reply page wears the EVENT'S THEME; the SETNAYAN top bar becomes
 * a small 'Made with Setnayan' line at the bottom. Check every guest-facing
 * reply surface, not only the Maker preview."*
 *
 * What was there: every door — ours and the couple's alike — drew the SETNAYAN
 * wordmark above the card, so the first thing a guest saw on the couple's RSVP
 * was our name over their mark. The plus-one's first page (`/welcome`) and the
 * request page for a non-Pro theme drew the bare door, whose `bg-cream` painted
 * over the theme ground their layout already wore.
 *
 *   1 · DoorShell `brand="foot"` draws no wordmark above the card and ONE small
 *       "Made with Setnayan" link under it; the default keeps the way home on
 *       top (sign-in, claim, a dead link are Setnayan's own pages).
 *   2 · EVERY door under `app/[slug]/` — the couple's pages — passes it, and the
 *       shared join flow forwards it to every door it draws.
 *   3 · every reply surface wears the event: the RSVP and the landing wear the
 *       hub look themselves; the plus-one page and the request page sit in the
 *       layout's look and keep the frame from painting over it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const SLUG = import.meta.dirname;
const APP = join(SLUG, '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test('1 · brand="foot": no wordmark above the card, one "Made with Setnayan" link under it', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DoorShell } = await import('@/app/_components/door/door-shell');
  const foot = renderToStaticMarkup(
    React.createElement(DoorShell, { brand: 'foot', title: 'Maria & Jose' }, React.createElement('p', null, 'THE-FORM')),
  );
  assert.doesNotMatch(foot, /aria-label="Setnayan home"/, 'the couple\'s page still opens with our wordmark');
  const made = foot.indexOf('data-door-made-with');
  assert.ok(made > 0, 'no "Made with Setnayan" line on the couple\'s page');
  assert.ok(made > foot.indexOf('THE-FORM'), '"Made with Setnayan" sits above the card, not at the foot');
  assert.match(foot.slice(made), /<a[^>]*href="\/"[^>]*>Made with Setnayan<\/a>/, 'the foot line no longer leads home');
  assert.equal(foot.match(/Made with Setnayan/g)?.length, 1);
  // Legible on any ground: 12px (the guest floor), on the card's own paper.
  const line = foot.slice(foot.lastIndexOf('<p', made), foot.indexOf('</p>', made));
  assert.match(line, /class="mt-4 text-center text-xs"/, 'the foot line fell under the 12px legibility floor');
  assert.match(line, /bg-surface\/90[^"]*text-ink\/75/, 'the foot line sits bare on the ground — unreadable on a photo or a dark theme');
  assert.doesNotMatch(line, /text-\[\d+(?:\.\d+)?px\]/);

  const ours = renderToStaticMarkup(React.createElement(DoorShell, { title: 'Sign in' }));
  assert.match(ours, /aria-label="Setnayan home"/, 'Setnayan\'s own doors lost the way home');
  assert.doesNotMatch(ours, /Made with Setnayan/);
});

test('2 · every door on the couple\'s pages passes brand="foot" — and the join flow forwards it', () => {
  let doors = 0;
  for (const file of walk(SLUG)) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/<(DoorShell|JoinFlow)\s/g)) {
      doors += 1;
      const head = src.slice(m.index!, m.index! + 160);
      assert.match(
        head,
        /brand="foot"/,
        `${relative(SLUG, file).split(sep).join('/')}: a <${m[1]}> on the couple's page draws Setnayan's bar on top`,
      );
    }
  }
  console.log(`  doors under app/[slug]: ${doors}`);
  assert.ok(doors >= 8, `only ${doors} doors found under app/[slug] — this guard is looking at nothing`);

  const flow = read('join/[eventId]/_components/join-flow.tsx');
  const shells = flow.match(/<(JoinShell|RequestSentScreen)\s/g)?.length ?? 0;
  const forwarded = flow.match(/skin=\{skin\} brand=\{brand\}/g)?.length ?? 0;
  assert.ok(shells >= 5, 'the join flow draws no doors — re-anchor this guard');
  assert.equal(forwarded, shells, 'a door in the join flow drops the brand it was handed');
  assert.match(read('join/[eventId]/_components/join-shell.tsx'), /<DoorShell[\s\S]{0,200}brand=\{brand\}/);
});

test('3 · every reply surface wears the event\'s theme, not the bare door', () => {
  for (const page of ['[slug]/invite/reply/page.tsx', '[slug]/invite/enter/page.tsx']) {
    const src = read(page);
    assert.match(src, /<GuestLookScope \{\.\.\.lookScopeProps\(hub\.look\)\}>/, `${page} no longer wears the hub look`);
    assert.match(src, /hubDoorSkin\(/, `${page} lost the RSVP's skin`);
  }
  const welcome = read('[slug]/welcome/page.tsx');
  assert.match(welcome, /<DoorShell[\s\S]{0,120}skin=\{hubDoorSkin\(doorMarkFor\(/, 'the plus-one page is the bare door again');
  const request = read('[slug]/request/page.tsx');
  assert.match(request, /const skin = look\.skin \?\? hubDoorSkin\(doorMarkFor\(event\)\);/, 'the request page is the bare door for a non-Pro theme');
  assert.doesNotMatch(request, /skin=\{look\.skin\}/, 'a request door skips the event\'s skin');
  // Both sit in the layout's look — never in a segment that dresses itself.
  const scope = read('[slug]/_components/guest-look-scope.tsx');
  const dressed = scope.match(/SEGMENTS_THAT_DRESS_THEMSELVES: readonly string\[\] = \[([^\]]*)\]/)?.[1];
  assert.ok(dressed !== undefined, 'SEGMENTS_THAT_DRESS_THEMSELVES moved — re-anchor this guard');
  for (const seg of ['welcome', 'request']) {
    assert.doesNotMatch(dressed, new RegExp(`'${seg}'`), `/${seg} left the layout's look`);
  }
});
