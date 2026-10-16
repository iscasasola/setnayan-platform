/**
 * 🏷 THE GUEST PAGE NEVER READS A COLOUR'S HEX — ONLY ITS NAME.
 *
 * Owner 2026-09-30 ("a colour is said by name" — guests were reading "#FAF7F2"),
 * re-affirmed 2026-10-15 (DECISION_LOG "SIX OWNER ANSWERS" — "no hex"). Live
 * `/cale-ice` on 2026-10-16 still read "Rosewood #5C0700" twice in its Dress
 * code: the Circles look's screen-reader line, and its visible legend in upper
 * case. Every other look but Arch · Watercolour · Strokes · Silk printed it too
 * (Paint chips under the name; Ribbon under the name; a nameless colour AS the
 * name; every swatch's `title` when it had no name).
 *
 * Held on the REAL widget's markup, for EVERY palette look × every layout ×
 * with and without the reader's own role, and on `PaletteLookList` itself for a
 * colour with no name: whatever a guest can READ — a text node, a `title`, an
 * `aria-label`, an `alt` — carries no `#rrggbb`. The hex stays where it belongs,
 * as the swatch's own colour (`style`, `--c`) and the figure's `data-colour`,
 * which nobody reads.
 *
 * 🪤 Same harness as `every-palette-look-draws.test.ts`: `globalThis.React`
 * before the DYNAMIC imports, `server-only` stubbed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const h = React.createElement;
const HEX = /#[0-9A-F]{6}\b/i;

/** Everything a guest can read off the markup: the text between tags, and the read-aloud / hover attributes. */
function readable(markup: string): string[] {
  const out: string[] = [];
  for (const m of markup.matchAll(/\s(?:title|aria-label|alt|aria-description)="([^"]*)"/g)) out.push(m[1]!);
  const text = markup.replace(/<style\b[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, '\n');
  for (const t of text.split('\n')) if (t.trim()) out.push(t.trim());
  return out;
}

const BOARD = {
  reception: ['#7A1F2B', '#C9A24B', '#F4E9DC'],
  principal_sponsors: ['#C9A24B', '#F4E9DC'],
  bridesmaids: ['#8E3B5B'],
  touched_roles: ['principal_sponsors', 'bridesmaids'],
};
/* Named colours, as on the live page — and one whose "name" is its own hex (the editor stores the hex when the couple
   typed no name), which must be said by the namer, never as typed. */
const PALETTE = [
  { name: 'Rosewood', hex: '#5C0700' },
  { name: 'Pandan Green', hex: '#669C35' },
  { name: '#C9A1A0', hex: '#C9A1A0' },
];
const DRESS = {
  title: 'Garden formal',
  description: 'Long dresses and barongs or suits.',
  palette: PALETTE,
  roles: { principal_sponsor_ninang: { style: 'long_gown' } },
};
const WORDS = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
const LOOKS = [null, 'tags', 'fabric', 'chips', 'circles', 'ribbon', 'arch', 'watercolour', 'strokes'] as const;
const LAYOUTS = [null, 'palette', 'line'] as const;

test('the dress code reads no hex — every look, every layout, with and without the reader’s role', async () => {
  const { DressCodeWidget } = await import('./dress-code-widget');
  let rendered = 0;
  for (const paletteLook of LOOKS) {
    for (const sceneStyle of LAYOUTS) {
      for (const guestRole of [null, 'principal_sponsor_ninang']) {
        const markup = renderToStaticMarkup(
          h(DressCodeWidget, { words: WORDS, config: DRESS, rolePalette: BOARD, paletteLook, sceneStyle, guestRole } as never),
        );
        const said = readable(markup);
        const hex = said.filter((s) => HEX.test(s));
        assert.deepEqual(hex, [], `look=${paletteLook} layout=${sceneStyle} role=${guestRole}: a guest reads a hex`);
        /* Anti-vacuity: colours ARE drawn — as colour (a swatch's `--c` or background), never as words. */
        assert.match(markup, /(?:--c:|background-color:)\s*#[0-9a-fA-F]{6}/, `look=${paletteLook} layout=${sceneStyle}: no colour is drawn at all`);
        rendered += 1;
      }
    }
  }
  assert.equal(rendered, LOOKS.length * LAYOUTS.length * 2);
});

test('the live page’s words: "Rosewood" is said once to a screen reader, and never with its hex', async () => {
  const { DressCodeWidget } = await import('./dress-code-widget');
  const markup = renderToStaticMarkup(h(DressCodeWidget, { words: WORDS, config: DRESS, rolePalette: BOARD, paletteLook: 'circles' } as never));
  assert.doesNotMatch(markup, /Rosewood\s*#|Rosewood<small/i);
  /* The Circles' legend repeats the names for the eye; it is aria-hidden, so the list's own words are the ONE
     accessible name per colour. */
  const legend = /<p aria-hidden="true" class="sn-pal-legend[^"]*">([\s\S]*?)<\/p>/.exec(markup);
  assert.ok(legend, 'the Circles legend is drawn, hidden from a screen reader');
  assert.match(legend![1]!, />Rosewood</);
  assert.equal((markup.match(/<span class="sr-only">Rosewood<\/span>/g) ?? []).length, 1, 'Rosewood has one screen-reader name');
});

test('PaletteLookList: a colour with no name says nothing rather than its hex — every look, full and row', async () => {
  const { PaletteLookList } = await import('./dress-code-palette-looks');
  const items = [{ hex: '#5C0700', name: 'Rosewood' }, { hex: '#669C35' }];
  for (const look of ['fabric', 'chips', 'circles', 'ribbon', 'arch', 'watercolour', 'strokes'] as const) {
    for (const size of ['full', 'row'] as const) {
      const markup = renderToStaticMarkup(h(PaletteLookList, { look, items, size, label: 'Our colours' }));
      assert.deepEqual(readable(markup).filter((s) => HEX.test(s)), [], `${look} (${size}): a guest reads a hex`);
      assert.ok(markup.includes('#669C35'), `${look} (${size}): the nameless colour is not drawn`);
    }
  }
});
