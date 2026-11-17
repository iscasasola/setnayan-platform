/**
 * GUARD — THE SUPPLIER BARS NEVER REMOUNT WITH THE SCREEN (owner, DECISION_LOG 17 Nov: "navigation bars should not load
 * with the screen… no full screen refresh").
 *
 * App Router keeps `layout.tsx` mounted across every in-shell navigation and REMOUNTS `template.tsx` on every pathname
 * change (that remount is the page's soft rise). So the top bar · rail (`AppRailShell`) and the phone's tab bar
 * (`VendorBottomNav`) must be drawn by the layout, and the template must draw nothing but the content wrapper — a bar
 * moved into the template would be torn down and rebuilt on every tab change.
 *
 * The blue look (`_components/supplier-look.css`, 17 Nov) is switched on by an ATTRIBUTE on the template's wrapper and
 * applied by CSS on <html>; it adds no element, no read and no request.
 *
 * Sabotage: import `VendorBottomNav` into template.tsx (1 red) · drop `<AppRailShell` from layout.tsx (2 red) · drop
 * `data-supplier-look` (3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const read = (f: string) => stripComments(readFileSync(join(import.meta.dirname, f), 'utf8'));
const TEMPLATE = read('template.tsx');
const LAYOUT = read('layout.tsx');

test('1 · the template (remounted on every page change) draws no bar, rail or tab bar', () => {
  assert.doesNotMatch(TEMPLATE, /AppRailShell|VendorBottomNav|BottomNav|PinnedBar|Rail\b|TopBar|SupplierThumbRow/, 'a bar is drawn by the template — it would remount on every tab change');
  assert.doesNotMatch(TEMPLATE, /from '[^']*(nav|rail|bar)[^']*'/i, 'the template imports a nav piece');
});

test('2 · the layout (kept across navigations) draws the rail shell and the phone tab bar', () => {
  assert.match(LAYOUT, /<AppRailShell\b/, 'the rail/top-bar shell left the layout');
  assert.match(LAYOUT, /<VendorBottomNav\b/, 'the phone tab bar left the layout');
});

test('3 · the blue look is an attribute on the content wrapper — no element, no read', () => {
  assert.match(TEMPLATE, /data-supplier-look=""/, 'the look switch is gone');
  assert.match(TEMPLATE, /import '\.\/_components\/supplier-look\.css'/, 'the look stylesheet is not loaded');
  assert.doesNotMatch(TEMPLATE, /async |await |createClient|fetch\(/, 'the template reads something');
});
