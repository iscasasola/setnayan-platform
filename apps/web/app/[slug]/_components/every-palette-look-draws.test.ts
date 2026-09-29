/**
 * EVERY PALETTE LOOK DRAWS EVERY COLOUR, IN ORDER — AND AN ABSENT PICK IS
 * TODAY'S TAGS.
 *
 * Owner 2026-09-29, DECISION_LOG "APPROVED — FIVE PALETTE STYLES, PICKED ON THE
 * TOOLBAR"; approved design `prototypes/palette_styles_2026-09-29.html`. The
 * Dress code scene's "Our colours" is drawn in one of five looks, stored as
 * `canvas.palette` (`lib/palette-looks.ts`), absent = Tags.
 *
 * Held here, on the REAL widget's markup (not a description of it):
 *   1 · absent, `tags`, and an id this version does not draw all render the
 *       SAME markup, and it is the shipped `.pahina-swatch` tags — so a live
 *       page that never picked cannot change;
 *   2 · each of the five draws every colour of "Our colours", in the order the
 *       widget was given them, and says so with its `data-pal-look`;
 *   3 · the role rows follow the look at row size, every hex in order;
 *   4 · the reader's own panel ("You are …") follows the look too;
 *   5 · the other two LAYOUTS keep drawing the colours their own way — the look
 *       is never half-applied to a view it was not designed for.
 *
 * 🪤 Same harness as `every-scene-style-draws.test.ts`: `globalThis.React`
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
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

const BOARD = {
  reception: ['#7A1F2B', '#C9A24B', '#F4E9DC'],
  principal_sponsors: ['#C9A24B', '#F4E9DC'],
  bridesmaids: ['#8E3B5B'],
  touched_roles: ['principal_sponsors', 'bridesmaids'],
};
/* Seven named colours typed in the dress-code editor — the design's upper case. */
const SEVEN = [
  { name: 'Wine', hex: '#351115' },
  { name: 'Olive', hex: '#646B38' },
  { name: 'Cream', hex: '#EFE3B8' },
  { name: 'Dusty rose', hex: '#C9A1A0' },
  { name: 'Gold', hex: '#B8934A' },
  { name: 'Slate', hex: '#4D5A72' },
  { name: 'Charcoal', hex: '#3A3A3A' },
];
const DRESS = {
  title: 'Garden formal',
  description: 'Long dresses and barongs or suits.',
  palette: SEVEN,
  roles: { principal_sponsor_ninang: { style: 'long_gown' } },
};
const WORDS = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
const LOOKS = ['tags', 'fabric', 'chips', 'circles', 'ribbon'] as const;

/** The markup of one `data-dress-code="…"` block (up to its matching close). */
function block(markup: string, key: string): string {
  const at = markup.indexOf(`data-dress-code="${key}"`);
  if (at < 0) return '';
  const open = markup.lastIndexOf('<', at);
  const tag = /^<([a-z]+)/.exec(markup.slice(open))![1]!;
  let depth = 0;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = open;
  for (let m = re.exec(markup); m; m = re.exec(markup)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return markup.slice(open, re.lastIndex);
  }
  return markup.slice(open);
}

/** The colours a list DRAWS, in document order: the look's `--c`, or the tag's background. */
function drawn(markup: string): string[] {
  return [...markup.matchAll(/(?:--c:|background-color:)\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1]!.toUpperCase());
}

async function render(extra: Record<string, unknown>) {
  const { DressCodeWidget } = await import('./dress-code-widget');
  return html(h(DressCodeWidget, { words: WORDS, config: DRESS, rolePalette: BOARD, ...extra } as never));
}

test('1 · absent, `tags` and an unknown id are ONE markup — the shipped tags, unchanged', async () => {
  const { paletteLookOfRow } = await import('@/lib/scene-style-of-row');
  const absent = await render({});
  const nullPick = await render({ paletteLook: null });
  const tags = await render({ paletteLook: 'tags' });
  const unknown = await render({ paletteLook: paletteLookOfRow({ config_json: { canvas: { palette: 'velvet' } } }) });
  const noCanvas = await render({ paletteLook: paletteLookOfRow({ config_json: null }) });
  assert.equal(nullPick, absent);
  assert.equal(tags, absent, 'an explicit Tags pick draws exactly what an absent one does');
  assert.equal(unknown, absent, 'an id this version does not draw reads as Tags — never a blank palette');
  assert.equal(noCanvas, absent);
  const ours = block(absent, 'ours');
  assert.ok(ours, 'the fixture draws "Our colours"');
  // The shipped tag, class for class (`.pahina-swatch` + the 1px inner edge, 3.25rem each).
  const tagsDrawn = [...ours.matchAll(/<li class="w-\[3\.25rem\]"[^>]*><span aria-hidden="true" class="pahina-swatch outline outline-1 outline-ink\/20 \[outline-offset:-1px\]"/g)];
  assert.equal(tagsDrawn.length, drawn(ours).length, 'every colour is the shipped silk tag');
  assert.doesNotMatch(absent, /sn-pal/, 'no new look class reaches a page that never picked');
  // The role rows keep the shipped row-size tag.
  assert.match(block(absent, 'roles'), /pahina-swatch !h-7 !w-5 shrink-0/);
  assert.doesNotMatch(absent, /data-pal-row/);
});

test('2 · each of the five looks draws every colour of "Our colours", in order', async () => {
  const want = drawn(block(await render({}), 'ours'));
  // The couple's seven typed colours are all there (the Mood Board's lead, the rest follow).
  for (const c of SEVEN) assert.ok(want.includes(c.hex.toUpperCase()), `${c.name} is in the palette`);
  for (const look of LOOKS) {
    const ours = block(await render({ paletteLook: look }), 'ours');
    assert.match(ours, new RegExp(`data-pal-look="${look}"`), `${look} marks its list for the entrance`);
    // Circles draw the buttons, then the same colours again as the dots of the names under them.
    const expected = look === 'circles' ? [...want, ...want] : want;
    assert.deepEqual(drawn(ours), expected, `${look} draws every colour, in order`);
    if (look !== 'tags') {
      assert.match(ours, new RegExp(`class="sn-pal sn-pal-${look}"`), `${look} is drawn in its own look`);
      // Every named colour keeps its name, once (Circles says it in the line under the row).
      for (const c of SEVEN) assert.ok(ours.includes(`>${c.name}<`), `${look} names ${c.name}`);
    }
  }
});

test('2b · with only two colours every look still draws both', async () => {
  const { DressCodeWidget } = await import('./dress-code-widget');
  const two = { title: 'Black tie', palette: [SEVEN[0], SEVEN[2]] };
  for (const look of LOOKS) {
    const ours = block(html(h(DressCodeWidget, { words: WORDS, config: two, paletteLook: look } as never)), 'ours');
    const two2 = ['#351115', '#EFE3B8'];
    assert.deepEqual(drawn(ours), look === 'circles' ? [...two2, ...two2] : two2, `${look} draws two colours`);
  }
});

test('3 · the role rows follow the look at row size — every hex, in order', async () => {
  const shipped = block(await render({}), 'roles');
  const want = drawn(shipped);
  assert.ok(want.length > 0, 'the fixture dresses a role with colours');
  for (const look of LOOKS.filter((l) => l !== 'tags')) {
    const rows = block(await render({ paletteLook: look }), 'roles');
    assert.deepEqual(drawn(rows), want, `${look}: the same colours on the role rows`);
    assert.match(rows, new RegExp(`data-pal-row="${look}"`));
    assert.doesNotMatch(rows, /data-pal-look/, 'row size has no entrance — the rows already arrive one by one');
  }
});

test('4 · the reader\'s own panel follows the look', async () => {
  const mine = await render({ guestRole: 'principal_sponsor_ninang' });
  const want = drawn(block(mine, 'you'));
  assert.ok(want.length > 0, 'the ninang is shown her colours');
  for (const look of LOOKS) {
    const you = block(await render({ guestRole: 'principal_sponsor_ninang', paletteLook: look }), 'you');
    assert.deepEqual(drawn(you), look === 'circles' ? [...want, ...want] : want, `${look}: her colours, in order`);
    assert.match(you, new RegExp(`data-pal-look="${look}"`));
  }
});

test('5 · "The palette" and "The line" layouts draw the colours their own way, whatever the look', async () => {
  for (const sceneStyle of ['palette', 'line']) {
    const base = await render({ sceneStyle });
    for (const look of LOOKS) {
      assert.equal(await render({ sceneStyle, paletteLook: look }), base, `${sceneStyle} is untouched by ${look}`);
    }
  }
});
