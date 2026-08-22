/**
 * the-venue-respects-privacy.test.ts — every guest door asks the same question
 * before it opens.
 *
 * 🚨 WHAT WENT WRONG. `/{slug}/venue` — the 3D "explore the venue" room — never
 * checked whether the celebration was private. Its own file said twice that it
 * did: the header claimed "all data + privacy scoping lives in the
 * public_venue_scene() RPC", and a note further down called the check "EARNED".
 * Read out of production BY THE OBJECT, that routine's only conditions are the
 * address, whether the event type allows seating, and whether the plan is
 * PUBLISHED. Visibility appears nowhere in it, and appeared nowhere in the page.
 *
 * So a couple who set their celebration to private — whom our own lock screen
 * promises that only their guests and hosts can see it — published a seating
 * plan and served the room, the tables, the booths and which seats are taken to
 * anyone holding the address. (Guest NAMES and photos still required a valid
 * personal token, so this was the layout and the occupancy, not the guest list.)
 *
 * Measured 2026-08-20: nothing was exposed, because the only two events with a
 * published plan are both public. It was a trap waiting for the first private
 * event to publish one.
 *
 * 🔑 A SENTENCE IS NOT A MECHANISM. This file carried two of them, and one
 * pointed confidently at a different layer — which is the most expensive kind,
 * because it sends the reader somewhere else to be reassured.
 *
 * 🔑 AND THE FIX IS THE SHIPPED GATE, NOT A NEW ONE. `canViewSlugEvent` already
 * backs the money-gift page and find-seat, and already knows the four ways in
 * (open to strangers · a redeemed guest session · a signed-in host · an invited
 * account, for that visibility only). This guard is therefore written across
 * ALL the guest doors, not against the one that was broken — the next door to
 * be added is the one that will forget.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SLUG_ROOT = join(HERE, '..', 'app', '[slug]');

/**
 * Guest doors that render an event's own content and must therefore ask.
 *
 * ⚠ THIS LIST IS A BILL, NOT A DECISION. Every entry is a door that has to
 * answer "may this person see this celebration?" before it renders. Deleting a
 * line to go green is deciding a stranger may read a private event.
 */
const DOORS = ['venue', 'find-seat', 'pabuya', 'hub', 'recap'];

function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function doorSource(door: string): string | null {
  const p = join(SLUG_ROOT, door, 'page.tsx');
  return existsSync(p) ? strip(readFileSync(p, 'utf8')) : null;
}

test('every guest door asks who is looking before it renders', () => {
  const missing: string[] = [];
  let checked = 0;
  for (const door of DOORS) {
    const code = doorSource(door);
    if (code === null) continue; // route retired; the coverage assert below catches a gutted list
    checked++;
    if (!/\bcanViewSlugEvent\s*\(/.test(code)) missing.push(door);
  }
  assert.ok(
    checked >= 4,
    `Only ${checked} of the ${DOORS.length} guest doors were found. This guard is ` +
      'scanning almost nothing — the routes moved, or the list is stale.',
  );
  assert.deepEqual(
    missing,
    [],
    'A guest door renders an event without asking whether the viewer may see it. ' +
      "On a private celebration our own lock screen promises only the couple's " +
      `guests and hosts can look. Doors missing the check: ${missing.join(', ')}`,
  );
});

test('the venue door SELECTS the visibility column it gates on', () => {
  const code = doorSource('venue');
  assert.ok(code, 'the venue door is gone');

  // 🪤 THE FIRST DRAFT OF THIS ASSERTION WAS DECORATION. It asked whether the
  // file contained "landing_page_visibility" anywhere. Deleting the column from
  // the SELECT — the exact regression — left it GREEN, because the gate call
  // itself names the column when it casts the row. **A file-level substring
  // cannot say where a name is used.** Read the select list.
  const selects = [...code!.matchAll(/\.select\(\s*(['"`])([\s\S]*?)\1/g)].map((m) => m[2] ?? '');
  assert.ok(selects.length > 0, 'the venue door no longer selects anything — guard is blind');
  assert.ok(
    selects.some((cols) => cols.includes('landing_page_visibility')),
    'The venue door calls the access gate without SELECTING the visibility ' +
      'column, so it hands it undefined — and an undefined visibility is not a ' +
      'private one, so the gate opens for everybody. Selected: ' +
      selects.map((c) => `"${c}"`).join(' | '),
  );
});

test('a refused viewer is sent somewhere that explains, not to a dead end', () => {
  const code = doorSource('venue');
  assert.match(
    code!,
    /redirect\(`\/\$\{slug\}`\)/,
    'A refused viewer must land on the event page, whose lock screen tells them ' +
      'how to get in — the same thing find-seat does. A bare 404 reads as a ' +
      'broken link to a guest who was genuinely invited.',
  );
});
