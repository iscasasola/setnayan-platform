/**
 * GUARD — EVERY BOTTOM INPUT RIDES THE KEYBOARD (owner 2026-10-24, "Yes", buttons fold, on
 * `prototypes/keyboard_rides_the_input_2026-10-24.html`: *"This should be a template that will make everyone adapt."*).
 *
 * The rule is a property of the tree, not a request to each builder:
 *   1. ONE KEYBOARD READING — no file but `lib/keyboard-ride.ts` reads `window.visualViewport` (it was eight files,
 *      three ways). A hand-rolled reading is the next way to disagree.
 *   2. ONE TYPING BAND — "Typing · <place>" + Done is drawn only by `app/_components/typing-band.tsx`; the Maker's
 *      four bars draw it (no second copy).
 *   3. EVERY BOTTOM ROW'S FIELD RIDES (rendered): a ThumbRow's field seat is a riding seat by default, a
 *      `rides={false}` needs a written reason at the call, no file but ThumbRow draws a `data-thumb-row`, and the chat
 *      composer's message box rides too.
 *   5. EVERY BOTTOM TEXT BOX — a file that pins a row to the screen's foot AND draws a text field rides it (ThumbRow,
 *      `useRidingRow`, or the one band), or says in EXEMPT why its field is not in that row (owner, verbatim:
 *      *"Applies all textbox like that"*).
 *   4. KEYBOARD UP → BAR DOWN — the bottom bar slides away under `html[data-keyboard="open"]` and its clearance becomes
 *      the keyboard's, so a row standing on it stands on the keyboard.
 *
 * What a unit test cannot do here is open a keyboard: the riding STATE (focus + keyboard up) is held by the pure
 * decision `thumbRowRides` below and walked in WebKit with a stand-in `visualViewport` (the PR's frames).
 *
 * Sabotage (2026-10-24): a `window.visualViewport` read put back in guest-group-picker.tsx (1 red); a "Typing ·" bar
 * hand-drawn in stage-tools.tsx (2 red); Budget's `useRidingRow` removed (5 red); ThumbRow's default flipped to `rides = false` (3 red); the dock's hide rule
 * removed from globals.css (4 red). Each restored → green.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as RowMod from '@/components/thumb-row';
import type * as ChatMod from '@/app/_components/chat-send-form';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}
const { ThumbRow, thumbRowRides } = require('@/components/thumb-row') as typeof RowMod;
const { ChatSendForm } = require('@/app/_components/chat-send-form') as typeof ChatMod;
const { TypingBand } = require('@/app/_components/typing-band') as typeof import('@/app/_components/typing-band');
const { ActionButton } = require('@/components/action-button') as typeof import('@/components/action-button');
const { Check } = require('lucide-react') as typeof import('lucide-react');
const { SP_KEY_BAR, SP_KEY_DONE } = require('@/lib/maker-stage-room') as typeof import('@/lib/maker-stage-room');

const WEB = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(WEB, p));
  }
  return out;
}
const SOURCES = ['app', 'components', 'lib'].flatMap((d) => walk(join(WEB, d)));

test('1 · no file but lib/keyboard-ride.ts reads window.visualViewport', () => {
  const readers = SOURCES.filter((f) => f !== 'lib/keyboard-ride.ts' && /\bvisualViewport\b/.test(read(f)));
  assert.deepEqual(readers, [], `a hand-rolled keyboard reading — read lib/keyboard-ride.ts instead:\n${readers.join('\n')}`);
  // …and the one reading publishes what CSS and the rows answer to.
  const kb = read('lib/keyboard-ride.ts');
  assert.match(kb, /setProperty\('--sn-keyboard-h'/, 'the keyboard height is not published');
  assert.match(kb, /setAttribute\('data-keyboard', 'open'\)/, 'html[data-keyboard="open"] is not published');
});

test('2 · one typing band — only typing-band.tsx draws "Typing ·", and the Maker’s bars draw it', () => {
  const drawers = SOURCES.filter((f) => f !== 'app/_components/typing-band.tsx' && /Typing ·/.test(read(f)));
  assert.deepEqual(drawers, [], `a second typing band:\n${drawers.join('\n')}`);
  for (const f of [
    'app/dashboard/[eventId]/launch/_components/stage-tools.tsx',
    'app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-rsvp-stage.tsx',
    'app/dashboard/[eventId]/launch/_components/rsvp-line-list.tsx',
  ]) {
    assert.match(read(f), /<TypingBand\b/, `${f}: the Maker's bar is not the one typing band`);
  }
});

test('2b · the Maker is unchanged: the band in flow renders the toolbar’s old bar, byte for byte', () => {
  const blur = () => {};
  // The Maker's toolbar bar as it shipped before the band (stage-tools.tsx, origin/main 2026-10-24).
  const was = renderToStaticMarkup(
    createElement(
      'div',
      { 'data-stage-keys': '', className: `-mx-[10px] rounded-t-2xl !border-t-0 !bg-transparent ${SP_KEY_BAR}` },
      createElement('span', { className: 'min-w-0 truncate' }, 'Typing · ', 'Names'),
      createElement('span', { 'data-type-done': '', className: SP_KEY_DONE }, createElement(ActionButton, { tone: 'brand', main: true, icon: Check, label: 'Done', onClick: blur })),
    ),
  );
  const now = renderToStaticMarkup(
    createElement(TypingBand, { inline: true, 'data-stage-keys': '', className: '-mx-[10px] rounded-t-2xl !border-t-0 !bg-transparent', place: 'Names', onDone: blur } as never),
  );
  assert.equal(now, was, 'the Maker’s typing bar is drawn differently through the one band');
});

test('3 · every bottom row’s field rides — rendered — and an opt-out says why', () => {
  // The ThumbRow's field seat is a riding seat by default, with the input inside it.
  const html = renderToStaticMarkup(createElement(ThumbRow, { name: 'probe', field: { placeholder: 'Search guests' } }));
  assert.match(html, /data-thumb-seat="field"[^>]*data-rides=""[^>]*>[\s\S]*?<input/, 'the row’s field does not ride by default');
  const off = renderToStaticMarkup(createElement(ThumbRow, { name: 'probe', field: { placeholder: 'Search guests' }, rides: false }));
  assert.doesNotMatch(off, /data-rides/, '`rides={false}` is not honoured');
  // A shipped component in the field seat rides too.
  const node = renderToStaticMarkup(createElement(ThumbRow, { name: 'probe', field: { node: createElement('input', { placeholder: 'Search customers' }) } }));
  assert.match(node, /data-thumb-seat="field"[^>]*data-rides=""/, 'a field node does not ride');

  // The decision: focus + keyboard up rides; a mode row, an opt-out, no focus or no keyboard does not.
  assert.equal(thumbRowRides({ rides: true, typing: 'Search guests', open: true, mode: false }), true);
  assert.equal(thumbRowRides({ rides: true, typing: null, open: true, mode: false }), false);
  assert.equal(thumbRowRides({ rides: true, typing: 'Search guests', open: false, mode: false }), false);
  assert.equal(thumbRowRides({ rides: false, typing: 'Search guests', open: true, mode: false }), false);
  assert.equal(thumbRowRides({ rides: true, typing: 'Search guests', open: true, mode: true }), false);
  // …and riding draws THE band, through the ONE riding row.
  const row = read('components/thumb-row.tsx');
  assert.match(row, /const ride = useRidingRow\(rowRef, \{ rides,/, 'ThumbRow does not ride through the one riding row');
  assert.match(row, /\{ride\.band\}/, 'a riding ThumbRow does not draw the band');
  assert.match(read('app/_components/typing-band.tsx'), /band: riding && over \? <TypingBand over=\{over\}/, 'the riding row does not draw the one typing band');
  assert.match(row, /rides = true,/, 'ThumbRow does not ride by default');

  // No file but ThumbRow draws a thumb row (every input in a [data-thumb-row] is ThumbRow's).
  const rows = SOURCES.filter((f) => f !== 'components/thumb-row.tsx' && /data-thumb-row=/.test(read(f)));
  assert.deepEqual(rows, [], `a hand-drawn thumb row:\n${rows.join('\n')}`);

  // An opt-out carries its reason in the call (a comment within the three lines above it).
  const optOuts: string[] = [];
  for (const f of SOURCES) {
    const raw = readFileSync(join(WEB, f), 'utf8').split('\n');
    raw.forEach((line, i) => {
      if (!/rides=\{false\}/.test(line) || f === 'components/thumb-row.tsx') return;
      const above = raw.slice(Math.max(0, i - 3), i + 1).join('\n');
      if (!/(\/\/|\/\*|\{\/\*)[^\n]*\S{4,}/.test(above)) optOuts.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(optOuts, [], `rides={false} without a written reason:\n${optOuts.join('\n')}`);

  // The chat composer: its message box rides (the row stays whole — Send is its verb).
  const chat = renderToStaticMarkup(createElement(ChatSendForm, { threadId: 't', sendAction: async () => ({ ok: true }) } as never));
  assert.match(chat, /<textarea[^>]*data-rides=""/, 'the composer’s message box does not ride');
  assert.match(read('app/_components/chat-send-form.tsx'), /typing && kb\.open \? \(\s*<TypingBand\b/, 'the composer does not wear the one typing band');
});

test('4 · keyboard up → bar down, and the bar’s clearance becomes the keyboard’s', () => {
  const css = read('app/globals.css');
  assert.match(css, /html\[data-keyboard='open'\] \[data-bottom-dock\] \{[^}]*transform:\s*translateY\(100%\)/, 'the bar stays up over the keyboard');
  const nav = read('app/_components/nav/bottom-nav.tsx');
  assert.match(nav, /const kb = useKeyboardRide\(\);/, 'the dock does not read the keyboard');
  assert.match(nav, /kbRef\.current\.open \? kbRef\.current\.bottom : el\.getBoundingClientRect\(\)\.height/, 'the dock’s clearance is not the keyboard’s while it is up');
});

/** Files that pin something to the foot AND draw a text field — but the field is not in the pinned row. Each says why. */
const EXEMPT: Record<string, string> = {
  'app/pay/[reference]/_components/pay-panel.tsx': 'the reference field is in the page body; the pinned bar holds only the pay buttons',
  'app/[slug]/_components/guest-hub-bar.tsx': 'the ROTATE box is in a card that opens over the bar (a sheet), not in the bar',
  'app/_components/account-switcher/account-switcher.tsx': 'the pinned box is a bottom sheet; its inputs are hidden form fields',
  'app/dashboard/[eventId]/seating/_components/seating-editor.tsx': 'the pinned box is a bottom sheet; the editor’s fields are in the page',
  'app/dashboard/[eventId]/vendors/_components/build-body.tsx': 'the pinned Build bar holds buttons only; the fields are in the page',
  'app/(shell)/explore/_components/taxonomy-search.tsx': 'its field rides with the bar that holds it (sticky-marketplace-header.tsx)',
};

test('5 · every bottom text box rides — a pinned row with a text field is a riding row, or says why not', () => {
  const PIN = /sn-bottomdock-h|styles\.lower|fixed inset-x-0 bottom|fixed bottom-|bottom-\[var\(--sn-(?:bottomdock|keyboard)/;
  const TEXT = /<input(?![^>]*type="(?:hidden|file|checkbox|radio|range|color|date)")|<textarea|<TaxonomySearch\b/;
  const RIDES = /<ThumbRow\b|useRidingRow\(|<TypingBand\b/;
  const loose: string[] = [];
  for (const f of SOURCES) {
    if (!f.endsWith('.tsx') || f.startsWith('app/dev/') || f === 'components/thumb-row.tsx') continue;
    const src = read(f);
    if (!PIN.test(src) || !TEXT.test(src) || RIDES.test(src)) continue;
    if (EXEMPT[f]) continue;
    loose.push(f);
  }
  assert.deepEqual(loose, [], `a bottom text box that does not ride the keyboard:\n${loose.join('\n')}`);
  for (const f of Object.keys(EXEMPT)) assert.ok(SOURCES.includes(f), `${f}: an exemption for a file that is gone`);
  // The rows found outside ThumbRow ride through the one hook.
  for (const f of ['app/dashboard/[eventId]/budget/_components/budget-screen.tsx', 'app/(shell)/explore/_components/sticky-marketplace-header.tsx', 'app/admin/hub-music/hub-music-manager.tsx']) {
    const src = read(f);
    assert.match(src, /useRidingRow\(/, `${f}: its bottom search does not ride`);
    assert.match(src, /\.rowProps\}/, `${f}: the riding row's focus handlers are not on the row`);
    assert.match(src, /\.band\}/, `${f}: the band is not drawn on the row`);
  }
  // The marketplace bar stands on the keyboard (it is at the screen's foot, not on the bar).
  assert.match(read('app/(shell)/explore/_components/sticky-marketplace-header.tsx'), /fixed bottom-\[var\(--sn-keyboard-h,0px\)\]/);
});
