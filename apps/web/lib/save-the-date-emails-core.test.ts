/**
 * Unit suite for the Save-the-Date guest-email core (the launchSaveTheDate
 * fan-out). These build a guest-facing email, so the edges that would surface
 * in a real inbox — a wrong/missing greeting, a leaked stale or unparseable
 * date, a junk recipient slipping through, the couple-name fallback chain, and
 * the RFC 8058 unsubscribe header — are pinned here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSaveTheDateGuestEmail,
  formatWeddingDate,
  isSendableEmail,
  resolveCoupleName,
  stdGuestGreetingName,
  STD_SUPPORT_EMAIL,
  type StdEventContext,
  type StdGuestRow,
} from './save-the-date-emails-core';

const baseCtx: StdEventContext = {
  coupleName: 'Maria & Jose',
  weddingDateIso: '2026-12-12',
  pageUrl: 'https://www.setnayan.com/maria-and-jose',
  venue: 'Manila Cathedral',
};

function guest(overrides: Partial<StdGuestRow> = {}): StdGuestRow {
  return {
    guest_id: 'g1',
    first_name: 'Ana',
    last_name: 'Santos',
    display_name: null,
    email: 'ana@example.com',
    ...overrides,
  };
}

test('isSendableEmail accepts well-formed and rejects junk/blank', () => {
  assert.equal(isSendableEmail('ana@example.com'), true);
  assert.equal(isSendableEmail('  ana@example.com  '), true);
  assert.equal(isSendableEmail('not-an-email'), false);
  assert.equal(isSendableEmail('ana@localhost'), false); // no dotted domain
  assert.equal(isSendableEmail(''), false);
  assert.equal(isSendableEmail(null), false);
  assert.equal(isSendableEmail(undefined), false);
});

test('stdGuestGreetingName prefers display first-name, then first_name, else empty', () => {
  assert.equal(stdGuestGreetingName(guest({ display_name: 'Tita Ana Reyes' })), 'Tita');
  assert.equal(stdGuestGreetingName(guest({ display_name: null, first_name: 'Ana' })), 'Ana');
  assert.equal(stdGuestGreetingName(guest({ display_name: '', first_name: '' })), '');
});

test('formatWeddingDate formats a YYYY-MM-DD and returns null for junk/missing', () => {
  assert.equal(formatWeddingDate('2026-12-12'), 'Saturday, December 12, 2026');
  assert.equal(formatWeddingDate(null), null);
  assert.equal(formatWeddingDate('not-a-date'), null);
});

test('resolveCoupleName fallback chain: display → bride & groom → default', () => {
  assert.equal(
    resolveCoupleName({ display_name: 'Maria & Jose', bride_name: 'Maria', groom_name: 'Jose' }),
    'Maria & Jose',
  );
  assert.equal(
    resolveCoupleName({ display_name: null, bride_name: 'Maria', groom_name: 'Jose' }),
    'Maria & Jose',
  );
  assert.equal(
    resolveCoupleName({ display_name: '  ', bride_name: 'Maria', groom_name: null }),
    'Maria',
  );
  assert.equal(
    resolveCoupleName({ display_name: null, bride_name: null, groom_name: null }),
    'Our wedding',
  );
});

test('buildSaveTheDateGuestEmail: full happy path carries names, date, link, calendar, unsubscribe', () => {
  const mail = buildSaveTheDateGuestEmail(guest(), baseCtx);
  // Subject + greeting + date
  assert.match(mail.subject, /Save the date — Maria & Jose/);
  assert.match(mail.subject, /December 12, 2026/);
  assert.match(mail.text, /^Hi Ana,/);
  assert.match(mail.text, /Saturday, December 12, 2026/);
  assert.match(mail.text, /at Manila Cathedral/);
  // Link to the now-public page
  assert.ok(mail.text.includes('https://www.setnayan.com/maria-and-jose'));
  assert.ok(mail.html.includes('https://www.setnayan.com/maria-and-jose'));
  // Add-to-calendar (Google Calendar URL)
  assert.match(mail.text, /Add it to your calendar:/);
  assert.match(mail.text, /calendar\.google\.com/);
  // RFC 8058 one-click unsubscribe
  assert.equal(
    mail.headers['List-Unsubscribe'],
    `<mailto:${STD_SUPPORT_EMAIL}?subject=unsubscribe>`,
  );
  assert.equal(mail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  // Plaintext + HTML both present
  assert.ok(mail.text.length > 0);
  assert.ok(mail.html.startsWith('<!DOCTYPE html>'));
});

test('buildSaveTheDateGuestEmail: no wedding date set → graceful copy, no date/calendar', () => {
  const mail = buildSaveTheDateGuestEmail(guest(), { ...baseCtx, weddingDateIso: null });
  assert.equal(mail.subject, 'Save the date — Maria & Jose');
  assert.match(mail.text, /getting married — please save the date/);
  assert.ok(!mail.text.includes('Add it to your calendar'));
});

test('buildSaveTheDateGuestEmail: no greeting name → neutral "Hi,"', () => {
  const mail = buildSaveTheDateGuestEmail(
    guest({ first_name: null, display_name: null }),
    baseCtx,
  );
  assert.match(mail.text, /^Hi,/);
});

test('buildSaveTheDateGuestEmail: no venue → no "at <venue>" clause', () => {
  const mail = buildSaveTheDateGuestEmail(guest(), { ...baseCtx, venue: null });
  assert.ok(!/ at /.test(mail.text.split('\n')[2] ?? ''));
});
