/**
 * hub-tools.test.ts — the ONE shared Hub tool library, the approved seed and the reader (admin supplier slice, owner
 * 2026-10-28 "HUB TOOLS BY SERVICE — … ONE SHARED LIBRARY, NEVER PER-SERVICE COPIES").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HUB_TOOLS_FALLBACK,
  HUB_TOOLS_SEED,
  HUB_TOOL_LIBRARY,
  HUB_TOOL_RECORDS,
  HUB_TOOL_TEMPLATES,
  SCAN_MODES,
  hubToolsFor,
  isHubToolKey,
  parseHubToolsSave,
} from './hub-tools';

test('the seed is the approved prototype: 80 services, every tool from the one library, every mode one of five', () => {
  assert.equal(HUB_TOOLS_SEED.length, 80);
  assert.equal(SCAN_MODES.length, 5);
  for (const r of HUB_TOOLS_SEED) {
    for (const t of r.tools) assert.ok(isHubToolKey(t), `${r.category}: "${t}" is not in the library`);
    assert.ok(SCAN_MODES.some((m) => m.key === r.scan), `${r.category}: unknown scan mode ${r.scan}`);
  }
  for (const t of HUB_TOOL_LIBRARY) assert.ok(HUB_TOOL_TEMPLATES.some((x) => x.key === t.template), `${t.key} has no template`);
  assert.equal(HUB_TOOL_TEMPLATES.length, 8, 'the owner approved EIGHT shared templates');
  const keys = HUB_TOOL_LIBRARY.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length, 'a tool appears twice in the library — a per-service copy');
});

test('the reader: a saved row wins; a removed tool is dropped; an unseeded category gets the catch-all', () => {
  const saved = hubToolsFor('Catering', { tools: ['headcount', 'not_a_tool', 'tables_and_seating'], scan_default: 'roaming' });
  // A tool turned off in the library (Turn off keeps data) drops out of the answer; its stored switch is untouched.
  const withoutHeadcount = HUB_TOOL_RECORDS.filter((t) => t.key !== 'headcount');
  assert.deepEqual(hubToolsFor('Catering', { tools: ['headcount'], scan_default: 'once' }, withoutHeadcount).tools, []);
  // A tool the Tool maker adds later is just another record.
  const later = [...HUB_TOOL_RECORDS, { key: 'gift_table', label: 'Gift table', template: 'checklist' as const }];
  assert.deepEqual(hubToolsFor('Catering', { tools: ['gift_table'], scan_default: 'once' }, later).tools, ['gift_table']);
  assert.ok(parseHubToolsSave({ categoryId: 'c', tools: ['gift_table'], scan: 'once' }, later));
  assert.equal(saved.source, 'saved');
  assert.deepEqual(saved.tools.slice().sort(), ['headcount', 'tables_and_seating']);
  assert.equal(saved.scan, 'roaming');

  const seed = hubToolsFor('catering', null);
  assert.equal(seed.source, 'seed');
  assert.ok(seed.tools.includes('headcount'));
  assert.equal(seed.scan, 'ordered_received');

  const loose = hubToolsFor('Photo and Video', null);
  assert.equal(loose.source, 'seed', '"&" and "and" must name the same category');

  const none = hubToolsFor('Underwater Basket Weaving', null);
  assert.equal(none.source, 'fallback');
  assert.deepEqual(none.tools, HUB_TOOLS_FALLBACK.tools);

  const emptySaved = hubToolsFor('Catering', { tools: [], scan_default: 'nope' });
  assert.deepEqual(emptySaved.tools, [], 'an admin who switched everything off keeps it off — never the seed again');
  assert.equal(emptySaved.scan, 'once');
});

test('the save refuses a tool or a mode the library does not hold', () => {
  assert.equal(parseHubToolsSave({ categoryId: 'c1', tools: ['headcount', 'made_up'], scan: 'once' }), null);
  assert.equal(parseHubToolsSave({ categoryId: 'c1', tools: ['headcount'], scan: 'sometimes' }), null);
  assert.equal(parseHubToolsSave({ categoryId: '', tools: [], scan: 'once' }), null);
  assert.deepEqual(parseHubToolsSave({ categoryId: ' c1 ', tools: ['tables_and_seating', 'headcount'], scan: 'unlimited' }), {
    categoryId: 'c1',
    tools: HUB_TOOL_RECORDS.filter((t) => t.key === 'headcount' || t.key === 'tables_and_seating').map((t) => t.key),
    scan: 'unlimited',
  });
});
