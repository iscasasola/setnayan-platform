/**
 * a-section-of-your-own.test.ts — "A BLANK SCREEN IN BETWEEN", built.
 *
 * Owner, 2026-09-23: *"they can add a blank screen in between, to create
 * content on the website as well, correct?"*
 *
 * "IN BETWEEN" is the requirement, and it is why these are widgets rather than
 * a table of their own: `display_order` is what puts a section between two
 * others, and a second table would carry a second order for the same fact.
 *
 * Three properties matter, each with its own section:
 *   ⛔ an EMPTY section never reaches a guest — a heading over a blank reads as
 *      a broken page, and an unadded slot must not read as an empty one;
 *   ⛔ the ceiling is a SHAPE — six names in the list, the same six in the
 *      database CHECK, so a seventh has no path at all;
 *   ⛔ the words are TEXT — `config_json` is host-writable, and nothing in it
 *      may become markup on a guest's page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;

import {
  CUSTOM_COLUMN_BODY_MAX,
  CUSTOM_SECTION_TYPES,
  CUSTOM_COLUMN_TITLE_MAX,
  customSectionHasContent,
  nextFreeCustomSlot,
  sanitizeCustomSection,
} from './custom-sections';
import { WIDGET_CATALOG, WIDGET_PHASES, WIDGET_SPOTLIGHT, WIDGET_TYPES } from './invitation-widgets';
import { customSectionContentMap } from './website-section-content';

const MIGRATION = readFileSync(
  join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20271242789193_the_couple_writes_their_own_section.sql'),
  'utf8',
);

/* ══ EMPTY NEVER PUBLISHES ═════════════════════════════════════════════ */

test('⛔ a heading with no words is not a section', () => {
  assert.equal(customSectionHasContent({ custom: { title: 'Our vows' } }), false);
  assert.equal(customSectionHasContent({ custom: { title: 'Our vows', body: '   ' } }), false);
  assert.equal(customSectionHasContent({ custom: { title: '', body: 'We met in 2019.' } }), true);
});

test('⛔ and the renderer agrees — an empty slot draws nothing at all', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomSectionWidget } = await import('../app/[slug]/_components/custom-section-widget');
  assert.equal(
    renderToStaticMarkup(React.createElement(CustomSectionWidget, { config: { custom: { title: 'Our vows' } } })),
    '',
    'a title alone renders nothing — not an empty section with a heading',
  );
  const filled = renderToStaticMarkup(
    React.createElement(CustomSectionWidget, { config: { custom: { title: 'Our vows', body: 'Line one\nLine two' } } }),
  );
  assert.match(filled, /Our vows/);
  assert.match(filled, /Line one/);
  // A section with words and no heading is legal — a bare passage in between.
  const untitled = renderToStaticMarkup(
    React.createElement(CustomSectionWidget, { config: { custom: { body: 'Just words.' } } }),
  );
  assert.match(untitled, /Just words\./);
  assert.doesNotMatch(untitled, /pahina-eyebrow/, 'no empty heading block');
});

test('⛔ a slot NEVER ADDED contributes no key — it must not read as empty', () => {
  /*
    🪤 THIS WAS A SOURCE GREP AND THE SABOTAGE WALKED PAST IT. The first version
    forbade `CUSTOM_SECTION_TYPES.map|forEach` in the resolver's body — so a
    sabotage that wrote `for (const t of CUSTOM_SECTION_TYPES) out[t] = false`
    left it green while the editor was told five sections were empty that had
    never been created. A ban on a PHRASING cannot see a rephrasing; this asks
    the function what it returns.

    Why it matters: `hasContent` fails OPEN for a key it was never given, and
    `setSectionMode('shown')` refuses a section whose content map says false —
    "add its content first" — for a section that does not exist.
  */
  assert.deepEqual(customSectionContentMap(undefined), {}, 'no rows, no keys');
  assert.deepEqual(customSectionContentMap([]), {}, 'an event with no sections claims nothing');

  const map = customSectionContentMap([
    { widget_type: 'custom_1', config_json: { custom: { body: 'We met in 2019.' } } },
    { widget_type: 'custom_3', config_json: { custom: { title: 'Heading only' } } },
    { widget_type: 'our_love_story', config_json: null },
  ]);
  assert.deepEqual(
    Object.keys(map).sort(),
    ['custom_1', 'custom_3'],
    'exactly the slots that EXIST — not all six, and not the shipped types',
  );
  assert.equal(map.custom_1, true, 'the one with words has content');
  assert.equal(map.custom_3, false, 'the one with only a heading does not');
  for (const t of CUSTOM_SECTION_TYPES) {
    if (t === 'custom_1' || t === 'custom_3') continue;
    assert.equal(t in map, false, `${t} was never added and must not be claimed empty`);
  }
});

/* ══ THE CEILING IS A SHAPE ════════════════════════════════════════════ */

test('⛔ six names, and the DATABASE names the same six', () => {
  assert.equal(CUSTOM_SECTION_TYPES.length, 6);
  for (const t of CUSTOM_SECTION_TYPES) {
    assert.ok(MIGRATION.includes(`'${t}'`), `${t} must be in the CHECK, or a save is refused`);
  }
  assert.ok(!MIGRATION.includes("'custom_7'") || MIGRATION.includes('custom_7 was accepted'),
    'custom_7 may appear ONLY inside the proof that it is refused');
  // The widened CHECK must not have dropped a shipped type.
  for (const t of ['our_love_story', 'special_message', 'schedule', 'rsvp']) {
    assert.ok(MIGRATION.includes(`'${t}'`), `${t} must survive the widened CHECK`);
  }
});

test('⛔ there is no seventh slot to hand out', () => {
  assert.equal(nextFreeCustomSlot([]), 'custom_1');
  assert.equal(nextFreeCustomSlot(['custom_1', 'custom_3']), 'custom_2', 'a gap is reused');
  assert.equal(nextFreeCustomSlot([...CUSTOM_SECTION_TYPES]), null, 'and six is the end of it');
});

test('⭐ every slot joined ALL FOUR registries — a type in one is invisible in the rest', () => {
  for (const t of CUSTOM_SECTION_TYPES) {
    assert.ok((WIDGET_TYPES as readonly string[]).includes(t), `${t} missing from WIDGET_TYPES`);
    assert.ok(WIDGET_PHASES[t], `${t} missing from WIDGET_PHASES — it would render in no phase`);
    assert.ok(WIDGET_SPOTLIGHT[t], `${t} missing from WIDGET_SPOTLIGHT — open-browse would not order it`);
    assert.ok(WIDGET_CATALOG.some((c) => c.type === t), `${t} missing from WIDGET_CATALOG — the editor row would be unlabelled`);
  }
  assert.equal(WIDGET_PHASES.custom_1?.length, 4, 'a custom section is available in every phase');
  assert.equal(
    WIDGET_CATALOG.find((c) => c.type === 'custom_2')?.is_always_on,
    false,
    'it must be hideable, or the couple could never take it down',
  );
});

/* ══ THE WORDS ARE TEXT ════════════════════════════════════════════════ */

test('⛔ nothing a host writes becomes markup on a guest page', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomSectionWidget } = await import('../app/[slug]/_components/custom-section-widget');
  const html = renderToStaticMarkup(
    React.createElement(CustomSectionWidget, {
      config: { custom: { title: '<img src=x onerror=alert(1)>', body: '<script>alert(2)</script>' } },
    }),
  );
  /*
    🪤 THE PROPERTY IS "NO TAG AND NO ATTRIBUTE", NOT "NOT THIS SUBSTRING". The
    first version forbade `onerror=` anywhere in the output — but the couple's
    words are a TEXT NODE, so the characters `onerror=alert(1)` appear in it,
    escaped and inert, exactly as they should. The guard failed on a page that
    was completely safe. What must not exist is a TAG the couple's words opened,
    or an attribute on one.
  */
  const tags = [...html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)];
  assert.ok(tags.length > 0, 'precondition: the section rendered some markup of its own');
  for (const [, name, attrs] of tags) {
    assert.ok(
      ['section', 'p', 'span'].includes((name ?? '').toLowerCase()),
      `the couple's words opened a <${name}> — nothing they type may become an element`,
    );
    assert.doesNotMatch(attrs ?? '', /\son[a-z]+\s*=/i, `an event handler reached <${name}>`);
  }
  assert.match(html, /&lt;script&gt;/, 'the characters are escaped and shown as text');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/, 'the title too — inert, and visible as typed');
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'custom-section-widget.tsx'), 'utf8');
  assert.doesNotMatch(src, /dangerouslySetInnerHTML/, 'and there is no path to raw HTML');
});

test('⛔ stored config is data — over the limit DROPPED (never cut), trimmed, never assumed', () => {
  assert.deepEqual(sanitizeCustomSection(null), { title: '', body: '' });
  assert.deepEqual(sanitizeCustomSection('a string'), { title: '', body: '' });
  assert.deepEqual(sanitizeCustomSection({ custom: { title: 42, body: [] } }), { title: '', body: '' });
  // 2026-09-24: was "bounded" (truncated). Now the recap's rule — a section cut
  // in half is a sentence we lost for them; see `sanitizeCustomSection`.
  assert.deepEqual(
    sanitizeCustomSection({ custom: { title: 'x'.repeat(CUSTOM_COLUMN_TITLE_MAX + 1), body: 'ok' } }),
    { title: '', body: '' },
  );
  assert.deepEqual(
    sanitizeCustomSection({ custom: { title: 'ok', body: 'y'.repeat(CUSTOM_COLUMN_BODY_MAX + 1) } }),
    { title: '', body: '' },
  );
  const atLimit = sanitizeCustomSection({
    custom: { title: 'x'.repeat(CUSTOM_COLUMN_TITLE_MAX), body: 'y'.repeat(CUSTOM_COLUMN_BODY_MAX) },
  });
  assert.equal(atLimit.title.length, CUSTOM_COLUMN_TITLE_MAX, 'exactly at the limit survives whole');
  assert.equal(atLimit.body.length, CUSTOM_COLUMN_BODY_MAX);
  assert.deepEqual(sanitizeCustomSection({ custom: { title: '  Hi  ', body: '  there  ' } }), {
    title: 'Hi',
    body: 'there',
  });
});

test('⛔ the writer MERGES config_json — saving words keeps the arrangement', () => {
  const actions = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'widgets', 'actions.ts'),
    'utf8',
  );
  const at = actions.indexOf('export async function saveCustomSection');
  assert.ok(at > 0);
  const body = actions.slice(at);
  assert.match(body, /\.\.\.existing, custom/, 'the canvas lives in the same bag and must survive');
  assert.match(body, /isCustomSectionType\(row\.widget_type\)/, 'words only go on a slot that has words');
  assert.match(body, /requireHostMembershipOrThrow/);
  const addAt = actions.indexOf('export async function addCustomSection');
  assert.ok(addAt > 0);
  assert.match(actions.slice(addAt), /nextFreeCustomSlot\(used\)/, 'add takes the next free slot');
  assert.match(actions.slice(addAt), /no_free_section/, 'and says so when there is none');
});
