/**
 * samahan-notify.test.ts — the two rules that decide who hears a samahan.
 *
 * The fan-out itself is a database write; what is worth proving without one is
 * the decision in front of it, so `selectSamahanRecipients` is pure and this
 * file exercises it directly:
 *
 *   · you are never notified about your own post;
 *   · a person already holding an unread notice for this samahan is skipped, so
 *     twenty messages in a minute ring once, not twenty times;
 *   · a REFUSED collapse read rings EVERYBODY. Supabase resolves with { error }
 *     and an empty list, which is indistinguishable from "nobody is ringing".
 *     Reading that as "everyone is already notified" would silence the whole
 *     feature the moment the query broke — and the symptom would be an absence,
 *     which is the one symptom nobody sees.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectSamahanRecipients,
  samahanNoticeCopy,
  samahanNoticeUrl,
} from './samahan-notice-rules';

const ANA = 'ana';
const BEN = 'ben';
const CARI = 'cari';

test('the person who posted is never told about their own post', () => {
  assert.deepEqual(selectSamahanRecipients([ANA, BEN, CARI], ANA, []), [BEN, CARI]);
});

test('a person already holding an unread notice is skipped', () => {
  assert.deepEqual(selectSamahanRecipients([ANA, BEN, CARI], ANA, [BEN]), [CARI]);
  assert.deepEqual(selectSamahanRecipients([ANA, BEN, CARI], ANA, [BEN, CARI]), []);
});

test('a refused collapse read rings everybody rather than nobody', () => {
  assert.deepEqual(selectSamahanRecipients([ANA, BEN, CARI], ANA, null), [BEN, CARI]);
});

test('a duplicated or empty roster row cannot double-ring or crash', () => {
  assert.deepEqual(selectSamahanRecipients([ANA, BEN, BEN, ''], ANA, []), [BEN]);
});

test('the notice points where the thing actually is, and that is the collapse key', () => {
  // Same string both places on purpose: the collapse asks "is there already an
  // unread notice at this URL?", so a URL that drifts from the one written is a
  // collapse that never collapses.
  assert.equal(samahanNoticeUrl('c1', 'story'), '/dashboard/samahan/c1');
  assert.equal(samahanNoticeUrl('c1', 'message'), '/dashboard/samahan/c1?tab=usapan');
});

test('the words say who, where, and how long it will be there', () => {
  const story = samahanNoticeCopy('story', 'Ana', 'Barkada');
  assert.match(story.title, /Ana/);
  assert.match(story.title, /Barkada/);
  assert.match(story.body, /24 hours/);

  const message = samahanNoticeCopy('message', 'Ana', 'Barkada');
  assert.match(message.title, /wrote in Barkada/);

  // A missing display name must never render as a blank or "undefined".
  const anon = samahanNoticeCopy('story', '  ', '');
  assert.match(anon.title, /^Someone added to your samahan$/);
});

test('a message notice carries no copy of the message', () => {
  // Taking a message down is a SOFT delete. A preview copied into a
  // notification row has no inverse — the words would outlive the take-down in
  // every recipient's tray.
  const long = 'the secret is '.repeat(20);
  const notice = samahanNoticeCopy('message', 'Ana', 'Barkada');
  assert.ok(!notice.title.includes('secret'));
  assert.ok(!notice.body.includes('secret'));
  assert.ok(!(notice.title + notice.body).includes(long.slice(0, 20)));
});
