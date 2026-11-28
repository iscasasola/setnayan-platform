/**
 * a-host-is-not-asked-to-confirm.test.ts — 🙅 THE COUPLE AND THE HOSTS DO NOT GET THE GUEST'S CONFIRM.
 *
 * Owner walk 2026-11-27 (MASTER-PLAN L3): signed in as the host on `/maria-and-jose`, the cover read "Confirm
 * attendance", and the tap landed on "You're not on this event's guest list" — a button that leads to a refusal. A host
 * with no guest row of their own is never offered the reply: not on the cover, not as the Reply card under it. A host
 * who IS on the list (a row of their own) keeps their real reply, as before (owner bug 2026-10-24).
 *
 * A PROPERTY of the real page (`SiteBody`, the fixture invitation), plus the one rule (`hostHasOwnReply`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSiteBodyFixtureFull } from '@/lib/site-body-fixture-render';
import { fixtureStranger, fixtureWidgets, siteBodyFixtureProps } from '@/lib/site-body-fixture';
import { COVER_RSVP_PART, hostHasOwnReply } from '@/lib/cover-rsvp';
import { HUB_RSVP_DEFAULT_WORDS } from '@/lib/element-style';

const FULL = fixtureWidgets({ hero: { ground: { kind: 'color', color: '#3a4a5a', shape: 'full' } } });
const PHOTO = { heroPhotoUrl: 'https://cdn.test/fixture-hero.jpg' } as const;
const HOST = { capability: 'owner', ownerUserId: 'lab-host', ownerEventId: siteBodyFixtureProps().event.event_id, maySiteEdit: true } as const;
const HOST_ROW = { hostOwnGuestId: '00000000-0000-4000-8000-00000000a002', hostOwnRsvp: 'pending' } as const;

test('the rule: only a host with a live row of their own has a reply here', () => {
  assert.equal(hostHasOwnReply(null), false);
  assert.equal(hostHasOwnReply(undefined), false);
  assert.equal(hostHasOwnReply(''), false);
  assert.equal(hostHasOwnReply('pending'), true);
  assert.equal(hostHasOwnReply('attending'), true);
});

for (const [shape, extra] of [
  ['the text cover', {}],
  ['a full ground', { widgets: FULL }],
  ['the photo cover', PHOTO],
] as const) {
  test(`${shape}: a host with no row of their own sees no "Confirm attendance" and no Reply card`, async () => {
    const page = await renderSiteBodyFixtureFull({ identity: fixtureStranger(), ownerCapability: HOST, ...extra } as never);
    assert.deepEqual(page.complaints, [], 'React or the page complained while rendering');
    assert.ok(page.html.includes('data-pahina-first-screen'), 'anti-vacuity: no cover');
    assert.doesNotMatch(page.html, /data-cover-rsvp="/, 'the host is offered the cover’s RSVP button with nothing to reply as');
    assert.ok(!page.html.includes(`id="${COVER_RSVP_PART}"`), 'the host’s Reply card is drawn with no row to reply as');
    assert.ok(!page.html.includes(`>${HUB_RSVP_DEFAULT_WORDS}<`), `"${HUB_RSVP_DEFAULT_WORDS}" is still on the host’s page`);
  });

  test(`${shape}: a host who IS on the list keeps their own reply`, async () => {
    const page = await renderSiteBodyFixtureFull({ identity: fixtureStranger(), ownerCapability: HOST, ...HOST_ROW, ...extra } as never);
    assert.match(page.html, /data-cover-rsvp="ask"/, 'a host on their own list lost their reply');
    assert.ok(page.html.includes(`id="${COVER_RSVP_PART}"`), 'a host on their own list lost their Reply card');
  });
}

test('a guest with a key still meets the Confirm', async () => {
  const page = await renderSiteBodyFixtureFull({ widgets: FULL } as never);
  assert.match(page.html, /data-cover-rsvp="ask"/, 'anti-vacuity: the guest lost the cover’s RSVP button');
});
