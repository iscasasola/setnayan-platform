/**
 * GUARD — A PAGE THE AVATAR RISES HAS A BACK WHEN IT IS OPENED COLD (owner 16 Nov, DECISION_LOG "NEVER LOSE THE BACK
 * BUTTON" · "BACK RULE SUPERSEDES THE 2026-08-21 LOCK": every non-top-level screen shows ‹ naming where it returns to; the
 * installed iPhone app has no browser back).
 *
 * Your details · Settings · Team rise from the avatar (their `@rise/(.)…` intercepts carry the ✕). Opened cold — a deep
 * link, a reload — the same body drew no way back. Each page now draws the shipped `BackButton` (its home from the map,
 * returning in place), wrapped in `BackWhenNotRisen` so a risen sheet never shows two ways out.
 *
 * Sabotage: drop the wrapper on one page (1 red) · make the wrapper always render (2 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const read = (f: string) => stripComments(readFileSync(join(import.meta.dirname, f), 'utf8'));
const PAGES = ['profile', 'settings', 'team'] as const;

test('1 · each risen page draws the shipped BackButton for its own route, inside BackWhenNotRisen', () => {
  for (const p of PAGES) {
    assert.ok(existsSync(join(import.meta.dirname, `@rise/(.)${p}`)), `${p} no longer rises — re-check whether it still needs this`);
    const code = read(`${p}/page.tsx`);
    const back = new RegExp(`<BackWhenNotRisen>\\s*<BackButton route="/vendor-dashboard/${p}" inPlace[^>]*/>\\s*</BackWhenNotRisen>`);
    assert.match(code, back, `${p}: the cold-arrival back is missing or not wrapped`);
  }
});

test('2 · the wrapper steps aside inside a RiseScreen (the rise has its own ✕)', () => {
  const code = read('_components/back-when-not-risen.tsx');
  assert.match(code, /useRiseClose\(\) \? null : <>\{children\}<\/>/);
});
