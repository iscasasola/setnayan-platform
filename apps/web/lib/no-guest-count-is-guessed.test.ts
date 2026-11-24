/**
 * 👥 NO GUESSED GUEST COUNT (supplier walk on live, 24 Nov 2026; controller brief).
 *
 * Measured on live: a supplier's "Update this quote" read "Billed 100 pax · no count from them yet". The couple never
 * gave 100 (their inquiry said 80 in free text and no count was stored). The 100 was a typed stand-in at the call site:
 * `requestedPax={thread.pax_at_inquiry ?? headerPax ?? 100}`. A per-guest line priced against it is a total built on a
 * number nobody gave (CLAUDE.md rule 3, "never guess a number that governs money").
 *
 * Fails if:
 *   · any app/lib source file falls a guest count (pax / headcount / guests) back to a numeric literal with `??` or `||`;
 *   · `openingPax` invents a count when neither the live nor the inquiry count exists;
 *   · `needsGuestCount` lets a per-guest quote that bills nobody through (or blocks one that bills someone);
 *   · the send core stops refusing it (`needs_guest_count`).
 *
 * SABOTAGE (each seen red, restored): put `?? 100` back at the call site · `openingPax` returns 100 for (null, null) ·
 * `needsGuestCount` returns false always · drop the core's `needs_guest_count` refusal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { needsGuestCount, openingPax } from './quote-money';

const WEB = join(__dirname, '..');

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* sources(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|lab)\.tsx?$/.test(name)) yield p;
  }
}

/**
 * A guest count falling back to a number: `pax ?? 150`, `headcount || 100`, `pax_at_inquiry ?? x ?? 100`.
 * The left side must name a count (pax · headcount · guestCount · guests); the right side ends in a bare number.
 * Not a count: a pax BLOCK size (`added_pax_block ?? 1`, "per 1 extra guest") or a per-pax PRICE / RATE.
 */
const GUESSED = /\b(?![\w.?]*(?:block|Block|price|Price|rate|Rate))[\w.?]*(?:pax|Pax|headcount|Headcount|guestCount|GuestCount)[\w.?]*(?:\s*\?\?\s*[\w.?]+)*\s*(?:\?\?|\|\|)\s*[1-9]\d*\b(?!\s*[*/%])/;

/**
 * Known couple-side planning estimates that are NOT billing (the onboarding budget band × an assumed guest count).
 * Each line here is a reasoned exception; a new one needs the same.
 */
const ALLOWED = new Set<string>([
  // Couple onboarding: a rough planning budget before any guest count exists. Shown as an estimate, never billed.
  'app/onboarding/wedding/_components/onboarding-shell.tsx',
]);

test('no app or lib file falls a guest count back to a typed number', () => {
  const hits: string[] = [];
  for (const dir of ['app', 'lib', 'components']) {
    for (const file of sources(join(WEB, dir))) {
      const rel = relative(WEB, file);
      if (ALLOWED.has(rel)) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
          if (GUESSED.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
  }
  assert.deepEqual(hits, [], `A guest count falls back to a typed number:\n${hits.join('\n')}`);
});

test('the pattern catches the shipped guess (self-check)', () => {
  assert.ok(GUESSED.test('requestedPax={thread.pax_at_inquiry ?? headerPax ?? 100}'));
  assert.ok(GUESSED.test('const pax = state.pax ?? 150;'));
  assert.ok(!GUESSED.test('requestedPax={thread.pax_at_inquiry ?? headerPax ?? null}'));
  assert.ok(!GUESSED.test('const pax = billedPax(seedPax ?? 0, minPax);'));
  assert.ok(!GUESSED.test('block = svc?.added_pax_block ?? 1;'));
  assert.ok(GUESSED.test('x * (out.min_pax ?? 1)'));
});

test('openingPax: live, then the inquiry, then nothing', () => {
  assert.equal(openingPax(170, 150), 170);
  assert.equal(openingPax(null, 150), 150);
  assert.equal(openingPax(undefined, 80), 80);
  assert.equal(openingPax(null, null), null);
  assert.equal(openingPax(0, null), null);
});

test('needsGuestCount: a per-guest line billed against nobody waits', () => {
  const perGuest = [{ basis: 'per_pax', rate_centavos: 45_000 }];
  assert.equal(needsGuestCount(perGuest, 0), true);
  assert.equal(needsGuestCount(perGuest, 80), false);
  assert.equal(needsGuestCount([{ basis: 'flat' }], 0), false);
  assert.equal(needsGuestCount([{ basis: 'per_pax', rate_centavos: 45_000, free: true }], 0), false);
  assert.equal(needsGuestCount([{ basis: 'per_pax', rate_centavos: 0 }], 0), false);
});

test('the send core refuses a per-guest quote with no count', () => {
  const core = readFileSync(join(WEB, 'lib/proposal-send.ts'), 'utf8');
  assert.match(core, /needsGuestCount\(input\.lineItems/);
  assert.match(core, /code: 'needs_guest_count'/);
});
