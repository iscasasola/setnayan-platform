/**
 * print-settings-opens-at-this-print.test.ts — THE ⚙ SHEET OPENS AT THE PRINT ON SCREEN, AND STILL HOLDS EVERY SECTION.
 *
 * Owner 2026-10-31, verbatim: *"Yes follow your recommendation"* — the recommendation: "when you tap ⚙ on a print, open the same
 * sheet already scrolled to that print's own section, with 'On every print' still above it. You land on the right settings, but
 * nothing is hidden or split into separate sheets."
 *
 * Held as properties:
 *   1 · each print with switches of its own names a heading the sheet really draws (`PRINT_SETTINGS_HEADS`, and a `key:` of the
 *       sections `maker-details.tsx` hands the sheet); "On every print" is never a print's own; a print without one opens at the top;
 *   2 · the open place, measured on a stand-in body scrolled anywhere: that print's section at the top of the scroll area (with just
 *       the blank room below the last section a heading near the end needs to get there); a print with no section — or whose
 *       section this event does not draw — at 0;
 *   3 · the sheet does it as it opens, before the frame paints and instantly (a layout effect on `open`, `behavior: 'instant'`, no
 *       smooth scroll), from the print the carousel says is on screen (the carousel writes it as its slide moves) — so opening
 *       again after a swipe lands on the new print;
 *   4 · nothing is hidden, filtered or split: every section handed in is drawn, in order, in the ONE sheet — shut too (its fields
 *       stay in the page, `studio-prints-posts-the-same.test.ts`).
 *
 * The open itself (a store the server render always reads shut) is walked in the lab at 390×844 WebKit with touch — see the PR.
 *
 * SABOTAGE (seen RED, then restored — see the PR): the sheet's `printSettingsOpenAt(b, printOnScreenNow())` read as
 * `printSettingsOpenAt(b, null)` → 3 red (the sheet no longer reads the print on screen); the open place's `+ body.scrollTop`
 * dropped → 2 red; the room's `transition-none` dropped (then an inline style) → 3 red — and in the lab under reduced motion the
 * same removal left Passes, Our Story poster and the seat plan 306 / 453 / 547 px down.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
/* Its side effect: `server-only` resolves to an empty module, so the sheet's file (which reaches a server action) can load. */
import './render-settled.test-helper';
import { PRINT_SETTINGS_HEADS, PRINT_SETTINGS_SECTION_OF, printSettingsOpenAt, printSettingsSectionFor, type PrintSettingsScroller } from './studio-prints-settings';
import { DIGITAL_TICKET_ITEM, FREE_PRINT_KEYS } from './maker-details-items';
import { PRINT_SET_KEYS } from './print-pieces';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('1 · a print with switches of its own names a heading the sheet draws; the rest open at the top', () => {
  const prints = new Set<string>([...PRINT_SET_KEYS, DIGITAL_TICKET_ITEM, ...FREE_PRINT_KEYS]);
  const named = Object.entries(PRINT_SETTINGS_SECTION_OF);
  assert.ok(named.length >= 5, 'anti-vacuity: no print names a section');
  /* The sections the sheet is handed — `editors[EVERY_PRINT_ITEM]` in maker-details.tsx. */
  const details = read(`${L}/maker-details.tsx`);
  const from = details.indexOf('editors[EVERY_PRINT_ITEM] = (');
  assert.ok(from > 0, 'anti-vacuity: the print settings editor was not found');
  const block = details.slice(from, details.indexOf('editors[DIGITAL_TICKET_ITEM]', from));
  const drawn = new Set([...block.matchAll(/key: '([a-z]+)',\s*\.\.\.PRINT_SETTINGS_HEADS\.([a-z]+)/g)].map((m) => (assert.equal(m[1], m[2], `section ${m[1]} wears heading ${m[2]}`), m[1])));
  assert.ok(drawn.has('every') && drawn.size >= 6, `anti-vacuity: the sheet's sections read ${JSON.stringify([...drawn])}`);
  for (const [piece, head] of named) {
    assert.ok(prints.has(piece), `"${piece}" is not a print on the Prints page`);
    assert.ok(head && head in PRINT_SETTINGS_HEADS, `"${piece}" names "${head}", not a heading of the sheet`);
    assert.ok(drawn.has(head!), `"${piece}" names "${head}", a section maker-details.tsx never hands the sheet`);
    assert.notEqual(head, 'every', `"${piece}" opens at "On every print" — that is every print's, the sheet's top`);
  }
  assert.equal(printSettingsSectionFor('pass'), 'passes');
  assert.equal(printSettingsSectionFor('invitation'), 'invitation');
  assert.equal(printSettingsSectionFor('seating-chart'), 'seating');
  /* No switch of these changes their file — the sheet opens at its top for them. */
  for (const none of [DIGITAL_TICKET_ITEM, 'seating-pack', 'menu', 'download', null, undefined, 'not-a-print']) {
    assert.equal(printSettingsSectionFor(none), null, `${String(none)} lands on a section that is not its own`);
  }
});

/** A stand-in body: sections at their offsets inside the content, scrolled to `scrollTop`, the body's own top at 120. */
function body(offsets: Record<string, number>, scrollTop: number, clientHeight = 700, scrollHeight = 1700): PrintSettingsScroller {
  const top = 120;
  return {
    scrollTop,
    clientHeight,
    scrollHeight,
    getBoundingClientRect: () => ({ top }),
    querySelector(sel: string) {
      const k = /data-print-settings-section="([a-z]+)"/.exec(sel)?.[1];
      return k && k in offsets ? { getBoundingClientRect: () => ({ top: top + offsets[k]! - scrollTop }) } : null;
    },
  };
}

test('2 · the sheet opens with that print’s section at the top of its scroll area — wherever it was last scrolled', () => {
  const at = { every: 96, invitation: 410, details: 590, passes: 980, story: 1240, seating: 1400 };
  for (const was of [0, 333, 1000]) {
    assert.deepEqual(printSettingsOpenAt(body(at, was), 'pass'), { key: 'passes', top: 980, room: 0 }, `scrolled to ${was}, the pass lands elsewhere`);
    assert.deepEqual(printSettingsOpenAt(body(at, was), 'invitation'), { key: 'invitation', top: 410, room: 0 });
    /* Near the end: the body is given just the room under its last section for the seat plan's heading to reach the top. */
    assert.deepEqual(printSettingsOpenAt(body(at, was), 'seat-plan'), { key: 'seating', top: 1400, room: 400 }, 'the last section cannot reach the top');
    assert.deepEqual(printSettingsOpenAt(body(at, was), DIGITAL_TICKET_ITEM), { key: null, top: 0, room: 0 }, 'a print with no section did not open at the top');
    assert.deepEqual(printSettingsOpenAt(body(at, was), null), { key: null, top: 0, room: 0 });
  }
  /* This event draws no "The invitation" (no parents, no opening line) — its print opens at the top, never at a missing place. */
  const { invitation: _gone, ...noInvitation } = at;
  assert.deepEqual(printSettingsOpenAt(body(noInvitation, 500), 'invitation'), { key: null, top: 0, room: 0 });
  /* A sheet that fits (nothing to scroll) shows every section already, and grows with no blank room. */
  assert.deepEqual(printSettingsOpenAt(body(at, 0, 1800, 1700), 'seat-plan'), { key: 'seating', top: 0, room: 0 });
});

test('3 · it happens as the sheet opens — before paint, instantly, at the print the carousel has on screen', () => {
  const sheetSrc = read(`${L}/studio-prints-settings.tsx`);
  const sheet = sheetSrc.slice(sheetSrc.indexOf('export function StudioPrintSettings('), sheetSrc.indexOf('export function StudioPrintSettingsDoor('));
  assert.ok(sheet.length > 1000, 'anti-vacuity: the sheet was not read');
  const effect = /useLayoutEffect\(\(\) => \{([\s\S]*?)\}, \[open\]\);/.exec(sheet)?.[1] ?? '';
  assert.match(effect, /if \(!open \|\| !b\) return;/, 'the open place is not set as the sheet opens');
  assert.match(effect, /printSettingsOpenAt\(b, printOnScreenNow\(\)\)/, 'the sheet does not open at the print on screen');
  assert.match(effect, /room\.current\.style\.height = '0px';[\s\S]*printSettingsOpenAt[\s\S]*room\.current\.style\.height = `\$\{below\}px`;/, 'the room below is not measured at 0, then given');
  assert.match(sheet, /<div ref=\{room\} aria-hidden data-print-settings-room="" className="h-0 transition-none" \/>\s*<\/div>/, 'the room is not the body’s last child — or it can transition');
  /* Under reduced motion globals.css gives every element a 0.001 ms transition (property `all`): a room that may transition still
     measures 0 when the scroll runs (WebKit, measured). The rule is what makes `transition-none` necessary — held so a
     change to it is seen here. */
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce\)[\s\S]{0,200}\*,[\s\S]{0,200}transition-duration: 0\.001ms !important/, 'anti-vacuity: the reduced-motion rule this guards against moved');
  assert.match(effect, /b\.scrollTo\(\{ top, behavior: 'instant' \}\)/, 'the open place is not set instantly');
  assert.match(sheet, /ref=\{scroller\} data-print-settings-body=""/, 'the place is set on another element than the sheet’s scrolling body');
  assert.doesNotMatch(sheet, /behavior: 'smooth'|scroll-smooth|scrollIntoView/, 'the sheet glides to the place — a jump on a phone, and no reduced motion');
  /* The carousel says which print is on screen as its slide moves (a swipe, ‹ ›, a jump) — and forgets it when it leaves. */
  const carousel = read(`${L}/studio-prints-carousel.tsx`);
  assert.match(carousel, /useEffect\(\(\) => \{\s*setPrintOnScreen\(here\.key\);\s*\}, \[here\.key\]\);/, 'the carousel does not say which print is on screen');
  assert.match(carousel, /useEffect\(\(\) => \(\) => setPrintOnScreen\(null\), \[\]\);/, 'the print on screen outlives the carousel');
});

test('4 · nothing is hidden or split — every section is drawn, in order, in the one sheet', async () => {
  const sheetSrc = read(`${L}/studio-prints-settings.tsx`);
  assert.match(sheetSrc, /\{sections\.map\(\(s\) => \(/, 'the sheet no longer draws its sections as handed');
  assert.doesNotMatch(sheetSrc, /sections\s*\.\s*(filter|slice|find)\(/, 'the sheet filters its sections');
  const S = await import(`../${L}/studio-prints-settings`);
  const keys = Object.keys(PRINT_SETTINGS_HEADS);
  const sections = keys.map((k) => ({
    key: k,
    ...PRINT_SETTINGS_HEADS[k as keyof typeof PRINT_SETTINGS_HEADS],
    body: React.createElement('input', { form: 'details-print-words', name: `probe_${k}`, defaultValue: 'x' }),
  }));
  const html = renderToStaticMarkup(React.createElement(S.StudioPrintSettings, { sections, form: 'details-print-words', lead: React.createElement('i', { 'data-probe-lead': '' }) }));
  const drawn = [...html.matchAll(/data-print-settings-section="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(drawn, keys, 'a section is missing from, or out of order in, the sheet');
  for (const k of keys) assert.match(html, new RegExp(`name="probe_${k}"`), `the "${k}" field left the page`);
  assert.equal((html.match(/role="dialog"/g) ?? []).length, 1, 'the settings are split across more than one sheet');
  assert.ok(html.indexOf('data-probe-lead') < html.indexOf('data-print-settings-section="every"'), 'the lead is not above "On every print"');
});
