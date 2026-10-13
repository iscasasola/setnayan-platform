/**
 * THE COOKIE NOTICE NEVER COVERS "I SENT IT" (2026-10-12, owner: "fix the problems"; flagged in #6493's walk).
 *
 * WHAT WAS WRONG. On a guest's FIRST visit the cookie notice (`z-[70]`, the full-width bar on a phone) sat over the
 * foot of the wish list's send sheet (`data-wish-send`, z 60): "I sent it" was under the notice until the guest
 * answered it. The record sheet that replaces it (`data-gift-record`) ties the notice at 70.
 *
 * WHAT HOLDS IT — the way #6482 fixed /login's sign-in card (`the-cookie-notice-stands-above-the-sign-in-backdrop`):
 *   · while either sheet is open the notice is LIFTED over it (the one question a visitor must be able to answer);
 *   · the sheet's panel ENDS ABOVE the notice by the height the notice publishes (`--cookie-banner-top`), so the
 *     foot with "I sent it" and the sheet's last line stay in view.
 * Every number is READ from the sources (the two wrappers' z from their class lists, the notice's own, the lift's
 * from globals.css), never re-typed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '../../..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const CSS = read('globals.css');
const BANNER = read('_components/cookie-consent-banner.tsx');
const WISH = read('[slug]/pabuya/_components/wish-list.tsx');
const RECORD = read('[slug]/pabuya/_components/gift-record-sheet.tsx');

const zOfWrapper = (src: string, attr: string): number => Number(new RegExp(`${attr}=""\\s+className="relative z-\\[(\\d+)\\]`).exec(src)?.[1]);

test('the notice carries the attribute the lift selects on, and publishes its height', () => {
  assert.match(BANNER, /data-cookie-consent=""/);
  assert.match(BANNER, /'--cookie-banner-top'/, 'the notice stopped publishing `--cookie-banner-top`');
});

test('while the send sheet or the record sheet is open, the notice is drawn ABOVE both', () => {
  const own = Number(/\bz-\[(\d+)\]/.exec(BANNER)?.[1]);
  const send = zOfWrapper(WISH, 'data-wish-send');
  const record = zOfWrapper(RECORD, 'data-gift-record');
  assert.ok([own, send, record].every(Number.isFinite), `could not read the layers (notice ${own}, send ${send}, record ${record})`);
  const lift = /html:has\(\[data-wish-send\], \[data-gift-record\]\) \[data-cookie-consent\]\s*\{\s*z-index:\s*(\d+);/.exec(CSS);
  assert.ok(lift, 'the rule that lifts the notice over the wish sheets is gone');
  const lifted = Number(lift[1]);
  assert.ok(lifted > send && lifted > record, `the notice is lifted to ${lifted}, the sheets are ${send} / ${record} — a sheet covers the notice again`);
});

test('the sheet ends above the notice: its foot ("I sent it") is never under it', () => {
  const rule = /@media \(max-width: 1023\.98px\)\s*\{\s*:is\(\[data-wish-send\], \[data-gift-record\]\) \[data-sheet-panel\]\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(rule, 'the sheet panel no longer leaves room for the notice');
  const body = rule[1] ?? '';
  assert.match(body, /margin-bottom:\s*var\(--cookie-banner-top, 0px\);/, 'the panel does not end above the notice');
  assert.match(body, /max-height:\s*calc\(90dvh - var\(--cookie-banner-top, 0px\)\);/, 'the panel can grow back under the notice');
  // …and the button it protects is in the sheet's foot, inside the panel the rule moves.
  assert.match(WISH, /data-wish-send=""[\s\S]*?<Sheet [\s\S]*?data-wish-send-foot=""[\s\S]*?data-wish-i-sent-it=""/);
  assert.match(read('_components/sheet.tsx'), /data-sheet-panel=""/, 'the shared Sheet lost the panel hook the rule selects on');
});
