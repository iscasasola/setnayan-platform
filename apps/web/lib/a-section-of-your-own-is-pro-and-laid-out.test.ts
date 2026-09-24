/**
 * a-section-of-your-own-is-pro-and-laid-out.test.ts — Event Hub Build 4.
 *
 * The couple's own sections shipped 2026-09-23 (`a-section-of-your-own.test.ts`)
 * as words only, free, with no way to take one back off. Build 4 (controller
 * 2026-09-24) adds four things, one section each below:
 *
 *   1. PRO — adding is arranging (owner 2026-09-22: "Free is the page we write.
 *      Pro is changing how it looks"); a couple who already has words keeps
 *      editing them; removing is never locked.
 *   2. LAYOUT — the story's four chapter arrangements, a closed set, with the
 *      section's photo behind, beside, or absent; every one stacks at 375px.
 *   3. DELETE — a real remove, so the slot is free again.
 *   4. LIMITS — ONE home (the recap's CUSTOM_COLUMN_*), refused at the door and
 *      dropped on read, never silently cut.
 *
 * Every decision is a pure function asked what it RETURNS; the source reads at
 * the bottom only prove the server actions are wired to those functions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;

import {
  CUSTOM_COLUMN_BODY_MAX,
  CUSTOM_COLUMN_TITLE_MAX,
  CUSTOM_SECTION_TYPES,
  customSectionIntent,
  customSectionWriteAllowed,
  nextFreeCustomSlot,
  readCustomSectionInput,
} from './custom-sections';
import * as recap from '../app/[slug]/_components/editorial/custom-columns';
import { EDITORIAL_ORDERABLE_KEYS } from '../app/[slug]/_components/editorial/editorial-order';
import { HUB_ARRANGEMENTS, hubArrangement, hubCanvasClass, hubPhotoPlacement } from './hub-canvas';
import { WIDGET_PHASES, WIDGET_TYPES } from './invitation-widgets';

const PUBLIC = 'r2://setnayan-media/events/E1/our-photos/a.jpg';
const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

/* ══ 1. THE PRO LINE ═════════════════════════════════════════════════════ */

test('⛔ adding a section is Pro — and nothing else about a free couple changes that', () => {
  assert.equal(customSectionWriteAllowed({ intent: 'add', ownsPro: true, hadContent: false }), true);
  assert.equal(customSectionWriteAllowed({ intent: 'add', ownsPro: false, hadContent: false }), false);
  assert.equal(
    customSectionWriteAllowed({ intent: 'add', ownsPro: false, hadContent: true }),
    false,
    'having words in ANOTHER section is not a licence to add a new one',
  );
});

test('⛔ the grandfather rule — words already on the page stay editable without Pro', () => {
  for (const intent of ['save', 'arrange'] as const) {
    assert.equal(customSectionWriteAllowed({ intent, ownsPro: true, hadContent: false }), true);
    assert.equal(customSectionWriteAllowed({ intent, ownsPro: false, hadContent: true }), true, `${intent} keeps working`);
    assert.equal(customSectionWriteAllowed({ intent, ownsPro: false, hadContent: false }), false, `${intent} on an empty slot is Pro`);
  }
});

test('⛔ removing your own words is never locked', () => {
  for (const ownsPro of [true, false]) {
    for (const hadContent of [true, false]) {
      assert.equal(customSectionWriteAllowed({ intent: 'delete', ownsPro, hadContent }), true);
    }
  }
});

test('⛔ the intent is a closed set — absent is the old save, anything else refused', () => {
  assert.equal(customSectionIntent(null), 'save', 'every form posted before Build 4 still saves');
  assert.equal(customSectionIntent(''), 'save');
  assert.equal(customSectionIntent('arrange'), 'arrange');
  assert.equal(customSectionIntent('delete'), 'delete');
  for (const junk of ['Delete', 'add', 'drop', 42, {}]) {
    assert.equal(customSectionIntent(junk), null, `${String(junk)} is not an intent`);
  }
});

/* ══ 2. LAYOUT ═══════════════════════════════════════════════════════════ */

test('⛔ the four chapter arrangements, and only those four', () => {
  assert.deepEqual([...HUB_ARRANGEMENTS].sort(), ['full', 'left', 'right', 'text']);
  for (const a of HUB_ARRANGEMENTS) assert.equal(hubArrangement(a), a);
  for (const junk of ['Left', 'centre', 'grid', '', 1, null, undefined, ['left']]) {
    assert.equal(hubArrangement(junk), null, `${JSON.stringify(junk)} is dropped, not repaired`);
  }
});

test('⭐ where the photo goes — behind, beside, or nowhere', () => {
  assert.equal(hubPhotoPlacement({}, true), 'behind', 'the default is the shipped background');
  assert.equal(hubPhotoPlacement({ arrangement: 'full' }, true), 'behind');
  assert.equal(hubPhotoPlacement({ arrangement: 'left' }, true), 'beside');
  assert.equal(hubPhotoPlacement({ arrangement: 'right' }, true), 'beside');
  assert.equal(hubPhotoPlacement({ arrangement: 'text' }, true), 'none', '"Words only" means words only');
  for (const a of HUB_ARRANGEMENTS) {
    assert.equal(hubPhotoPlacement({ arrangement: a }, false), 'none', `${a} with no resolved photo draws none`);
  }
  assert.match(hubCanvasClass({ arrangement: 'left' }, true), /\bhub-photo-beside\b/);
  assert.doesNotMatch(hubCanvasClass({ arrangement: 'left' }, true), /\bhub-has-media\b/, 'never both layers');
  assert.match(hubCanvasClass({ arrangement: 'text' }, true), /\bhub-no-media\b/);
});

test('⭐ the frame draws exactly the layer the placement names', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubCanvasFrame } = await import('../app/[slug]/_components/hub-canvas-frame');
  const Frame = HubCanvasFrame as unknown as React.FunctionComponent<Record<string, unknown>>;
  const draw = (arrangement: string) =>
    renderToStaticMarkup(
      React.createElement(
        Frame,
        {
          widget: { widget_id: 'W', event_id: 'E', widget_type: 'custom_1', config_json: { canvas: { media: PUBLIC, arrangement, focal: 3 } } },
          mediaUrls: { [PUBLIC]: 'https://example.test/p.jpg' },
        },
        React.createElement('section', null, React.createElement('p', null, 'words')),
      ),
    );

  for (const side of ['left', 'right']) {
    const html = draw(side);
    assert.match(html, new RegExp(`hub-arr-${side}`));
    assert.match(html, /class="hub-canvas-photo"/, `${side}: the photo gets its own column`);
    assert.doesNotMatch(html, /class="hub-canvas-media"/, `${side}: and no background layer under the words`);
    assert.match(html, /--hub-focal:\s*100% 0%/, 'the 3x3 focal point reaches the photo');
    const img = /<div class="hub-canvas-photo-img"([^>]*)>([\s\S]*?)<\/div>/.exec(html);
    assert.ok(img, 'the picture layer renders');
    assert.equal((img?.[2] ?? '').trim(), '', 'and it is CHILDLESS — nothing may sit under its transform');
  }
  const words = draw('text');
  assert.doesNotMatch(words, /hub-canvas-photo|hub-canvas-media|--hub-media/, 'words only: no picture at all');
  assert.match(words, /<p>words<\/p>/);
  const full = draw('full');
  assert.match(full, /class="hub-canvas-media"/, 'full: the shipped background, unchanged');
  assert.doesNotMatch(full, /hub-canvas-photo/);
});

test('📱 every layout stacks at 375px — two columns only from 768px', () => {
  const css = read('app', 'globals.css');
  const base = css.indexOf('.hub-photo-beside {');
  assert.ok(base > 0, 'the beside rule exists');
  const baseBody = css.slice(css.indexOf('{', base) + 1, css.indexOf('}', base));
  assert.match(baseBody, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/, 'ONE column by default');
  // Every two-column declaration for it must sit inside a min-width media block.
  const twoCol = /\.hub-photo-beside\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/g;
  const hits = [...css.matchAll(twoCol)];
  assert.equal(hits.length, 1, 'exactly one two-column rule');
  const before = css.slice(0, hits[0]!.index);
  const media = before.lastIndexOf('@media');
  assert.match(before.slice(media, media + 40), /@media \(min-width: 768px\)/, 'and it is behind 768px');
  assert.equal(before.slice(media).split('}').length - 1, 0, 'and still inside that block');
});

/* ══ 3. DELETE ═══════════════════════════════════════════════════════════ */

test('⭐ a removed section frees its slot', () => {
  const before = ['custom_1', 'custom_2', 'custom_3', 'custom_4', 'custom_5', 'custom_6'];
  assert.equal(nextFreeCustomSlot(before), null, 'all six taken');
  assert.equal(nextFreeCustomSlot(before.filter((t) => t !== 'custom_4')), 'custom_4', 'the removed one is handed out again');
});

/* ══ 4. LIMITS ═══════════════════════════════════════════════════════════ */

test('⛔ one home for the limits — the recap\'s, imported', () => {
  assert.equal(CUSTOM_COLUMN_TITLE_MAX, recap.CUSTOM_COLUMN_TITLE_MAX);
  assert.equal(CUSTOM_COLUMN_BODY_MAX, recap.CUSTOM_COLUMN_BODY_MAX);
  const src = read('lib', 'custom-sections.ts');
  assert.doesNotMatch(src, /_MAX\s*=\s*\d/, 'no local copy of a limit in custom-sections.ts');
  const panel = read('app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'sections-panel.tsx');
  assert.match(panel, /maxLength=\{CUSTOM_COLUMN_TITLE_MAX\}/, 'the heading input carries the limit');
  assert.match(panel, /maxLength=\{CUSTOM_COLUMN_BODY_MAX\}/, 'the words input carries the limit');
});

test('⛔ the write door REFUSES over the limit — it never cuts a sentence', () => {
  const T = CUSTOM_COLUMN_TITLE_MAX;
  const B = CUSTOM_COLUMN_BODY_MAX;
  assert.deepEqual(readCustomSectionInput('x'.repeat(T), 'y'.repeat(B)), {
    ok: true,
    value: { title: 'x'.repeat(T), body: 'y'.repeat(B) },
  });
  assert.deepEqual(readCustomSectionInput('x'.repeat(T + 1), 'ok'), { ok: false, reason: 'too_long' });
  assert.deepEqual(readCustomSectionInput('ok', 'y'.repeat(B + 1)), { ok: false, reason: 'too_long' });
  assert.deepEqual(readCustomSectionInput('  Hi  ', '  there  '), { ok: true, value: { title: 'Hi', body: 'there' } });
  assert.deepEqual(readCustomSectionInput(null, 7), { ok: true, value: { title: '', body: '' } });
});

test('🪤 a browser\'s CRLF is one character, as maxLength counted it', () => {
  // 40 lines of 99 chars + 39 breaks = exactly the body limit when each break is 1.
  const line = 'z'.repeat(99);
  const lf = Array.from({ length: 40 }, () => line).join('\n');
  assert.equal(lf.length, 40 * 99 + 39);
  const padded = lf + 'z'.repeat(CUSTOM_COLUMN_BODY_MAX - lf.length);
  assert.equal(padded.length, CUSTOM_COLUMN_BODY_MAX, 'precondition: exactly at the limit with LF');
  const crlf = padded.replace(/\n/g, '\r\n');
  assert.ok(crlf.length > CUSTOM_COLUMN_BODY_MAX, 'precondition: the POSTed form is longer');
  const r = readCustomSectionInput('', crlf);
  assert.equal(r.ok, true, 'a body the editor allowed is not refused for its line breaks');
  assert.equal(r.ok && r.value.body, padded, 'and it is stored with plain line breaks');
});

/* ══ THE SHIPPED SETS STAY CLOSED ════════════════════════════════════════ */

test('⛔ a custom section is a new keyed type, not a hole in a shipped record', () => {
  // The recap's shipped run is still exactly its shipped keys.
  for (const k of EDITORIAL_ORDERABLE_KEYS) {
    assert.doesNotMatch(k, /custom/, `${k}: the editorial record stays closed`);
  }
  // And the hub's per-type record is exhaustive over EVERY type, custom ones included.
  for (const t of WIDGET_TYPES) assert.ok(WIDGET_PHASES[t], `${t} missing from WIDGET_PHASES`);
  for (const t of CUSTOM_SECTION_TYPES) assert.ok((WIDGET_TYPES as readonly string[]).includes(t));
});

/* ══ THE SERVER ACTIONS ARE WIRED TO THE DECISIONS ABOVE ═════════════════ */

const ACTIONS = read('app', 'dashboard', '[eventId]', 'website', 'widgets', 'actions.ts');
const fnBody = (name: string) => {
  const at = ACTIONS.indexOf(`export async function ${name}`);
  assert.ok(at > 0, `${name} exists`);
  const next = ACTIONS.indexOf('\nexport async function ', at + 10);
  return ACTIONS.slice(at, next < 0 ? undefined : next);
};

test('⛔ no new server action — Build 4 rides the two that exist', () => {
  const exported = [...ACTIONS.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(exported, [
    'addCustomSection',
    'moveWidgetDown',
    'moveWidgetUp',
    'saveCustomSection',
    'setSectionMode',
    'setWidgetBackground',
    'setWidgetCrop',
    'setWidgetMotion',
    'toggleWidgetVisibility',
  ]);
});

test('⛔ add refuses a free couple BEFORE it inserts', () => {
  const body = fnBody('addCustomSection');
  const gate = body.indexOf('refuseCustomSectionWithoutPro(');
  const pro = body.indexOf('eventCoupleWebsiteProActive(');
  const insert = body.indexOf('.insert(');
  assert.ok(gate > 0 && pro > 0 && insert > 0);
  assert.ok(gate < insert && pro < insert, 'the Pro check runs before the row exists');
});

test('⛔ save gates every intent, and a delete counts what it removed', () => {
  const body = fnBody('saveCustomSection');
  assert.match(body, /customSectionIntent\(formData\.get\('intent'\)\)/);
  const gate = body.indexOf('refuseCustomSectionWithoutPro(');
  assert.ok(gate > 0, 'the Pro line is consulted');
  for (const write of ['.delete()', '.update(']) {
    const at = body.indexOf(write);
    assert.ok(at > gate, `${write} happens only after the Pro line`);
  }
  assert.match(body, /isCustomSectionType\(row\.widget_type\)/, 'only a slot the couple added may be removed');
  assert.match(body, /\.delete\(\)[\s\S]{0,120}\.select\('widget_id'\)/, 'a refused delete is zero rows, not an error — it must be counted');
  assert.match(body, /readCustomSectionInput\(/, 'words go through the refusing door');
  assert.match(body, /hubArrangement\(formData\.get\('arrangement'\)\)/, 'the layout goes through the closed set');
});

/* ══ THE EDITOR ══════════════════════════════════════════════════════════ */

test('⛔ a free couple sees it NAMED and LOCKED — never an Add button, never hidden', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SectionsPanel } = await import('../app/dashboard/[eventId]/website/editor/_components/sections-panel');
  const noop = () => undefined;
  const LOCK = React.createElement('p', { 'data-lock': 'yes' }, 'LOCKED');
  const rows = [
    { widget_id: 'A', event_id: 'E', widget_type: 'custom_1', display_order: 1, is_visible: true, is_always_on: false, config_json: { custom: { body: 'We met in 2019.' } } },
    { widget_id: 'B', event_id: 'E', widget_type: 'custom_2', display_order: 2, is_visible: true, is_always_on: false, config_json: null },
  ];
  const render = (ownsPro: boolean) =>
    renderToStaticMarkup(
      React.createElement(SectionsPanel, {
        eventId: 'E',
        rows: rows as never,
        contentMap: {},
        toggleAction: noop,
        moveUpAction: noop,
        moveDownAction: noop,
        setModeAction: noop,
        saveCustomAction: noop,
        addCustomAction: noop,
        ownsPro,
        customLock: LOCK,
      }),
    );

  const free = render(false);
  assert.doesNotMatch(free, /Add a section of your own/, 'no Add button for a free couple');
  assert.match(free, /A section of your own/, 'but the feature is named');
  assert.equal((free.match(/data-lock="yes"/g) ?? []).length, 2, 'locked twice: the empty slot and Add');
  assert.equal((free.match(/name="title"/g) ?? []).length, 1, 'the slot WITH words keeps its editor (grandfather)');
  assert.equal((free.match(/value="delete"/g) ?? []).length, 2, 'and both can still be removed');

  const pro = render(true);
  assert.match(pro, /Add a section of your own/);
  assert.doesNotMatch(pro, /data-lock/);
  assert.equal((pro.match(/name="title"/g) ?? []).length, 2);
  assert.equal((pro.match(/name="arrangement"/g) ?? []).length, 2 * HUB_ARRANGEMENTS.length, 'four layouts per section');
  assert.match(pro, /<details[\s\S]*?Remove this section[\s\S]*?Remove for good/, 'remove asks twice, with no script');
});
