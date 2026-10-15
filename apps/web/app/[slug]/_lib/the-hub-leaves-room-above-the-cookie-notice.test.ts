/**
 * THE EVENT HUB LEAVES ROOM ABOVE THE FIRST-VISIT COOKIE NOTICE (2026-10-13, hub leftovers; the owner's walk of the
 * hub at 375×812 on a first visit: "See our page" and "Sign out of this invitation" were under the notice until it
 * was answered — measured `elementFromPoint` = the notice for both).
 *
 * The same fix shape as #6482 (/login) and the wish list's send sheet: the notice publishes its own height
 * (`--cookie-banner-top`, 0 once answered or off a phone) and the PAGE keeps that much room clear of it —
 *   · the page's foot (`data-guest-foot`; on a tabbed page Me's own `data-me-stage`) pads its bottom by it, so the
 *     sign-out scrolls up clear of the notice;
 *   · the Save the Date film's quiet "See our page" (`absolute bottom-5`, over a full-screen film the notice sits on)
 *     stands that far above the edge.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '../..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const CSS = read('globals.css');
const SITE = read('[slug]/_components/site-body.tsx');
const FILM = read('[slug]/_components/save-the-date-film.tsx');
const BANNER = read('_components/cookie-consent-banner.tsx');
const OVERLAY = read('[slug]/_components/reveal/reveal-overlay.tsx');

test('the notice still publishes the height the hub reads', () => {
  assert.match(BANNER, /'--cookie-banner-top'/, 'the notice stopped publishing `--cookie-banner-top`');
});

test('the page foot and Me stand clear of the notice by its published height', () => {
  const rule = /\[data-guest-foot\],\s*\[data-me-stage\]\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(rule, 'the rule that gives the hub room above the notice is gone');
  assert.match(rule[1] ?? '', /padding-bottom:\s*var\(--cookie-banner-top, 0px\);/, 'the foot does not leave the notice’s height clear');
  // …and the two places that end in the sign-out wear the hooks the rule selects on.
  assert.match(SITE, /<div data-guest-foot=""[^>]*>\s*\{scanTrail\}\s*\{signOut\}/, 'the page foot (record note + sign-out) lost data-guest-foot');
  assert.match(SITE, /<div data-me-stage=""/, 'Me lost data-me-stage');
  assert.match(SITE, /data-me-stage=""[\s\S]*?\{scanTrail\}\s*\{signOut\}\s*<\/div>/, 'the sign-out is no longer the end of Me’s stage');
});

test('the Save the Date film’s quiet “See our page” stands above the notice', () => {
  const at = FILM.indexOf('See our page');
  assert.ok(at > -1, 'the film lost its quiet "See our page"');
  // The wrapper that holds the quiet button: `absolute bottom-5 left-4`, immediately before its <button>.
  const wrap = /<div className="absolute bottom-5 left-4 z-20"([\s\S]*?)>\s*<button/.exec(FILM);
  assert.ok(wrap, 'the quiet "See our page" no longer sits in its corner wrapper');
  assert.match(wrap[1] ?? '', /style=\{\{\s*bottom:\s*'calc\(1\.25rem \+ var\(--cookie-banner-top, 0px\)\)'\s*\}\}/, 'the quiet "See our page" is under the first-visit notice again');
});

test('the veil’s one instruction stands above the notice (Batch 8 R3)', () => {
  const at = OVERLAY.indexOf('{VEIL_HINT}');
  assert.ok(at > -1, 'the veil lost its instruction');
  // The hint's positioned wrapper is the last `absolute inset-x-0` <div> before it.
  const before = OVERLAY.slice(0, at);
  const wrap = before.slice(before.lastIndexOf('pointer-events-none absolute inset-x-0'));
  assert.doesNotMatch(wrap, /\bbottom-16\b/, 'the hint is pinned at a fixed bottom-16 again — under the first-visit notice');
  assert.match(wrap, /style=\{\{\s*bottom:\s*'calc\(4rem \+ var\(--cookie-banner-top, 0px\)\)'\s*\}\}/, '"Tap or swipe up to unveil" is under the first-visit notice again');
});
