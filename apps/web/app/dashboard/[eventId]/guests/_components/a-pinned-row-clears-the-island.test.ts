/**
 * 📱 A PINNED ROW NEVER SITS UNDER THE IPHONE'S CLOCK (owner 2026-10-30, a screenshot of Home: "The top row is intersecting
 * with the floating islang of iphone"). When the app's top bar slides away, every head pinned under it (Home's cover line
 * `--home-bar`, Guests and People `--gs-top`) pins at the top of the SAFE AREA — `env(safe-area-inset-top)` — never at 0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const src = readFileSync(path.join(__dirname, 'use-shell-bar-offset.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

test('the hidden-bar offset is the safe area, not 0', () => {
  const write = src.match(/setProperty\(name,\s*shellBarShows\(bar\)\s*\?\s*`[^`]*`\s*:\s*'([^']*)'\)/);
  assert.ok(write, 'the one write of the offset was not found — the guard cannot see it');
  assert.match(write[1], /^env\(safe-area-inset-top/, `the bar-hidden offset is "${write[1]}" — on an iPhone that pins the row under the clock`);
});
