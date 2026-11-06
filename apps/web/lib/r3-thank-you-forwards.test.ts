/**
 * r3-thank-you-forwards.test.ts — R3 · THE THANK-YOU VIDEO LIVES IN MEMORIES, AND ITS OLD ADDRESS LANDS THERE.
 *
 * Owner, 2026-10-27/28 (DECISION_LOG "THE THANK-YOU VIDEO MOVES TO MEMORIES AND IS FREE TO MAKE AND SAVE", "EVERY OLD
 * DOOR FORWARDS — 'ALL MAPPING WILL BE KEPT'"; reorg plan step 9 / 14): the maker moves into Memories next to the
 * event's gallery, and `/studio/thank-you` forwards. Until 2026-11-06 the keepsake row's Thank You button was in
 * Memories but its door still opened `/studio/thank-you` — the maker had never moved. Now the page moved WHOLE (no
 * redraw) to `/memories/thank-you`, and one address (`thankYouVideoHref`) is asked by every door. A guard per half:
 *
 *   1 · THE OLD ADDRESS — `/studio/thank-you` (a trailing slash too) forwards in the middleware, by the address alone;
 *       the old page file is gone (so it is not a second route against Vercel's cap) and the new one is there.
 *   2 · EVERY DOOR — the catalogue (`addOnHref` / `appStoreDetailHref`, which the keepsake row's sheet and Home's Papic
 *       card read), Home's App row and the sign-in return all name the Memories address.
 *   3 · NOTHING NAMES THE OLD ONE — no page or module outside the forward map links to `/studio/thank-you`.
 *   4 · IT IS A MEMORIES PAGE — the Memories tab lights it (not Home), and its back goes to Memories.
 *   5 · THE APP ANSWERS THE SAME — refused in the app without Apple's shop, opened where Apple sells: the rule the old
 *       address had (`STORE_SHELL_WEB_ONLY_STUDIO_SEGMENTS` 'thank-you'), at the new one.
 *
 * Sabotage (2026-11-06, each seen red, then restored): the `['studio/thank-you', …]` forward removed → 1 red ·
 * `addOnHref`'s thank-you line removed → 2 red · Home's App row put back on the literal `/studio/thank-you` → 3 red ·
 * the `'thank-you'` row of `STUDIO_ABSORBED` removed → 4 red · `memories\/thank-you` dropped from
 * `WEB_ONLY_FEATURE_ROUTE` → 5 red.
 *
 * Run: cd apps/web && node --import tsx --test lib/r3-thank-you-forwards.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { legacyRedirectTarget } from './legacy-redirects';
import { addOnHref, appStoreDetailHref } from './add-ons-catalog';
import { thankYouVideoHref } from './memories-keepsakes';
import { buildEventMenuSections, eventMenuRows, eventMenuRowClaims } from './customer-menu';
import { pageHome } from './page-home';
import { isStoreShellWebOnlyPath } from './store-shell';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const EID = 'S89E-ABCDEFGHIJ';
const NEW = `/dashboard/${EID}/memories/thank-you`;
const OLD = `/dashboard/${EID}/studio/thank-you`;

test('1 · the old address forwards to the Memories page — by the address alone; the page moved, not copied', () => {
  assert.equal(thankYouVideoHref(EID), NEW);
  assert.equal(legacyRedirectTarget(OLD), NEW, '/studio/thank-you no longer forwards to Memories');
  assert.equal(legacyRedirectTarget(`${OLD}/`), NEW, 'a trailing slash on the old address does not forward');
  assert.equal(legacyRedirectTarget(NEW), null, 'the new home forwards somewhere — a loop');
  assert.ok(!existsSync(join(WEB, 'app/dashboard/[eventId]/studio/thank-you/page.tsx')), 'the old page is still a route');
  assert.ok(existsSync(join(WEB, 'app/dashboard/[eventId]/memories/thank-you/page.tsx')), 'the maker has no Memories page');
  const page = read('app/dashboard/[eventId]/memories/thank-you/page.tsx');
  assert.match(page, /<ThankYouMaker plan=\{plan\} eventId=\{eventId\} checkout=\{checkout\} \/>/, 'the maker was redrawn, not moved');
});

test('2 · every door names the Memories address — the catalogue, Home’s App row, the sign-in return', () => {
  assert.equal(addOnHref('thank-you', EID), NEW, 'the catalogue still opens the old address');
  // The keepsake row's sheet (`ServiceParts` → `readServicePart`) and Home's Papic card both read this one.
  assert.equal(appStoreDetailHref('thank-you', EID), NEW, 'the keepsake row’s door still opens the old address');
  const home = read('app/dashboard/[eventId]/page.tsx');
  assert.match(home, /open: thankYouVideoHref\(eventId\)/, 'Home’s App row does not open the Memories page');
  const page = read('app/dashboard/[eventId]/memories/thank-you/page.tsx');
  assert.match(page, /redirect\(`\/login\?next=\$\{thankYouVideoHref\(eventId\)\}`\)/, 'signing in returns to the old address');
  // The keepsake row on Memories draws the door it read — the Thank You button opens it.
  const memories = read('app/dashboard/[eventId]/memories/page.tsx');
  assert.match(memories, /'thank-you': <ServiceParts eventId=\{eventId\} service="papic" door=\{thankYou\} \/>/);
});

test('3 · nothing outside the forward map names /studio/thank-you', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        const rel = relative(WEB, abs);
        if (rel === 'lib/legacy-redirects.ts') continue;
        if (/studio\/thank-you/.test(stripComments(readFileSync(abs, 'utf8')))) offenders.push(rel);
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  walk(join(WEB, 'components'));
  assert.deepEqual(offenders, [], `still linking to the old address: ${offenders.join(', ')}`);
});

test('4 · it is a Memories page — the Memories tab lights it, and its back goes to Memories', () => {
  const rows = eventMenuRows(
    buildEventMenuSections(EID, {
      websiteEnabled: true,
      studioRows: [{ key: 'thank-you', href: addOnHref('thank-you', EID), name: 'Thank-You Video' }],
    }),
  );
  const holders = rows.filter((r) => eventMenuRowClaims(r).includes(NEW)).map((r) => r.key);
  assert.deepEqual(holders, ['memories'], `the Thank-You page is lit by ${holders.join(' + ') || 'no tab'}, not Memories`);
  assert.deepEqual(pageHome('/dashboard/[eventId]/memories/thank-you'), {
    kind: 'home',
    home: '/dashboard/[eventId]/memories',
    label: 'Memories',
  });
});

test('5 · the app answers the same at the new address — refused without Apple’s shop, open where Apple sells', () => {
  assert.equal(isStoreShellWebOnlyPath(NEW, false), true, 'the moved page opened in the app without Apple');
  assert.equal(isStoreShellWebOnlyPath(NEW, true), false, 'the moved page is refused where Apple sells');
  // The rest of Memories stays open in the app.
  assert.equal(isStoreShellWebOnlyPath(`/dashboard/${EID}/memories`, false), false, 'the Memories tab is refused');
});
