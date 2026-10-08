/**
 * 🗂 THE FIVE GUEST-ENTRY CHOICES ARE SHOWN UNDER THE THREE RULES
 * (owner 2026-10-02, DECISION_LOG row of that name). Wording and grouping only:
 * the SAME five stored values, listed in ONE dropdown under three headings —
 * Only my list · My list + requests · Open (plain names, owner 2026-10-07) —
 * and the closed button reads heading + choice.
 *
 * SABOTAGE (run 2026-10-02): moving `one_qr` from Open into Accept in
 * `GUESTS_GET_IN_CHOICES` turns tests 1 and 3 red (a group heading is gone and
 * the label reads "Accept · One QR for everyone").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeRsvpAskConfig } from './rsvp-ask';
import {
  GUESTS_GET_IN_CHOICES,
  guestsGetInLabel,
  guestsGetInOptions,
  guestsGetInPatch,
  readGuestsGetIn,
  type GuestsGetIn,
} from './who-can-reply';
import { pickRuns } from '../app/dashboard/[eventId]/website/editor/_components/pick-menu-place';
import { stripComments } from './strip-comments';

const APP = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

test('1 · the dropdown has 3 headings and 5 choices, in the owner\'s order', () => {
  const runs = pickRuns(guestsGetInOptions());
  assert.deepEqual(
    runs.map((r) => [r.group, r.options.map((o) => o.label)]),
    [
      ['Only my list', ['They reply', 'No reply']],
      ['My list + requests', ['They reply', 'No reply']],
      ['Open', ['Anyone with the link']],
    ],
  );
  assert.equal(runs.flatMap((r) => r.options).length, 5);
});

test('2 · round trip: each of the five choices stores, then reads back, as itself', () => {
  const keys = pickRuns(guestsGetInOptions()).flatMap((r) => r.options.map((o) => o.key));
  assert.deepEqual([...keys].sort(), ['list', 'one_qr', 'one_qr_approve', 'personal', 'requests']);
  for (const key of keys) {
    const stored = sanitizeRsvpAskConfig({ meal: false, ...guestsGetInPatch(key) });
    assert.equal(readGuestsGetIn(stored), key, `${key} did not round-trip`);
  }
  // The five stored shapes are distinct — grouping never merges two values.
  const shapes = new Set(keys.map((k) => JSON.stringify(guestsGetInPatch(k))));
  assert.equal(shapes.size, 5);
});

test('3 · the closed button and every display say heading + choice, from ONE helper', () => {
  const said: Record<GuestsGetIn, string> = {
    list: 'Only my list · They reply',
    personal: 'Only my list · No reply',
    requests: 'My list + requests · They reply',
    one_qr_approve: 'My list + requests · No reply',
    one_qr: 'Open · Anyone with the link',
  };
  for (const c of GUESTS_GET_IN_CHOICES) assert.equal(guestsGetInLabel(c.value), said[c.value]);

  /* The one dropdown is the shared `GuestsGetIn` part (2026-10-07) — the Maker and Guests › Setup both mount it. */
  const maker = read('app/dashboard/[eventId]/_components/guest-setup/guests-get-in.tsx');
  assert.match(maker, /buttonText=\{guestsGetInLabel\(value\)\}/);
  assert.match(maker, /options=\{guestsGetInOptions\(\)\}/);
  const invite = read('app/dashboard/[eventId]/guests/invite/_components/share-link-panel.tsx');
  assert.match(invite, /guestsGetInLabel\(readGuestsGetIn\(/);
  const sheet = read('lib/event-details-sheet.ts');
  assert.match(sheet, /guestsGetInLabel\(readGuestsGetIn\(/);

  // No second list: the old spellings are gone from every surface.
  const old = /Only people on my list|Anyone, I approve|No reply · |Personal QR for each guest|label: 'Guest list|label: 'Open event'/;
  for (const [where, src] of [
    ['maker', maker],
    ['invite', invite],
    ['who-can-reply', read('lib/who-can-reply.ts')],
    ['rsvp-ask', read('lib/rsvp-ask.ts')],
    ['onboarding', read('app/onboarding/_shared/setup-card.tsx')],
    ['privacy', read('app/dashboard/[eventId]/website/privacy/page.tsx')],
  ] as const) {
    assert.doesNotMatch(src, old, `${where} still carries an old guest-entry spelling`);
  }
});

// Test 4 (onboarding's guest-entry card speaks the shared words) and the first-visit
// pop-up's assertion were retired when simplicity fixes 2 (owner 2026-10-02, d23 +
// "no entry card") removed both surfaces; onboarding stays in the old-spellings sweep
// above, so a returning "Guest list" / "Open event" label there still turns this red.
