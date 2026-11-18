/**
 * W1-B28 (supplier walk, 16 Nov 2026): an unknown /vendor-dashboard/* address answered 200 with the console's ~8 s
 * loader before saying "doesn't exist". The middleware now rewrites it to an address no route matches, so Next answers
 * its root 404 at once. These hold the list of console pages to the folders on disk — both ways — so a real page can
 * never be 404'd and a typo can never reach the console's layout again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  SUPPLIER_CONSOLE_SEGMENTS,
  SUPPLIER_PAGE_NOT_FOUND_REWRITE,
  isUnknownSupplierPage,
} from './supplier-console-routes';

const ROOT = join(process.cwd(), 'app/vendor-dashboard');
const ROUTE_FILE = /^(page|route)\.(tsx|ts|jsx|js)$/;

function holdsARoute(dir: string): boolean {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (holdsARoute(p)) return true;
    } else if (ROUTE_FILE.test(name)) return true;
  }
  return false;
}

/** Every first segment a URL can take under the console: plain folders (not `_private`, `@slot`, `(group)`) with a page. */
function segmentsOnDisk(): Set<string> {
  const out = new Set<string>();
  for (const name of readdirSync(ROOT)) {
    const p = join(ROOT, name);
    if (!statSync(p).isDirectory()) continue;
    assert.ok(!name.startsWith('(') && !name.startsWith('['), `${name}: a route group or a dynamic folder at the console root — the first-segment list cannot describe it; rethink lib/supplier-console-routes.ts`);
    if (name.startsWith('_') || name.startsWith('@')) continue;
    if (holdsARoute(p)) out.add(name);
  }
  return out;
}

test('the console page list is exactly the folders that hold a page', () => {
  const disk = segmentsOnDisk();
  assert.ok(disk.size > 20, 'anti-vacuity: the console moved');
  const missing = [...disk].filter((s) => !SUPPLIER_CONSOLE_SEGMENTS.has(s));
  const stale = [...SUPPLIER_CONSOLE_SEGMENTS].filter((s) => !disk.has(s));
  assert.deepEqual(missing, [], `these console pages would 404 — add them to SUPPLIER_CONSOLE_SEGMENTS: ${missing.join(', ')}`);
  assert.deepEqual(stale, [], `these listed pages no longer exist — remove them: ${stale.join(', ')}`);
});

test('unknown first segments are refused; real pages, deeper paths and other areas are not', () => {
  assert.equal(isUnknownSupplierPage('/vendor-dashboard/no-such-page'), true);
  assert.equal(isUnknownSupplierPage('/vendor-dashboard/nope/deeper'), true);
  assert.equal(isUnknownSupplierPage('/vendor-dashboard/%E0%A4%A'), true, 'a malformed escape');
  assert.equal(isUnknownSupplierPage('/vendor-dashboard'), false);
  assert.equal(isUnknownSupplierPage('/vendor-dashboard/'), false);
  assert.equal(isUnknownSupplierPage('/vendor-dashboard/clients'), false);
  assert.equal(isUnknownSupplierPage('/vendor-dashboard/clients/abc/anything'), false, 'deeper paths are the page’s own business');
  assert.equal(isUnknownSupplierPage('/vendor-dashboard/subscription?plan=pro'.split('?')[0]!), false);
  assert.equal(isUnknownSupplierPage('/vendor-dashboardx/foo'), false);
  assert.equal(isUnknownSupplierPage('/dashboard/foo'), false);
});

test('the rewrite target can match no route: private segments, and nothing dynamic under app/[slug]', () => {
  const segs = SUPPLIER_PAGE_NOT_FOUND_REWRITE.split('/').filter(Boolean);
  assert.equal(segs.length, 2);
  for (const s of segs) assert.ok(s.startsWith('_'), `${s}: a non-private segment could be a static route`);
  const top = readdirSync(join(process.cwd(), 'app')).filter((n) => n.startsWith('['));
  assert.deepEqual(top, ['[slug]'], 'a new top-level dynamic folder could catch the rewrite — re-check it');
  const under = readdirSync(join(process.cwd(), 'app/[slug]')).filter((n) => n.startsWith('[') || n.startsWith('('));
  assert.deepEqual(under, [], 'a dynamic folder under app/[slug] would catch the rewrite and answer something else');
  assert.ok(existsSync(join(process.cwd(), 'app/not-found.tsx')), 'the root 404 page the rewrite lands on is gone');
});

test('the middleware answers it after the legacy forwards and before any session work', () => {
  const mw = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8');
  const guard = mw.indexOf('if (isUnknownSupplierPage(pathname))');
  assert.ok(guard > 0, 'the middleware no longer refuses an unknown supplier page');
  assert.ok(mw.indexOf('legacyRedirectTarget(pathname, search)') < guard, 'a retired console page must forward before it is refused');
  assert.match(mw.slice(guard, guard + 300), /missing\.pathname = SUPPLIER_PAGE_NOT_FOUND_REWRITE;[\s\S]*NextResponse\.rewrite\(missing\)/);
  const session = mw.indexOf('await updateSession(');
  if (session > 0) assert.ok(guard < session, 'the 404 waits for the session refresh');
});
