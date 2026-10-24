/**
 * me-is-the-one-place.test.ts — INVITATION › ME IS THE ONE PLACE FOR EVERYTHING ABOUT THE GUEST (owner 2026-10-24:
 * "Approve the corrected Me redesign. Build it." — `Setnayan/prototypes/me_tab_redraw_2026-10-24_fable.html`).
 *
 * Held on THE REAL GUEST PAGE (`SiteBody`, the fixture invitation, a tabbed Invitation):
 *   (1) Me reads top to bottom: who (the formal name), as what (the role), when and where (date, Ceremony /
 *       Reception) · the guest's own sections · the ONE Reply (`#me-reply`) · the record line and the two pills;
 *   (2) ONE Reply on the page: the cover's button is a mark on Me (`#me-reply`), the Welcome draws no Reply card and
 *       no greeting paragraph, Me draws no second door (no top-of-Me card, no ticket "Reply to the invitation", no
 *       "Change your reply" bar) — exactly one link into the reply page, and it is Me's;
 *   (3) after a yes the same spot reads "You're coming ✓ · Change my reply";
 *   (4) the record notice says "at this event" — never the event type's word;
 *   (5) the rules: a plain guest has no role line; the role line carries no colour dots; one place for both venues is
 *       one line.
 *
 * Sabotages seen red (each restored): the Welcome's Reply card put back on the tabbed page ((2) red) · the ticket's
 * reply bar put back ((2) red) · the record line back on `w.eventWord` ((4) red) · MeReply drawn before the greeting
 * ((1) red).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSiteBodyFixture } from './site-body-fixture-render';
import { siteBodyFixtureProps } from './site-body-fixture';
import { guestGreetingOf } from './guest-greeting';
import { scanTrailLines } from './scan-trail-words';
import { stripComments } from './strip-comments';

/** The fixture's guest, given a role (the sample guest is a plain guest, who has no role line). */
const asBestWoman = (patch: Record<string, unknown> = {}) => {
  const base = siteBodyFixtureProps().identity as { guest: Record<string, unknown> };
  return { ...base, guest: { ...base.guest, role: 'best_woman', side: 'groom', ...patch } } as never;
};
const meOf = (html: string) => {
  const at = html.indexOf('data-me-stage=""');
  assert.ok(at > 0, 'anti-vacuity: no Me on the page');
  return html.slice(at);
};

test('(1) Me reads who · as what · when and where · their sections · the one Reply · the record and the pills', async () => {
  const html = await renderSiteBodyFixture({ guestStages: true, identity: asBestWoman() });
  const me = meOf(html);
  const order = ['data-greeting-eyebrow', 'data-greeting-name', 'data-greeting-role', 'data-greeting-date', 'data-greeting-venues', 'id="me-reply"', 'data-me-foot'];
  let last = -1;
  for (const mark of order) {
    const i = me.indexOf(mark);
    assert.ok(i > last, `${mark} is missing from Me or out of the prototype’s order`);
    last = i;
  }
  assert.match(me, /Your invitation/);
  assert.match(me, /Will you join us\?/);
});

test('(2) ONE Reply: the cover’s button is a mark on Me, and no second door is drawn anywhere', async () => {
  const html = await renderSiteBodyFixture({ guestStages: true, identity: asBestWoman() });
  const cover = html.slice(html.indexOf('<header data-pahina-first-screen=""'), html.indexOf('</header>', html.indexOf('<header data-pahina-first-screen=""')));
  assert.match(cover, /data-cover-rsvp="ask"[^>]*href="#me-reply"|href="#me-reply"[^>]*data-cover-rsvp="ask"/, 'the cover’s RSVP button does not open Me at its Reply');
  assert.ok(!html.includes('id="site-reply"'), 'the Welcome still draws its own Reply card');
  assert.ok(!/joining us as|love to celebrate with you|hope you can be with us/.test(html), 'the Welcome’s greeting paragraph is back');
  assert.ok(!html.includes('data-me-change-reply'), 'the "Change your reply" bar is back');
  assert.ok(!html.includes('data-me-reply=""'), 'the ticket’s "Reply to the invitation" bar is back');
  const doors = html.match(/href="[^"]*\/invite\/reply[^"]*"/g) ?? [];
  assert.equal(doors.length, 1, `the page holds ${doors.length} doors into the reply page — one, Me’s, is the rule`);
  const meDoor = meOf(html).indexOf('/invite/reply');
  assert.ok(meDoor > 0, 'the one door is not Me’s');
  // …and on a page without the new guest side (no cover button): the Welcome's one action opens Me's Reply too.
  const plain = await renderSiteBodyFixture({ identity: asBestWoman() });
  const plainDoors = plain.match(/href="[^"]*\/invite\/reply[^"]*"/g) ?? [];
  assert.equal(plainDoors.length, 1, `without the guest side the page holds ${plainDoors.length} doors into the reply page`);
  assert.match(plain, /data-arrival-action="ask"[^>]*>\s*<a [^>]*href="#me-reply"/, 'the Welcome’s action does not open Me’s Reply');
});

test('(3) after a yes: "You’re coming ✓ · Change my reply", in the same spot', async () => {
  const html = await renderSiteBodyFixture({ guestStages: true, identity: asBestWoman({ rsvp_status: 'attending' }) });
  const me = meOf(html);
  const foot = me.slice(me.indexOf('id="me-reply"'));
  assert.match(foot, /You’re coming/);
  assert.match(foot, /✓/);
  assert.match(foot, /Change my reply/);
  assert.ok(!html.includes('id="site-reply"'), 'a second Reply card after a yes');
});

test('(4) the record notice says "at this event" — never the event type’s word', () => {
  for (const said of [scanTrailLines(null), scanTrailLines(true), scanTrailLines(false)]) {
    assert.match(said.main, /at this event\./);
    assert.doesNotMatch(`${said.main} ${said.more ?? ''}`, /wedding|celebration/i);
  }
  const src = stripComments(readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'scan-trail-notice.tsx'), 'utf8'));
  assert.doesNotMatch(src, /eventWord/, 'the record notice reads the event type’s word again');
});

test('(5) the greeting’s rules', () => {
  const base = {
    name: 'Atty. Indalecia S. Casasola',
    roleCode: 'best_woman',
    roleWord: 'Best Woman',
    sideLabel: "Groom's side",
    date: 'December 18, 2026',
    venues: [
      { role: 'ceremony' as const, name: 'Santuario de San Vicente de Paul Parish' },
      { role: 'reception' as const, name: 'Seda Hotel Vertis North' },
    ],
    venueName: null,
  };
  const g = guestGreetingOf(base);
  assert.equal(g.eyebrow, 'Your invitation');
  assert.equal(g.role, 'Best Woman');
  assert.equal(g.tail, "Groom's side");
  assert.ok(!('dots' in g), 'the role line carries colour dots — the colours are named in What to wear');
  const plain = guestGreetingOf({ ...base, roleCode: 'guest', roleWord: 'Guest' });
  assert.equal(plain.role, null, 'a plain guest is given a "Guest" badge');
  assert.equal(plain.tail, null);
  assert.deepEqual(guestGreetingOf({ ...base, venues: [{ role: 'both', name: 'Seda' }] }).venues, [{ label: 'Ceremony & Reception', name: 'Seda' }]);
});
