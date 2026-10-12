/**
 * the-supplier-foundations-hold.test.ts — S-PR0 of the supplier dashboard
 * redesign (corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 6, row
 * S-PR0): the thumb row, the shell's envelope, and the two tour keys.
 *
 * The buttons are held by `../every-supplier-action-is-a-button.test.ts`; this
 * file holds the three other foundations, each by the thing that would go
 * missing rather than by a symbol that could be renamed around it.
 *
 * SABOTAGE, each seen red before this shipped (S-PR0 PR body has the runs):
 *   · `leavesThePage` returning true for a same-path link   → test 1
 *   · `sn-glass-row` taken off the row                       → test 2 (and
 *     `lib/floating-rows-are-glass.test.ts`, which lists this row too)
 *   · the envelope seeded from the notification count        → test 4
 *   · `vendor_shop_v1` mounted on Today                      → test 5
 *   · `useFitRow` called in the shell that renders null      → test 2
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { TOURS, TOUR_KEYS } from '@/lib/tours';
import { customerLandingHref } from '../customers/anchors';
import { leavesThePage } from './supplier-thumb-leave';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const O = 'https://www.setnayan.com';
const AT = '/vendor-dashboard/customers';

test('1 · the row slides down only for a tap that really leaves the page', () => {
  // leaves
  assert.equal(leavesThePage('/vendor-dashboard', null, AT, O), true, 'another page of the app');
  assert.equal(leavesThePage('/vendor-dashboard/clients/abc?tab=details', null, AT, O), true);
  assert.equal(leavesThePage(`${O}/vendor-dashboard/shop`, null, AT, O), true, 'an absolute link to this site');
  // stays
  assert.equal(leavesThePage('#payday', null, AT, O), false, 'a fragment scrolls, it does not leave');
  assert.equal(leavesThePage(`${AT}?seg=money`, null, AT, O), false, 'the same path with another search is the same page');
  assert.equal(leavesThePage(`${AT}#calendar`, null, AT, O), false);
  assert.equal(leavesThePage('/vendor-dashboard/shop', '_blank', AT, O), false, 'a new tab leaves this page where it is');
  assert.equal(leavesThePage('https://example.com/x', null, AT, O), false, 'another site unloads the page; pagehide handles it');
  assert.equal(leavesThePage(null, null, AT, O), false);
  assert.equal(leavesThePage('', null, AT, O), false);
});

test('2 · the thumb row is the shared glass, portalled, fitted and slid — with no fill of its own', () => {
  const row = code('app/vendor-dashboard/_components/supplier-thumb-row.tsx');
  assert.ok(row.length > 1500, `read ${row.length} chars — an empty read is a green lie`);
  assert.match(row, /className=\{`\$\{styles\.lower\} sn-glass-row`\}/, 'the row does not wear the ONE glass recipe');
  assert.match(row, /data-glass-row="supplier-thumb"/, 'lost the anchor floating-rows-are-glass reads');
  assert.match(row, /createPortal\(/, 'no longer portalled — `position: fixed` is not fixed under a transformed ancestor');
  assert.match(row, /document\.body,\s*\)/, 'the portal target is not <body>');
  assert.match(row, /useFitRow\(fitRef\)/, 'the buttons no longer change state as one (rule 3a)');
  // 🔴 The fit hook must run where its node EXISTS. The outer row returns null
  // until mounted, so a hook called there measures nothing, once, and four
  // buttons overflow a phone (seen on the 375 side-by-side: "Ca").
  // SABOTAGE: move `useFitRow(fitRef)` back into SupplierThumbRow → RED.
  const outer = row.slice(row.indexOf('export function SupplierThumbRow('), row.indexOf('function ThumbFit('));
  const inner = row.slice(row.indexOf('function ThumbFit('));
  assert.ok(outer.length > 500 && inner.length > 100, 'the row is no longer split into the mounted shell and the fitted inner row');
  assert.match(outer, /if \(!mounted\) return null;/);
  assert.doesNotMatch(outer, /useFitRow\(/, 'the fit hook is called in the component that renders nothing before mount — it measures null and never runs again');
  assert.match(inner, /const fitRef = useRef<HTMLDivElement>\(null\);\s*useFitRow\(fitRef\);[\s\S]*<div ref=\{fitRef\}/, 'the fitted row does not own both the ref and the hook');
  assert.match(outer, /<ThumbFit>\{children\}<\/ThumbFit>/);
  assert.match(row, /data-on=\{on \? 'true' : 'false'\}/, 'the slide has no state to read');
  assert.match(row, /if \(leavesThePage\(/, 'it no longer slides down first on leaving (rule 5)');
  assert.match(row, /addEventListener\('pagehide'/);

  const css = stripComments(readFileSync(join(HERE, 'supplier-thumb-row.module.css'), 'utf8'));
  const lower = css.match(/\.lower\s*\{([^}]*)\}/);
  assert.ok(lower, 'the .lower rule is gone');
  assert.match(lower[1]!, /position:\s*fixed/);
  assert.match(lower[1]!, /transform:\s*translateY\(140%\)/, 'the row does not start below the screen, so it cannot slide up');
  assert.match(lower[1]!, /transition:\s*transform 320ms/);
  assert.match(lower[1]!, /bottom:\s*calc\(var\(--sn-bottomdock-h/, 'it no longer sits on the measured bottom dock');
  assert.doesNotMatch(lower[1]!, /background|box-shadow|backdrop-filter/, 'the row took a fill, a shadow or a blur of its own — the shared recipe paints it');
  assert.match(css, /\.lower\[data-on='true'\]\s*\{\s*transform:\s*none;?\s*\}/, 'nothing brings it up');
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*\.lower\s*\{\s*transition:\s*none/, 'reduced motion still slides');
  assert.match(css, /flex:\s*1 0 60%;\s*min-width:\s*60%/, 'a field in the row no longer keeps 60 % (rule 3b)');
});

test('3 · the supplier-side foundations load with supplier routes only', () => {
  const files = ['app', 'components', 'lib'].flatMap((r) => walk(join(WEB, r)));
  assert.ok(files.length > 500, `scanned only ${files.length} files`);
  const importers = files
    .filter((f) => /supplier-thumb-row|supplier-submit|supplier-thumb-leave/.test(stripComments(readFileSync(f, 'utf8')).match(/from\s+['"][^'"]+['"]/g)?.join('\n') ?? ''))
    .map((f) => relative(WEB, f));
  assert.ok(importers.length >= 1, 'nothing imports the foundations — the scan is blind');
  const outside = importers.filter((f) => !f.startsWith('app/vendor-dashboard/') && !f.startsWith('app/dev/supplier-lab/'));
  assert.deepEqual(outside, [], 'a file outside the supplier routes imports a supplier foundation — its weight would ride with that route');
});

test('4 · the shell hands the shared bar the envelope, seeded from the messages count', () => {
  const layout = code('app/vendor-dashboard/layout.tsx');
  const at = layout.indexOf('const topBar = (');
  assert.ok(at > 0, 'the cluster could not be found — the scan has gone blind');
  const cluster = layout.slice(at, layout.indexOf('timer.flush();', at));
  const env = cluster.match(/<UnreadMessagesBadge\b[\s\S]*?\/>/);
  assert.ok(env, 'the envelope is not in the cluster handed to the shared bar');
  assert.equal(cluster.match(/<UnreadMessagesBadge\b/g)!.length, 1, 'two envelopes are two Realtime channels');
  assert.match(env[0], /initialUnread=\{threadsUnread\}/, 'the envelope is seeded from something other than the unread MESSAGES count');
  assert.match(env[0], /href=\{customerLandingHref\('messages'\)\}/, 'the envelope does not land on the inbox through the anchors table');
  assert.equal(customerLandingHref('messages'), '/vendor-dashboard/customers?open=messages#customer-tools');
  assert.ok(cluster.indexOf('<UnreadMessagesBadge') < cluster.indexOf('<AccountSwitcher'), 'the envelope sits after the avatar');
  assert.match(cluster, /<AccountSwitcher data=\{switcherData\} \/>/, 'the avatar — and the only Sign out — left the bar');
  assert.match(cluster, /data-supplier-shell-shop=""[^>]*>\s*\{vendorSidebarName\}/, 'the bar names the person, not the shop');
});

test('5 · the two new tour keys are registered — and each mounts only with its own page', () => {
  for (const key of ['vendor_shop_v1', 'vendor_hub_v1'] as const) {
    assert.ok(TOUR_KEYS.includes(key), `${key} is not in TOUR_KEYS — completeTour would refuse it`);
    const tour = TOURS[key];
    assert.equal(tour.key, key);
    assert.equal(tour.slides.length, 1, `${key}: the redesign draws ONE slide per page`);
    const words = `${tour.label} ${tour.blurb} ${tour.slides.map((s) => `${s.title} ${s.body}`).join(' ')}`;
    assert.doesNotMatch(words, /\bvendor/i, `${key} says "vendor"`);
    assert.doesNotMatch(words, /celebration|website/i, `${key} uses a retired word`);
    assert.doesNotMatch(tour.slides[0]!.title, /&[a-z#0-9]+;/, 'a title is plain text — an entity prints literally');
  }
  assert.equal(TOURS.vendor_shop_v1.slides[0]!.title, 'Services · Page · Insights');
  assert.equal(TOURS.vendor_shop_v1.slides[0]!.body, 'What you sell, how your page looks, how it is doing.');
  assert.equal(TOURS.vendor_hub_v1.slides[0]!.title, 'Run the day');
  assert.equal(TOURS.vendor_hub_v1.slides[0]!.body, 'Scan, schedule, shot list, headcount — for this event only.');

  // A tour is a claim about a page. It mounts on that page and nowhere else.
  const HOME: Record<string, string> = {
    vendor_shop_v1: 'app/vendor-dashboard/shop/',
    vendor_hub_v1: 'app/vendor-dashboard/on-the-day/',
  };
  const files = walk(join(WEB, 'app'));
  for (const [key, home] of Object.entries(HOME)) {
    const mounts = files
      .filter((f) => new RegExp(`tourKey="${key}"`).test(stripComments(readFileSync(f, 'utf8'))))
      .map((f) => relative(WEB, f));
    assert.ok(mounts.length <= 1, `${key} is mounted ${mounts.length} times: ${mounts.join(', ')}`);
    for (const m of mounts) assert.ok(m.startsWith(home), `${key} is mounted on ${m}, not on the page it describes (${home})`);
  }
});
