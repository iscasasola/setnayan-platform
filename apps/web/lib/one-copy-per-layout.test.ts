/**
 * 📦 ONE COPY PER LAYOUT — the split-chunk groups that stop a page re-shipping
 * the modules its layouts already ship (lib/one-copy-per-layout.ts).
 *
 * What is held here (no build needed): which files are anchors, which entries
 * an anchor's chunk may be added to (only ones that already load the anchor —
 * the "no page can grow" half), that CSS is never moved, the priority order,
 * and that next.config.ts really hands the groups to the client production
 * build. The KB it saves is measured by the build's own budget scripts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { anchorChunkName, findLayoutAnchors, inAnchor, oneCopyPerLayoutGroups, underAnchor, type LayoutAnchor } from './one-copy-per-layout';

const WEB = join(__dirname, '..');
const anchors = findLayoutAnchors(join(WEB, 'app'));
const byEntry = (e: string) => {
  const a = anchors.find((x) => x.entry === e);
  assert.ok(a, `no anchor ${e}`);
  return a as LayoutAnchor;
};
const ctxOf = (...names: string[]) => ({ chunkGraph: { getModuleChunksIterable: () => names.map((name) => ({ name })) } });

test('the Maker’s ancestors are all anchors, outermost first', () => {
  const want = ['app/layout', 'app/dashboard/layout', 'app/dashboard/[eventId]/layout', 'app/dashboard/[eventId]/loading', 'app/dashboard/[eventId]/template', 'app/dashboard/[eventId]/launch/loading'];
  for (const e of want) byEntry(e);
  assert.equal(anchors[0].entry, 'app/layout');
  for (let i = 1; i < anchors.length; i++) assert.ok(anchors[i - 1].depth <= anchors[i].depth, 'sorted by depth');
  assert.ok(!anchors.some((a) => /\/_[^/]+\//.test(a.entry)), 'a _private folder is not a route');
  assert.ok(!anchors.some((a) => a.entry.endsWith('/page')), 'a page is never an anchor');
});

test('an anchor’s chunk goes only to entries under its folder — every one of which loads the anchor', () => {
  const ev = byEntry('app/dashboard/[eventId]/layout');
  assert.equal(underAnchor(ev, { name: 'app/dashboard/[eventId]/launch/page' }), true);
  assert.equal(underAnchor(ev, { name: 'app/dashboard/[eventId]/loading' }), true);
  assert.equal(underAnchor(ev, { name: 'app/dashboard/(launcher)/page' }), false, 'a sibling route does not load the event layout');
  assert.equal(underAnchor(ev, { name: 'app/vendor-dashboard/page' }), false);
  assert.equal(underAnchor(ev, { name: 'maker-details' }), false, 'async chunks are never touched (webpack runtime stays the same)');
  assert.equal(underAnchor(ev, { name: null }), false);
  const dash = byEntry('app/dashboard/layout');
  assert.equal(underAnchor(dash, { name: 'app/dashboard-x/page' }), false, 'a prefix is a folder, not a string start');
  const root = byEntry('app/layout');
  assert.equal(underAnchor(root, { name: 'app/[slug]/page' }), true);
  assert.equal(underAnchor(root, { name: 'app/global-error' }), false, 'global-error renders without the root layout');
});

test('only the anchor’s own JS modules move — never CSS', () => {
  const ev = byEntry('app/dashboard/[eventId]/layout');
  assert.equal(inAnchor(ev, { type: 'javascript/auto' }, ctxOf('app/dashboard/[eventId]/layout', 'app/dashboard/[eventId]/launch/page')), true);
  assert.equal(inAnchor(ev, { type: 'javascript/auto' }, ctxOf('app/dashboard/[eventId]/launch/page', 'app/dashboard/[eventId]/guests/page')), false, 'two pages sharing a module is not this rule');
  assert.equal(inAnchor(ev, { type: 'css/mini-extract' }, ctxOf('app/dashboard/[eventId]/layout', 'app/dashboard/[eventId]/launch/page')), false);
});

test('outer anchors win; a layout before its folder’s loading; all between Next’s lib (30) and webpack’s defaults', () => {
  const g = oneCopyPerLayoutGroups(anchors) as Record<string, { priority: number; minChunks: number; name: string }>;
  const p = (e: string) => g[anchorChunkName(byEntry(e))].priority;
  assert.ok(p('app/layout') > p('app/dashboard/layout'));
  assert.ok(p('app/dashboard/layout') > p('app/dashboard/[eventId]/layout'));
  assert.ok(p('app/dashboard/[eventId]/layout') > p('app/dashboard/[eventId]/loading'));
  for (const v of Object.values(g)) {
    assert.ok(v.priority < 30 && v.priority > -10, `${v.name} priority ${v.priority}`);
    assert.equal(v.minChunks, 2, 'a module only the anchor ships stays where it is');
  }
  assert.equal(new Set(Object.values(g).map((v) => v.name)).size, anchors.length, 'one chunk name per anchor');
});

test('next.config.ts hands the groups to the CLIENT PRODUCTION build only', () => {
  const src = readFileSync(join(WEB, 'next.config.ts'), 'utf8');
  const at = src.indexOf('oneCopyPerLayoutGroups(findLayoutAnchors(');
  assert.ok(at > 0, 'next.config.ts no longer adds the one-copy-per-layout groups');
  const before = src.slice(Math.max(0, at - 600), at);
  assert.match(before, /if \(!isServer && !dev && split && typeof split === 'object'\)/);
  assert.match(before, /split\.cacheGroups = \{\s*\.\.\.\(split\.cacheGroups \?\? \{\}\),/, 'Next’s own groups (framework, lib) are kept');
});
