/**
 * paid-for-every-event.test.ts — a host who PAID must not have their guests
 * turned away.
 *
 * `seat/page.tsx` opened with `if (!event || event.event_type !== 'wedding')
 * notFound();`. Nothing on the couple's side gates the seating plan by event
 * type — a debut, a birthday or a christening host can build it, publish it,
 * AND buy the Custom QR seat pass. Their guests, holding the QR that pass
 * printed, landed on "this page does not exist".
 *
 * They were sold something their guests could not open, and neither side had
 * any way to find out why.
 *
 * 🔑 THIS IS A DEFECT, NOT A PRODUCT DECISION. If the answer were "seat passes
 * are wedding-only", the gate would belong on the couple's side — at the point
 * of sale — not on the guest's 404. The rest of the guest tree agrees:
 * find-seat, find-my-table and recap all ask the event-type PROFILE, and a
 * missing profile row degrades to enabled (GENERIC_PROFILE).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE = join(HERE, '..');
const SEAT = readFileSync(join(ROUTE, 'seat', 'page.tsx'), 'utf8');

test('no guest sub-route hardcodes wedding-only', () => {
  // Sweeping the folder rather than naming seat/page.tsx: the next route to be
  // added is where this comes back.
  const offenders: string[] = [];
  for (const entry of readdirSync(ROUTE, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const file = join(ROUTE, entry.name, 'page.tsx');
    if (!existsSync(file)) continue;
    // Strip comments FIRST. Without this the sweep flags the very comment that
    // explains the fix, and `recap/page.tsx` — where the same comparison picks
    // a NOUN ("event" vs "wedding") and is entirely correct.
    //
    // 🔑 A CHECK THAT FIRES ON CORRECT CODE TEACHES PEOPLE TO DELETE THE CHECK.
    // Both false positives above were real, found on the first run, and the
    // blunt version would have shipped a test that had to be ignored.
    const src = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    // The GATE shape specifically: the comparison must decide whether the page
    // exists. A comparison that picks a word is not a gate.
    if (/if \([^)]*event_type [!=]== 'wedding'[^)]*\)\s*(notFound\(\)|redirect\()/.test(src)) {
      offenders.push(`${entry.name}/page.tsx`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `These guest routes gate on the event type directly instead of asking the ` +
      `event-type profile: ${offenders.join(', ')}. A host whose event type is ` +
      `not "wedding" can still build, publish and PAY for these surfaces — the ` +
      `couple's side has no such gate — so this turns their guests away from ` +
      `something that was bought. Use surfaceEnabled(await resolveProfile(...)).`,
  );
});

test('the seat pass asks the profile, like its siblings', () => {
  assert.match(
    SEAT,
    /if \(!surfaceEnabled\(await resolveProfile\(event\.event_type\), 'website'\)\) notFound\(\);/,
    'The seat page no longer resolves the profile — it is the exact line ' +
      'find-seat, find-my-table and recap use, and matching them is the point.',
  );
});

test('the gate order is unchanged — the page must not become a token oracle', () => {
  // The SKU check must stay ABOVE the token lookups. Reordering would let a
  // stranger learn whether a token is valid for an event that never bought the
  // pass, which is exactly what its own comment warns about.
  const gate = SEAT.indexOf('eventOwnsCustomQrGuest');
  const tokenLookup = SEAT.indexOf('readGuestSession(');
  assert.ok(gate !== -1, 'the seat-pass entitlement gate is gone');
  assert.ok(
    tokenLookup === -1 || gate < tokenLookup,
    'A token lookup now runs BEFORE the entitlement gate. Its own comment says ' +
      'why that must not happen: "we never confirm whether a token is valid for ' +
      'this wedding" — reordering turns the page into a token oracle.',
  );
});

test('the copy stops calling every celebration a wedding', () => {
  // Harmless while the page 404'd for everything else; reachable and wrong the
  // moment it opens to a debut. Fixed in the same change rather than left as a
  // known defect aimed at a newly-unlocked audience.
  assert.match(SEAT, /const noun = eventNoun\(event\.event_type\)/, 'the noun helper is gone');
  assert.ok(
    !/for this wedding/.test(SEAT.replace(/\/\/.*$/gm, '')),
    'A guest-facing string says "this wedding" again, on a route that now also ' +
      'serves birthdays, debuts and christenings.',
  );
});
