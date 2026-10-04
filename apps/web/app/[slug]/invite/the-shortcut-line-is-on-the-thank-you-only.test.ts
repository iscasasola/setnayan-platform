/**
 * ONE QUIET "SHORTCUT TO THIS EVENT" LINE — ON THE THANK-YOU, AFTER A YES, AND
 * NOWHERE ELSE (owner 2026-10-03, DECISION_LOG "AMENDS THE ROW ABOVE — GUESTS GET
 * ONE QUIET 'SHORTCUT TO THIS EVENT' LINE, ONLY AFTER THEY REPLY").
 *
 *   1 · rendered: the line, and the steps for THIS phone behind a tap (a
 *       `<details>` — no popup, no script); both phones when it cannot tell;
 *   2 · placed: the thank-you mounts it exactly once, only after a Yes, never in
 *       the before-the-reply render, and no other guest page mounts it — the
 *       2026-09-30 removal from the Event Hub stands;
 *   3 · the tile is the couple's: the page names the per-event manifest and the
 *       apple icon through the one helper the Event Hub uses.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { HOME_SCREEN_LINE } from '@/lib/home-screen-shortcut';

(globalThis as unknown as { React: unknown }).React = React;

const APP = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36';

async function render(userAgent: string | null) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ShortcutLine } = await import('./_components/shortcut-line');
  return renderToStaticMarkup(React.createElement(ShortcutLine, { userAgent }));
}

test('1 · the line, with this phone\'s steps behind a tap — never a popup', async () => {
  const iphone = await render(IPHONE);
  assert.ok(iphone.includes(HOME_SCREEN_LINE), 'the line is not drawn');
  assert.match(iphone, /^<details[^>]*data-landing-shortcut=""[^>]*><summary/, 'the steps are not behind a tap');
  assert.doesNotMatch(iphone, /<details[^>]*\sopen/, 'the steps open by themselves');
  assert.match(iphone, /Share → Add to Home Screen/);
  assert.doesNotMatch(iphone, /⋮/, 'an iPhone is shown Android\'s steps');
  const android = await render(ANDROID);
  assert.match(android, /⋮ → Add to Home screen/);
  assert.doesNotMatch(android, /Share → Add/, 'an Android is shown iPhone\'s steps');
  const unknown = await render(null);
  assert.equal((unknown.match(/data-shortcut-steps=/g) ?? []).length, 2, 'an unknown phone is not shown both');
  assert.doesNotMatch(iphone + android + unknown, /role="dialog"|<dialog|beforeinstallprompt/, 'a popup');
});

test('2 · the thank-you mounts it once, after a Yes only — and no other guest page does', () => {
  const ENTER = read('[slug]/invite/enter/page.tsx');
  const mounts = ENTER.match(/<ShortcutLine\b/g) ?? [];
  assert.equal(mounts.length, 1, `the line is mounted ${mounts.length} times on the thank-you`);
  assert.match(ENTER, /\{reply === 'yes' \? <ShortcutLine userAgent=\{userAgent\} \/> : null\}/, 'the line shows before a Yes');
  // Never in the before-the-reply render (it returns early, above the thank-you).
  const preReply = ENTER.slice(ENTER.indexOf('if (unreplied && ticket !== \'full\') {'), ENTER.indexOf('<TicketPopup'));
  assert.ok(preReply.length > 100, 'the before-the-reply render moved — this check is blind');
  assert.doesNotMatch(preReply, /ShortcutLine/, 'the line is on the screen before the reply');

  const slugDir = join(APP, '[slug]');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        const rel = full.slice(APP.length + 1);
        if (rel === join('[slug]', 'invite', 'enter', 'page.tsx') || rel === join('[slug]', 'invite', '_components', 'shortcut-line.tsx')) continue;
        if (/ShortcutLine|HOME_SCREEN_LINE|homeScreenStepsFor/.test(stripComments(readFileSync(full, 'utf8')))) offenders.push(rel);
      }
    }
  };
  walk(slugDir);
  assert.deepEqual(offenders, [], `the shortcut line reached another guest page: ${offenders.join(', ')}`);
});

test('3 · the shortcut made from the thank-you is the couple\'s tile for THAT event', () => {
  const ENTER = read('[slug]/invite/enter/page.tsx');
  assert.match(ENTER, /export async function generateMetadata\(/, 'the thank-you names no tile');
  assert.match(
    ENTER,
    // + the tile's one-time re-entry code (I9, 2026-10-04 — lib/guest-reentry.test.ts).
    /eventShortcutMetadata\(shell\.slug as string, shell\.display_name as string \| null, \{ reentryCode: tileCode \}\)/,
    'the thank-you names its tile some other way than the Event Hub',
  );
  assert.doesNotMatch(ENTER, /export const metadata\b/, 'a static metadata export would drop the tile');
});
