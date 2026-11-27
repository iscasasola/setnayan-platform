/**
 * GUARD — A PAGE THE AVATAR RISES HAS A BACK WHEN IT IS OPENED COLD (owner 16 Nov, DECISION_LOG "NEVER LOSE THE BACK
 * BUTTON" · "BACK RULE SUPERSEDES THE 2026-08-21 LOCK": every non-top-level screen shows ‹ naming where it returns to; the
 * installed iPhone app has no browser back).
 *
 * Your details · Settings · Team rise from the avatar (their `@rise/(.)…` intercepts carry the ✕). Opened cold — a deep
 * link, a reload — the same body drew no way back. Each page now draws the shipped `BackButton` (its home from the map,
 * returning in place), wrapped in `BackWhenNotRisen` so a risen sheet never shows two ways out.
 *
 * Final check B18: the back is the one pinned row (`ToolPin`) drawn by each page's screen.
 * Sabotage: drop the wrapper on one page (1 red) · make the wrapper always render (2 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const read = (f: string) => stripComments(readFileSync(join(import.meta.dirname, f), 'utf8'));
// Each page's screen draws the one pinned row (final check B18 — `ToolPin`, ‹ + the title, returning in place).
const SCREENS = {
  profile: 'profile/_components/details-screen.tsx',
  settings: 'settings/settings-view.tsx',
  team: 'team/_components/helpers-view.tsx',
} as const;

test('1 · each risen page draws the one pinned row for its own route, returning in place; the row steps aside when risen', () => {
  for (const [p, screen] of Object.entries(SCREENS)) {
    assert.ok(existsSync(join(import.meta.dirname, `@rise/(.)${p}`)), `${p} no longer rises — re-check whether it still needs this`);
    const code = read(screen);
    assert.match(code, new RegExp(`<ToolPin route="/vendor-dashboard/${p}" inPlace title="[^"]+" />`), `${p}: the cold-arrival back is missing`);
    assert.doesNotMatch(read(`${p}/page.tsx`), /<BackButton\b/, `${p}: a second back is drawn beside the pinned row`);
  }
  // ToolPin hides its ‹ and title inside a rise (the layer's head names it), and its ‹ returns in place.
  const pin = read('_components/tool-page.tsx');
  assert.match(pin, /<BackWhenNotRisen>\s*<BackButton route=\{route\} params=\{params\} variant="tool" inPlace=\{inPlace\} \/>/);
  const back = read('../_components/back-button.tsx');
  const tool = back.slice(back.indexOf("props.variant === 'tool'"), back.indexOf("props.variant === 'chat'"));
  assert.match(tool, /if \(!props\.inPlace\) return tool;\s*return <ReturnInPlace/, 'the tool ‹ does not return in place');
});

test('2 · the wrapper steps aside inside a RiseScreen (the rise has its own ✕)', () => {
  const code = read('_components/back-when-not-risen.tsx');
  assert.match(code, /useRiseClose\(\) \? null : <>\{children\}<\/>/);
});
