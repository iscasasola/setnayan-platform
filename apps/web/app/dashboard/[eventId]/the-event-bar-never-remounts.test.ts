/**
 * GUARD — THE EVENT'S BARS NEVER LOAD WITH THE SCREEN (owner 17 Nov 2026, DECISION_LOG: *"navigation bars should not
 * load with the screen… no full screen refresh… request fix and speed fix"*).
 *
 * App Router keeps a LAYOUT mounted across every navigation inside its segment and remounts only what sits under it:
 * the `template.tsx` and the page. So "the bar keeps its DOM node across a tab change" holds exactly when:
 *   1. the bars (the bottom/tab bar, the top bar's account menu, the rail) are rendered by `layout.tsx`, OUTSIDE
 *      `{children}`;
 *   2. `template.tsx` — the part that DOES remount on each pathname — wraps only the content, and draws no bar;
 *   3. no Today piece added by the 1280 board draws a bar, reads data, or reloads the page — it lays out what the page
 *      already read (`homeControlTiles(input)` is pure), so the board adds no request.
 * #5881 / #6772 / #6879 and `app/_components/nav/the-bar-outlives-the-slide.test.ts` hold the slide's paint order; this
 * one holds the lifecycle. (A static proof: it reads the files the router mounts, not a live browser.)
 *
 * Sabotage (run 17 Nov 2026): move `<BottomDock>…</BottomDock>` above `</AppRailShell>` (1 red) · render `<CustomerBottomNav>` from
 * template.tsx (2 red) · `await` a read in HomeControlBoardColumn (3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname;
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const BARS = ['CustomerBottomNav', 'AccountSwitcher', 'CustomerSidebar', 'SidebarShell'];

test('1 · the layout draws the bottom bar outside the content that swaps', () => {
  const layout = read('layout.tsx');
  const kids = layout.indexOf('{children}');
  const shellEnd = layout.indexOf('</AppRailShell>');
  const dock = layout.indexOf('<BottomDock');
  const bar = layout.indexOf('<CustomerBottomNav');
  assert.ok(kids > -1 && shellEnd > -1 && dock > -1 && bar > -1, 'the layout lost {children}, the rail shell, the dock or the bar');
  assert.equal(layout.indexOf('{children}', kids + 1), -1, 'the layout renders {children} twice');
  // The content sits inside the rail shell; the dock and its bar come after the shell closes — a sibling, never inside.
  assert.ok(kids < shellEnd, 'the content is outside the rail shell');
  assert.ok(shellEnd < dock && dock < bar, 'the bottom bar is drawn inside the content area (it would scroll and swap with it)');
  assert.equal((layout.match(/<CustomerBottomNav\b/g) ?? []).length, 1, 'a second bottom bar');
});

test('2 · the template — what remounts on each tab — wraps only the content and draws no bar', () => {
  const t = read('template.tsx');
  for (const b of BARS) assert.ok(!t.includes(b), `template.tsx draws ${b}: it would remount on every tab press`);
  assert.match(t, /return <div className="sn-page-enter">\{children\}<\/div>;/, 'the template does more than wrap the content');
});

test('3 · the 1280 board adds no read, no bar and no reload', () => {
  const row = read('_components/home-control-row.tsx');
  const fn = row.slice(row.indexOf('export function HomeControlBoardColumn('), row.indexOf('/** The glance row'));
  assert.ok(fn.length > 100, 'the board column moved');
  assert.doesNotMatch(fn, /\bawait\b|async |createClient|supabase|fetch\(/, 'the board reads data of its own');
  assert.doesNotMatch(fn, /window\.location|router\.refresh|<a /, 'the board reloads the page');
  assert.doesNotMatch(row, /^['"]use server['"]/m, 'the control row became a server action');
  const first = read('_components/home-first-screen.tsx');
  for (const b of BARS) assert.ok(!first.includes(`<${b}`), `Today draws ${b}`);
});
