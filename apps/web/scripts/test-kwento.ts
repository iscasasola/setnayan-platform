/**
 * scripts/test-kwento.ts — unit suite for the Kwento Tier-1 text moderation
 * gate (lib/kwento-moderation.ts). The wall/approval interlocks live in the
 * DB (CHECK constraints + RPCs); this suite owns the lexicon + PII verdicts.
 *
 * Run: pnpm exec tsx scripts/test-kwento.ts   (from apps/web)
 */

import assert from 'node:assert/strict';

import { moderateKwentoText, normalizeForModeration } from '../lib/kwento-moderation';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push(name);
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
}

console.log('kwento moderation test suite\n');

// ── clean: real wedding messages must pass untouched ────────────────────────

test('clean: warm English message', () => {
  const r = moderateKwentoText('Right after the first dance — so much joy in one room!');
  assert.equal(r.state, 'clean');
});

test('clean: Taglish warmth with ñ and emoji', () => {
  const r = moderateKwentoText('Grabe ang saya! Hindi mapigil ni Tita Niña ang luha 🥹💛');
  assert.equal(r.state, 'clean');
});

test('clean: Bisaya congratulations', () => {
  const r = moderateKwentoText('Malipayon kaayo mi para ninyo! Padayon sa gugma.');
  assert.equal(r.state, 'clean');
});

test('clean: affectionate banter words are NOT flagged (loka, baliw)', () => {
  const r = moderateKwentoText("Loka-loka talaga 'tong barkada natin, baliw na 'to — mahal namin kayo!");
  assert.equal(r.state, 'clean');
});

test('clean: substrings inside innocent words never match (class, bassist, Scunthorpe-style)', () => {
  for (const text of ['The class of 2010 is complete tonight!', 'Ang galing ng bassist!', 'Assess the buffet agad']) {
    assert.equal(moderateKwentoText(text).state, 'clean', text);
  }
});

// ── flagged: profanity (a human decides) ────────────────────────────────────

test('flagged: English profanity', () => {
  const r = moderateKwentoText('That speech was fucking amazing');
  assert.equal(r.state, 'flagged');
  assert.ok(r.labels.includes('profanity'));
});

test('flagged: Tagalog profanity (gago / putangina, incl. spaced form)', () => {
  assert.equal(moderateKwentoText('Gago talaga si best man haha').state, 'flagged');
  assert.equal(moderateKwentoText('putang ina ang ganda ng kasal').state, 'flagged');
});

test('flagged: Cebuano profanity (yawa / pisti / buang)', () => {
  assert.equal(moderateKwentoText('Yawa ka brad, nakahilak ko').state, 'flagged');
  assert.equal(moderateKwentoText('Pisti ang kusog sa party!').state, 'flagged');
  assert.equal(moderateKwentoText('Buang jud ka — congrats!').state, 'flagged');
});

test('flagged: leetspeak + repeated-letter evasion still caught (g@go / gagooo)', () => {
  assert.equal(moderateKwentoText('g@go talaga').state, 'flagged');
  assert.equal(moderateKwentoText('gagooooo hahaha').state, 'flagged');
});

test('flagged: PH phone number = PII (doxxing guard)', () => {
  const r = moderateKwentoText('Contact the band at 0917 123 4567 — they were great!');
  assert.equal(r.state, 'flagged');
  assert.ok(r.labels.includes('pii_phone'));
  assert.equal(moderateKwentoText('text me +63 917-123-4567').state, 'flagged');
});

test('flagged: email address = PII', () => {
  const r = moderateKwentoText('Send the raw files to tita.baby@gmail.com please');
  assert.equal(r.state, 'flagged');
  assert.ok(r.labels.includes('pii_email'));
});

test('clean: a year or short number is NOT a phone (no false PII)', () => {
  assert.equal(moderateKwentoText('Since 2019 to forever — 143!').state, 'clean');
});

// ── blocked: never stored ───────────────────────────────────────────────────

test('blocked: explicit TL sexual terms', () => {
  assert.equal(moderateKwentoText('kantot na kayo mamaya ha').state, 'blocked');
});

test('blocked: hard EN slur', () => {
  assert.equal(moderateKwentoText('what a retard moment haha').state, 'blocked');
});

test('blocked wins over flagged when both present', () => {
  const r = moderateKwentoText('putangina kantot');
  assert.equal(r.state, 'blocked');
});

// ── normalization ───────────────────────────────────────────────────────────

test('normalize: diacritics stripped, leet mapped, repeats collapsed', () => {
  assert.equal(normalizeForModeration('GÁGOOO'), 'gago');
  assert.equal(normalizeForModeration('g@g0'), 'gago');
});

test('boundary: exactly 280 chars handled; body length is the route/RPC concern', () => {
  const long = 'a'.repeat(280);
  assert.equal(moderateKwentoText(long).state, 'clean');
});

// ── results ──

console.log(`\n${passed} passed · ${failed} failed${failed ? ` → ${failures.join(', ')}` : ''}`);
if (failed > 0) process.exit(1);
