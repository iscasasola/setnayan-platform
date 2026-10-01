/**
 * 🎟 "WHERE TO GET TICKETS" — the link is https, bounded, and shown only on a
 * PUBLIC event (owner 2026-09-29, DECISION_LOG "DISCOVER — UNPARKED" item b:
 * the organizer sells the tickets, never Setnayan).
 *
 * Three things are held here:
 *   1. the parser refuses everything but an https web address, and says why;
 *   2. the parser and the database CHECK are the SAME rule — read from the
 *      migration text, so neither can loosen without this going red;
 *   3. the guest page's link exists only for a Public event, and the button
 *      opens it in a new tab with `rel="noopener noreferrer"`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import React, { createElement } from 'react';
import {
  TICKET_URL_MAX,
  TICKET_URL_SQL_PATTERN,
  parseTicketUrl,
  publicTicketUrl,
} from './ticket-url';
import { GetTickets } from '../app/[slug]/_components/get-tickets';
import { VisibilityPanel } from '../app/dashboard/[eventId]/website/editor/_components/media-panels';

// The components compile to classic `React.createElement` under tsx — the same
// shim every render test in this tree sets.
(globalThis as unknown as { React: unknown }).React = React;

const REPO = join(__dirname, '..', '..', '..');
const MIGRATIONS = join(REPO, 'supabase', 'migrations');

function ticketMigration(): string {
  const f = readdirSync(MIGRATIONS).find((n) => n.endsWith('_events_ticket_url.sql'));
  assert.ok(f, 'the events.ticket_url migration is missing');
  return readFileSync(join(MIGRATIONS, f), 'utf8');
}

test('an https web address is kept; blank clears the link', () => {
  assert.deepEqual(parseTicketUrl('https://tickets.example.com/show?id=12#seats'), {
    ok: true,
    value: 'https://tickets.example.com/show?id=12#seats',
  });
  // Typed the way people type an address — no scheme — reads as https.
  assert.deepEqual(parseTicketUrl('  tickets.example.ph/concert  '), {
    ok: true,
    value: 'https://tickets.example.ph/concert',
  });
  assert.deepEqual(parseTicketUrl('https://shop.example.com:8443/t'), {
    ok: true,
    value: 'https://shop.example.com:8443/t',
  });
  assert.deepEqual(parseTicketUrl(''), { ok: true, value: null });
  assert.deepEqual(parseTicketUrl('   '), { ok: true, value: null });
  assert.deepEqual(parseTicketUrl(null), { ok: true, value: null });
});

test('🔒 everything that is not an https web address is refused, with a reason', () => {
  for (const bad of ['http://tickets.example.com', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://x.example.com']) {
    const r = parseTicketUrl(bad);
    assert.equal(r.ok, false, `${bad} was accepted`);
    assert.equal(!r.ok && r.reason, 'not_https', `${bad} should be refused as not https`);
  }
  for (const bad of ['https://localhost/x', 'https://user:pw@tickets.example.com', 'https://tick ets.example.com', 'not a link']) {
    const r = parseTicketUrl(bad);
    assert.equal(r.ok, false, `${bad} was accepted`);
  }
  const long = `https://tickets.example.com/${'a'.repeat(TICKET_URL_MAX)}`;
  const r = parseTicketUrl(long);
  assert.equal(!r.ok && r.reason, 'too_long');
  assert.equal(parseTicketUrl(42).ok, false);
});

test('🔗 the parser and the database CHECK are one rule', () => {
  const sql = ticketMigration();
  // The CHECK names the same pattern, character for character, and the same cap.
  assert.ok(
    sql.includes(`ticket_url ~ '${TICKET_URL_SQL_PATTERN}'`),
    'the CHECK pattern and TICKET_URL_SQL_PATTERN have drifted apart',
  );
  assert.match(sql, new RegExp(`char_length\\(ticket_url\\) <= ${TICKET_URL_MAX}\\b`),
    'the CHECK length cap and TICKET_URL_MAX have drifted apart');
  // https only — the property the CHECK exists for.
  assert.match(TICKET_URL_SQL_PATTERN, /^\^https:\/\//);
});

test('🔒 the column is readable by a host session and written only by the server action', () => {
  const sql = ticketMigration();
  assert.match(sql, /GRANT SELECT \(ticket_url\) ON public\.events TO authenticated;/);
  assert.doesNotMatch(sql, /GRANT UPDATE \(ticket_url\)/, 'a host session must not PATCH the link directly');
  assert.doesNotMatch(sql, /GRANT SELECT \(ticket_url\) ON public\.events TO [^;]*anon/);
  assert.match(sql, /CREATE VIEW public\.events_host/, 'events_host must be rebuilt over the new column');

  const action = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'privacy', 'actions.ts'),
    'utf8',
  );
  assert.match(action, /parseTicketUrl\(formData\.get\('ticket_url'\)\)/, 'the action must parse the link it writes');
  assert.match(action, /\.update\(\{ ticket_url: ticket\.value \}\)/, 'the action writes only the parsed value');
});

test('🎟 only a PUBLIC event has a tickets link', () => {
  const url = 'https://tickets.example.com/show';
  assert.equal(publicTicketUrl({ visibility: 'public', ticketUrl: url }), url);
  for (const visibility of ['unlisted', 'invited_accounts', 'private', null]) {
    assert.equal(publicTicketUrl({ visibility, ticketUrl: url }), null, `${visibility} drew a tickets link`);
  }
  // A stored value is re-read through the parser — it can never become an href unchecked.
  assert.equal(publicTicketUrl({ visibility: 'public', ticketUrl: 'javascript:alert(1)' }), null);
  assert.equal(publicTicketUrl({ visibility: 'public', ticketUrl: null }), null);
});

test('🎟 "Get tickets" opens the organizer page in a new tab, sharing nothing', () => {
  const html = renderToStaticMarkup(createElement(GetTickets, { url: 'https://tickets.example.com/show' }));
  assert.match(html, /href="https:\/\/tickets\.example\.com\/show"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, />\s*Get tickets\s*</);
  assert.equal(renderToStaticMarkup(createElement(GetTickets, { url: null })), '');
});

test('🎟 the Maker asks "Where to get tickets" right under Public — and only there', () => {
  const noop = () => undefined;
  const pub = renderToStaticMarkup(
    createElement(VisibilityPanel, {
      action: noop,
      eventId: 'e1',
      visibility: 'public',
      ticketUrl: 'https://tickets.example.com/show',
    }),
  );
  assert.match(pub, /Where to get tickets/);
  assert.match(pub, /name="ticket_url"/);
  assert.match(pub, /value="https:\/\/tickets\.example\.com\/show"/);
  assert.doesNotMatch(pub, /Edit in|↗/, 'the field is right here — never a link to edit it elsewhere');

  for (const visibility of ['private', 'unlisted'] as const) {
    const html = renderToStaticMarkup(createElement(VisibilityPanel, { action: noop, eventId: 'e1', visibility }));
    assert.doesNotMatch(html, /name="ticket_url"/, `${visibility} drew the tickets field`);
  }
});
