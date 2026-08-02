/**
 * A LIVE POOL OPENS THE GUEST CAMERA — paid or free (owner-locked 2026-08-02).
 *
 * The gate used to require a PURCHASE. So on a free event the guest site showed
 * "Show my QR" and "Photos of you" and **no camera**: the only people who could
 * shoot were whoever had been handed one of the three claim links. The free tier
 * owned 50 shots that almost nobody could spend.
 *
 * Owner: *"free guests can shoot."* Paying buys MORE SHOTS, not more PEOPLE.
 * That is safe to give away because the bound was never the number of cameras —
 * it is the purse, and `papic_reserve_event_points_for_seat` already fails
 * CLOSED at zero.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Strip comments — the notes explaining each choice must not trip the checks
 *  that enforce it. (They did, twice, before this existed.) */
const noComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

test('the guest-camera gate accepts a pool, not only a purchase', () => {
  const src = read('lib/papic-guest.ts');
  assert.match(
    src,
    /fetchEventPoolStatus\(/,
    'eventPapicGuestActive must consult the pool — a free grant has no order, ' +
      'so a purchase-only check leaves free events with unspendable shots.',
  );
  assert.match(
    src,
    /pool\?\.applies === true/,
    'a pool that APPLIES opens the camera',
  );
});

test('🪤 it keys on `applies`, never on remaining > 0', () => {
  // An empty pool must still open the camera. The capture screen explains
  // "out of shots" far better than a missing button does, and closing the door
  // at zero would strand a guest who scanned seconds earlier.
  const src = read('lib/papic-guest.ts');
  const gate = noComments(src).slice(
    noComments(src).indexOf('export async function eventPapicGuestActive'),
  );
  assert.ok(
    !/remaining\w*\s*>\s*0/.test(gate),
    'the gate must not require remaining points — that turns "out of shots" ' +
      'into "the button vanished".',
  );
});

test('a purchase still opens it, independently of the pool', () => {
  // A paid pass must not depend on a pool row existing — the two are separate
  // reasons, checked with OR, so neither can mask the other.
  const src = read('lib/papic-guest.ts');
  const gate = src.slice(src.indexOf('export async function eventPapicGuestActive'));
  assert.match(gate, /owned\.some\(Boolean\)/);
  assert.ok(
    gate.indexOf('owned.some(Boolean)') < gate.indexOf('pool?.applies'),
    'the purchase check should short-circuit before the pool read',
  );
});

test('the duplicate poster door is gone', () => {
  // /papic/pool/[token] + events.papic_pool_token were a second door beside
  // /{slug}/invite, which already existed and lands the scanner somewhere
  // strictly better (camera AND their own QR AND photos of them).
  for (const gone of [
    'app/papic/pool/[token]/page.tsx',
    'app/papic/pool/[token]/actions.ts',
    'lib/papic-pool-join.ts',
  ]) {
    assert.ok(!existsSync(join(WEB, gone)), `${gone} should be deleted`);
  }
  // The pool GALLERY at /papic/pool is a different thing and stays.
  assert.ok(existsSync(join(WEB, 'app/papic/pool/page.tsx')), 'the pool gallery stays');
});

test('the poster now encodes the event site’s own join link', () => {
  for (const rel of [
    'app/dashboard/[eventId]/studio/papic/crew/page.tsx',
    'app/dashboard/[eventId]/studio/papic/crew/poster/page.tsx',
  ]) {
    const src = read(rel);
    assert.match(src, /\/\$\{(eventSlug|slug)\}\/invite/, `${rel} must point at /{slug}/invite`);
    assert.ok(
      !src.includes('/papic/pool/${'),
      `${rel} must not point at the retired standalone camera`,
    );
  }
});
