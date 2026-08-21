/**
 * THE FIRST PERSON TO SCAN A PRINTED INVITATION IS NOT A RETURNING VISITOR.
 *
 * The hub card's headline was an unconditional `Hi again, {name}.` — and the
 * first arrival mints the session and lands straight on this page, so it was
 * literally the first sentence a guest ever read. The comment above the card's
 * own mount even called it "for identified RETURNING guests", asserting a gate
 * that did not exist.
 *
 * ── WHY THE SIGNAL IS THE EARLIEST SCAN, AND ONLY THAT ──────────────────────
 * `scan_events` is written by every door that mints a guest session and was read
 * by nothing. The MINIMUM row is the signal because it does not move when the
 * guest re-scans the card in their hand, and because the redeem route has been
 * observed writing TWO rows ~1.3s apart for a single arrival — a count would
 * lie where a minimum does not.
 *
 * ⛔ The two obvious "improvements" are both the bug wearing a hat:
 * `rsvp_responded_at` is stamped by three HOST dashboard paths with no guest
 * session in sight, and `arrived` is written only by the door crew. Either one
 * demotes a genuine first arrival back to "Hi again".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WORDS = {
  organizer: 'couple', theOrganizer: 'the couple', TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s', TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding', organizerIsHonoree: false,
};

async function render(over: Record<string, unknown>) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestHubCard } = await import('../_components/guest-hub-card');
  return renderToStaticMarkup(
    React.createElement(GuestHubCard as never, {
      words: WORDS,
      data: {
        firstName: 'Ana', displayName: 'Ana Cruz', rsvpStatus: 'pending',
        tableLabel: null, mealPreference: null, dietaryRestrictions: null,
        nextScheduleBlock: null, slug: 'x', isLimitedPlusOne: false, arrived: false,
        ...over,
      },
    } as never),
  );
}

test('🔴 a first arrival is greeted as new, not as a return', async () => {
  const html = await render({ firstVisit: true });
  assert.match(html, /Hello, Ana\./, 'the first sentence a guest ever reads still says "Hi again"');
  assert.doesNotMatch(html, /Hi again/);
});

test('a returning guest still gets the returning greeting', async () => {
  const html = await render({ firstVisit: false });
  assert.match(html, /Hi again, Ana\./, 'the fix took the returning greeting away too');
});

test('an unknown answer falls back to today’s copy, never to greeting a regular as new', async () => {
  // The prop is optional: every existing construction site omits it.
  const html = await render({});
  assert.match(html, /Hi again, Ana\./);
});

test('🔒 it never says "Welcome" — that word already means "checked in at the door"', async () => {
  // Welcome collides in five other places, all of them about arriving AT THE
  // VENUE. Telling somebody at home they have arrived is a different lie.
  const html = await render({ firstVisit: true });
  const headline = html.slice(0, html.indexOf('Your invitation summary'));
  assert.doesNotMatch(headline, /Welcome/);
});

test('a blank name does not render "Hello, ." in either branch', async () => {
  for (const firstVisit of [true, false]) {
    const html = await render({ firstName: '   ', firstVisit });
    assert.doesNotMatch(html, /Hello, \./);
    assert.doesNotMatch(html, /Hi again, \./);
  }
});

// ── The signal ──────────────────────────────────────────────────────────────

const LOADERS = readFileSync(join(__dirname, 'loaders.ts'), 'utf8');
const stripped = LOADERS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the signal is the EARLIEST scan, not a count and not the newest', async () => {
  const block = stripped.slice(stripped.indexOf('guestFirstVisit'), stripped.indexOf('const guestHubData'));
  assert.match(block, /from\('scan_events'\)/, 'the arrival trail is no longer read');
  assert.match(block, /ascending: true/, 'reading the NEWEST scan makes every visit look like the first');
  assert.match(block, /\.limit\(1\)/);
  assert.doesNotMatch(block, /count/i, 'a count lies — the redeem route writes two rows for one arrival');
});

test('⛔ the greeting never leans on a host-written field', async () => {
  const block = stripped.slice(stripped.indexOf('guestFirstVisit'), stripped.indexOf('const guestHubData'));
  for (const trap of ['rsvp_responded_at', 'guestArrived', 'arrived']) {
    assert.ok(
      !block.includes(trap),
      `the first-visit test leans on ${trap}, which the HOST writes — a genuine first arrival would be demoted to "Hi again"`,
    );
  }
});

test('a rejected query does not read as "never been here"', async () => {
  // A lost grant would otherwise greet every returning guest as new.
  const block = stripped.slice(stripped.indexOf('guestFirstVisit'), stripped.indexOf('const guestHubData'));
  assert.match(block, /firstScanErr/, 'the read error is unchecked');
  assert.match(block, /!firstScanErr &&/, 'the error is read but not required to be absent');
});

// ── The WIRE, not just the two ends ─────────────────────────────────────────
//
// 🚨 EVERY TEST ABOVE PASSED WITH THE FIX DISCONNECTED. The card was rendered
// with an explicit prop, and the loader's query block was read as source — but
// nothing asserted that the loader HANDS the answer to the card. Deleting the
// single line `firstVisit: guestFirstVisit,` (occurrence count 1 → 0) left all
// eight tests green while every guest went back to "Hi again".
// Testing the primitive is not testing the caller.

test('🔴 the loader actually passes the answer to the card', () => {
  // Bound to the hub-data object by STRUCTURE, not by a bare substring: a
  // mention anywhere else in this 1400-line file would otherwise satisfy it.
  const at = stripped.indexOf('const guestHubData');
  assert.ok(at > -1, 'the hub data object was renamed — re-point this guard');
  const obj = stripped.slice(at, stripped.indexOf('};', at));
  assert.match(
    obj,
    /firstVisit:\s*guestFirstVisit/,
    'the loader computes the first-visit answer and never hands it over — every guest reads "Hi again" again',
  );
});

test('the card still accepts it, so the wire has something to land on', () => {
  const card = readFileSync(join(__dirname, '..', '_components', 'guest-hub-card.tsx'), 'utf8');
  assert.match(card, /firstVisit\?:\s*boolean/, 'the prop is gone — the loader is talking to nobody');
});

test('🔒 NOT ONE of the four greeting arms says "welcome"', () => {
  // The rule was written down and then broken three lines below it, in the ONE
  // arm no test rendered: a first-time guest with no name on file read
  // "Hello — welcome." — telling somebody at home they had arrived at the venue.
  // Rendering catches the arms; reading the ternary catches the arm a fixture
  // forgets to construct.
  const card = readFileSync(join(__dirname, '..', '_components', 'guest-hub-card.tsx'), 'utf8');
  const at = card.indexOf('{firstName.trim()');
  assert.ok(at > -1, 'the greeting ternary moved — re-point this guard');
  const ternary = card.slice(at, card.indexOf('</span>', at));
  assert.doesNotMatch(
    ternary,
    /welcome/i,
    '"Welcome" already means "checked in at the door" in five other places on this very card',
  );
  // …and it is genuinely four arms, so the slice is not silently empty.
  // Vacuity check: three '?' means the slice really is the whole nested
  // ternary and not an empty or truncated string that trivially lacks "welcome".
  assert.equal(
    (ternary.match(/\?/g) ?? []).length,
    3,
    'the greeting is no longer the four-arm ternary this guard reads — re-point it',
  );
});

test('every arm renders, including the two nobody had ever constructed', async () => {
  for (const firstVisit of [true, false]) {
    for (const firstName of ['Ana', '   ']) {
      const html = await render({ firstName, firstVisit });
      const headline = html.slice(0, html.indexOf('Your invitation summary'));
      assert.doesNotMatch(
        headline,
        /welcome/i,
        `the ${firstName.trim() ? 'named' : 'blank-name'} / ${firstVisit ? 'first' : 'return'} arm says welcome`,
      );
      assert.doesNotMatch(headline, /undefined|null|NaN/, 'an arm rendered a placeholder');
    }
  }
});
