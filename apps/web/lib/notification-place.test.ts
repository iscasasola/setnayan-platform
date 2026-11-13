/**
 * notification-place.test.ts — EVERY NOTIFICATION SAYS WHICH PART IT IS FROM, AND NEVER GUESSES.
 *
 * Owner, 2026-11-13: *"how do we identify if it is from an event they are making or an event they are invited to or
 * a user notification … we need to be able to easily identify to see if they will jump to an event dashboard, or
 * their supplier dashboard, or something"*. Approved: `prototypes/notifications_place_2026-11-13` Option A.
 *
 * Runs the ONE rule (`lib/notification-place.ts`) the bell's row and the phone push both call:
 *   1 · each link prefix maps to its part — /dashboard/<uuid> → event, /vendor-dashboard → shop, else account;
 *   2 · /admin maps to Setnayan HQ (the push's old `subjectFor()` said "account" for these);
 *   3 · the stance: couple → "You organise", guest → "Invited" (eventStance, as Home's cards), no seat → none;
 *   4 · a place that cannot be said — the event removed, several shops, a failed read — is null, and a null place is
 *       drawn as "Place didn't load": never blank, never a guess;
 *   5 · the push title is the same place line, under 40, cutting the NAME at a word and never the stance;
 *   6 · 🔒 GUARD: the row's place line is never blank, for every part × every way its facts can fail — and the row
 *       component draws the place line from `placeLineWords`, so the guard holds the pixels, not a helper only.
 *
 * SABOTAGE (seen red, then restored): `resolveNotificationPlace` returning `{ name: '' … }` for a removed event
 * (4 + 6 red); `placeTitle` fitting the WHOLE "name · stance" string (5 red — the stance was cut).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PLACE_DIDNT_LOAD,
  eventStanceWords,
  notificationPart,
  opensWords,
  placeLineText,
  placeLineWords,
  placeMarkLetter,
  placeWhoFromSwitcher,
  resolveNotificationPlace,
  type EventPlaceFact,
  type NotificationPlaceFacts,
} from './notification-place';
import { PUSH_TITLE_MAX, placeTitle, pushMessage } from './push-message';
import { stripComments } from './strip-comments';

const EV = '11111111-2222-4333-8444-555555555555';
const EV2 = '66666666-2222-4333-8444-555555555555';

const fact = (over: Partial<EventPlaceFact> = {}): EventPlaceFact => ({
  event_id: EV,
  display_name: 'Maria & Jose',
  member_type: 'couple',
  monogram_text: 'M & J',
  monogram_color: null,
  monogram_font_key: null,
  monogram_style: null,
  monogram_frame_key: null,
  monogram_custom_svg: null,
  monogram_uploaded_svg: null,
  ...over,
});

const FACTS: NotificationPlaceFacts = {
  events: new Map([
    [EV, fact()],
    [EV2, fact({ event_id: EV2, display_name: 'Ana’s 30th', member_type: 'guest' })],
  ]),
  who: { photoUrl: null, initial: 'C', shops: [{ name: 'SetnaProd', logoUrl: null }] },
};

test('1 · each link prefix maps to its part', () => {
  assert.equal(notificationPart(`/dashboard/${EV}/guests`, null), 'event', 'an event link with no event_id is still an event');
  assert.equal(notificationPart(`/dashboard/${EV}`, EV), 'event');
  assert.equal(notificationPart('/ana-30th', EV2), 'event', 'a public page tagged with its event is the event');
  assert.equal(notificationPart('/vendor-dashboard', null), 'shop');
  assert.equal(notificationPart(`/vendor-dashboard/messages/${EV}`, EV), 'shop', 'a supplier-side link is the shop, even with an event');
  assert.equal(notificationPart('/dashboard?seg=people', null), 'account');
  assert.equal(notificationPart('/dashboard/people', null), 'account');
  assert.equal(notificationPart('/help', null), 'account');
  assert.equal(notificationPart(null, null), 'account');
});

test('2 · /admin maps to Setnayan HQ', () => {
  assert.equal(notificationPart('/admin', null), 'hq');
  assert.equal(notificationPart('/admin/payments', null), 'hq');
  const p = resolveNotificationPlace({ related_url: '/admin/payments', event_id: null }, FACTS);
  assert.equal(placeLineText(p), 'Setnayan HQ · Admin');
  assert.equal(opensWords(p, { related_url: '/admin/payments' }), 'Opens HQ › Payments');
});

test('3 · the stance: organiser · invited · helper · no seat', () => {
  assert.equal(eventStanceWords('couple'), 'You organise');
  assert.equal(eventStanceWords('guest'), 'Invited');
  assert.equal(eventStanceWords('coordinator'), 'You help');
  assert.equal(eventStanceWords('vendor'), null, 'a booking is not a seat');
  assert.equal(eventStanceWords(null), null);
  const mine = resolveNotificationPlace({ related_url: `/dashboard/${EV}/guests`, event_id: EV }, FACTS);
  assert.equal(placeLineText(mine), 'Maria & Jose · You organise');
  assert.equal(opensWords(mine, { related_url: `/dashboard/${EV}/guests`, event_id: EV }), 'Opens Maria & Jose › Guests');
  const invited = resolveNotificationPlace({ related_url: '/ana-30th', event_id: EV2 }, FACTS);
  assert.equal(placeLineText(invited), 'Ana’s 30th · Invited');
  assert.equal(opensWords(invited, { related_url: '/ana-30th', event_id: EV2 }), 'Opens Ana’s 30th — the event page');
  const shop = resolveNotificationPlace({ related_url: `/vendor-dashboard/messages/${EV}` }, FACTS);
  assert.equal(placeLineText(shop), 'SetnaProd · Your shop');
  // An event notice whose link is not the event's own (an invitation → /dashboard, a request from an event → People)
  // still names its event, and the ⓘ says where the press really lands.
  const invite = resolveNotificationPlace({ related_url: '/dashboard', event_id: EV2 }, FACTS);
  assert.equal(placeLineText(invite), 'Ana\u2019s 30th · Invited');
  assert.equal(opensWords(invite, { related_url: '/dashboard', event_id: EV2 }), 'Opens your events');
  const fromEvent = resolveNotificationPlace({ related_url: '/dashboard?seg=people', event_id: EV }, FACTS);
  assert.equal(placeLineText(fromEvent), 'Maria & Jose · You organise');
  assert.equal(opensWords(fromEvent, { related_url: '/dashboard?seg=people', event_id: EV }), 'Opens People');
  const me = resolveNotificationPlace({ related_url: '/dashboard?seg=people' }, FACTS);
  assert.equal(placeLineText(me), 'Your account');
  assert.equal(opensWords(me, { related_url: '/dashboard?seg=people' }), 'Opens People');
});

test('4 · a place that cannot be said is null, and is drawn as "Place didn’t load"', () => {
  // The event was removed: ON DELETE SET NULL left the link and dropped the id.
  const removed = { related_url: `/dashboard/${EV}/orders`, event_id: null };
  assert.equal(resolveNotificationPlace(removed, FACTS), null);
  assert.equal(opensWords(null, removed), 'This event was removed — the notice stays');
  // The batch read failed.
  assert.equal(resolveNotificationPlace({ related_url: `/dashboard/${EV}`, event_id: EV }, { events: null, who: FACTS.who }), null);
  // The event is not in what the read returned.
  assert.equal(resolveNotificationPlace({ related_url: `/dashboard/${EV}`, event_id: EV }, { events: new Map(), who: null }), null);
  // A helper on several shops: /vendor-dashboard/… names none.
  const two = { events: null, who: { photoUrl: null, initial: 'C', shops: [{ name: 'A', logoUrl: null }, { name: 'B', logoUrl: null }] } };
  assert.equal(resolveNotificationPlace({ related_url: '/vendor-dashboard/orders' }, two), null);
  // No facts at all.
  assert.equal(resolveNotificationPlace({ related_url: '/vendor-dashboard' }, null), null);
  // …and null is WORDS.
  assert.deepEqual(placeLineWords(null), { name: PLACE_DIDNT_LOAD, stance: null, missing: true });
  assert.equal(placeLineText(null), 'Place didn’t load');
});

test('5 · the push title is the place line — the name is cut at a word, the stance never', () => {
  const long = 'Indalecio Casasola & Claire Marie Villanueva-Santos';
  const t = placeTitle(long, 'You organise');
  assert.ok(t.length <= PUSH_TITLE_MAX, `${t.length}: ${t}`);
  assert.ok(t.endsWith(' · You organise'), `the stance was cut: ${t}`);
  const name = t.slice(0, -' · You organise'.length);
  assert.ok(name.endsWith('…'), name);
  assert.ok(long.startsWith(name.slice(0, -1)), 'the cut invented text');
  assert.ok(/\s/.test(long[name.length - 1] ?? ' '), `cut through a word: ${name}`);
  assert.equal(placeTitle('Maria & Jose', 'Invited'), 'Maria & Jose · Invited', 'a short name is not cut');
  const msg = pushMessage({ subject: { kind: 'event', name: long, stance: 'Invited' }, sentence: 'x', url: '/d', collapseKey: 'k', level: 'normal' });
  assert.ok(msg.title.length <= PUSH_TITLE_MAX && msg.title.endsWith(' · Invited'), msg.title);
});

test('6 · 🔒 a row’s place line is never blank — every part, every failure', () => {
  const rows = [
    { related_url: `/dashboard/${EV}/guests`, event_id: EV },
    { related_url: `/dashboard/${EV}/guests`, event_id: null },
    { related_url: '/ana-30th', event_id: EV2 },
    { related_url: '/vendor-dashboard/messages/x', event_id: null },
    { related_url: '/admin/payments', event_id: null },
    { related_url: '/dashboard?seg=people', event_id: null },
    { related_url: null, event_id: null },
  ];
  const factSets: Array<NotificationPlaceFacts | null> = [
    FACTS,
    null,
    { events: null, who: null },
    { events: new Map(), who: { photoUrl: null, initial: null, shops: [] } },
    { events: new Map([[EV, fact({ display_name: '   ' })]]), who: { photoUrl: null, initial: null, shops: [{ name: '  ', logoUrl: null }] } },
  ];
  for (const r of rows) {
    for (const f of factSets) {
      const w = placeLineWords(resolveNotificationPlace(r, f));
      assert.ok(w.name.trim().length > 0, `blank place line for ${JSON.stringify(r)}`);
      assert.ok(opensWords(resolveNotificationPlace(r, f), r).trim().length > 0, 'a blank ⓘ');
    }
  }
  // The row draws the line from these words — not from a copy that could go blank on its own.
  const LIST = stripComments(readFileSync(join(process.cwd(), 'app', '_components', 'notifications', 'notifications-list.tsx'), 'utf8'));
  const item = LIST.slice(LIST.indexOf('function NotificationItem('), LIST.indexOf('function RowButton('));
  assert.match(item, /const words = placeLineWords\(place\);/, 'the row no longer takes its place line from placeLineWords');
  assert.match(item, /data-notice-place=""[\s\S]*?<PlaceWords words=\{words\}/, 'the place line is not drawn inside the row');
  assert.match(LIST, /place=\{resolveNotificationPlace\(n, places\)\}/, 'the list no longer resolves each row through the one rule');
  const placeWords = LIST.slice(LIST.indexOf('function PlaceWords('), LIST.indexOf('function PlaceFace('));
  assert.match(placeWords, /words\.missing[\s\S]*?\{words\.name\}/, 'the "didn’t load" words are not drawn');
});

test('the account menu’s facts project to who is reading', () => {
  const who = placeWhoFromSwitcher({
    displayName: ' cale ',
    email: 'c@x.test',
    photoUrl: null,
    context: { shops: [{ name: 'SetnaProd', logoUrl: 'https://x.test/l.png' }] },
  });
  assert.equal(who.initial, 'C');
  assert.deepEqual(who.shops, [{ name: 'SetnaProd', logoUrl: 'https://x.test/l.png' }]);
  assert.equal(placeWhoFromSwitcher({ displayName: null, email: '', photoUrl: null, context: { shops: [] } }).initial, null);
});

test('the event\u2019s notification mark is ONE letter — the monogram\u2019s first, else the name\u2019s', () => {
  const cases: Array<[string | null, string | null, string]> = [
    ['M & J', 'Maria & Jose', 'M'],
    [null, 'Ana\u2019s 30th', 'A'],
    ['  ', 'jose', 'J'],
    ['& ', '\u00c9lise & Paolo', '\u00c9'],
    [null, null, '?'],
  ];
  for (const [monogram_text, display_name, want] of cases) {
    const got = placeMarkLetter({ monogram_text, display_name });
    assert.equal(got, want);
    assert.equal(Array.from(got).length, 1, `the mark draws "${got}" — more than one character`);
  }
  // The row draws exactly that letter, and names the event in full for assistive tech.
  const LIST = stripComments(readFileSync(join(process.cwd(), 'app', '_components', 'notifications', 'notifications-list.tsx'), 'utf8'));
  const face = LIST.slice(LIST.indexOf('function PlaceFace('), LIST.indexOf("case 'shop':", LIST.indexOf('function PlaceFace(')));
  assert.match(face, /aria-label=\{place\.name\}[\s\S]*?\{placeMarkLetter\(place\.event\)\}/, 'the event mark is not the one letter with the full name');
  assert.doesNotMatch(face, /<EventMonogram\b/, 'the full monogram is back in the 38px mark');
});
