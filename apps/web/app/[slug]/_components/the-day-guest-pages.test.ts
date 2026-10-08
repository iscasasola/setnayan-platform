/**
 * 📱 THE DAY — THE GUEST'S PHONE PAGES (P9). Owner 2026-10-01, DECISION_LOG
 * "THE DAY GUEST PAGES — APPROVED, WITH ANSWERS" + "THE EVENT HUB IS FULL
 * SCREEN WITH ONE EXIT · CAMERA EXIT → LIVE · GALLERY = YOUR SHOTS + PHOTOS OF
 * YOU (ALL ONLY IF SHARED)"; prototype the_day_guest_phone_2026-10-01_fable.html.
 *
 * REACHABLE, NOT JUST BUILT (owner 2026-10-02): each part is RENDERED here, and
 * the page is checked to mount it where the design draws it — a component no
 * page draws is the "built but not there" this rule exists for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const h = React.createElement;
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const src = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));
const BODY = () => src('app/[slug]/_components/site-body.tsx');

// ── WELCOME: "Table N" + the floor plan with YOU ──────────────────────────────

test('the floor plan is the seat plan’s own renderer, and only the guest’s table says YOU', async () => {
  const { seatPlanPreviewSvg } = await import('@/lib/seat-plan-preview-svg');
  const { DEFAULT_FLOOR_PLAN } = await import('@/lib/seating');
  const t = (id: string, label: string, x: number) => ({
    table_id: id,
    public_id: id,
    event_id: 'e',
    table_label: label,
    table_type: 'round_10' as never,
    capacity: 10,
    sort_order: 0,
    x_pos: x,
    y_pos: 50,
  });
  const base = {
    tables: [t('t1', 'Table 1', 20), t('t7', 'Table 7', 70)],
    floorPlan: DEFAULT_FLOOR_PLAN,
    seatedByTable: new Map([['t7', 3]]),
    mode: 'moodboard' as const,
    palette: [],
  };
  const mine = seatPlanPreviewSvg({ ...base, youTableId: 't7', fluid: true });
  assert.equal((mine.match(/data-you=""/g) ?? []).length, 1, 'one YOU ring, on one table');
  assert.match(mine, />YOU<\/text>/);
  assert.match(mine, /width="100%"/, 'fills the phone, not the 420px thumbnail');
  // The prints and thumbnails pass no reader — byte-for-byte what they were.
  const print = seatPlanPreviewSvg(base);
  assert.doesNotMatch(print, /YOU|data-you/);
  assert.match(print, /width="420" height="300"/);
  // Move the input, the output moves: a different reader is marked elsewhere.
  assert.notEqual(seatPlanPreviewSvg({ ...base, youTableId: 't1' }), seatPlanPreviewSvg({ ...base, youTableId: 't7' }));
});

test('Welcome draws "Your table · Table 7", the plan (pinch to zoom) and the way to the ticket in Me', async () => {
  const { YourSeatBlock } = await import('./your-seat-block');
  const plan = '<svg xmlns="http://www.w3.org/2000/svg"><circle data-you=""/></svg>';
  const out = html(h(YourSeatBlock, { tableLabel: 'Table 7', venueName: 'Manila Hotel', plan, arrived: false }));
  assert.match(out, /Your table/);
  assert.match(out, />Table 7</);
  assert.match(out, /data-allow-zoom=""/, 'pinch is handed back to the browser on the plan');
  assert.match(out, /Pinch to zoom/);
  assert.match(out, /data-you=""/, 'the plan arrived on the page');
  assert.match(out, /href="\?tab=me"[^>]*>It(’|&#x27;|&rsquo;|')s on your ticket in Me/);
  // Replace means remove: the wayfinding map's path line is gone.
  assert.doesNotMatch(out, /dotted path/);
  // The venue is Welcome's own part, further down — not repeated at the table.
  assert.doesNotMatch(out, /Manila Hotel/);
  const s = src('app/[slug]/_components/your-seat-styles.tsx') + src('app/[slug]/_components/your-seat-block.tsx');
  assert.doesNotMatch(s, /WayfindingMap/, 'the replaced map came back into the seat block');
  // REACHED: the loader draws the plan with THIS guest's table, and the page hands it in.
  const loaders = src('app/[slug]/_lib/loaders.ts');
  assert.match(loaders, /seatPlanPreviewSvg\(\{[\s\S]{0,400}youTableId: guestTableId/);
  assert.match(BODY(), /<YourSeatBlock[\s\S]{0,200}plan=\{seatMap\.plan\}/);
});

// ── WELCOME, SCROLLED: the walking order, the ONE venue, E-Gifts ──────────────

test('the day’s Welcome runs look · reminders · walking order · venue · E-Gifts', async () => {
  const { welcomePartsOnTheDay } = await import('@/lib/invitation-welcome');
  const day = {
    bodyNormal: true,
    identified: true,
    dressCodeOn: true,
    remindersOn: true,
    reminders: 'Dinner is at 6:00',
    giftHref: '/ana/pabuya',
    maker: false,
  };
  assert.deepEqual(welcomePartsOnTheDay({ ...day, march: true, venue: true }), ['look', 'reminders', 'march', 'venue', 'gifts']);
  assert.deepEqual(welcomePartsOnTheDay({ ...day, march: false, venue: false }), ['look', 'reminders', 'gifts'], 'no walk set → no walk');
  assert.deepEqual(welcomePartsOnTheDay({ ...day, march: true, venue: true, maker: true }), [], 'never the Maker canvas');

  const { GuestWelcome } = await import('./guest-welcome');
  const out = html(
    h(GuestWelcome, {
      parts: ['march', 'venue'],
      words: {} as never,
      look: null,
      reminders: null,
      march: h('section', { id: 'site-entourage' }, 'Parents'),
      venue: h('section', { 'data-day-directions': '' }, 'Reception'),
      giftHref: null,
    }),
  );
  assert.ok(out.indexOf('site-entourage') > 0 && out.indexOf('site-entourage') < out.indexOf('data-day-directions'), 'the walk, then the venue');

  // REACHED: the guest tree hands Welcome the entourage and the ONE venue, and
  // the walk leaves Live when Welcome carries it (one place on the page).
  const body = BODY();
  assert.match(body, /march=\{marchOnWelcome \? guestEntourage : null\}/);
  assert.match(body, /venue=\{<DayDirections venues=\{dayVenues\} \/>\}/);
  /* 📱 2026-10-08 (owner, DECISION_LOG "EIGHT OWNER ANSWERS" answer 5 — the guest's pages follow the Maker's
     filing): the walk also leaves this group when its own tab is another one (`marchTab`, the one filing). The
     property is unchanged — one place on the page — and both slots are counted. */
  assert.match(body, /\{marchOnWelcome \|\| marchTab !== hereTab \? null : guestEntourage\}/);
  assert.match(body, /\{marchOnWelcome \|\| marchTab === hereTab \? null : group\(marchTab, guestEntourage,/);
});

test('one venue is labelled with its role, so the guest knows which of the two it is', async () => {
  const { DayDirections } = await import('./day-directions');
  const out = html(
    h(DayDirections, {
      venues: [{ role: 'reception', name: 'Manila Hotel', address: 'One Rizal Park', latitude: 14.58, longitude: 120.97 }],
    }),
  );
  assert.match(out, /Getting there · Reception/);
  assert.equal((out.match(/data-venue-role=/g) ?? []).length, 1);
});

// ── GALLERY: your shots + photos of you; everyone's only when shared ───────────

test('Your shots: three states, three sets of words — and everyone’s only behind the shared switch', async () => {
  const { YourShotsGallery } = await import('./your-shots-gallery');
  const failed = html(h(YourShotsGallery, { shots: null, qrToken: 'q', cameraOn: true, everyoneHref: null }));
  assert.match(failed, /couldn(’|&#x27;|&rsquo;|')t load your shots/);
  const empty = html(h(YourShotsGallery, { shots: { shots: [], total: 0 }, qrToken: 'q', cameraOn: true, everyoneHref: null }));
  assert.match(empty, /land here/);
  assert.equal(
    html(h(YourShotsGallery, { shots: { shots: [], total: 0 }, qrToken: 'q', cameraOn: false, everyoneHref: null })),
    '',
    'no camera, nothing shot, nothing shared → nothing drawn',
  );
  const some = html(
    h(YourShotsGallery, {
      shots: { shots: [{ id: 'c1', url: 'https://x/1.avif', capturedAt: null }], total: 14 },
      qrToken: 'tok',
      cameraOn: true,
      everyoneHref: null,
    }),
  );
  assert.match(some, />14</, 'the count is the read’s own total');
  assert.match(some, /href="\/papic\/me\/tok\/photo\?id=c1&amp;src=guest"/, 'a guest saves their own shot');
  assert.doesNotMatch(some, /Everyone/, 'not shared → no way into everyone’s photos');
  const shared = html(
    h(YourShotsGallery, { shots: { shots: [], total: 0 }, qrToken: 'tok', cameraOn: true, everyoneHref: '/papic/me/tok/session?next=pool' }),
  );
  assert.match(shared, /data-everyones-photos=""/);

  // REACHED: the Gallery tab mounts it, gated on the SHIPPED switch, never a new one.
  const body = BODY();
  assert.match(body, /<YourShotsGallery[\s\S]{0,300}everyoneHref=\{poolGalleryOpen &&/);
  const loaders = src('app/[slug]/_lib/loaders.ts');
  assert.match(loaders, /papicPoolGalleryActive\(\)[\s\S]{0,300}pool_gallery_open/, 'the switch is events.pool_gallery_open, behind its gate');
  // The venue wall is Live's now (prototype frame 1b), not the Gallery's.
  assert.match(body, /\{group\('live', isLive && liveWall && !\(tabs\.on && liveHubArranged\)/);
  // …and the save route admits a guest's own shot as well as a photo of them.
  const route = src('app/papic/me/[token]/photo/route.ts');
  assert.match(route, /if \(!tag && !own\)/);
});

// ── CAMERA: one ×, back to where they were, "N photos added · See them" ───────

test('the camera comes back to the tab it was opened from — Live when opened directly', async () => {
  const { cameraHrefWithBack, cameraExitHref, cameraBackTab, addedShots } = await import('../_lib/hub-tabs');
  const door = '/papic/me/T/session?next=guest&from=ana';
  assert.equal(cameraHrefWithBack(door, 'gallery'), `${door}&back=gallery`);
  assert.equal(cameraHrefWithBack('/papic/me/T', 'gallery'), '/papic/me/T', 'no event to return to → unchanged');
  assert.equal(cameraExitHref('ana', 'welcome', 3), '/ana?tab=live&added=3', 'a word that is not a tab is not an address');
  assert.equal(cameraExitHref('ana', 'home', 3), '/ana?tab=home&added=3');
  assert.equal(cameraExitHref('ana', null, 0), '/ana?tab=live', 'opened directly → Live, and no note for nothing');
  assert.equal(cameraExitHref('ana', 'me', 2, 'gallery'), '/ana?tab=gallery&added=2', 'the thumbnail opens their shots');
  assert.equal(cameraBackTab('../../evil'), null);
  assert.equal(addedShots('3'), 3);
  assert.equal(addedShots('0'), null);
  assert.equal(addedShots('9999'), null);
  assert.equal(addedShots('<b>'), null);

  // REACHED: the bar carries the tab, the bridge passes it, the camera draws
  // the × and the thumbnail, and the page says what landed.
  assert.match(src('app/[slug]/_components/site-menu-bar.tsx'), /cameraHrefWithBack\(slot\.href, activeKey\)/);
  assert.match(BODY(), /camera: papicGuest\s*\?\s*`\/papic\/me\/\$\{encodeURIComponent\(guest\.qr_token\)\}\/session\?next=guest&from=/);
  assert.match(src('app/papic/me/[token]/session/route.ts'), /cameraBackTab\(url\.searchParams\.get\(CAMERA_BACK_PARAM\)\)/);
  const cam = src('app/papic/guest/_components/papic-guest-capture.tsx');
  assert.match(cam, /data-camera-exit=""[\s\S]{0,80}href=\{cameraExitHref\(exitTo\.slug, exitTo\.tab, added\)\}/);
  assert.match(cam, /data-camera-thumb=""[\s\S]{0,80}href=\{cameraExitHref\(exitTo\.slug, null, added, 'gallery'\)\}/);
  assert.match(src('app/papic/guest/page.tsx'), /exitTo=\{backSlug \? \{ slug: backSlug, tab: backTab \} : null\}/);
  const body = BODY();
  assert.match(body, /data-shots-added=""[\s\S]{0,900}See them/);
  assert.match(src('app/[slug]/page.tsx'), /shotsAdded: addedShots\(search\[CAMERA_ADDED_PARAM\]\)/);
});

// ── FULL SCREEN WITH ONE EXIT ──────────────────────────────────────────────────

test('the Event Hub has one × top-left, back to Setnayan — and none in a Maker preview', async () => {
  const { InvitationShell } = await import('./invitation-shell');
  const withExit = html(h(InvitationShell, { exitHref: '/', children: h('p', null, 'x') } as never));
  assert.equal((withExit.match(/data-hub-exit=""/g) ?? []).length, 1);
  assert.match(withExit, /href="\/"[^>]*aria-label="Close — back to Setnayan"/);
  const none = html(h(InvitationShell, { children: h('p', null, 'x') } as never));
  assert.doesNotMatch(none, /data-hub-exit/);
  assert.match(BODY(), /exitHref=\{makerWayBack \|\| isMakerCanvas \? null : '\/'\}/);
});
