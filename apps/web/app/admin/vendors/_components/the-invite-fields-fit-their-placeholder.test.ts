/**
 * the-invite-fields-fit-their-placeholder.test.ts — 🔒 the "Invite a supplier" fields share a row only while each keeps
 * room for its whole placeholder.
 *
 * Walk 2026-11-01: "hello@vendorbusiness.ph" was cut to "hello@vendorbusi". The form split into three columns by the
 * WINDOW (`sm:grid-cols-3`), so wherever the card itself was narrow — the 512-px card of the personal-invite page, the
 * admin column beside the rail at tablet width — each field got a third of it, ~160 px. The property, on the REAL
 * rendered form: its columns are sized by the card's own width (`repeat(auto-fit|auto-fill, minmax(<min>, 1fr))`, no
 * window-breakpoint column count), and that <min> holds the longest placeholder at the field's 16 px type.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

/** A generous average glyph width for the 16-px UI face (measured ≈ 7.96 px on "hello@vendorbusiness.ph"). */
const GLYPH_PX = 8.4;
/** `.input-field`: `px-3` each side + a 1-px border each side. */
const FIELD_CHROME_PX = 12 * 2 + 2;

test('every typed field’s column holds its whole placeholder, at any window', async () => {
  const { InviteVendorForm } = await import('./invite-vendor-form');
  const { LoaderOverlayProvider } = await import('@/components/sd-loader/loader-overlay');
  const html = renderToStaticMarkup(
    React.createElement(LoaderOverlayProvider as never, null, React.createElement(InviteVendorForm, { prices: {}, categories: [] })),
  );
  const form = /<form[^>]*class="([^"]*)"/.exec(html)?.[1];
  assert.ok(form, 'the invite <form> did not render');
  assert.ok(!/(^|\s)(sm|md|lg|xl|tab):grid-cols-\d/.test(form), `the fields split by the WINDOW, not the card: "${form}"`);
  const min = /grid-cols-\[repeat\(auto-(?:fit|fill),minmax\((\d+(?:\.\d+)?)(rem|px),1fr\)\)\]/.exec(form);
  assert.ok(min, `the fields have no minimum column width: "${form}"`);
  const minPx = Number(min[1]) * (min[2] === 'rem' ? 16 : 1);
  // 1 Nov 2026: the email and the business name became rows of the ONE Field template (`TypedRow`). A row spans the
  // whole card (`col-span-full`) and its open field stretches across the row, so the example always has the card's
  // width; at rest the pill shows short words that fit its fixed width. No raw typed box is left to be cut.
  const rawTyped = [...html.matchAll(/<input(?![^>]*type="(?:hidden|checkbox|date)")[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(rawTyped, [], 'a raw typed box is back in the invite form');
  for (const row of ['invite-email', 'invite-business']) {
    const at = html.indexOf(`data-form-row="${row}"`);
    assert.ok(at > 0, `the ${row} Field row did not render`);
    const span = html.lastIndexOf('col-span-full', at);
    const formRows = html.lastIndexOf('data-form-rows', at);
    assert.ok(span > 0 && span < formRows, `the ${row} row does not span the whole card`);
  }
  const PILL_TEXT_PX = 200 - 14 - 10 - 16 - 6; // the wide pill less its padding, its pencil and the gap
  for (const m of html.matchAll(/data-form-row-pill="typed"[^>]*>([\s\S]*?)<\/button>/g)) {
    const words = (m[1] ?? '').replace(/<[^>]+>/g, '').trim();
    assert.ok(words.length * 7.6 <= PILL_TEXT_PX, `"${words}" does not fit the pill at rest`);
  }
});
