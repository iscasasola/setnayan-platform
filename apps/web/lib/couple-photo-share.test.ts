/**
 * couple-photo-share.test.ts — 📸 the credit line, the consent sentence and the words (pure).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  A_COUPLE_CREDIT,
  coupleCreditChoices,
  coupleNamesCredit,
  couplePhotoConsentText,
  coupleShareStateLine,
  monthYearOf,
  shareRefusalWords,
  shopAnswerDoneLine,
} from './couple-photo-share';

test('the names credit is first names + the event’s month/year — never a surname', () => {
  assert.equal(coupleNamesCredit({ bride_name: 'Ana Reyes', groom_name: 'Ben Cruz', event_date: '2027-02-13', event_date_precision: 'day' }, '2026-10-30'), 'Ana & Ben · Feb 2027');
  assert.equal(coupleNamesCredit({ display_name: 'Ana & Ben', event_date: '2027-02-01', event_date_precision: 'month' }, '2026-10-30'), 'Ana & Ben · Feb 2027');
  // A year-only (or no) date names the month it is shared in.
  assert.equal(coupleNamesCredit({ bride_name: 'Ana Reyes', groom_name: 'Ben Cruz', event_date: '2027-01-01', event_date_precision: 'year' }, '2026-10-30'), 'Ana & Ben · Oct 2026');
  assert.equal(coupleNamesCredit({ bride_name: 'Ana Reyes', groom_name: null, event_date: null }, '2026-10-30'), 'Ana · Oct 2026');
  assert.equal(coupleNamesCredit({ display_name: '  ', bride_name: null, groom_name: '' }, '2026-10-30'), null);
  assert.doesNotMatch(coupleNamesCredit({ bride_name: 'Ana Reyes', groom_name: 'Ben Cruz' }, '2026-10-30') ?? '', /Reyes|Cruz/);
});

test('the credit dropdown offers names first, and always "A couple"', () => {
  assert.deepEqual(coupleCreditChoices('Ana & Ben · Feb 2027').map((c) => c.key), ['names', 'a_couple']);
  assert.deepEqual(coupleCreditChoices(null), [{ key: 'a_couple', label: A_COUPLE_CREDIT }]);
  assert.equal(A_COUPLE_CREDIT, 'A couple', 'the database CHECKs this exact string');
});

test('words', () => {
  assert.equal(monthYearOf('2026-12-05'), 'Dec 2026');
  assert.equal(monthYearOf('nope'), null);
  assert.match(couplePhotoConsentText('Bloom & Co.'), /mine to share.*people in it agree.*Bloom & Co\./);
  assert.equal(coupleShareStateLine('waiting', 'Bloom & Co.'), 'Sent to Bloom & Co. · waiting for them');
  assert.equal(coupleShareStateLine('approved', 'Bloom & Co.'), 'On Bloom & Co.’s service card');
  assert.match(shareRefusalWords('no_consent'), /Tick the box/);
  assert.match(shareRefusalWords('something-new'), /nothing was sent/);
  assert.match(shopAnswerDoneLine(true, 'waiting'), /on your service card/);
  assert.match(shopAnswerDoneLine(false, 'approved'), /Taken off/);
  assert.match(shopAnswerDoneLine(false, 'waiting'), /show anywhere/);
});

test('🛡 #7089 — the frozen copy’s key names no event and no file; an upload key is this event’s own', async () => {
  const { coupleLookKey, shareIdOfCoupleLook, isEventUploadKey } = await import('./couple-photo-share');
  const id = '0b8d5a3e-1c2f-4a6b-9d7e-112233445566';
  const ev = '7f000000-0000-4000-8000-000000000001';
  const at = 'a1b2c3d4e5f6a7b8';
  assert.equal(coupleLookKey(id, `inspiration/${ev}/bridal_bouquet/abc-Ana Reyes wedding.JPG`, at), `couple-looks/${id}-${at}.jpg`);
  assert.equal(coupleLookKey(id, `inspiration/${ev}/bridal_bouquet/no-extension`, at), `couple-looks/${id}-${at}.jpg`);
  assert.equal(coupleLookKey(id, `inspiration/${ev}/bridal_bouquet/x.svg`, at), `couple-looks/${id}-${at}.jpg`, 'a non-image extension rode into the public key');
  assert.equal(coupleLookKey(id, `inspiration/${ev}/bridal_bouquet/x.WEBP`, at), `couple-looks/${id}-${at}.webp`);
  assert.doesNotMatch(coupleLookKey(id, `inspiration/${ev}/x/Ana.webp`, at), new RegExp(`${ev}|Ana|inspiration`));
  assert.throws(() => coupleLookKey(id, 'x.jpg', 'not-hex'), /16 hex/);
  // Two attempts never share a key (the double-approve fix): the losing one deletes only its own.
  assert.notEqual(coupleLookKey(id, 'x.jpg', 'aaaaaaaaaaaaaaaa'), coupleLookKey(id, 'x.jpg', 'bbbbbbbbbbbbbbbb'));
  assert.equal(shareIdOfCoupleLook(`couple-looks/${id}-${at}.webp`), id);
  assert.equal(shareIdOfCoupleLook(`couple-looks/${id}.webp`), null);
  assert.equal(shareIdOfCoupleLook(`couple-looks/${id}-Ana.jpg`), null);
  assert.equal(shareIdOfCoupleLook(`couple-looks/${id}-${at}.svg`), null);
  assert.equal(shareIdOfCoupleLook(`inspiration/${ev}/x.jpg`), null);
  assert.ok(isEventUploadKey(ev, `inspiration/${ev}/bridal_bouquet/a.jpg`));
  assert.ok(!isEventUploadKey(ev, `inspiration/someone-else/a.jpg`));
  assert.ok(!isEventUploadKey(ev, `inspiration/${ev}/../other/a.jpg`));
  assert.ok(!isEventUploadKey(ev, null));
  assert.ok(!isEventUploadKey(ev, `inspiration/${ev}/suggestions/bridal_bouquet/a.jpg`), 'a supplier suggestion passed as the couple’s own upload');
});

test('👁 who sees it — four audiences; the default is the event’s own Event Hub setting, never wider', async () => {
  const m = await import('./couple-photo-share');
  assert.deepEqual([...m.COUPLE_PHOTO_AUDIENCES], ['hosts', 'exclusive', 'private', 'public']);
  assert.deepEqual(m.COUPLE_PHOTO_AUDIENCES.map((a) => m.COUPLE_PHOTO_AUDIENCE_LABEL[a]), ['Only hosts', 'Exclusive', 'Private', 'Public']);
  assert.equal(m.defaultCouplePhotoAudience('public'), 'public');
  for (const v of ['private', 'invited_accounts', 'unlisted', null, undefined, 'weird']) {
    assert.equal(m.defaultCouplePhotoAudience(v as string | null), 'exclusive', `${String(v)} defaulted wider than Exclusive`);
  }
  assert.match(m.COUPLE_PHOTO_AUDIENCE_HINT.private, /same as Exclusive/, 'the ⓘ no longer says Private fails closed');
  assert.ok(m.audienceIsPublic('public') && !m.audienceIsPublic('private'));
  assert.ok(!m.isCouplePhotoAudience('everyone') && m.isCouplePhotoAudience('hosts'));
});
