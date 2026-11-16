/**
 * an-event-lives-under-its-creator.test.ts — THE ADDRESS MOVE, PART 2: EVENTS (owner 2026-11-15, specs DECISION_LOG
 * d7910b5d; map ADDRESS_MOVE_MAP_2026-11-15_fable.md).
 *
 * An event lives at `setnayan.com/{the creator's username}/{event}` — no `/u/` — and the person's page at
 * `setnayan.com/{username}`, while the owner's cutover switch (`NEXT_PUBLIC_U_NESTING_CUTOVER`) is on. Held here:
 *   1. every redirect / rewrite pair, as pure functions;
 *   2. `/{x}/{y}` is decided by the second word alone (one pool of names): an event's own pages, a shop's pages and a
 *      chapter are never read as a nested event — and the event-page list matches the folders on disk;
 *   3. the helper: `/{username}/{event}` on, the old bare address off, the bare address for an event whose own word is a
 *      page word, and `/{username}` for the person page;
 *   4. old sub-page links (`/{event}/invite` for guests already invited) forward with their query;
 *   5. 🛑 THE OWNER'S HARD RULE: `/cale-ice` and `/maria-and-jose` still load — with the switch OFF nothing about them
 *      changes, and with it ON they forward (never 404) to the nested address;
 *   6. the wiring: the middleware gates all of it on the switch; the page sends a wrong or renamed owner to the real
 *      address and 404s a nested word that is no event; the layout forwards old sub-pages; nested opens keep the cached
 *      Event Hub;
 *   7. no event link is typed by hand any more.
 *
 * MUTATIONS (each turns this red): drop `isNotANestedEvent(b)` from `bareNestingRewrite` (2); return `/u/${owner}/…`
 * from `publicEventPath` (3); drop the `cached` exclusion in `oldSubPageTarget` (4); remove the `isUserNestingCutover
 * Enabled()` gate around the middleware block (6); type `` `/${event.slug}/hub` `` into an app file (7).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EVENT_SUB_ROUTES,
  SHOP_SUB_ROUTES,
  bareChapterRewrite,
  bareNestingRewrite,
  isUsernameWord,
  legacyUserPrefixRedirect,
  nestableEventSlug,
} from './u-nesting';
import { oldSubPageTarget, personPath, publicEventPath } from './public-event-url';
import { SHOP_SUB_PAGES } from './shop-address';
import { RESERVED_SLUGS } from './reserved-slugs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const reserved = (w: string) => RESERVED_SLUGS.has(w);
const FLAG = 'NEXT_PUBLIC_U_NESTING_CUTOVER';

function withCutover<T>(on: boolean, fn: () => T): T {
  const was = process.env[FLAG];
  if (on) process.env[FLAG] = 'true';
  else delete process.env[FLAG];
  try {
    return fn();
  } finally {
    if (was === undefined) delete process.env[FLAG];
    else process.env[FLAG] = was;
  }
}

test('1 · the redirect and rewrite pairs', () => {
  assert.deepEqual(bareNestingRewrite('/ana/our-wedding', reserved), { eventPath: '/our-wedding', owner: 'ana' });
  assert.deepEqual(bareNestingRewrite('/ana/our-wedding/find-my-table', reserved), {
    eventPath: '/our-wedding/find-my-table',
    owner: 'ana',
  });
  assert.equal(bareChapterRewrite('/ana/c/S89C-CK46HS1VSS', reserved), '/u/ana/c/S89C-CK46HS1VSS');
  assert.equal(legacyUserPrefixRedirect('/u/ana'), '/ana');
  assert.equal(legacyUserPrefixRedirect('/u/ana/our-wedding'), '/ana/our-wedding');
  assert.equal(legacyUserPrefixRedirect('/u/ana/c/S89C-CK46HS1VSS'), '/ana/c/S89C-CK46HS1VSS');
  assert.equal(legacyUserPrefixRedirect('/u/S89U-KEMMF2ADCK'), null, 'the account public-id form keeps /u/');
  assert.equal(legacyUserPrefixRedirect('/v/shop'), null);
  assert.ok(isUsernameWord('ana-reyes') && !isUsernameWord('S89U-KEMMF2ADCK') && !isUsernameWord('s89u-kemmf2adck'));
});

test('2 · the second word decides — an event page, a shop page or a chapter is never a nested event', () => {
  for (const page of ['hub', 'invite', 'seat', 'recap', 'welcome', 'cached', 'redeem', 'dates', 'review', 'booth', 'guest-review', 'c']) {
    assert.equal(bareNestingRewrite(`/cale-ice/${page}`, reserved), null, `/cale-ice/${page} was read as somebody's event`);
  }
  for (const app of ['admin', 'dashboard', 'vendor-dashboard', 'api', 'u', 'v', 'join', 'papic']) {
    assert.equal(bareNestingRewrite(`/${app}/anything`, reserved), null, `/${app}/… was read as a person's event`);
  }
  assert.equal(bareNestingRewrite('/cale-ice', reserved), null, 'a bare word is not nested');
  // The event-page list IS the folders on disk.
  const disk = readdirSync(join(WEB, 'app', '[slug]'))
    .filter((n) => !n.startsWith('_') && !n.startsWith('[') && !/\.(tsx?|mjs|css)$/.test(n))
    .filter((n) => statSync(join(WEB, 'app', '[slug]', n)).isDirectory() || n === 'manifest.webmanifest')
    .sort();
  assert.ok(disk.length > 15, `only ${disk.length} event pages found — the scan is blind`);
  for (const n of disk) assert.ok(EVENT_SUB_ROUTES.has(n), `app/[slug]/${n} is an event page missing from EVENT_SUB_ROUTES`);
  for (const n of EVENT_SUB_ROUTES) assert.ok(disk.includes(n), `EVENT_SUB_ROUTES names ${n}, which is no event page`);
  assert.deepEqual([...SHOP_SUB_ROUTES].sort(), [...SHOP_SUB_PAGES].sort(), 'the shop page lists drifted apart');
});

test('3 · the helper: /{username}/{event} on, the old address off, /{username} for the person', () => {
  withCutover(true, () => {
    assert.equal(publicEventPath('our-wedding', 'ana'), '/ana/our-wedding');
    assert.equal(publicEventPath('our-wedding', null), '/our-wedding', 'no username → the old address (it still works)');
    assert.equal(publicEventPath('hub', 'ana'), '/hub', 'an event named like an event page keeps the old address');
    assert.ok(!nestableEventSlug('invite') && nestableEventSlug('our-wedding'));
    assert.equal(personPath('ana'), '/ana');
    assert.equal(personPath('S89U-KEMMF2ADCK'), '/u/S89U-KEMMF2ADCK');
  });
  withCutover(false, () => {
    assert.equal(publicEventPath('our-wedding', 'ana'), '/our-wedding', 'switch off → byte-identical to today');
    assert.equal(personPath('ana'), '/u/ana');
  });
});

test('4 · old sub-page links forward with their query — the internal copy never does', () => {
  withCutover(true, () => {
    assert.equal(oldSubPageTarget('/our-wedding/invite', 'our-wedding', 'ana'), '/ana/our-wedding/invite');
    assert.equal(oldSubPageTarget('/our-wedding/invite?error=x', 'our-wedding', 'ana'), '/ana/our-wedding/invite?error=x');
    assert.equal(oldSubPageTarget('/our-wedding/invite/enter?in=1', 'our-wedding', 'ana'), '/ana/our-wedding/invite/enter?in=1');
    assert.equal(oldSubPageTarget('/Our-Wedding/hub', 'our-wedding', 'ana'), '/ana/our-wedding/hub');
    assert.equal(oldSubPageTarget('/our-wedding', 'our-wedding', 'ana'), null, 'the bare page is the page’s own redirect');
    assert.equal(oldSubPageTarget('/our-wedding/cached/v2.x', 'our-wedding', 'ana'), null);
    assert.equal(oldSubPageTarget('/our-wedding/invite', 'our-wedding', null), null, 'no username → stays');
    assert.equal(oldSubPageTarget(null, 'our-wedding', 'ana'), null);
  });
  withCutover(false, () => assert.equal(oldSubPageTarget('/our-wedding/invite', 'our-wedding', 'ana'), null));
});

test('5 · 🛑 /cale-ice and /maria-and-jose still load', () => {
  withCutover(false, () => {
    for (const w of ['cale-ice', 'maria-and-jose']) {
      assert.equal(publicEventPath(w, 'ice'), `/${w}`, `/${w} moved with the switch off`);
      assert.equal(oldSubPageTarget(`/${w}/invite`, w, 'ice'), null);
    }
  });
  withCutover(true, () => {
    for (const w of ['cale-ice', 'maria-and-jose']) {
      assert.ok(nestableEventSlug(w), `${w} could not be nested`);
      assert.equal(publicEventPath(w, 'ice'), `/ice/${w}`);
      assert.deepEqual(bareNestingRewrite(`/ice/${w}`, reserved), { eventPath: `/${w}`, owner: 'ice' });
      assert.equal(bareNestingRewrite(`/${w}`, reserved), null, `/${w} itself must reach its own page (which forwards)`);
      assert.equal(bareNestingRewrite(`/${w}/invite`, reserved), null, `/${w}/invite must reach the guest invite`);
      assert.ok(!reserved(w), `${w} became a reserved word`);
    }
  });
});

test('6 · the wiring', () => {
  const mw = read('middleware.ts');
  const gate = mw.indexOf('if (isUserNestingCutoverEnabled()) {\n    const reservedWord');
  assert.ok(gate > 0, 'the events block is not behind the cutover switch');
  const block = mw.slice(gate, mw.indexOf('} else if (pathname.startsWith(\'/u/\')) {', gate));
  assert.match(block, /legacyUserPrefixRedirect\(pathname\)[\s\S]{0,200}request\.url\), 308\)/, '/u/ no longer 308s to the bare form');
  assert.match(block, /bareChapterRewrite\(pathname, reservedWord\)/);
  assert.match(block, /hubViewRewritePath\(request, fetch, \{ pathname: nestedEvent\.eventPath \}\)/, 'a nested open lost the cached Event Hub');
  assert.match(block, /requestHeaders\.set\('x-sn-u-nesting', '1'\);\s*requestHeaders\.set\('x-sn-u-owner', nestedEvent\.owner\.toLowerCase\(\)\);/);
  assert.match(mw, /isUserNestingCutoverEnabled\(\) && \(await bareWordIsPerson\(bareShop\.slug\)\)/, 'a stranger’s /{username} no longer reaches the person page');

  const page = read('app/[slug]/page.tsx');
  assert.match(page, /const wrongOwner = viaNesting && askedOwner !== \(ownerSlug \?\? ''\)\.toLowerCase\(\);/, 'a wrong or renamed owner is not sent to the real address');
  assert.match(page, /if \(reqHeaders\.get\('x-sn-u-nesting'\) === '1'\) notFound\(\);/, 'a nested word that is no event is drawn as something else');
  assert.match(page, /return AccountProfilePage\(\{ params: Promise\.resolve\(\{ userSlug: slug\.toLowerCase\(\) \}\) \}\);/, '/{username} lost the person page');

  const layout = read('app/[slug]/layout.tsx');
  assert.match(layout, /if \(eventId\) await forwardOldSubPage\(slug, eventId\);/, 'old sub-page links no longer forward');
  const fwd = read('app/[slug]/_lib/forward-old-sub-page.ts');
  assert.match(fwd, /if \(!isUserNestingCutoverEnabled\(\) \|\| onTheCachedHub\(\)\) return;/, 'the forward reads the request on the cached hub, or runs with the switch off');
  assert.match(fwd, /if \(h\.get\('x-sn-u-nesting'\) === '1' \|\| h\.has\('next-action'\)\) return;/, 'a nested open or a form post is forwarded');

  const route = read('lib/hub-view-route.ts');
  assert.match(route, /if \(isUserNestingCutoverEnabled\(\) && !opts\.pathname\) return null;/);
  const helper = read('lib/public-event-url.ts');
  assert.match(helper, /\.select\('created_by_user_id'\)/, 'the address no longer names the creator');
});

test('7 · no event address is typed by hand', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?)$/.test(n) && !/\.test\.tsx?$/.test(n)) files.push(p);
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.ok(files.length > 2000, `only ${files.length} files walked — the scan is blind`);
  const offenders: string[] = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const line of text.split('\n')) {
      if (/revalidatePath\(/.test(line)) continue; // the internal route, which the rewrite renders — correct as is
      if (/`\/\$\{(event|ev|e|row|evt)\??\.slug\}/.test(line)) offenders.push(`${relative(WEB, f).split(sep).join('/')}: ${line.trim().slice(0, 120)}`);
    }
  }
  assert.deepEqual(offenders, [], `build event addresses with publicEventPath (lib/public-event-url.ts):\n  ${offenders.join('\n  ')}`);
});
