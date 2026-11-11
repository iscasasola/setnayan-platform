/**
 * home-is-the-profile.test.ts — 🏠 HOME IS THE PROFILE (owner 11 Nov 2026, "One profile page approve" — v3 of
 * `one-profile-page`, DECISION_LOG "HOME PAGE v3 APPROVED").
 *
 *   1 · The bar and the ☰ list the SAME two entries, in the SAME order: Home, then Discover.
 *   2 · Home's sections are Events · People · Shop · Memories, Shop only for an owner.
 *   3 · Every door into People or Memories lands on Home's section — the old pages forward with every parameter,
 *       and no code links the old addresses (except the matchers that light Home on the pages still under them).
 *   4 · One header: the public `/u/[slug]` and Home draw the same `ProfileHeader`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AccountBottomNav } from '@/app/dashboard/(launcher)/_components/account-bottom-nav';
import { accountBarTabs } from '@/lib/account-bar';
import { stripComments } from '@/lib/strip-comments';
import {
  HOME_HREF,
  forwardToHome,
  homeSegHref,
  homeSegments,
  resolveHomeSeg,
} from '@/lib/home-segments';
import { PEOPLE_GROUPS_HREF, peopleViewHref, pickedPeopleHref } from '@/lib/people-views';
import { personHref } from '@/lib/people-person-link';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function barLabels(): { labels: string[]; hrefs: string[] } {
  const html = renderToStaticMarkup(createElement(AccountBottomNav, { tabs: accountBarTabs({ discoverOpen: true }) }));
  const cells = [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>[\s\S]*?<span class="line-clamp-2[^"]*"[^>]*>([^<]*)<\/span>/g)];
  return { labels: cells.map((m) => m[2]!), hrefs: cells.map((m) => m[1]!.replace(/&amp;/g, '&')) };
}

/** The signed-in drawer's top-level entries, in source order: the Home row, then the Discover row. */
function drawerEntries(): { label: string; href: string }[] {
  const fd = src('app/_components/frontdoor/front-door-shell.tsx');
  const home = fd.match(/<Link href=\{HOME_HREF\} \{\.\.\.rowProps\('events'\)\} data-home-row="">[\s\S]*?<span className="fd-label-text">([^<]+)<\/span>/);
  const disc = fd.match(/<Link href="\/" \{\.\.\.rowProps\('home'\)\}>[\s\S]*?<span className="fd-label-text">([^<]+)<\/span>/);
  assert.ok(home, 'the ☰ has no Home row (a link to HOME_HREF marked data-home-row)');
  assert.ok(disc, 'the ☰ has no Discover row');
  return [
    { label: home[1]!, href: HOME_HREF, at: home.index! },
    { label: disc[1]!, href: '/', at: disc.index! },
  ]
    .sort((a, b) => a.at - b.at)
    .map(({ label, href }) => ({ label, href }));
}

test('1 · the bar and the ☰ list the same two entries, in the same order — Home, then Discover', () => {
  const bar = barLabels();
  assert.deepEqual(bar.labels, ['Home', 'Discover']);
  const drawer = drawerEntries();
  assert.deepEqual(
    drawer.map((d) => d.label),
    bar.labels,
    `the ☰ reads ${drawer.map((d) => d.label).join(' · ')}, the bar ${bar.labels.join(' · ')}`,
  );
  assert.deepEqual(drawer.map((d) => d.href), bar.hrefs, 'the ☰ and the bar open different places for the same word');
  // Nothing else in the ☰ may be a destination between them: Home's sections are small doors, the rest fine print.
  const fd = src('app/_components/frontdoor/front-door-shell.tsx');
  const between = fd.slice(fd.indexOf('data-home-row=""'), fd.indexOf(`<Link href="/" {...rowProps('home')}>`));
  assert.ok(!/rowProps\(/.test(between.slice(20)), 'a full rail row sits between Home and Discover — only section doors belong there');
  for (const seg of ['events', 'people', 'shop', 'memories'])
    assert.match(between, new RegExp(`data-home-door="${seg}"`), `Home's ${seg} door left the ☰`);
});

test('2 · Home\'s sections: Events · People · Shop · Memories, Shop only for an owner', () => {
  assert.deepEqual(homeSegments({ ownsShop: true }), ['events', 'people', 'shop', 'memories']);
  assert.deepEqual(homeSegments({ ownsShop: false }), ['events', 'people', 'memories']);
  assert.equal(resolveHomeSeg('shop', { ownsShop: false }), 'events', 'a non-owner reached a Shop section');
  assert.equal(resolveHomeSeg('people', { ownsShop: false }), 'people');
  assert.equal(resolveHomeSeg('nonsense', { ownsShop: true }), 'events');
  assert.equal(homeSegHref('events'), HOME_HREF, 'Events is Home itself, and keeps ?hub=1');
  const page = src('app/dashboard/(launcher)/page.tsx');
  assert.match(page, /export default async function HomePage\(/, '/dashboard is no longer Home');
  assert.match(page, /<HomeProfile[\s\S]*?>\s*\{body\}\s*<\/HomeProfile>/, 'Home no longer wraps the section in the profile');
});

test('3 · the old pages forward to Home\'s sections, every parameter kept', () => {
  assert.equal(forwardToHome('people', {}), '/dashboard?seg=people');
  assert.equal(
    forwardToHome('people', { view: 'requests', error: 'fence', person: ['S89U-ABCDEFGHJK', 'x'] }),
    '/dashboard?seg=people&view=requests&error=fence&person=S89U-ABCDEFGHJK',
  );
  assert.equal(forwardToHome('memories', { tab: 'vendors' }), '/dashboard?seg=memories&tab=vendors');
  assert.equal(forwardToHome('people', { seg: 'shop', view: 'alaga' }), '/dashboard?seg=people&view=alaga', 'a stray seg= hijacked the forward');
  for (const [file, seg] of [
    ['app/dashboard/(account)/people/page.tsx', 'people'],
    ['app/dashboard/(account)/library/page.tsx', 'memories'],
  ] as const) {
    assert.match(src(file), new RegExp(`redirect\\(forwardToHome\\('${seg}', await searchParams\\)\\)`), `${file} no longer forwards to Home`);
  }
  assert.match(src('app/dashboard/(account)/samahan/page.tsx'), /redirect\(`\/dashboard\?seg=people&view=samahan/, '/dashboard/samahan no longer goes straight to Home › People › Groups');
  // The People addresses every People door asks for.
  const g = { showConnections: true, showDependents: true };
  assert.equal(PEOPLE_GROUPS_HREF, '/dashboard?seg=people&view=samahan');
  assert.match(peopleViewHref('following', g), /^\/dashboard\?seg=people&view=following$/);
  assert.equal(pickedPeopleHref('seg:memories', g), '/dashboard?seg=memories', 'the picker\'s Home group does not open Home\'s sections');
  assert.equal(personHref('S89U-ABCDEFGHJK'), '/dashboard?seg=people&person=S89U-ABCDEFGHJK');
});

/** Code that may still NAME an old address: the matchers that light Home on pages still under it, and the forwarders. */
const MAY_NAME_OLD = new Set([
  'app/_components/frontdoor/rail-active.ts',
  'app/dashboard/(account)/_components/account-rail-context.tsx',
  'app/dashboard/(account)/_components/account-focus-paths.ts',
  'app/dashboard/(launcher)/_components/account-bottom-nav.tsx',
  'lib/appearance.ts',
  'lib/stay-ratchet.navigation.ts',
  'app/dev/bar-lab/[[...path]]/page.tsx',
]);

test('3b · no code links the old People or Memories address — every door lands on Home', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.ts$|\.harness\.ts$/.test(e.name) && !MAY_NAME_OLD.has(rel)) {
        const code = stripComments(readFileSync(join(WEB, rel), 'utf8'));
        // A door is a string that STARTS with the old address and is not a page under it (`/dashboard/people/<id>`).
        for (const m of code.matchAll(/['"`](?:\$\{[A-Z_]+\})?\/dashboard\/(people|library)(?![\w/-]|\/\$\{|\/\[)/g))
          offenders.push(`${rel} → ${m[0]}`);
      }
    }
  };
  walk('app');
  walk('lib');
  walk('components');
  assert.deepEqual(offenders, [], `these still point at an old address:\n${offenders.join('\n')}`);
});

test('4 · one header: the public page and Home draw the same ProfileHeader', () => {
  const pub = src('app/u/[userSlug]/page.tsx');
  const home = src('app/dashboard/(launcher)/_components/home-profile.tsx');
  assert.match(pub, /<ProfileHeader\b/, 'the public page no longer draws the shared header');
  assert.ok(!/<header className="uprof-head"/.test(pub), 'the public page grew its own copy of the header again');
  assert.match(home, /<ProfileHeader\b[\s\S]*?layout="home"/, 'Home no longer draws the shared header');
  assert.match(pub, /\$\{PROFILE_HEADER_CSS\}/, 'the public page lost the header\'s styles');
});
