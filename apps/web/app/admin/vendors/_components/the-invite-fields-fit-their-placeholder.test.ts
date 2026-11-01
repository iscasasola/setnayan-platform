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
  const placeholders = [...html.matchAll(/<input[^>]*placeholder="([^"]*)"[^>]*>/g)].map((m) => m[1] ?? '');
  assert.ok(placeholders.length >= 2, 'the email and business-name fields did not render');
  for (const p of placeholders) {
    const need = p.length * GLYPH_PX + FIELD_CHROME_PX;
    assert.ok(minPx >= need, `"${p}" needs ~${Math.ceil(need)} px; a column may be ${minPx} px`);
  }
});
