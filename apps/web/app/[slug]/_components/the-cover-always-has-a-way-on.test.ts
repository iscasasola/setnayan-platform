/**
 * the-cover-always-has-a-way-on.test.ts — 🦶 NO FIRST SCREEN ENDS WITH NEITHER A DOOR NOR A FOOT, AND THE DOOR IS NEVER
 * DRAWN TWICE.
 *
 * Live on `/cale-ice`, 2026-10-17, signed out (owner: *"where is the RSVP and swipe marker?"* · *"the button shows after
 * the cover?"*). Since the Cover Scene took the whole first screen (`min-h` 100svh), the stranger's cover was drawn with
 * `foot={false}` — no RSVP button, no "Swipe up" hint — on the belief that its ONE door ("Get inside") was docked under
 * it. It was not on the first screen at all: the photo cover stands in the page's first group and the door in the next,
 * so the door began exactly at the fold (y 812 of 812 at 375, y 800 of 800 at 1280, measured). A first screen that
 * ended in nothing.
 *
 * The rule now (owner 2026-10-17, and the one-button rule of 2026-09-26/27): every cover has its foot. A stranger's
 * door stands IN the foot, where a guest's RSVP button stands — in its place, never beside it — reading "Confirm your
 * Booking" (owner: *"Change the button to 'Confirm your Booking'"*), with the hint under it; it is not drawn again below.
 * A viewer of that tree who meets no door (the host) gets the RSVP button to the shipped reply door instead.
 *
 * A PROPERTY, rendered on the REAL page (`SiteBody`, the fixture invitation) for every viewer the stranger's tree and
 * the guest's tree draw — not a phrasing of the source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSiteBodyFixtureFull } from '@/lib/site-body-fixture-render';
import { fixtureStranger, fixtureWidgets, siteBodyFixtureProps } from '@/lib/site-body-fixture';
import { COVER_LINE_ATTR } from '@/lib/hub-veil';
import { STRANGER_DOOR_WORDS } from './get-inside';

const FULL = fixtureWidgets({ hero: { ground: { kind: 'color', color: '#3a4a5a', shape: 'full' } } });
const PHOTO = { heroPhotoUrl: 'https://cdn.test/fixture-hero.jpg' } as const;
const HOST = { capability: 'owner', ownerUserId: 'lab-host', ownerEventId: siteBodyFixtureProps().event.event_id, maySiteEdit: true } as const;

/** Each viewer, and what its foot must hold: the stranger's ONE door, or the RSVP button. */
const VIEWERS = [
  ['a stranger · the photo cover (cale-ice’s shape)', { identity: fixtureStranger(), widgets: FULL, ...PHOTO }, 'door'],
  ['a stranger · the text cover, no ground (maria-and-jose’s shape)', { identity: fixtureStranger() }, 'door'],
  ['a stranger · the text cover, a full ground', { identity: fixtureStranger(), widgets: FULL }, 'door'],
  ['a stranger · the photo cover, no ground', { identity: fixtureStranger(), ...PHOTO }, 'door'],
  ['a stranger holding a replaced key', { identity: { ...fixtureStranger(), reason: 'invalid_invite' as const }, widgets: FULL }, 'door'],
  ['a signed-in stranger not on the list', { identity: { ...fixtureStranger(), signedInNotListed: true }, widgets: FULL }, 'door'],
  ['the host on their own page', { identity: fixtureStranger(), widgets: FULL, ownerCapability: HOST }, 'rsvp'],
  ['the host · the photo cover', { identity: fixtureStranger(), ...PHOTO, ownerCapability: HOST }, 'rsvp'],
  ['a guest with a key', { widgets: FULL, guestStages: true }, 'rsvp'],
] as const;

/** Every cover header on the page, whole. */
function covers(html: string): string[] {
  const out: string[] = [];
  for (let at = html.indexOf('<header data-pahina-first-screen=""'); at >= 0; at = html.indexOf('<header data-pahina-first-screen=""', at + 1)) {
    out.push(html.slice(at, html.indexOf('</header>', at) + '</header>'.length));
  }
  return out;
}

for (const [who, props, way] of VIEWERS) {
  test(`${who}: the first screen ends in its foot — ${way === 'door' ? 'the ONE door' : 'the RSVP button'} and the hint`, async () => {
    const page = await renderSiteBodyFixtureFull(props as never);
    assert.deepEqual(page.complaints, [], 'React or the page complained while rendering');
    const heads = covers(page.html);
    assert.ok(heads.length >= 1, 'anti-vacuity: no cover on the page');
    for (const head of heads) {
      const foot = head.lastIndexOf('<div data-cover-foot=""');
      assert.ok(foot > 0, 'a cover with no foot — its first screen ends in nothing');
      assert.match(head.slice(foot), /^<div data-cover-foot=""[^>]*class="mt-auto[\s\S]*<\/div><\/header>$/, 'the foot is not the last thing on the cover');
      const footHtml = head.slice(foot);
      assert.match(footHtml, /data-cover-hint=""[^>]*>[\s\S]*Swipe up for the event/, 'the foot has no "Swipe up" hint');
      const doorHere = footHtml.includes('data-get-inside=');
      const rsvpHere = /data-cover-rsvp="/.test(footHtml);
      assert.ok(doorHere || rsvpHere, 'the foot holds neither a door nor the RSVP button — no way on');
      assert.ok(!(doorHere && rsvpHere), 'the foot holds the door AND the RSVP button — two ways in (owner 2026-09-26/27, one button)');
      assert.equal(doorHere ? 'door' : 'rsvp', way, `the foot holds the ${doorHere ? 'door' : 'RSVP button'}, not the ${way}`);
      if (doorHere) {
        // Behind a closed veil the door waits for the unveil, like the button it stands in for: it is a cover line.
        assert.match(footHtml, new RegExp(`<div ${COVER_LINE_ATTR}="\\w*" data-cover-door=""`), 'the door in the foot is no cover line — it would show behind the veil');
        // The signed-out door reads the owner's words; a signed-in stranger's is "Ask to join" / the list-only line.
        if (footHtml.includes('data-get-inside="door"')) assert.ok(footHtml.includes(`>${STRANGER_DOOR_WORDS}<`), `the door does not read "${STRANGER_DOOR_WORDS}"`);
      }
    }
    // NEVER TWICE: one door on the whole page at most, and, where the cover holds it, none after the cover.
    assert.ok(page.html.split('data-get-inside=').length - 1 <= 1, 'the stranger’s door is drawn twice');
    if (way === 'door') assert.ok(page.html.includes('data-get-inside='), 'anti-vacuity: a stranger with no door');
    assert.equal(page.html.includes('>Get inside<'), false, 'the door still reads its old words');
    if (way === 'door') {
      const lastCover = page.html.lastIndexOf('</header>');
      assert.ok(!page.html.slice(lastCover).includes('data-get-inside='), 'a second door under the cover');
    }
  });
}

test('the door that stands in the foot is not fitted around — the fit is only for a door below a cover', async () => {
  const page = await renderSiteBodyFixtureFull({ identity: fixtureStranger(), widgets: FULL });
  const door = /<details class="([^"]*)" data-get-inside="door"/.exec(page.html)?.[1] ?? '';
  assert.ok(door, 'anti-vacuity: no door');
  assert.ok(!door.split(' ').includes('sn-door-dock'), 'the door in the foot is docked — the first-screen fit would move the cover around a door already at its foot');
});

test('on a dark ground the foot’s framed button keeps a label you can read, and the foot rests above the cookie notice', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const css = readFileSync(join(__dirname, '..', '..', 'globals.css'), 'utf8');
  // The cream tone repaints mulberry as the paper; `.button-primary`'s label is cream (white) — blank pill without this.
  const rule = /header\[data-cover-tone='cream'\] \[data-cover-foot\] \.button-primary \{\s*color: ([^;]+);/.exec(css);
  assert.ok(rule, 'no label colour for the foot’s button on a dark ground — "Confirm your Booking" is white on paper');
  assert.doesNotMatch(rule![1]!, /cream|255 255 255|#fff/i, 'the foot’s button label is the same white as its paper');
  const page = await renderSiteBodyFixtureFull({ identity: fixtureStranger(), widgets: FULL });
  assert.match(page.html, /<header [^>]*data-cover-tone="cream"[\s\S]*?<div data-cover-foot=""[\s\S]*?class="button-primary/, 'anti-vacuity: the dark-ground stranger cover has no framed button in its foot');
  // The first screen ends above the first-visit notice while it is up: the cover's height subtracts it.
  assert.match(css, /\[data-page-column\] \{[^}]*--cover-scene-above: var\(--cookie-banner-top, 0px\);/, 'the cover’s foot rests under the first-visit cookie notice');
});
