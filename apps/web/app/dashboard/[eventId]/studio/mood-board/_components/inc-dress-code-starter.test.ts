/**
 * inc-dress-code-starter.test.ts — an INC event's EMPTY dress code starts from
 * the modest guidance again, on BOTH surfaces that edit it, and opening the
 * form writes nothing (owner 2026-10-04, DECISION_LOG "YES TO ALL": "restore
 * the INC modest-dress starter text inside the Mood Board's dress-code form
 * (lost in #6318)").
 *
 * Holds:
 *   1. INC + empty  → pre-filled, and the one-line note renders above the form.
 *   2. INC + anything already set → returned untouched, no note.
 *   3. Not INC → no pre-fill.
 *   4. Rendering either form calls no action — the starter is form defaults.
 *   5. Both surfaces ask the ONE rule (`incDressCodeStarter`) and hand its flag on.
 *
 * 🪤 `globalThis.React` set before the dynamic import — see
 * `app/_components/byline-renders-as-a-door.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import {
  INC_DRESS_CODE_STARTER_NOTE,
  INC_DRESS_CODE_SUGGESTION,
  incDressCodeStarter,
} from './inc-dress-code-starter';
import { normalizeDressCodeConfig } from './dress-code-fields';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

/* Both forms import their save action, which reaches `server-only` — a module
   that does not resolve under the unit runner. Stubbed exactly as
   `app/dashboard/[eventId]/home-numbers-move.test.ts` does. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_inc_dress_code__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const EMPTY = () => normalizeDressCodeConfig({});
const INC = { ceremony_type: 'inc', secondary_ceremony_type: null };
const HERE = path.dirname(fileURLToPath(import.meta.url));

test('INC + empty dress code → pre-filled with the modest guidance', () => {
  const { config, started } = incDressCodeStarter(INC, EMPTY());
  assert.equal(started, true);
  assert.equal(config.title, 'Modest & formal');
  assert.match(config.description, /dress modestly and formally/);
  assert.deepEqual(config.dos, INC_DRESS_CODE_SUGGESTION.dos);
  assert.deepEqual(config.donts, INC_DRESS_CODE_SUGGESTION.donts);
  assert.ok(config.dos.length > 0 && config.donts.length > 0);
  // No colours, roles or groups are invented for the couple.
  assert.deepEqual(config.palette, []);
  assert.deepEqual(config.roles, {});
  assert.deepEqual(config.groups, {});
});

test('a mixed wedding with an INC SIDE is pre-filled too', () => {
  const { started } = incDressCodeStarter({ ceremony_type: 'catholic', secondary_ceremony_type: 'inc' }, EMPTY());
  assert.equal(started, true);
});

test('INC + a dress code already set → untouched', () => {
  const cases: Record<string, unknown>[] = [
    { title: 'Black tie' },
    { description: 'Anything blue.' },
    { dos: ['Wear blue'] },
    { donts: ['No white'] },
    { palette: [{ name: 'Sage', hex: '#9caf88' }] },
  ];
  for (const raw of cases) {
    const saved = normalizeDressCodeConfig(raw);
    const { config, started } = incDressCodeStarter(INC, saved);
    assert.equal(started, false, `starter fired over ${JSON.stringify(raw)}`);
    assert.equal(config, saved, `config was replaced over ${JSON.stringify(raw)}`);
  }
});

test('not INC → no pre-fill', () => {
  for (const event of [
    { ceremony_type: 'catholic', secondary_ceremony_type: null },
    { ceremony_type: null, secondary_ceremony_type: null },
    {},
    null,
    undefined,
  ]) {
    const saved = EMPTY();
    const { config, started } = incDressCodeStarter(event, saved);
    assert.equal(started, false);
    assert.equal(config, saved);
    assert.equal(config.title, '');
    assert.deepEqual(config.dos, []);
  }
});

test('the rule never mutates the saved config it was given', () => {
  const saved = EMPTY();
  const before = JSON.stringify(saved);
  incDressCodeStarter(INC, saved);
  assert.equal(JSON.stringify(saved), before);
});

test('the Maker panel: pre-filled + note for INC, writes nothing on render', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DressCodePanel } = await import(
    '../../../website/editor/_components/authoring-panels'
  );
  let calls = 0;
  const spy = async () => {
    calls += 1;
  };

  const started = incDressCodeStarter(INC, EMPTY());
  const html = renderToStaticMarkup(
    React.createElement(DressCodePanel, {
      action: spy,
      eventId: 'E1',
      config: started.config,
      incStarter: started.started,
      eventNoun: 'wedding',
    }),
  );
  assert.ok(html.includes('data-inc-dress-code-starter'), 'the note did not render');
  assert.ok(html.includes(INC_DRESS_CODE_STARTER_NOTE), 'the note says something else');
  assert.ok(html.includes('Modest &amp; formal'), 'the headline was not pre-filled');
  assert.ok(html.includes('Covered shoulders / sleeves'), 'the do’s were not pre-filled');
  assert.ok(html.includes('Sleeveless tops or bared shoulders'), 'the don’ts were not pre-filled');

  const plain = incDressCodeStarter({ ceremony_type: 'catholic' }, EMPTY());
  const plainHtml = renderToStaticMarkup(
    React.createElement(DressCodePanel, {
      action: spy,
      eventId: 'E1',
      config: plain.config,
      incStarter: plain.started,
      eventNoun: 'wedding',
    }),
  );
  assert.ok(!plainHtml.includes('data-inc-dress-code-starter'), 'a non-INC form shows the INC note');
  assert.ok(!plainHtml.includes('Modest &amp; formal'));

  assert.equal(calls, 0, 'rendering the form called its save action');
});

test('the Mood Board form: INC lists + note; existing lists untouched', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DressCodeListsForm } = await import('./dress-code-lists-form');

  const started = incDressCodeStarter(INC, EMPTY());
  const html = renderToStaticMarkup(
    React.createElement(DressCodeListsForm, {
      eventId: 'E1',
      dos: started.config.dos,
      donts: started.config.donts,
      inMaker: false,
      incStarter: started.started,
    }),
  );
  assert.ok(html.includes('data-inc-dress-code-starter'), 'the note did not render on the Mood Board');
  assert.ok(html.includes('Formal, modest attire'));
  assert.ok(html.includes('Plunging, sheer, or backless cuts'));

  const kept = incDressCodeStarter(INC, normalizeDressCodeConfig({ dos: ['Wear blue'] }));
  const keptHtml = renderToStaticMarkup(
    React.createElement(DressCodeListsForm, {
      eventId: 'E1',
      dos: kept.config.dos,
      donts: kept.config.donts,
      inMaker: false,
      incStarter: kept.started,
    }),
  );
  assert.ok(!keptHtml.includes('data-inc-dress-code-starter'));
  assert.ok(keptHtml.includes('Wear blue'));
  assert.ok(!keptHtml.includes('Formal, modest attire'));
});

test('both surfaces ask the one rule and hand its flag to the form', () => {
  const read = (rel: string) => readFileSync(path.join(HERE, rel), 'utf8');
  const moodBoard = read('mood-board-editor.tsx');
  const maker = read('../../../website/editor/page.tsx');
  for (const [name, src] of [
    ['Mood Board', moodBoard],
    ['Maker', maker],
  ] as const) {
    const calls = src.match(/\bincDressCodeStarter\(/g) ?? [];
    assert.equal(calls.length, 1, `${name}: expected one incDressCodeStarter( call, found ${calls.length}`);
  }
  assert.match(moodBoard, /incStarter=\{dressLists\.incStarter\}/, 'the Mood Board form is not told it was pre-filled');
  assert.match(maker, /incStarter=\{dressCodeIncStarter\}/, 'the Maker panel is not told it was pre-filled');

  // The rule is form defaults only: no client, no write.
  const rule = stripComments(read('inc-dress-code-starter.ts'));
  assert.doesNotMatch(rule, /supabase|\.(update|insert|upsert|rpc)\(|'use server'/);
});
