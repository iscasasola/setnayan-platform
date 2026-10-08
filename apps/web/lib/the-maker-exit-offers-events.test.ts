/**
 * ✕ THE MAKER'S WAY OUT OFFERS EVENTS — owner, on the live Maker at 896 px, verbatim: *"why can't i go back to
 * events?"* · told his options: *"Okay, fix the three step."*
 *
 * Measured: the Maker is a fixed full-screen layer (z 80) over the app's top bar (z 20) and rail (z 60), which hold
 * the "Events" link — so ✕ → this event's page → ☰ → Events was THREE taps, against "everything in less than 3 taps".
 *
 *   1 · ✕ opens the way-out sheet; it no longer leaves by itself.
 *   2 · the sheet has exactly two doors, both real links: Back to this event (where ✕ always went) · All events.
 *   3 · the "changes are kept" line is the draft bar's own count — never said when there is nothing to keep.
 *   4 · Escape and the dimmed page close the sheet; neither leaves. It is the Maker's ONE sheet, at every width.
 *   5 · nothing of the sheet rides the Maker's first load.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';

import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const LAUNCH = 'app/dashboard/[eventId]/launch/_components';
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const src = (rel: string) => stripComments(raw(rel));
const SHELL = src(`${LAUNCH}/maker-shell.tsx`);
const SHEET = src(`${LAUNCH}/maker-exit-sheet.tsx`);

async function render(changes: number): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerExitSheet } = await import(`../${LAUNCH}/maker-exit-sheet`);
  return renderToStaticMarkup(React.createElement(MakerExitSheet, { eventId: 'S89E-ABCDEF1234', changes, onClose: () => {} }))
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

/* ══ 1 · ✕ OPENS THE SHEET — IT NO LONGER LEAVES ════════════════════════════ */

test('1 · the ✕ is a button that opens the way-out sheet; the bar holds no link out of the Maker', () => {
  const bar = SHELL.slice(SHELL.indexOf('data-maker-toolbar=""'), SHELL.indexOf('data-maker-toolbar=""') + 2600);
  const exit = bar.slice(bar.indexOf('<IconPill tone="exit">'), bar.indexOf('</IconPill>'));
  assert.ok(exit.length > 200, 'precondition: the ✕ pill was found');
  assert.match(exit, /<button\s+type="button"\s+aria-label="Exit"\s+aria-haspopup="dialog"\s+aria-expanded=\{exitOpen\}/);
  assert.match(exit, /onClick=\{\(\) => setExitOpen\(true\)\}/, '✕ does something other than open the sheet');
  assert.doesNotMatch(exit, /<Link|href=|router\.|location\./, '✕ still leaves by itself — Events is three taps again');
  assert.match(exit, /data-maker-tool="exit"/);
  // One Maker, one bar: the shipped (flag-off) Maker and the new one draw this same ✕ — nothing gates it on the flag.
  assert.doesNotMatch(exit, /stagesStudio/);
  assert.match(SHELL, /\{exitOpen && typeof document !== 'undefined'\s*\? createPortal\(<MakerExitSheet eventId=\{eventId\} changes=\{draft\?\.count \?\? 0\} onClose=\{\(\) => setExitOpen\(false\)\} \/>, document\.body\)/);
});

/* ══ 2 · EXACTLY TWO DOORS, BOTH REAL LINKS ═════════════════════════════════ */

test('2 · the sheet offers Back to this event and All events — two links, the right addresses, the button rule', async () => {
  const html = await render(0);
  const links = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(links.length, 2, `exactly two doors: ${links.join(' ')}`);
  const hrefs = links.map((a) => /href="([^"]*)"/.exec(a)?.[1]);
  assert.deepEqual(hrefs, ['/dashboard/S89E-ABCDEF1234', '/dashboard'], 'Back to this event (where ✕ always went), then All events');
  const labels = links.map((a) => /aria-label="([^"]*)"/.exec(a)?.[1]);
  assert.deepEqual(labels, ['Back to this event', 'All events']);
  // BUTTON_RULE_2026-10-07: each an ActionButton — the pill class, a tone, an icon and its word.
  for (const a of links) assert.match(a, /class="ab ab-neutral[^"]*"/, a);
  assert.equal((html.match(/<span class="lbl">/g) ?? []).length, 2);
  assert.equal((html.match(/<svg\b/g) ?? []).length, 2, 'icon + word, both doors');
  // The sheet's own close is the dimmed page (a button), never a third door; and the words are the product's.
  assert.equal((html.match(/<button\b/g) ?? []).length, 1);
  assert.match(html, /<button type="button" aria-label="Close" data-maker-sheet-scrim=""/);
  assert.doesNotMatch(html, /celebration|wedding|website|vendor/i);
  // One source for the doors.
  const { makerExitDoors } = await import(`../${LAUNCH}/maker-exit-sheet`);
  assert.deepEqual(makerExitDoors('E1').map((d: { href: string }) => d.href), ['/dashboard/E1', '/dashboard']);
});

/* ══ 3 · "KEPT" IS SAID FROM THE REAL COUNT ═════════════════════════════════ */

test('3 · the kept-as-a-draft line is the draft bar’s own count — and absent when there is nothing to keep', async () => {
  const { makerExitDraftLine } = await import(`../${LAUNCH}/maker-exit-sheet`);
  assert.equal(makerExitDraftLine(0), null);
  assert.equal(makerExitDraftLine(1), 'Your 1 change is saved as a draft.');
  assert.equal(makerExitDraftLine(4), 'Your 4 changes are saved as a draft.');
  assert.equal(makerExitDraftLine(1200), 'Your 1,200 changes are saved as a draft.');
  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(makerExitDraftLine(bad), null, String(bad));
  assert.doesNotMatch(await render(0), /data-maker-exit-draft|saved as a draft/, 'a clean draft was told something is kept');
  assert.match(await render(3), /<p data-maker-exit-draft=""[^>]*>Your 3 changes are saved as a draft\.<\/p>/);
  // The count is the ✓ badge's: the draft bar tells the shell the number it shows.
  const BAR = src('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(BAR, /const applyCount = summary\.hasChanges \? summary\.changeCount : 0;/);
  assert.match(BAR, /restore: \(\) => actRef\.current\(\{ intent: 'restore' \}\),\s*count: applyCount,/);
  assert.equal(BAR.match(/const applyCount = /g)?.length, 1, 'one count, two readers');
});

/* ══ 4 · ESCAPE CLOSES, NEVER EXITS — THE MAKER'S ONE SHEET, EVERY WIDTH ════ */

test('4 · Escape and the dimmed page close the sheet; it is the Maker’s one sheet, shown at every width', async () => {
  assert.match(SHEET, /if \(e\.key !== 'Escape'\) return;\s*e\.stopPropagation\(\);\s*onClose\(\);/);
  assert.doesNotMatch(SHEET, /router\.|location\.|useRouter/, 'the sheet navigates by itself');
  assert.match(SHEET, /<MakerSheet label="Leave the Maker" onClose=\{onClose\} everyWidth>/);
  const html = await render(0);
  // The shipped sheet is a phone's (`lg:hidden`); this one a desktop needs too — its ✕ is the same button.
  assert.match(html, /<div data-maker-sheet="" class="fixed inset-0 z-\[95\]">/);
  const PARTS = src(`${LAUNCH}/stages-studio-parts.tsx`);
  assert.match(PARTS, /className=\{`fixed inset-0 z-\[95\]\$\{everyWidth \? '' : ' lg:hidden'\}`\}/, 'every other sheet stays a phone’s');
  assert.match(PARTS, /everyWidth = false,/);
});

/* ══ 5 · NOTHING OF IT ON THE FIRST LOAD ════════════════════════════════════ */

test('5 · the sheet arrives lazily — the shell imports only its door', () => {
  assert.match(raw(`${LAUNCH}/details-lazy.tsx`), /export const MakerExitSheet = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/maker-exit-sheet'\)/);
  assert.doesNotMatch(SHELL, /from '\.\/maker-exit-sheet'/);
  assert.match(SHELL, /import \{[^}]*\bMakerExitSheet\b[^}]*\} from '\.\/details-lazy';/);
});
