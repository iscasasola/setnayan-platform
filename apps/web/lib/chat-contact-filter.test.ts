/**
 * scanForContactInfo() — the deterministic off-platform-contact detector wired
 * into the chat send path (lib/chat-send.ts). Locks the detection contract:
 * phones / emails / social URLs / @handles / app names / euphemisms / solicits
 * are caught + masked, while legitimate chatter (prices, pax counts, dates,
 * venue talk) passes clean.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanForContactInfo, MASK_TOKEN } from './chat-contact-filter';

// ── Hard tokens: caught + masked ────────────────────────────────────────────

test('PH mobile number is masked', () => {
  const r = scanForContactInfo('call me 09171234567 please');
  assert.equal(r.hasHit, true);
  assert.ok(r.categories.includes('phone'));
  assert.equal(r.masked, `call me ${MASK_TOKEN} please`);
});

test('PH mobile with spaces/dashes is masked', () => {
  assert.equal(scanForContactInfo('0917 123 4567').masked, MASK_TOKEN);
  assert.equal(scanForContactInfo('0917-123-4567').masked, MASK_TOKEN);
});

test('international +63 number is masked', () => {
  const r = scanForContactInfo('reach +63 917 123 4567');
  assert.equal(r.hasHit, true);
  assert.equal(r.masked, `reach ${MASK_TOKEN}`);
});

test('email is masked', () => {
  const r = scanForContactInfo('email juan.delacruz@gmail.com thanks');
  assert.equal(r.hasHit, true);
  assert.ok(r.categories.includes('email'));
  assert.equal(r.masked, `email ${MASK_TOKEN} thanks`);
});

test('obfuscated email (at)/(dot) is masked', () => {
  const r = scanForContactInfo('juan (at) gmail (dot) com');
  assert.equal(r.hasHit, true);
  assert.equal(r.masked, MASK_TOKEN);
});

test('social URL is masked', () => {
  assert.equal(
    scanForContactInfo('see facebook.com/juanphotos').masked,
    `see ${MASK_TOKEN}`,
  );
  assert.equal(scanForContactInfo('wa.me/639171234567').masked, MASK_TOKEN);
});

test('@handle is masked but not an email', () => {
  const r = scanForContactInfo('follow @juan_photo for updates');
  assert.equal(r.hasHit, true);
  assert.ok(r.categories.includes('handle'));
  assert.equal(r.masked, `follow ${MASK_TOKEN} for updates`);
});

// ── Soft signals: caught (default: masked) ──────────────────────────────────

test('bare app name is caught', () => {
  const r = scanForContactInfo('let us talk on viber');
  assert.equal(r.hasHit, true);
  assert.ok(r.categories.includes('social_app'));
});

test('short app tokens ig / fb are caught with word boundaries', () => {
  assert.equal(scanForContactInfo('add me on ig').hasHit, true);
  assert.equal(scanForContactInfo('find me on fb').hasHit, true);
});

test('colour-coded euphemisms are caught', () => {
  assert.equal(scanForContactInfo("i'm on the blue app").hasHit, true);
  assert.equal(scanForContactInfo('message me on the purple app').hasHit, true);
});

test('solicitation phrasing is caught', () => {
  assert.equal(scanForContactInfo('add me on messenger').hasHit, true);
  assert.equal(scanForContactInfo('my number is below').hasHit, true);
  assert.equal(scanForContactInfo("let's take this off platform").hasHit, true);
});

// ── Combined: intent + payload, payload removed ─────────────────────────────

test('solicit + number: number masked, message still legible', () => {
  const r = scanForContactInfo('add me on viber 09171234567 ok?');
  assert.equal(r.hasHit, true);
  assert.ok(r.categories.includes('phone'));
  // The number is gone regardless of how the soft signals are tuned.
  assert.ok(!/\d{9,}/.test(r.masked));
});

// ── False-positive guards: legitimate chatter passes clean ──────────────────

test('prices, pax counts, and years are NOT flagged', () => {
  assert.equal(scanForContactInfo('the package is ₱12,999 for 150 pax').hasHit, false);
  assert.equal(scanForContactInfo('the wedding is set for June 2026').hasHit, false);
  assert.equal(scanForContactInfo('we need 200 chairs and 20 tables').hasHit, false);
});

test('ordinary words containing app substrings are NOT flagged', () => {
  // "ig" inside big/dig, "fb" not standalone, "insta" only as a word.
  assert.equal(scanForContactInfo('this is a big dignified venue').hasHit, false);
  assert.equal(scanForContactInfo('instant coffee at the tasting').hasHit, false);
});

test('empty / non-string input is safe', () => {
  assert.equal(scanForContactInfo('').hasHit, false);
  assert.equal(scanForContactInfo('').masked, '');
  // @ts-expect-error — defensive runtime guard for a non-string.
  assert.equal(scanForContactInfo(null).hasHit, false);
});

test('clean message returns the body referentially usable and unmasked', () => {
  const body = 'Hi! Do you have our date open? Budget is around 80k.';
  const r = scanForContactInfo(body);
  assert.equal(r.hasHit, false);
  assert.equal(r.masked, body);
});

test('multiple hits are all masked in order', () => {
  const r = scanForContactInfo('email a@b.com or call 09171234567');
  assert.equal(r.masked, `email ${MASK_TOKEN} or call ${MASK_TOKEN}`);
  assert.equal(r.hits.length, 2);
});
