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
  assert.equal(coupleLookKey(id, `inspiration/${ev}/bridal_bouquet/abc-Ana Reyes wedding.JPG`), `couple-looks/${id}.jpg`);
  assert.equal(coupleLookKey(id, `inspiration/${ev}/bridal_bouquet/no-extension`), `couple-looks/${id}.jpg`);
  assert.doesNotMatch(coupleLookKey(id, `inspiration/${ev}/x/Ana.webp`), new RegExp(`${ev}|Ana|inspiration`));
  assert.equal(shareIdOfCoupleLook(`couple-looks/${id}.webp`), id);
  assert.equal(shareIdOfCoupleLook(`couple-looks/${id}-Ana.jpg`), null);
  assert.equal(shareIdOfCoupleLook(`inspiration/${ev}/x.jpg`), null);
  assert.ok(isEventUploadKey(ev, `inspiration/${ev}/bridal_bouquet/a.jpg`));
  assert.ok(!isEventUploadKey(ev, `inspiration/someone-else/a.jpg`));
  assert.ok(!isEventUploadKey(ev, `inspiration/${ev}/../other/a.jpg`));
  assert.ok(!isEventUploadKey(ev, null));
});
