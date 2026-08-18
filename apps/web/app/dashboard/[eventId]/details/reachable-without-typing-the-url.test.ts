/**
 * reachable-without-typing-the-url.test.ts — a page needs a door.
 *
 * 🚨 WHY THIS EXISTS. On 2026-08-18 the owner was asked to press a new button
 * and answered "i cant find it". He was right: `/dashboard/[eventId]/details`
 * (Personalization, which holds put-away) and `/dashboard/[eventId]/hosts` were
 * linked by exactly ONE component — `app/_components/profile-menu.tsx` — and
 * that component is imported by NOTHING. It had been superseded by the account
 * switcher, which carries neither row. Both pages were live, correct, tested,
 * and reachable only by typing the address.
 *
 * 🔑 A LINK IN A COMPONENT NOBODY MOUNTS IS NOT A LINK. This is the
 * gate-with-no-handle shape one level up: not a switch nobody can flip, but a
 * PAGE nobody can reach. It survived every check we have, because all of them
 * ask whether the route RENDERS — and it did.
 *
 * ⚠ AND THE REGISTER SAID OTHERWISE. `lib/nav-registry-defaults.ts` still lists
 * `customer.profile-menu.hosts` and `customer.profile-menu.personalization`
 * under a `profile-menu` area that no longer ships. One file said the door was
 * there, the app disagreed, and nobody read both.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { buildCustomerNavGroups } from '../_components/customer-nav-config';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');

/** Every non-test .ts/.tsx under apps/web/app and apps/web/lib. */
function sources(): { path: string; code: string }[] {
  const out: { path: string; code: string }[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === '.next') continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e))
        out.push({ path: relative(WEB, p), code: stripComments(readFileSync(p, 'utf8')) });
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  return out;
}

const SRC = sources();

/** Is this module imported by anything at all? */
function isMounted(modulePath: string): boolean {
  const base = modulePath.replace(/\.tsx?$/, '');
  const name = base.split('/').pop()!;
  return SRC.some(
    (s) =>
      s.path !== modulePath &&
      new RegExp(`from\\s+['"][^'"]*${name}['"]`).test(s.code),
  );
}

/**
 * The per-event pages that must be reachable by CLICKING, with what a person
 * loses when they are not.
 *
 * ⚠ THIS HAND LIST IS THE FLOOR, NOT THE CHECK. The first cut of this file had
 * exactly two entries — `details` and `hosts` — because those were the two
 * examples in front of me. An audit hours later found a THIRD page orphaned by
 * the same dead component, and this list said nothing about it.
 * 🔑 A GUARD IS ONLY AS WIDE AS ITS LIST. The real check is the derived one
 * below, which reads the dead component and requires every link it held to have
 * a home. Keep this list for the sentences; trust the derived one for coverage.
 */
const MUST_HAVE_A_DOOR: { segment: string; whatIsLost: string }[] = [
  {
    segment: 'details',
    whatIsLost:
      'the couple cannot put a finished celebration away, or bring it back — ' +
      'and five screens tell them to do exactly that',
  },
  { segment: 'hosts', whatIsLost: 'the couple cannot add a co-host' },
  {
    segment: 'refer',
    whatIsLost:
      'no couple can ever start a referral — the admin Studio promises this ' +
      'page "appears for couples" when the programme is switched on',
  },
];

test('the pages people go to are linked from the event rail, not just addressable', () => {
  const groups = buildCustomerNavGroups('EVT123', { websiteEnabled: true });
  const hrefs = groups.flatMap((g) => g.items).map((i) => i.href);
  assert.ok(hrefs.length >= 5, 'the rail lost destinations — every check below would pass vacuously');

  const unreachable = MUST_HAVE_A_DOOR.filter(
    ({ segment }) => !hrefs.includes(`/dashboard/EVT123/${segment}`),
  ).map(({ segment, whatIsLost }) => `${segment} — ${whatIsLost}`);

  assert.deepEqual(
    unreachable,
    [],
    'These pages exist and nothing in the event rail links to them, so the only ' +
      'way in is typing the address:\n  ' +
      unreachable.join('\n  '),
  );
});

/**
 * 🔑 DERIVED FROM THE DEAD COMPONENT, NOT TYPED BY HAND.
 *
 * When a menu is REPLACED, the rows the replacement forgot are what strand a
 * page. That has now happened three times from one component: Personalization,
 * Hosts, and — three weeks after the component had already stopped rendering —
 * Refer a couple, which was therefore never clickable for a single day of its
 * life. A changelog note the same day recorded it as "reachable via direct link
 * / account", which is what stopped anyone from checking.
 *
 * So this reads `profile-menu.tsx` itself and requires every event-scoped link
 * it holds to exist somewhere a person can press. Adding a link to the dead
 * component can no longer create a silent orphan: it fails here instead.
 */
test('every event link in the retired menu has a home in a mounted surface', () => {
  const dead = join(WEB, 'app/_components/profile-menu.tsx');
  const code = stripComments(readFileSync(dead, 'utf8'));

  const segments = [
    ...code.matchAll(/href=\{`\/dashboard\/\$\{eventId\}\/([a-z0-9-]+)`\}/g),
  ].map((m) => m[1]!);

  assert.ok(
    segments.length >= 3,
    `only ${segments.length} event links found in the retired menu — the pattern ` +
      'stopped matching, so this test would pass while proving nothing',
  );

  const hrefs = buildCustomerNavGroups('EVT123', { websiteEnabled: true })
    .flatMap((g) => g.items)
    .map((i) => i.href);

  const stranded = segments.filter((seg) => !hrefs.includes(`/dashboard/EVT123/${seg}`));
  assert.deepEqual(
    stranded,
    [],
    'The retired menu links these pages and the live event rail does not, so ' +
      'they are reachable only by typing the address:\n  ' +
      stranded.join('\n  ') +
      '\n\nEither give each a row, or delete it from the retired component — but ' +
      'do not leave a link in a menu nobody mounts.',
  );
});

test('a link only counts if something actually mounts the component holding it', () => {
  /*
    The assertion that would have caught the original defect. profile-menu.tsx
    linked both pages and was imported by nothing — so a naive "does any file
    reference this href?" check passes while the door does not exist.
  */
  assert.equal(
    isMounted('app/_components/profile-menu.tsx'),
    false,
    'profile-menu.tsx is mounted again. Either delete this assertion and rely ' +
      'on it for the links, or leave the rail rows in place — but do not let ' +
      'BOTH claim to be the door without deciding which one ships.',
  );

  // …and the component that IS mounted must be the one carrying the rows.
  assert.ok(
    isMounted('app/dashboard/[eventId]/_components/customer-nav-config.ts'),
    'the event rail config is mounted nowhere — the rows it defines are not a door',
  );
});
