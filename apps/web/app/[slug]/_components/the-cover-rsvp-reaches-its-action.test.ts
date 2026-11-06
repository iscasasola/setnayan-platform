/**
 * the-cover-rsvp-reaches-its-action.test.ts — 🧭 THE COVER'S RSVP BUTTON GOES STRAIGHT TO THE RSVP PAGE.
 *
 * Owner 2026-10-26, verbatim: *"on rsvp when they get the invite link there is a button confirm attendance. instead of
 * jumping to will you join us? (REPLY) make it go directly to the RSVP Page."*
 *
 * History: 2026-10-17 (live on `/cale-ice`, signed in as its host — *"confirm attendance is not doing anything?"*) the
 * button went to `/cale-ice/invite/reply`, and the reply page sent anyone without a guest pass back to `/cale-ice` (307),
 * so the tap reloaded the cover. The fix then was a stop on the way: the button glided to the page's RSVP part (the
 * Reply card under the cover; from 2026-10-24 Me's "Will you join us? · Reply"), whose own button opened the reply.
 * Since 2026-10-24 the reply page replies as exactly whom the Event Hub is viewing as (`readReplyIdentityForEvent`): the
 * guest's pass or seat, or a signed-in host's OWN row — and tells a host with no row so (`NoReplyHere`), never a 307.
 * So the stop is gone: the cover's button IS the door to the reply page, one tap.
 *
 * A PROPERTY, on the REAL page (`SiteBody`, the fixture invitation), for every reader who meets the button:
 *   · a guest with a seat (a key) — the button's href is the reply page, never an in-page `#…` mark (Me's `#me-reply`,
 *     the Welcome's `#site-reply`); Me's own Reply is still there, for a guest who goes to Me;
 *   · the host on their own page — the same reply page (it replies as the host's own row); the host's card under the
 *     cover is still there;
 *   · a stranger (no seat, no pass) is still handed the stranger's door in the cover's foot, never the reply page
 *     (it would send them home) — unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSiteBodyFixtureFull } from '@/lib/site-body-fixture-render';
import { fixtureStranger, fixtureWidgets, siteBodyFixtureProps } from '@/lib/site-body-fixture';
import { COVER_RSVP_PART } from '@/lib/cover-rsvp';
import { replyEntry } from '@/lib/guest-pass-hop';
import { inviteReplyPath } from '@/lib/invite-arrival';

const FULL = fixtureWidgets({ hero: { ground: { kind: 'color', color: '#3a4a5a', shape: 'full' } } });
const PHOTO = { heroPhotoUrl: 'https://cdn.test/fixture-hero.jpg' } as const;
const EVENT = siteBodyFixtureProps().event;
const HOST = { capability: 'owner', ownerUserId: 'lab-host', ownerEventId: EVENT.event_id, maySiteEdit: true } as const;
const REPLY = inviteReplyPath(EVENT.slug ?? '');
/** The host's OWN guest row (the groom's), not yet answered — the host's card reads it (owner bug 2026-10-24). */
const HOST_ROW = { hostOwnGuestId: '00000000-0000-4000-8000-00000000a002', hostOwnRsvp: 'pending' } as const;
/** The cover: the first-screen header, whole (the page's own top bar is a `<header>` too, and comes first). */
const coverOf = (html: string) => {
  const at = html.indexOf('<header data-pahina-first-screen=""');
  return { at, end: html.indexOf('</header>', at) + 9, html: html.slice(at, html.indexOf('</header>', at) + 9) };
};

const READERS = [
  ['a guest with a key', {}, 'guest'],
  ['a guest with a key · a full ground', { widgets: FULL }, 'guest'],
  ['the host on their own page (cale-ice’s shape)', { identity: fixtureStranger(), widgets: FULL, ...PHOTO, ownerCapability: HOST, ...HOST_ROW }, 'host'],
  ['the host · the text cover', { identity: fixtureStranger(), ownerCapability: HOST, ...HOST_ROW }, 'host'],
] as const;

for (const [who, props, kind] of READERS) {
  test(`${who}: the cover’s button goes straight to the RSVP page — no stop at an RSVP part`, async () => {
    const page = await renderSiteBodyFixtureFull(props as never);
    assert.deepEqual(page.complaints, [], 'React or the page complained while rendering');
    const html = page.html;
    const head = coverOf(html).html;
    const button = /<a [^>]*data-cover-rsvp="ask"[^>]*>/.exec(head)?.[0];
    assert.ok(button, 'anti-vacuity: no RSVP button on the cover');
    const href = /href="([^"]*)"/.exec(button!)![1]!;
    assert.ok(!href.startsWith('#'), `the cover’s button still stops at an RSVP part on the page (${href}) — the owner asked for the RSVP page`);
    assert.equal(href, REPLY, `the cover’s button goes to ${href}, not to the RSVP page`);
    // The RSVP part the button used to stop at is still on the page, for a reader who goes there (Me's Reply / the card).
    const PART = kind === 'guest' ? 'me-reply' : COVER_RSVP_PART;
    assert.equal(html.split(`id="${PART}"`).length - 1, 1, `the ${kind === 'guest' ? 'Me' : 'host’s'} Reply is no longer on the page`);
    const at = html.indexOf(`id="${PART}"`);
    const part = html.slice(html.lastIndexOf('<', at), html.indexOf('</div>', html.indexOf('</a>', at)) + 6);
    assert.equal(/<a [^>]*href="([^"]*)"/.exec(part)?.[1], REPLY, 'the RSVP part’s own Reply no longer opens the reply page');
  });
}

test('a stranger (no seat, no pass) is never handed a cover button into the reply page — it would send them home', async () => {
  // The bounce itself, as the reply page decides it for a reader it does not know.
  assert.deepEqual(replyEntry({ slug: 'cale-ice', hasPass: false, code: null }), { kind: 'door', href: '/cale-ice' });
  for (const props of [
    { identity: fixtureStranger() },
    { identity: fixtureStranger(), ...PHOTO },
  ]) {
    const { html } = await renderSiteBodyFixtureFull(props as never);
    const head = coverOf(html).html;
    assert.ok(head.length > 100, 'anti-vacuity: no cover');
    assert.doesNotMatch(head, new RegExp(`<a [^>]*data-cover-rsvp="[^"]*"[^>]*href="${REPLY}"`), 'a reader with no pass is sent from the cover to the reply page');
  }
});

test('the glide is gone — nothing on the cover stops the tap on its way to the reply page', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const foot = readFileSync(join(__dirname, 'pahina-masthead.tsx'), 'utf8');
  assert.doesNotMatch(foot, /CoverRsvpGoes/, 'the cover still mounts the in-page glide');
  assert.ok(!existsSync(join(__dirname, 'cover-rsvp-goes.tsx')), 'the in-page glide is back — the button no longer stops on the page');
  // The one decision: a reply state's href is the Reply card's own — the reply page — never a mark on the page.
  const decide = readFileSync(join(__dirname, '..', '..', '..', 'lib', 'cover-rsvp.ts'), 'utf8');
  assert.match(decide, /return \{ kind: c\.kind, href: c\.href \};/, 'coverRsvpOf no longer hands the button the card’s own href');
  assert.doesNotMatch(decide, /toPart|partHref/, 'coverRsvpOf can still send the button to a part of the page');
});
