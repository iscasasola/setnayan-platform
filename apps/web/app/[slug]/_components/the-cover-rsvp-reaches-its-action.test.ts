/**
 * the-cover-rsvp-reaches-its-action.test.ts — 🧭 A TAP ON THE COVER'S RSVP BUTTON REACHES ITS ACTION.
 *
 * Live on `/cale-ice`, 2026-10-17 (owner, signed in as its host: *"confirm attendance is not doing anything?"* · then
 * *"it is not going to the RSVP part?"*). Measured: the tap was NOT swallowed — no layer, veil, drape or handler
 * stopped it (lab, Chromium 375/1280 + WebKit 375: the click reached the link, `defaultPrevented` false, the browser
 * navigated). It went to `/cale-ice/invite/reply`, and the reply page keeps only a reader who holds a guest pass for
 * the event (`replyEntry`, lib/guest-pass-hop.ts): the host holds none, so `GET /cale-ice/invite/reply` → 307 →
 * `/cale-ice` — the tap reloaded the cover it was pressed on.
 *
 * The rule now (owner 2026-10-17): the button TAKES the reader to the page's RSVP part — the Reply card under the cover
 * (`COVER_RSVP_PART`) — and that card's own button opens the Reply in a form THIS reader can reach.
 *
 * A PROPERTY, on the REAL page (`SiteBody`, the fixture invitation), for every reader who meets the button:
 *   · the cover's button is an in-page link to an element that IS on this page, with the RSVP part's id;
 *   · that part holds a link into the Reply that this reader is not bounced from — a guest (who holds the pass) to
 *     the reply page — and the host to the SAME reply page, which since 2026-10-24 replies as the host's OWN row
 *     (`readReplyIdentityForEvent`). It used to open the reply's host preview (`?preview=draft`), whose sample guest is
 *     named after a real guest — the owner was asked to answer "Gabriel dela Peña"'s RSVP
 *     (`lib/the-reply-is-sent-as-who-the-hub-says.test.ts`);
 *   · the glide that makes the jump smooth is mounted (and the plain link still works without it);
 *   · nobody without a guest pass is handed a cover button straight into the reply page (it would bounce them).
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
  test(`${who}: the cover’s button goes to the RSVP part on this page, and the part opens a Reply this reader can reach`, async () => {
    const page = await renderSiteBodyFixtureFull(props as never);
    assert.deepEqual(page.complaints, [], 'React or the page complained while rendering');
    const html = page.html;
    const cover = coverOf(html);
    const head = cover.html;
    const button = /<a [^>]*data-cover-rsvp="ask"[^>]*>/.exec(head)?.[0];
    assert.ok(button, 'anti-vacuity: no RSVP button on the cover');
    const href = /href="([^"]*)"/.exec(button!)![1]!;
    /* 🔁 2026-10-24 (owner, the Me redraw — one place): a guest's RSVP part is Me's one Reply (`#me-reply`, on the Me
       tab — the hub shell opens that tab at it); the host's page has no Me, and keeps its card under the cover. */
    const PART = kind === 'guest' ? 'me-reply' : COVER_RSVP_PART;
    assert.equal(href, `#${PART}`, `the cover’s button goes to ${href}, not to the page’s RSVP part`);
    // The part is ON this page, after the cover, exactly once.
    assert.equal(html.split(`id="${PART}"`).length - 1, 1, 'the RSVP part is not on the page exactly once — the button leads nowhere');
    const at = html.indexOf(`id="${PART}"`);
    assert.ok(at > cover.end, 'the RSVP part is not under the cover');
    if (kind === 'guest') {
      const meTab = html.lastIndexOf('data-hub-tab="me"', at);
      assert.ok(meTab > cover.end, 'Me’s Reply is not on the Me tab — the shell has no tab to open at it');
      assert.ok(!html.includes(`id="${COVER_RSVP_PART}"`), 'the Welcome still draws a second RSVP part');
    }
    const partTag = html.lastIndexOf('<', at);
    const part = html.slice(partTag, html.indexOf('</div>', html.indexOf('</a>', at)) + 6);
    const into = /<a [^>]*href="([^"]*)"/.exec(part)?.[1];
    assert.ok(into, 'the RSVP part holds no way into the Reply — the reader lands on nothing to press');
    if (kind === 'guest') assert.equal(into, REPLY, 'the guest’s RSVP part does not open the reply page');
    else assert.equal(into, REPLY, 'the host’s RSVP part does not open the plain reply page — the one that replies as the host’s own row (a `?preview=draft` here is the Maker’s sample, named after a real guest)');
  });
}

test('nobody without a guest pass is handed a cover button straight into the reply page — it would bounce them home', async () => {
  // The bounce itself, as the reply page decides it.
  assert.deepEqual(replyEntry({ slug: 'cale-ice', hasPass: false, code: null }), { kind: 'door', href: '/cale-ice' });
  for (const props of [
    { identity: fixtureStranger(), ownerCapability: HOST },
    { identity: fixtureStranger(), widgets: FULL, ...PHOTO, ownerCapability: HOST },
    { identity: fixtureStranger() },
    { identity: fixtureStranger(), ...PHOTO },
  ]) {
    const { html } = await renderSiteBodyFixtureFull(props as never);
    const head = coverOf(html).html;
    assert.ok(head.length > 100, 'anti-vacuity: no cover');
    assert.doesNotMatch(head, new RegExp(`<a [^>]*data-cover-rsvp="[^"]*"[^>]*href="${REPLY}"`), 'a reader with no pass is sent from the cover to the reply page');
  }
});

test('the glide is mounted by the foot whenever its button is an in-page link, and it never blocks the plain link', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const foot = readFileSync(join(__dirname, 'pahina-masthead.tsx'), 'utf8');
  assert.match(foot, /rsvp\.href\.startsWith\('#'\) \? <CoverRsvpGoes \/> : null/, 'the foot no longer mounts the glide for an in-page button');
  const glide = readFileSync(join(__dirname, 'cover-rsvp-goes.tsx'), 'utf8');
  // It only steps in when the part exists — otherwise the browser's own jump (or navigation) stands.
  assert.match(glide, /if \(!part\) return;[^\n]*\n[\s\S]{0,200}?if \(part\.closest\('\[hidden\]'\)\) return;\s*e\.preventDefault\(\);/, 'the glide prevents the jump before it has found the part — or takes a part on another tab (Me’s Reply) from the shell');
  // It listens on the document, so nothing laid over the button's words can stand between the tap and the move.
  assert.match(glide, /document\.addEventListener\('click', onClick\)/);
});
