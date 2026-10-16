/**
 * the-cover-scene-has-its-own-edit.test.ts — ✏️ COVER SCENE › EDIT: THE COVER'S LINES, EACH WITH THE HOUSE SWITCH
 * (owner-approved 2026-10-16, DECISION_LOG "APPROVED — THE COVER SCENE'S OWN EDIT · STYLE (OPENING) · ANIMATE…";
 * prototype `cover_scene_edit_animate_2026-10-16.html` `drawLines`).
 *
 *   (1) THE GROUP'S EDIT IS LIVE, and the toolbar draws the lines there (`CoverLines`), in place of the words' rows.
 *   (2) EVENT TITLE HAS NO SWITCH — no `hidden` field on the names (the sanitiser drops a stored one), "always" in the
 *       list and a tap says why; every other line has the house switch (`PanelSwitch`).
 *   (3) A HIDDEN LINE IS ABSENT FOR GUESTS — and leaves the Maker's canvas at once too (never ghosted), on the page as
 *       drawn by the server and in the instant preview alike.
 *   (4) THE LOGO'S SWITCH IS STUDIO'S "SHOW THE LOGO" — `events.logo_wanted`, one fact: Edit writes that column, and the
 *       cover draws no mark when it is off.
 *   (5) A LINE'S NAME PICKS THAT WORD.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { HUB_ELEMENT_FIELDS, hubElementDeclarations, sanitizeHubElementStyle } from './element-style';
import { MAKER_COVER_SCENE, MAKER_PARTS, makerPartParent, makerPartToolWorks } from './maker-parts';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const TOOLS = stripComments(read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx'));
const LINES = stripComments(read('app/dashboard/[eventId]/launch/_components/stage-panel/cover-lines.tsx'));

test('(1) the Cover Scene’s Edit is live, and its rows are the cover’s lines', () => {
  assert.ok(makerPartToolWorks(MAKER_COVER_SCENE, 'edit'), 'Cover Scene › Edit is grey');
  assert.ok(makerPartToolWorks(MAKER_COVER_SCENE, 'bg'));
  assert.match(TOOLS, /\{editOn && picked === MAKER_COVER_SCENE && !rsvpOpen \? \(\s*<CoverLines lines=\{coverLines\}/, 'the toolbar does not draw the cover’s lines on its Edit');
  assert.match(TOOLS, /\.filter\(\(k\) => makerPartParent\(k\) === MAKER_COVER_SCENE\)/, 'the list is not the cover’s own words');
  // The RSVP button is one of them.
  assert.equal(MAKER_PARTS.rsvpbutton.label, 'RSVP button');
  assert.equal(makerPartParent('rsvpbutton'), MAKER_COVER_SCENE);
});

test('(2) the Event title has no switch — "always", and a tap says why; every other line has the house switch', async () => {
  assert.ok(!HUB_ELEMENT_FIELDS.names.includes('hidden'), 'the names can be hidden');
  assert.equal(sanitizeHubElementStyle({ hidden: true, color: '#112233' }, 'names')?.hidden, undefined, 'a stored hidden on the names survives');
  const { coverLineHasSwitch, CoverLines, COVER_TITLE_ALWAYS } = await import('../app/dashboard/[eventId]/launch/_components/stage-panel/cover-lines');
  assert.equal(coverLineHasSwitch('names'), false);
  for (const k of ['logo', 'ename', 'date', 'place', 'heroline', 'herolink', 'rsvpbutton'] as const) assert.ok(coverLineHasSwitch(k), `${k} has no switch`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(
    React.createElement(CoverLines, {
      lines: [
        { part: 'ename', label: 'Top line', sample: 'With thanksgiving', shown: true },
        { part: 'logo', label: 'Logo', sample: 'the monogram', shown: true },
        { part: 'names', label: 'Event title', sample: 'Maria & Jose', shown: true },
        { part: 'date', label: 'Date', sample: 'December 18, 2026', shown: false },
        { part: 'rsvpbutton', label: 'RSVP button', sample: 'Confirm attendance', shown: true },
      ],
      onPick: () => {},
      onSay: () => {},
    }),
  );
  const row = (part: string) => new RegExp(`<div data-cover-line-row="${part}"[^>]*>[\\s\\S]*?</div>`).exec(html)?.[0] ?? '';
  assert.doesNotMatch(row('names'), /role="switch"/, 'the Event title has a switch');
  assert.match(row('names'), /data-cover-line-always=""[^>]*>always</, 'the Event title does not say "always"');
  for (const part of ['ename', 'logo', 'date', 'rsvpbutton']) assert.match(row(part), /role="switch"/, `${part} has no switch`);
  assert.match(row('date'), /aria-checked="false"/, 'a hidden line shows its switch on');
  assert.match(html, /1 hidden<\/b>/, 'the list does not say what is hidden');
  assert.match(LINES, /onClick=\{\(\) => onSay\(COVER_TITLE_ALWAYS\)\}/);
  assert.equal(COVER_TITLE_ALWAYS, 'The names are the cover — they are always shown.');
});

test('(3) a hidden line is absent for guests — and leaves the Maker’s canvas too, never ghosted', async () => {
  assert.deepEqual(hubElementDeclarations({ hidden: true }), [['display', 'none']]);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('../app/[slug]/_components/pahina-masthead');
  for (const stampElements of [false, true]) {
    const html = renderToStaticMarkup(
      React.createElement(PahinaMasthead, { displayName: 'Maria & Jose', eventDate: '2026-12-18', venueName: 'Manila Cathedral', elements: { date: { hidden: true }, venue: { hidden: true } }, stampElements } as never),
    );
    const date = /<p [^>]*data-motion="arrive-date"[^>]*>/.exec(html)?.[0] ?? '';
    assert.match(date, /style="display:none"/, `${stampElements ? 'the Maker' : 'a guest'}: a hidden Date is drawn`);
    assert.doesNotMatch(html, /opacity:0\.3/, `${stampElements ? 'the Maker' : 'a guest'}: a hidden line is ghosted, not gone`);
  }
  // The instant preview lays the same answer (no `editor: true` ghost on a hero part).
  assert.match(stripComments(read('app/[slug]/_components/editor-bridge.tsx')), /for \(const \[p, v\] of hubElementDeclarations\(style\)\) part\.style\.setProperty\(p, v\);/);
  // The switch writes the word's own `hidden` on the hero row, through the one draft door.
  assert.match(LINES, /withElementChoice\(before\.elements \?\? null, el, 'hidden', shown \? null : true\)/);
  assert.match(LINES, /JSON\.stringify\(\{ widgets: \{ hero: \{ canvas: next \} \} \}\)/);
});

test('(4) the Logo’s switch is Studio’s "Show the logo" — one fact, and off draws no mark', () => {
  assert.match(LINES, /l\.part === 'logo' \? await keepLogo\(on\)/, 'the Logo’s switch is not the logo answer');
  assert.match(LINES, /JSON\.stringify\(\{ events: \{ logo_wanted: on \} \}\)/, 'the Logo’s switch does not write events.logo_wanted');
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  assert.match(body, /const coverLogoOff = \(event as \{ logo_wanted\?: boolean \| null \}\)\.logo_wanted === false;/);
  assert.equal((body.match(/monogramSlot=\{coverLogoOff \? null : \(/g) ?? []).length, 4, 'a cover still draws the mark with the Logo switched off');
});

test('(5) a line’s name picks that word', () => {
  assert.match(LINES, /onClick=\{\(\) => onPick\(l\.part\)\}/);
  assert.match(TOOLS, /<CoverLines lines=\{coverLines\} onPick=\{\(k\) => pickPartRef\.current\(k\)\}/);
});
