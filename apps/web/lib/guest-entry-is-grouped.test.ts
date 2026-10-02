/**
 * 🗂 THE FIVE GUEST-ENTRY CHOICES ARE SHOWN UNDER THE THREE RULES
 * (owner 2026-10-02, DECISION_LOG row of that name). Wording and grouping only:
 * the SAME five stored values, listed in ONE dropdown under three headings —
 * List only · Accept · Open — and the closed button reads heading + choice.
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
      ['List only', ['Guests reply', 'No reply, each gets their own QR']],
      ['Accept', ['Guests reply', 'No reply, one QR, I approve each']],
      ['Open', ['One QR for everyone']],
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
    list: 'List only · Guests reply',
    personal: 'List only · No reply, each gets their own QR',
    requests: 'Accept · Guests reply',
    one_qr_approve: 'Accept · No reply, one QR, I approve each',
    one_qr: 'Open · One QR for everyone',
  };
  for (const c of GUESTS_GET_IN_CHOICES) assert.equal(guestsGetInLabel(c.value), said[c.value]);

  const maker = read('app/dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx');
  assert.match(maker, /buttonText=\{guestsGetInLabel\(getInNow\)\}/);
  assert.match(maker, /options=\{guestsGetInOptions\(\)\}/);
  const invite = read('app/dashboard/[eventId]/guests/invite/_components/invite-panel.tsx');
  assert.match(invite, /guestsGetInLabel\(readGuestsGetIn\(/);
  const sheet = read('lib/event-details-sheet.ts');
  assert.match(sheet, /guestsGetInLabel\(readGuestsGetIn\(/);
  const popup = read('app/dashboard/[eventId]/guests/_components/who-can-reply-ask.tsx');
  assert.match(popup, /WHO_CAN_REPLY_CHOICES\.map/);

  // No second list: the old spellings are gone from every surface.
  const old = /Only people on my list|Anyone, I approve|No reply · |Personal QR for each guest|label: 'Guest list|label: 'Open event'/;
  for (const [where, src] of [
    ['maker', maker],
    ['invite', invite],
    ['popup', popup],
    ['who-can-reply', read('lib/who-can-reply.ts')],
    ['rsvp-ask', read('lib/rsvp-ask.ts')],
    ['onboarding', read('app/onboarding/_shared/setup-card.tsx')],
    ['privacy', read('app/dashboard/[eventId]/website/privacy/page.tsx')],
  ] as const) {
    assert.doesNotMatch(src, old, `${where} still carries an old guest-entry spelling`);
  }
});

test('4 · onboarding speaks the same words for the choices it stores', () => {
  const card = read('app/onboarding/_shared/setup-card.tsx');
  assert.match(card, /guestsGetInChoice\(GUESTS_IN_AS\[/);
  assert.match(card, /buttonText=\{guestsGetInLabel\(GUESTS_IN_AS\[guestsInOf\(answers\)\]\)\}/);
});
