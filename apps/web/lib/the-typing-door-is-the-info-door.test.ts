/**
 * ⌨️ THE TYPING DOOR IS THE INFO DOOR — one value, two doors (DECISION_LOG
 * 2026-10-06 "PLAIN WORDS ARE TYPED ON THE PAGE AND SAVED TO STUDIO › INFO").
 *
 *   1. Every `info:` part names a field with exactly ONE key, and that key is the
 *      field itself — the draft column the page writes. Sabotage: give a door a
 *      second key ("message") → red.
 *   2. Where the page types a field today, the shipped writer writes THAT column,
 *      to the DRAFT (guests see nothing until ✓ Apply).
 *   3. Where Studio › Info's door ships, it carries that same key.
 *   4. The guest's name in "Dear Ana," is never typeable — only the hero's parts are.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAKER_INFO_DOORS, MAKER_INFO_FIELDS, MAKER_PART_KEYS, makerPartSource } from './maker-parts';
import { sceneTypeWrite } from './scene-type-words';
import { HUB_TYPE_WORD_PARTS, HUB_TYPE_FACT_PARTS, isSceneTypeField } from './hub-part-words';
import { SAME_FIELD_ATTR } from '../app/dashboard/[eventId]/launch/_components/same-field';
import { typeablePart } from '../app/[slug]/_components/type-in-place-canvas';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('every info part names one field, and its one key is the field itself', () => {
  const info = MAKER_PART_KEYS.map((k) => [k, makerPartSource(k)] as const).filter(([, s]) => s.kind === 'info');
  assert.ok(info.length >= 4, 'the plain-text parts are info parts');
  for (const [k, s] of info) {
    if (s.kind !== 'info') continue;
    assert.ok((MAKER_INFO_FIELDS as readonly string[]).includes(s.field), `${k}: ${s.field} is a known field`);
    const door = MAKER_INFO_DOORS[s.field];
    assert.ok(door, `${k}: ${s.field} has its two doors`);
    if (door.sameField !== null) assert.equal(door.sameField, s.field, `${k}: ONE key — the Info door's key is the field (${s.field}), never a second name`);
  }
});

test('where the page types a field, the shipped writer writes that column — to the draft', () => {
  for (const [field, door] of Object.entries(MAKER_INFO_DOORS)) {
    if (door.page === null) continue;
    if (isSceneTypeField(door.page)) {
      const w = sceneTypeWrite(door.page, field === 'special_message' ? 'special_message' : 'what_to_bring', 'Bring a shawl.', null);
      assert.ok(w.ok, `${field}: the page's write is accepted`);
      if (!w.ok) continue;
      assert.equal(w.writeKey, `events:${field}`, `${field}: the page writes events.${field}`);
      assert.deepEqual(Object.keys(w.patch.events ?? {}), [field], `${field}: one column, the draft's`);
    } else if (door.page === 'names') {
      const bar = read('app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx');
      assert.ok(HUB_TYPE_FACT_PARTS.includes('names'), 'the names are typed on the page');
      assert.match(bar, new RegExp(`NAMES_WRITE_KEY = 'event:${field}'`), `${field}: the names bar writes events.${field}`);
      assert.match(bar, new RegExp(`events: \\{ ${field}: name \\}`), `${field}: …as a draft patch`);
    } else {
      assert.ok(HUB_TYPE_WORD_PARTS.includes(door.page), `${field}: the hero's ${door.page} is typed on the page`);
    }
  }
  /* The bar saves through the draft door only (intent=save) — Apply publishes. */
  const bar = read('app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx');
  assert.match(bar, /fd\.set\('intent', 'save'\)/, 'typed words are a draft save');
});

test("where Studio › Info's door ships, it carries the same key", () => {
  assert.equal(SAME_FIELD_ATTR, 'data-same-field');
  const where: Record<string, string> = {
    special_message: 'app/dashboard/[eventId]/launch/_components/special-message-field.tsx',
    what_to_bring: 'app/dashboard/[eventId]/website/editor/page.tsx',
    opening_line: 'app/dashboard/[eventId]/launch/_components/opening-line-field.tsx',
  };
  for (const [field, door] of Object.entries(MAKER_INFO_DOORS)) {
    if (door.sameField === null) continue;
    const file = where[field];
    assert.ok(file, `${field}: this test knows its Info door`);
    const src = read(file!);
    assert.ok(src.includes(`data-same-field="${door.sameField}"`) || src.includes(`sameField="${door.sameField}"`), `${field}: its Info door carries "${door.sameField}"`);
  }
  assert.match(read('app/dashboard/[eventId]/website/editor/_components/text-panel.tsx'), /data-same-field=\{sameField\}/, 'the Reminders box wears its key');
});

test('the guest’s own name is never typeable — only the hero’s parts take a caret', () => {
  const part = { getAttribute: (a: string) => (a === 'data-el' ? 'names' : null) } as unknown as HTMLElement;
  assert.equal(typeablePart(part, 'f:greeting'), null, '"Dear Ana," — the guest name fills itself in');
  assert.equal(typeablePart(part, 'f:hero'), 'names', 'the couple’s names on the hero are typed');
});
