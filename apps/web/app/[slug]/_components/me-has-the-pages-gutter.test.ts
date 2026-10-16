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
/* FIRST of the app's modules: this import installs the seam the real page is drawn through. */
import { renderSiteBodyFixture } from '@/lib/site-body-fixture-render';
import { FIXTURE_EVENT, siteBodyFixtureProps } from '@/lib/site-body-fixture';
import { stripComments } from '@/lib/strip-comments';
import { PAGE_COLUMN, PLATE } from '../_lib/measures';

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

/*
  ── THE GUEST'S FOOT — THE RECORD NOTE AND THE SIGN-OUT (2026-10-11, the tester's walk of the joined batch) ──
  The scan-trail note ("We keep a record of when you open your invitation…" + "Stop keeping a record") ran from the
  glass's left edge to its right at 320, 375, 390 and 768 on the Save the Date: a full-bleed stage has no shell
  column, and the foot sits outside the film's page column. The sign-out beside it only looked right because it is
  centred.

  Held on the REAL page, drawn for a guest with a real row id (the fixture's own sample guest is never shown the
  note): on the full-bleed Save the Date the foot is set in the page's own column — `px-4` is the gutter at 320, 375
  and 390, `sm:px-6` at 768 — and on a tabbed page it is inside Me's own gutter, once. And the note itself can be
  read (≥ 4.5:1, from the house tokens) and its button pressed (44px).

  SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): the foot's column taken off → (4) red;
  the note put back to `text-ink/60` → (5) red.
*/
function asARealGuest() {
  const p = siteBodyFixtureProps();
  return { ...p.identity, guest: { ...(p.identity as { guest: Record<string, unknown> }).guest, guest_id: '11111111-1111-4111-8111-111111111111' } } as typeof p.identity;
}
const NOTE = /<form[^>]*data-scan-trail=""[^>]*>/;

test('(4) the record note and the sign-out have the page’s gutter at 320 · 375 · 390 · 768 — full-bleed and tabbed', async () => {
  /* 📜 RE-AIMED 2026-10-15. The Save the Date became ONE page with Me its own (owner 2026-10-15, `hub-tabs.ts`), so
     wherever the guest's bar is drawn its foot is Me's — exactly as on the Invitation. The full-bleed foot is now
     drawn only with NO bar (the menu switched off), which the fixture cannot render (it hides the environment); its
     column is held from the source instead: the same expression, the page's own column on a full-bleed stage. */
  const BODY = read('site-body.tsx');
  assert.match(
    BODY,
    /\{tabs\.on \? null : \(\s*<div data-guest-foot="" className=\{plan\.fullBleed \? `\$\{PAGE_COLUMN\} space-y-6` : 'space-y-6'\}>\s*\{scanTrail\}\s*\{signOut\}/,
    'the full-bleed foot no longer takes the page’s own column (note above the sign-out)',
  );
  assert.ok(PAGE_COLUMN.split(/\s+/).includes('px-4'), 'no gutter at 320 · 375 · 390');
  assert.ok(PAGE_COLUMN.split(/\s+/).includes('sm:px-6'), 'no gutter at 768');
  // The page's own column and the film's are the same classes — not a new number.
  const filmColumn = read('std-film-handoff.tsx').match(/<div className="(mx-auto w-full max-w-3xl px-4[^"]*)">\{children\}<\/div>/)?.[1]?.split(/\s+/) ?? [];
  for (const c of PAGE_COLUMN.split(/\s+/)) assert.ok(filmColumn.includes(c), `"${c}" is not on the Save the Date page’s own column`);

  // The Invitation and the Save the Date (film and no film): the note is inside Me's gutter — no foot of its own.
  const pages = {
    invitation: await renderSiteBodyFixture({ identity: asARealGuest() }),
    'save the date (film)': await renderSiteBodyFixture({ identity: asARealGuest(), event: { ...FIXTURE_EVENT, event_date: null }, lifecyclePhase: 'save_the_date', stdFilm: true, scheduleBlocks: [] }),
    'save the date (no film)': await renderSiteBodyFixture({ identity: asARealGuest(), lifecyclePhase: 'save_the_date', stdFilm: false }),
  };
  for (const [name, html] of Object.entries(pages)) {
    assert.match(html, NOTE, `anti-vacuity: the record note is not on the ${name}`);
    assert.doesNotMatch(html, /data-guest-foot/, `${name}: a page with Me draws a second foot`);
    const stage = html.indexOf('data-me-stage=""');
    assert.ok(stage > 0 && html.search(NOTE) > stage, `${name}: the note is not inside Me`);
    assert.ok(html.slice(stage).includes('/sign-out"') && html.slice(stage).search(NOTE) < html.slice(stage).indexOf('/sign-out"'), `${name}: the note is not above the sign-out, in Me`);
    assert.match(html.slice(stage, stage + 200), /class="[^"]*\bpx-4\b/, `${name}: Me’s stage lost its gutter`);
  }
});

test('(5) the record note can be read and its button pressed', () => {
  const css = readFileSync(join(__dirname, '..', '..', 'globals.css'), 'utf8');
  const token = (name: string) => {
    const m = css.match(new RegExp(`--color-${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`));
    assert.ok(m, `--color-${name} was not found`);
    return [Number(m![1]), Number(m![2]), Number(m![3])];
  };
  const ink = token('ink');
  const page = token('cream');
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c: number[]) => 0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!);
  const contrast = (alphaPct: number) => {
    const a = alphaPct / 100;
    const mixed = ink.map((v, i) => v * a + page[i]! * (1 - a));
    const [hi, lo] = [lum(page), lum(mixed)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };
  assert.ok(contrast(60) < 4.5 && contrast(60) > 3.8, `the measure moved: ink/60 is ${contrast(60).toFixed(2)}`);
  const notice = read('scan-trail-notice.tsx');
  const form = notice.match(/<form\s+action=\{toggle\}[\s\S]*?className="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
  const tint = form.map((c) => c.match(/^text-ink\/(\d+)$/)).find(Boolean);
  assert.ok(tint, `the note sets no ink of its own (${form.join(' ')})`);
  assert.ok(contrast(Number(tint![1])) >= 4.5, `the note is ${contrast(Number(tint![1])).toFixed(2)}:1 (text-ink/${tint![1]})`);
  assert.match(notice, /<SubmitButton\s+className="[^"]*\bmin-h-\[44px\][^"]*"/, 'the button is under 44px tall');
  // The event's OWN word, never a fixed "wedding".
  assert.equal((notice.match(/at this \$\{w\.eventWord\}/g) ?? []).length, 3, 'a sentence names a fixed kind of event');
  assert.doesNotMatch(notice, /at this (?:wedding|celebration)/);
  // Reversible at once, by the same button — which is why it does not ask.
  assert.match(notice, /\{optedOut \? 'Keep a record again' : 'Stop keeping a record'\}/);
  assert.match(notice, /setGuestScanTracking\.bind\(null, eventId, guestId, scanOptOutTarget\(optedOut\)\)/);
});

