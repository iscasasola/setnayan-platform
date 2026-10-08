/**
 * pills-are-everywhere.test.ts — EVERY SEGMENTED SELECTOR ON A SETNAYAN-LOOK SCREEN IS DRAWN BY THE ONE TEMPLATE.
 *
 * Owner, 2026-10-08, verbatim: *"adjust all pill selectors to this if possible"* · *"we want the whole app to be
 * adaptive to the same feel"* · *"the only part that does not follow our rules is their customized event hub"*.
 * `INTERACTION_RULES.md` § 9: one source per kind of control — the pill selector's is
 * `app/_components/pill-selector.tsx` (a full pill; the terracotta thumb slides; grey when off).
 *
 * `selectors-are-pills-that-slide.test.ts` holds the template itself and the watch for hand-drawn tracks. THIS file
 * holds the selectors that were converted OUTSIDE the Maker, one line each in `CONVERTED`:
 *
 *   (1) `pill-track.tsx` — the template's "second way in" as three elements a server page can write. RENDERED:
 *       it wears the template's track and choice look, lays the thumb, and passes the caller's role / aria / address
 *       straight through. It adds no colour, radius or speed of its own.
 *   (2) each converted selector is drawn through the template: the track is the template's, a choice wears the
 *       template's look, and the thumb is laid (unless the line says why it cannot slide yet).
 *   (3) what each one replaced is gone from its file (the hand-made class string does not come back).
 *   (4) the guests' Event Hub (`app/[slug]/**`) is the one place that does NOT follow this rule — nothing there
 *       imports the template.
 *
 * A builder who converts another selector ADDS its line. A line is never removed to go green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const has = (classes: string, c: string) => classes.split(/\s+/).includes(c);

const D = 'app/dashboard/[eventId]';
const A = 'app/dashboard/(account)';

/**
 * ONE CONVERTED SELECTOR.
 *   anchor — words that appear ONCE in the file, on the selector (its name for a screen reader, or its data mark);
 *   via    — 'track'   : it is written as `<PillTrack>` with `<PillButton>` / `<PillLink>` choices;
 *            'classes' : it keeps its own elements and wears `PILL_TRACK_CLASS` + `pillSegClass` + `<PillThumb />`;
 *   thumb  — 'slides'  : the thumb travels to the picked choice;
 *            'waits'   : the choices are radios (`aria-checked`), which the thumb does not read yet — the selector is
 *                        the pill in shape and colour, and the picked choice paints itself. `why` says so.
 *   gone   — a piece of the hand-made class string it replaced.
 */
type Converted = {
  area: 'couple' | 'shared' | 'supplier' | 'public' | 'admin';
  what: string;
  file: string;
  anchor: string;
  via: 'track' | 'classes';
  thumb: 'slides' | 'waits';
  why?: string;
  gone: string;
};

const RADIO = 'a radio group (aria-checked): the thumb reads aria-pressed / aria-current / aria-selected only — one line in pill-thumb.tsx (PICKED + attributeFilter) would let it slide';

export const CONVERTED: readonly Converted[] = [
  /* ── area 1 · the couple's dashboard and the shared pieces ── */
  { area: 'couple', what: 'Planner mode · Display language (Guided | DIY · English | Tagalog)', file: `${A}/profile/page.tsx`, anchor: 'data-setting-segmented={name}', via: 'track', thumb: 'slides', gone: 'rounded-md border border-ink/15 bg-cream p-1' },
  { area: 'couple', what: 'Seat plan view (List | 2D | 3D)', file: `${D}/seating/_components/seating-frame.tsx`, anchor: 'data-seating-view-segment=""', via: 'track', thumb: 'slides', gone: 'bg-mulberry/15 text-mulberry-700 ring-1' },
  { area: 'couple', what: 'Seat-plan panel (People | Tables | Rules)', file: `${D}/seating/_components/seating-editor.tsx`, anchor: 'aria-label="Seat-plan panel"', via: 'track', thumb: 'slides', gone: "'border-terracotta text-ink' : 'border-transparent" },
  { area: 'couple', what: 'Who can sit here (guest | group | role)', file: `${D}/seating/_components/seating-editor.tsx`, anchor: 'data-seat-pick-tabs=""', via: 'track', thumb: 'slides', gone: 'inline-flex flex-1 rounded-lg border border-ink/15 bg-cream p-0.5' },
  { area: 'couple', what: 'Seat plan dock (Door | Walk-through · With entrance | Separate)', file: `${D}/seating/_components/seating-editor.tsx`, anchor: 'role="group" aria-label={label} className="shrink-0"', via: 'track', thumb: 'slides', gone: 'overflow-hidden rounded-lg border border-ink/15 text-[11px]' },
  { area: 'couple', what: 'How to make your mark (Create your own | Upload your monogram)', file: `${D}/monogram/mark-toggle.tsx`, anchor: 'aria-label="How to make your mark"', via: 'classes', thumb: 'slides', gone: 'rounded-xl bg-ink/5 p-1' },
  { area: 'couple', what: 'Schedule view (Journey | Preparation | Event Day)', file: `${D}/schedule/_components/schedule-mode-toggle.tsx`, anchor: 'data-schedule-view-switch=""', via: 'classes', thumb: 'slides', gone: 'rounded-lg px-' },
  { area: 'couple', what: 'Guest list views (List | Map | Setup)', file: `${D}/guests/_components/guests-screen.tsx`, anchor: 'aria-label="Guest list views"', via: 'classes', thumb: 'slides', gone: 'styles.seg' },
  { area: 'couple', what: 'How moments are made (Automatic | I choose)', file: `${D}/story/_components/make-it-yours.tsx`, anchor: 'aria-label="How moments are made"', via: 'classes', thumb: 'slides', gone: 'className={s.seg}' },
  { area: 'couple', what: 'Preview device (iPhone | MacBook)', file: `${D}/_components/device-frame.tsx`, anchor: 'data-device-toggle=""', via: 'track', thumb: 'slides', gone: 'rounded-full border border-ink/10 bg-cream p-1' },
  { area: 'couple', what: 'How the video plays (Fill | Fit to screen)', file: `${D}/_components/std-media-picker.tsx`, anchor: 'data-std-video-fit=""', via: 'classes', thumb: 'slides', gone: 'inline-flex rounded-xl border border-ink/15 bg-cream p-0.5' },
  { area: 'couple', what: 'One area’s access (Edit | Off | View)', file: `${D}/details/_components/people-with-access.tsx`, anchor: 'data-area-toggle=""', via: 'track', thumb: 'waits', why: RADIO, gone: 'h-10 shrink-0 rounded-full bg-ink/[0.06] p-0.5' },
  { area: 'couple', what: 'How to set the date (Specific date(s) | A range)', file: `${A}/create-event/_components/create-date-picker.tsx`, anchor: 'aria-label="How do you want to set the date?"', via: 'track', thumb: 'waits', why: RADIO, gone: "'bg-ink text-white' : 'bg-ink/5" },
  { area: 'couple', what: 'Order the reel (By significance | By time)', file: `${A}/life-flash/_components/scroll-reel.tsx`, anchor: 'aria-label="Order the reel"', via: 'track', thumb: 'slides', gone: 'flex rounded-full border border-ink/15 p-0.5 text-xs' },
  { area: 'shared', what: 'A thread’s views (Chat | Decisions | Files)', file: 'app/_components/chat-thread-views.tsx', anchor: 'aria-label="Show"', via: 'classes', thumb: 'slides', gone: 'inline-flex overflow-hidden rounded-lg border border-ink/15' },
  { area: 'shared', what: 'Workspace sections (Chat · Quote · Payments · Files · Call · Details) — both sides', file: 'app/_components/relationship-tab-shell.tsx', anchor: 'aria-label="Workspace sections"', via: 'classes', thumb: 'slides', gone: 'rounded-xl border border-ink/10 bg-cream/70 p-1' },
];

/** From the opening `<` of the element the anchor sits on, a window long enough to hold the selector. */
function selectorWindow(src: string, anchor: string, file: string): string {
  const at = src.indexOf(anchor);
  assert.ok(at >= 0, `${file}: the selector marked “${anchor}” is gone — if it was deleted on purpose, say so in the PR`);
  assert.equal(src.indexOf(anchor, at + 1), -1, `${file}: “${anchor}” appears twice — the line no longer names ONE selector`);
  return src.slice(src.lastIndexOf('<', at), at + 1500);
}

/** What is wrong with one converted selector's source — nothing, when it is drawn by the template. */
export function pillFaults(src: string, c: Pick<Converted, 'file' | 'anchor' | 'via' | 'thumb' | 'gone'>): string[] {
  const faults: string[] = [];
  const win = selectorWindow(src, c.anchor, c.file);
  if (c.via === 'track') {
    if (!/^<PillTrack\b/.test(win)) faults.push('the track is drawn by hand — it is no longer <PillTrack>');
    if (!/<Pill(?:Button|Link)\b/.test(win)) faults.push('no choice is a <PillButton> / <PillLink>');
    if (/^<PillTrack\b[^>]*\bslide=\{false\}/.test(win)) faults.push('the thumb is switched off (slide={false})');
    if (!/from '@\/app\/_components\/pill-track'/.test(src)) faults.push('the file does not import the template');
  } else {
    if (!/\$\{(?:PILL_TRACK_CLASS|I_SEGMENTED_CLASS)\}|className=\{I_SEGMENTED_CLASS\}/.test(win)) faults.push('the track does not wear the template’s class');
    if (!/\b(?:pillSegClass|iSegClass)\(/.test(src)) faults.push('no choice wears the template’s look (pillSegClass)');
    if (!/<PillThumb \/>/.test(win)) faults.push('the thumb is gone — nothing slides');
  }
  if (c.thumb === 'waits' && !/aria-checked=\{/.test(win)) faults.push('it is marked as a radio group that cannot slide yet, but its choices no longer say aria-checked — mark it “slides”');
  if (c.thumb === 'slides' && !/aria-(?:pressed|selected|current)=\{/.test(src)) faults.push('no choice says it is picked in a way the thumb reads');
  if (src.includes(c.gone)) faults.push(`the hand-made look is back: “${c.gone}”`);
  return faults;
}

test('(1) pill-track.tsx — the template, as three elements a server page can write: RENDERED', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const P = await import('../app/_components/pill-selector');
  const T = await import('../app/_components/pill-track');
  const h = React.createElement;
  /* Painted, with the one HTML escape a class string carries (after:content-['']) undone. */
  const paint = (el: React.ReactElement) => renderToStaticMarkup(el).replace(/&#x27;/g, "'");

  // A group of buttons: the template's track, the caller's role and name, the picked one painting its own pill.
  const buttons = paint(
    h(T.PillTrack as never, { role: 'group', 'aria-label': 'Order', className: 'shrink-0' } as never, [
      h(T.PillButton as never, { key: 'a', on: true, 'aria-pressed': true } as never, 'By time'),
      h(T.PillButton as never, { key: 'b', on: false, 'aria-pressed': false, disabled: true } as never, 'By name'),
    ]),
  );
  const trackClass = /^<div role="group" aria-label="Order" data-pill-track="" class="([^"]*)"/.exec(buttons)?.[1] ?? '';
  for (const c of [...P.PILL_TRACK_CLASS.split(' '), P.PILL_TRACK_GROUND, 'inline-flex', 'shrink-0']) assert.ok(has(trackClass, c), `the track lost ${c}`);
  assert.ok(!has(trackClass, 'flex-1'), 'a track that was not asked to grow fills its row');
  assert.match(buttons, /<button aria-pressed="true" type="button" class="([^"]*)">By time<\/button>/);
  const [on, off] = [...buttons.matchAll(/<button [^>]*class="([^"]*)"/g)].map((m) => m[1]!);
  assert.equal(on, `${P.pillSegClass(true)} `, 'a picked button does not wear the template’s picked look, and only that');
  assert.equal(off, `${P.pillSegClass(false)} `);
  assert.match(buttons, /<button aria-pressed="false" disabled="" type="button"/, 'the caller’s own attributes are not passed through');

  // A nav of links that fills its row; a form of submit buttons carrying name=value.
  const nav = paint(h(T.PillTrack as never, { as: 'nav', grow: true, 'aria-label': 'Views' } as never, h(T.PillLink as never, { on: true, href: '/x?tab=a', 'aria-current': 'page' } as never, 'A')));
  assert.match(nav, /^<nav aria-label="Views" data-pill-track="" class="[^"]*\bflex-1\b[^"]*">/);
  assert.match(nav, /<a [^>]*aria-current="page"[^>]*href="\/x\?tab=a"|<a [^>]*href="\/x\?tab=a"[^>]*aria-current="page"/);
  assert.match(nav, /<a [^>]*class="[^"]*\bbg-mulberry\b[^"]*\brounded-full\b|<a [^>]*class="[^"]*\brounded-full\b[^"]*\bbg-mulberry\b/);
  const form = paint(h(T.PillTrack as never, { as: 'form', role: 'group', 'aria-label': 'Mode' } as never, h(T.PillButton as never, { on: false, type: 'submit', name: 'mode', value: 'diy', 'aria-pressed': false } as never, 'DIY')));
  assert.match(form, /^<form role="group" aria-label="Mode" data-pill-track=""/);
  const submit = /<button [^>]*>/.exec(form)?.[0] ?? '';
  for (const attr of ['value="diy"', 'name="mode"', 'type="submit"', 'aria-pressed="false"']) assert.ok(submit.includes(attr), `a submit choice lost ${attr}`);

  // It decides no look and no behaviour of its own.
  const src = read('app/_components/pill-track.tsx');
  assert.match(src, /^'use client';/, 'a server page could not write these');
  assert.doesNotMatch(src, /\b(?:rounded|bg|text|duration|ease|shadow|ring|border)-[a-z[]/, 'pill-track.tsx draws a look of its own — the look is pill-selector.tsx’s');
  assert.doesNotMatch(src, /onClick|onKeyDown|useState|useEffect|aria-(?:pressed|selected|current|checked)=/, 'pill-track.tsx decides behaviour — every handler and aria attribute is the caller’s');
  assert.match(src, /\{slide \? <PillThumb \/> : null\}\s*\{children\}/, 'the thumb is not laid FIRST inside the track');
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(), ['./pill-selector', 'next/link', 'react']);
});

test('(2)(3) every converted selector is drawn by the template — its track, its choices, its thumb; the hand-made look is gone', () => {
  assert.ok(CONVERTED.length >= 16, `anti-vacuity: only ${CONVERTED.length} selectors are held`);
  const report: string[] = [];
  for (const c of CONVERTED) {
    const faults = pillFaults(read(c.file), c);
    if (faults.length) report.push(`${c.what} — ${c.file}\n      ${faults.join('\n      ')}`);
    if (c.thumb === 'waits') assert.ok(c.why && c.why.length > 20, `${c.what}: a selector whose thumb cannot slide yet must say why`);
  }
  assert.deepEqual(report, [], `a converted selector is no longer drawn by the pill template:\n  ${report.join('\n  ')}`);
  // Two lines never name the same selector.
  const keys = CONVERTED.map((c) => `${c.file}|${c.anchor}`);
  assert.equal(new Set(keys).size, keys.length, 'two lines name the same selector');
  // The check SEES each fault it names.
  const sample = { file: 'x.tsx', anchor: 'data-x=""', via: 'track', thumb: 'slides', gone: 'rounded-lg border p-1' } as const;
  const good = `import { PillButton, PillTrack } from '@/app/_components/pill-track';\n<PillTrack data-x="">\n<PillButton on={a} aria-pressed={a}>A</PillButton></PillTrack>`;
  assert.deepEqual(pillFaults(good, sample), []);
  assert.equal(pillFaults(good.replace('<PillTrack data-x="">', '<div className="flex rounded-lg border p-1" data-x="">'), sample).length, 2, 'blind to a track drawn by hand');
  assert.equal(pillFaults(good.replace('<PillTrack data-x="">', '<PillTrack slide={false} data-x="">'), sample).length, 1, 'blind to a thumb switched off');
  assert.equal(pillFaults(good.replace(/<PillButton[^>]*>A<\/PillButton>/, '<button aria-pressed={a}>A</button>'), sample).length, 1, 'blind to a hand-made choice');
  const worn = { ...sample, via: 'classes' } as const;
  const goodWorn = 'const c = pillSegClass(on);\n<nav className={`${PILL_TRACK_CLASS} ${PILL_TRACK_GROUND}`} data-x="">\n<PillThumb />\n<a aria-current={on}>A</a></nav>';
  assert.deepEqual(pillFaults(goodWorn, worn), []);
  assert.equal(pillFaults(goodWorn.replace('<PillThumb />\n', ''), worn).length, 1, 'blind to a missing thumb');
  assert.equal(pillFaults(goodWorn.replace('${PILL_TRACK_CLASS} ${PILL_TRACK_GROUND}', 'flex rounded-md bg-cream p-1'), worn).length, 1, 'blind to a track that dropped the template’s class');
});

test('(4) the guests’ Event Hub is the one place that does not follow this rule — nothing under app/[slug] draws the template', () => {
  const walk = (dir: string): string[] =>
    readdirSync(join(WEB, dir)).flatMap((name) => {
      const rel = `${dir}/${name}`;
      return statSync(join(WEB, rel)).isDirectory() ? walk(rel) : /\.tsx$/.test(name) && !/\.test\./.test(name) ? [rel] : [];
    });
  const files = walk('app/[slug]');
  assert.ok(files.length >= 50, `anti-vacuity: only ${files.length} Event Hub files were read`);
  const users = files.filter((f) => /_components\/pill-(?:track|selector|thumb)'/.test(read(f)));
  assert.deepEqual(users, [], 'the couple’s own Event Hub is theirs to style — it does not wear the Setnayan pill selector');
  for (const c of CONVERTED) assert.ok(!c.file.startsWith('app/[slug]/'), `${c.file} is the guests’ Event Hub — out of this rule`);
});
