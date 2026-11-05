/**
 * 📍 INFO SHOWS DATE AND VENUE READ-ONLY (owner 2026-10-06, verbatim:
 * *"suppliers"*; DECISION_LOG "DATE AND VENUE LIVE IN SUPPLIERS, NOT IN 'YOUR
 * EVENT'") — AMENDED 2026-10-22 for the venue's PIN (DECISION_LOG "A MANUAL
 * VENUE TAKES THE COUPLE'S PIN; A SHOP'S VENUE TAKES THE SHOP'S"): *"manual
 * entry venues can set pin. venues from actual suppliers cannot customize pin"*.
 * The DATE is still the read-only fact. The VENUES are `StudioVenues`: a shop's
 * venue is still one quiet row with no field (and SAYS when the shop has not
 * pinned); a manual or unbooked venue carries the shipped AddressPinField.
 *
 * In the new Maker's Studio › Info the date and the venue are shown as guests
 * read them, with the one line that says where they are set — and NO field:
 *   1 · `MakerDetails`, under `studio`, replaces the Date and Venues editors with
 *       `StudioReadOnlyFact` (never the shipped `DateEditor` / `VenuesEditor`).
 *   2 · `StudioReadOnlyFact`, rendered, holds no input, select, textarea or
 *       button — no date input of any kind — and says the Suppliers line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { STUDIO_SUPPLIERS_LINE } from './studio-details';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · under the flag, Date is the read-only fact; Venues are StudioVenues — never the Details editors', () => {
  const details = read(`${L}/maker-details.tsx`);
  const at = details.indexOf('if (props.studio) {');
  assert.ok(at > 0, 'the Studio block moved — re-read this guard');
  const block = details.slice(at, details.indexOf('\n  }\n', at));
  assert.match(block, /editors\.date = <StudioTool part="fact" label="Date" value=\{yeIn\.date\.dateDisplay\} line=\{STUDIO_SUPPLIERS_LINE\} data="date" \/>;/);
  assert.match(block, /editors\.venues = yeIn\.venues\.slots\.length\s*\?\s*<StudioTool part="venues" eventId=\{eventId\} slots=\{yeIn\.venues\.slots\} \/>\s*:\s*<StudioTool part="fact" label=\{ye\?\.rows\.venues\?\.label \?\? 'Venue'\} value=\{names \|\| null\} line=\{STUDIO_SUPPLIERS_LINE\} data="venues" \/>;/);
  assert.doesNotMatch(block, /DateEditor|VenuesEditor|venuesEditorFor|type="date"|type=\{?['"]date/, 'a date field (or the Details venue editor) is drawn in Studio › Info');
});

test('2 · the fact, rendered: its words and the Suppliers line, and no field at all', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const tools = await import(`../${L}/studio-tools`);
  for (const value of ['Saturday, 12 June 2027', null]) {
    const html = renderToStaticMarkup(React.createElement(tools.StudioReadOnlyFact, { value, line: STUDIO_SUPPLIERS_LINE, data: 'date' }));
    assert.match(html, /data-studio-read-only="date"/);
    assert.ok(html.includes(value ?? 'Not set yet'));
    assert.ok(html.includes('Set when you book your venue in Suppliers'));
    assert.doesNotMatch(html, /<input|<select|<textarea|<button|contenteditable/i, 'the read-only date carries a field');
  }
});

test('3 · Studio › Info › Venues, rendered: a shop’s venue has no field and says it is unpinned; a manual one carries the pin field', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StudioVenues } = await import(`../${L}/studio-venues`);
  const columns = (slot: 'ceremony' | 'reception') =>
    slot === 'ceremony'
      ? { name: 'std_film_ceremony_name', address: 'ceremony_venue_address', lat: 'ceremony_venue_latitude', lng: 'ceremony_venue_longitude' }
      : { name: 'std_film_venue_name', address: 'venue_address', lat: 'venue_latitude', lng: 'venue_longitude' };
  const slot = (key: 'ceremony' | 'reception', booked: Record<string, unknown> | null, source?: 'own') => ({
    slot: key,
    label: key === 'ceremony' ? 'Ceremony' : 'Reception',
    booked: booked ? { address: null, photos: [], pin: null, ...booked } : null,
    choice: source ? { source } : {},
    typed: '',
    address: '',
    pin: null,
    columns: columns(key),
  });
  const html = (slots: unknown[]) => renderToStaticMarkup(React.createElement(StudioVenues, { eventId: 'e-1', slots }));
  const part = (h: string, key: string) => {
    const at = h.indexOf(`data-studio-venue="${key}"`);
    assert.ok(at > 0, `no ${key} card`);
    const next = h.indexOf('data-studio-venue="', at + 10);
    return h.slice(at, next > 0 ? next : undefined);
  };
  const FIELD = /<input|<select|<textarea|<button|contenteditable|data-pin-field-loading|data-venue-manual-pin/i;
  for (const source of [undefined, 'own'] as const) {
    const h = html([
      slot('ceremony', { name: 'San Agustin (added by hand)', pinFrom: 'manual', vendorId: 'ev-c', pin: { lat: 14.58, lng: 120.97 } }),
      slot('reception', { name: 'Seda Vertis North', pinFrom: 'shop', vendorId: 'ev-r' }, source),
    ]);
    const shop = part(h, 'reception');
    assert.match(shop, /data-studio-venue-door="shop"/);
    assert.ok(shop.includes('Seda Vertis North hasn’t pinned their place yet'), `the unpinned shop is dropped silently (${source ?? 'supplier'})`);
    assert.doesNotMatch(shop, FIELD, `a shop’s venue carries a field (${source ?? 'supplier'})`);
    const manual = part(h, 'ceremony');
    assert.match(manual, /data-studio-venue-door="manual"/);
    assert.match(manual, /data-venue-manual-pin="ceremony"/, 'a manual venue has no pin field');
  }
  const pinned = html([slot('reception', { name: 'Seda Vertis North', pinFrom: 'shop', vendorId: 'ev-r', pin: { lat: 14.65, lng: 121.03 } })]);
  assert.ok(pinned.includes('Pinned by Seda Vertis North'));
  const nothing = part(html([slot('reception', null)]), 'reception');
  assert.match(nothing, /data-studio-venue-door="own"/);
  assert.match(nothing, /data-pin-field-loading|data-address-field/, 'an unbooked venue has no pin field');
});
