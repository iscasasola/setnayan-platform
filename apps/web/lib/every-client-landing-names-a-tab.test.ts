/**
 * every-client-landing-names-a-tab.test.ts
 *
 * The sequel to `the-confirm-lands-where-you-pressed-it.test.ts` (#5736), which
 * fixed the two DEPOSIT answers the owner caught live. This one counts the rest
 * — and there were fourteen more in the same file, plus five in sibling pages.
 *
 * ── WHAT THIS GUARD IS ACTUALLY FOR ─────────────────────────────────────────
 * `NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED` is `"true"` in production
 * (measured 2026-09-20 via `vercel env pull --environment=production`; the
 * owner's bounce could not have happened otherwise). With it on, a landing on
 * `/vendor-dashboard/clients/<eventId>` that names no `?tab=` is FORWARDED to
 * the conversation. So every one of those redirects ended a supplier's action
 * on a screen that says nothing about it — the handover they just sent, the
 * change order they just accepted, the service they just marked complete.
 *
 * 🔑 AND A TAB IS NOT ENOUGH, WHICH IS THE PART A `?tab=` GREP CANNOT SEE.
 * The page has TWO shells with two different tab vocabularies (see
 * lib/vendor-client-return.ts). Three of these redirects DID carry a tab —
 * `?tab=activity` — and `activity` is not a tab the live shell has, so
 * `RelationshipTabShell` dropped the supplier on its first panel (Quote) while
 * the note they wrote sat on Details. A tab-shaped wrong answer.
 *
 * So the assertion is not "contains ?tab=". It is: EVERY `redirect()` to the
 * client page, anywhere under apps/web, is built by the rule module — which is
 * the only thing that knows which shell is live and what it calls each surface.
 *
 * SABOTAGE-PROVEN: restoring any single literal redirect (e.g.
 * `` redirect(`/vendor-dashboard/clients/${eventId}?handover=sent`) ``) fails
 * the count below, and the failure prints the offending line.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { stripComments } from './strip-comments';
import {
  SURFACE_TABS,
  VENDOR_CARD_TABS,
  VENDOR_CLIENT_TABS,
  vendorClientSurfaceHref,
  type VendorClientSurface,
} from './vendor-client-return';

const WEB = path.join(__dirname, '..');
const CLIENTS_DIR = path.join(WEB, 'app', 'vendor-dashboard', 'clients');
const EVENT = '2d4f1144-7816-4367-9c99-6ff0f9a6de10';

/** Every `.ts`/`.tsx` under apps/web/app (no node_modules, no build output). */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * A `redirect(` whose FIRST argument is a template literal naming the client
 * page itself (not a sub-route like `/production-sheet`). Multi-line on
 * purpose: `suggestScheduleChange`'s redirect is wrapped across three lines and
 * a single-line grep walked straight past it while this file was being written.
 */
const LITERAL_CLIENT_REDIRECT =
  /redirect\(\s*`\/vendor-dashboard\/clients\/\$\{[A-Za-z0-9_.]+\}(?![/A-Za-z])/g;

test('NO redirect anywhere lands a supplier on the client page by hand', () => {
  const files = walk(path.join(WEB, 'app'));
  const offenders: string[] = [];
  let scanned = 0;
  for (const file of files) {
    const src = stripComments(readFileSync(file, 'utf8'));
    if (!src.includes('/vendor-dashboard/clients/')) continue;
    scanned += 1;
    const lines = src.split('\n');
    for (const m of src.matchAll(LITERAL_CLIENT_REDIRECT)) {
      const line = src.slice(0, m.index).split('\n').length;
      offenders.push(
        `${path.relative(WEB, file)}:${line} — ${lines[line - 1]?.trim() ?? ''}`.slice(0, 160),
      );
    }
  }
  console.log(
    `[client-landing] scanned ${files.length} files under app/ (${scanned} mention the route); ` +
      `hand-built client-page redirects: ${offenders.length}`,
  );
  // A floor: if the sweep ever finds nothing to scan, it is broken, not clean.
  assert.ok(scanned >= 5, `only ${scanned} files mention the client route — the walk is broken`);
  assert.equal(
    offenders.length,
    0,
    `a supplier is sent to the client page by hand — the live shell forwards a ` +
      `tab-less landing to the conversation, and a tab the shell does not know ` +
      `is no better:\n  ${offenders.join('\n  ')}`,
  );
});

test('every client-page redirect in the clients tree goes through the rule', () => {
  const files = walk(CLIENTS_DIR).filter((f) => {
    const src = readFileSync(f, 'utf8');
    return src.includes('redirect(') && src.includes('/vendor-dashboard/clients/');
  });
  let calls = 0;
  for (const file of files) {
    const src = stripComments(readFileSync(file, 'utf8'));
    calls += (src.match(/vendorClientSurfaceHref\(/g) ?? []).length;
  }
  console.log(`[client-landing] vendorClientSurfaceHref call sites: ${calls}`);
  // 27 at the time of writing (22 in actions.ts + 5 sibling page bails). The
  // assertion is a FLOOR, not the number — a new action may add more, but
  // silently dropping them all back to literals must not read as a pass.
  assert.ok(calls >= 27, `expected at least 27 rule-built landings, found ${calls}`);
});

test('a surface resolves to a tab the shell it is aimed at actually renders', () => {
  const surfaces = Object.keys(SURFACE_TABS) as VendorClientSurface[];
  let checked = 0;
  for (const surface of surfaces) {
    for (const shellOn of [true, false]) {
      const href = vendorClientSurfaceHref(EVENT, surface, { shellOn, query: { n: '1' } });
      const tab = new URL(href, 'https://x.invalid').searchParams.get('tab');
      assert.ok(tab, `${surface} (shellOn=${shellOn}) produced no tab: ${href}`);
      const vocabulary: readonly string[] = shellOn ? VENDOR_CLIENT_TABS : VENDOR_CARD_TABS;
      assert.ok(
        vocabulary.includes(tab),
        `${surface} → ?tab=${tab}, which the ${shellOn ? 'ON' : 'OFF'} shell does not render ` +
          `(it knows ${vocabulary.join(' · ')})`,
      );
      // `chat` is a door, not a room — landing on it IS the bounce.
      assert.notEqual(tab, 'chat', `${surface} lands on the chat door`);
      assert.match(href, /[?&]n=1\b/, `${href} lost its notice`);
      checked += 1;
    }
  }
  assert.equal(checked, surfaces.length * 2, `expected ${surfaces.length * 2} checks, got ${checked}`);
  console.log(`[client-landing] ${checked} surface×shell landings verified`);
});

test('the two tab vocabularies are the ones the shells really declare', () => {
  // A hand-copied list rots. Both are read back from their source of truth, so
  // adding a tab to either shell without telling this module turns red.
  const nav = stripComments(
    readFileSync(
      path.join(CLIENTS_DIR, '[eventId]', '_components', 'customer-card-nav.tsx'),
      'utf8',
    ),
  );
  // Only the tab declarations — the file also carries the pipeline-stage list
  // (`inquiry · quoted · booked · delivered · reviewed`), which is not a tab
  // strip and whose keys a looser match happily swallowed.
  const navTabs = nav.slice(nav.indexOf('const BASE_TABS'), nav.indexOf('export const CARD_TABS'));
  assert.ok(navTabs.length > 100, 'could not slice the tab declarations out of customer-card-nav');
  const offKeys = [...navTabs.matchAll(/\{\s*key:\s*'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    [...offKeys].sort(),
    [...VENDOR_CARD_TABS].sort(),
    `customer-card-nav declares ${offKeys.join(' · ')}`,
  );

  const page = stripComments(readFileSync(path.join(CLIENTS_DIR, '[eventId]', 'page.tsx'), 'utf8'));
  const shellBlock = page.slice(page.indexOf('const tabs: RelationshipTab[] = ['));
  const onIds = [...shellBlock.slice(0, 2000).matchAll(/^\s{6}id: '([a-z]+)',$/gm)].map((m) => m[1]);
  assert.deepEqual(
    [...onIds].sort(),
    [...VENDOR_CLIENT_TABS].sort(),
    `the relationship shell declares ${onIds.join(' · ')}`,
  );
  console.log(
    `[client-landing] OFF shell: ${offKeys.join(' · ')} | ON shell: ${onIds.join(' · ')}`,
  );
});

test('the notice each surface carries is rendered on the panel that surface names', () => {
  const page = stripComments(readFileSync(path.join(CLIENTS_DIR, '[eventId]', 'page.tsx'), 'utf8'));

  // ScheduleTab is `delivery`. All three of its notices must be read inside it
  // — a notice drawn somewhere else is the same failure in a new costume.
  const schedule = page.slice(
    page.indexOf('function ScheduleTab('),
    page.indexOf('function LockRequestAnswer('),
  );
  assert.ok(schedule.length > 1000, 'could not slice ScheduleTab');
  for (const flag of ['search.suggest', 'search.handover', 'search.change_order']) {
    assert.ok(schedule.includes(flag), `${flag} is not read inside ScheduleTab`);
    const elsewhere = page.split(flag).length - 1 - (schedule.split(flag).length - 1);
    assert.equal(elsewhere, 0, `${flag} is also read outside ScheduleTab (${elsewhere} times)`);
  }
  assert.equal(SURFACE_TABS.delivery.shellOn, 'schedule');
  assert.equal(SURFACE_TABS.delivery.shellOff, 'schedule');

  // `completion` — the flag that NOTHING read until this PR. Both mounts of the
  // card must be handed it, or one shell tells the supplier and the other does
  // not, which is exactly how this bug class survives a fix.
  const mounts = page.match(/<VendorCompletionCard/g) ?? [];
  const noticed = page.match(/notice=\{(?:completedNotice|typeof search\.completed)/g) ?? [];
  assert.equal(mounts.length, 2, `expected 2 completion-card mounts, found ${mounts.length}`);
  assert.equal(
    noticed.length,
    mounts.length,
    `${mounts.length} completion cards, ${noticed.length} of them told what happened`,
  );
  assert.match(page, /notice === '1' \?/, 'the completion card never draws the success notice');
  assert.match(page, /notice === 'notyours' \?/, 'the completion card never draws the failure');
  console.log(
    `[client-landing] delivery notices confined to ScheduleTab; ` +
      `${noticed.length}/${mounts.length} completion cards render ?completed=`,
  );
});
