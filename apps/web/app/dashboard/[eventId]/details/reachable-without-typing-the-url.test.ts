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
import { buildCustomerMenuTree } from '@/lib/customer-menu';
import { PEOPLE_GROUP_COPY } from '@/lib/event-people-roster';

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
  {
    segment: 'hosts',
    whatIsLost: 'a helper without the guest list cannot see what they may do (everyone else lands on the guest list)',
  },
  {
    segment: 'refer',
    whatIsLost:
      'no couple can ever start a referral — the admin Studio promises this ' +
      'page "appears for couples" when the programme is switched on',
  },
];

/**
 * 🔄 STAGE D (owner 2026-09-29) MOVED TWO OF THESE DOORS OFF THE RAIL — on
 * purpose, to their new homes, never to nowhere. The rail is five rows now, so
 * a page that is not a row must PROVE its door in a mounted surface instead:
 *
 *   hosts → since the Hosts fold (owner 2026-09-30) `/hosts` is REDIRECT-ONLY:
 *           anyone holding the guest list lands on it (a rail row), and the
 *           one viewer it still draws for — a helper without the guest list —
 *           reaches it from the People roster's "Running the day with you";
 *   refer → the account menu: the event layout hands `referHref` to the
 *           mounted <AccountSwitcher>, which draws "Refer a couple".
 *   details → the Home cover's "Event Details" button (owner 2026-10-23: "only
 *           keep the Event Details button and remove the event settings"). The
 *           rail's name row stopped being a link, so `/details` is no longer a
 *           DRAWN rail href — `drawnRailHrefs` below drops the `event` group the
 *           rail does not draw, or this guard would keep counting a door nobody
 *           can see.
 *
 * Each proof reads the REAL builder and the REAL mount, so deleting the new
 * door turns this red exactly as deleting the old rail row did.
 */
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const MOVED_DOOR: Record<string, (railHrefs: string[]) => boolean> = {
  // The Countdown widget since 24 Oct 2026 (owner-approved control center) — the cover's ⚙ Settings pill went.
  details: () =>
    read('app/dashboard/[eventId]/_components/home-control-faces.ts').includes('door: `/dashboard/${e}/details`') &&
    read('app/dashboard/[eventId]/_components/home-control-row.tsx').includes('<Shell k="count" door={`/dashboard/${e}/details`}') &&
    read('app/dashboard/[eventId]/_components/home-first-screen.tsx').includes('<HomeControlRow ') &&
    isMounted('app/dashboard/[eventId]/_components/home-first-screen.tsx'),
  hosts: (railHrefs) =>
    railHrefs.includes('/dashboard/EVT123/guests') &&
    read('app/dashboard/[eventId]/hosts/page.tsx').includes(
      "if (!isDelegateWithoutArea(viewer, 'guest_list')) redirect(`/dashboard/${eventId}/guests`);",
    ) &&
    PEOPLE_GROUP_COPY.hosts.path === 'hosts',
  refer: () =>
    read('app/dashboard/[eventId]/layout.tsx').includes('referHref={referralEnabled ? `/dashboard/${eventId}/refer` : null}') &&
    read('app/_components/account-switcher/account-switcher.tsx').includes('href={referHref}') &&
    isMounted('app/_components/account-switcher/account-switcher.tsx'),
};

/**
 * The hrefs the rail actually DRAWS. `event-rail-context.tsx` drops the `event`
 * group (`groupsWithHub.filter((g) => g.key !== 'event')`) — its row is in the
 * tree for the lit-row resolver, not on screen — so counting it would be a door
 * in data only. The filter is read from the rail itself, so if the rail starts
 * drawing that group again this follows.
 */
function drawnRailHrefs(): string[] {
  const rail = read('app/dashboard/[eventId]/_components/event-rail-context.tsx');
  const dropsEvent = rail.includes("groupsWithHub.filter((g) => g.key !== 'event')");
  return buildCustomerNavGroups('EVT123', { websiteEnabled: true })
    .filter((g) => !(dropsEvent && g.key === 'event'))
    .flatMap((g) => g.items)
    .map((i) => i.href);
}

/** Is this event page reachable by clicking — a rail row, or a proven moved door? */
function hasDoor(segment: string, railHrefs: string[]): boolean {
  if (railHrefs.includes(`/dashboard/EVT123/${segment}`)) return true;
  return MOVED_DOOR[segment]?.(railHrefs) ?? false;
}

test('the pages people go to are linked from the event rail, not just addressable', () => {
  const hrefs = drawnRailHrefs();
  // The floor is the ruled bar (owner 22 Oct 2026, "Yes remove more"): every tab's page is a drawn rail destination.
  const bar = buildCustomerMenuTree('EVT123', { websiteEnabled: true }).map((m) => m.href.split('?')[0]!);
  assert.ok(bar.length >= 4, 'the bar lost a ruled tab — every check below would pass vacuously');
  for (const tab of bar) assert.ok(hrefs.includes(tab), `the rail lost ${tab} — every check below would pass vacuously`);

  const unreachable = MUST_HAVE_A_DOOR.filter(({ segment }) => !hasDoor(segment, hrefs)).map(({ segment, whatIsLost }) => `${segment} — ${whatIsLost}`);

  assert.deepEqual(
    unreachable,
    [],
    'These pages exist and nothing in the event rail links to them, so the only ' +
      'way in is typing the address:\n  ' +
      unreachable.join('\n  '),
  );
});

/**
 * 🔑 CAPTURED FROM THE DEAD COMPONENT, NOT TYPED FROM MEMORY.
 *
 * `app/_components/profile-menu.tsx` was deleted (S39 — it was mounted
 * nowhere, see the test below). Before it existed, this test read the file
 * itself and derived this list at run time; now that the file is gone the
 * list has to be frozen, or the whole guard goes vacuous.
 *
 * Every `href={\`/dashboard/${eventId}/...\`}` the component held, captured
 * with `git show 52c15f957965420da74f3c5820ba197791c09fe0:apps/web/app/_components/profile-menu.tsx`
 * (origin/main, the last commit that touched the file before deletion) and
 * `grep -n "href="` over that output. Re-run that command to re-verify this
 * list — never re-type it from memory or shrink it because a segment now
 * has a home; that is exactly what the derived check below still proves.
 *
 * DO NOT DROP AN ENTRY. If a listed page genuinely no longer needs a door,
 * that is an owner-visible decision, not a quiet edit to this array.
 */
const RETIRED_MENU_EVENT_LINKS = ['hosts', 'details', 'refer'] as const;

/**
 * When a menu is REPLACED, the rows the replacement forgot are what strand a
 * page. That has now happened three times from one component: Personalization,
 * Hosts, and — three weeks after the component had already stopped rendering —
 * Refer a couple, which was therefore never clickable for a single day of its
 * life. A changelog note the same day recorded it as "reachable via direct link
 * / account", which is what stopped anyone from checking.
 *
 * So this requires every event-scoped link the dead component used to hold
 * (frozen above, since the file itself is gone) to exist somewhere a person
 * can press. Adding a link back to a revived version of the component — or
 * to any other retired surface — still has to widen this list by hand; it
 * can no longer create a silent orphan, because the property under test
 * ("every destination the retired menu used to offer is still reachable
 * from a mounted surface") never depended on the file existing.
 */
test('every event link in the retired menu has a home in a mounted surface', () => {
  const segments = RETIRED_MENU_EVENT_LINKS;

  assert.ok(
    segments.length >= 3,
    `only ${segments.length} event links in the frozen retired-menu list — ` +
      'the list was shrunk, so this test would pass while proving nothing',
  );

  const hrefs = drawnRailHrefs();

  const stranded = segments.filter((seg) => !hasDoor(seg, hrefs));
  assert.deepEqual(
    stranded,
    [],
    'The retired menu used to link these pages and the live event rail does ' +
      'not, so they are reachable only by typing the address:\n  ' +
      stranded.join('\n  ') +
      '\n\nGive each a row in the mounted event rail — the retired component ' +
      'is gone, so it cannot carry the link anymore.',
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
