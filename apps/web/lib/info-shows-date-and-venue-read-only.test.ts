/**
 * 📍 INFO SHOWS DATE AND VENUE READ-ONLY (owner 2026-10-06, verbatim:
 * *"suppliers"*; DECISION_LOG "DATE AND VENUE LIVE IN SUPPLIERS, NOT IN 'YOUR
 * EVENT'").
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

test('1 · under the flag, Date and Venue are the read-only fact — never their editors', () => {
  const details = read(`${L}/maker-details.tsx`);
  const at = details.indexOf('if (props.studio) {');
  assert.ok(at > 0, 'the Studio block moved — re-read this guard');
  const block = details.slice(at, details.indexOf('\n  }\n', at));
  assert.match(block, /editors\.date = <StudioTool part="fact" value=\{yeIn\.date\.dateDisplay\} line=\{STUDIO_SUPPLIERS_LINE\} data="date" \/>;/);
  assert.match(block, /editors\.venues = <StudioTool part="fact" value=\{names \|\| null\} line=\{STUDIO_SUPPLIERS_LINE\} data="venues" \/>;/);
  assert.doesNotMatch(block, /DateEditor|VenuesEditor|venuesEditorFor|type="date"|type=\{?['"]date/, 'a date or venue field is drawn in Studio › Info');
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
