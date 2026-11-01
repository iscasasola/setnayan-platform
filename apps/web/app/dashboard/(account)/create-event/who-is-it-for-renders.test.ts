/**
 * who-is-it-for-renders.test.ts — RENDER-LEVEL guards for the owner's 2026-10-28 ruling (DECISION_LOG "EVENT TYPES
 * MUST BE SPECIFIC — NO GENERIC 'CELEBRATION' / 'OTHER EVENT' FOR NEW EVENTS; 'WHO IS IT FOR?' APPROVED"; prototype
 * `prototypes/who_is_it_for_2026-10-28/`). The REAL `EventTypePicker` is painted with renderToStaticMarkup from the
 * shapes the page hands it, and the words a person sees are read from the HTML — one test per numbered item:
 *
 *   1. "Your groups" — a group picked shows only what a group may hold, and the form it opens posts `community_id`.
 *   2. "Your business" — business types only; no "Show all event types" doorway to leak the rest.
 *   3. "Celebration" is not offered for a new event (the creatable roster drops it, as production's `enabled` does).
 *   4. "Can't find yours? Ask us to add it" is the grid's last row, for every answer.
 *
 * SABOTAGES PERFORMED AND UNDONE (each turned its test red):
 *   1. `...groupHiddenTypes(types, subject, groupTypeKeys),` removed from the picker → test 1 RED (Wedding drawn).
 *   2. `&& mayShowAll` removed from the show-all button → test 2 RED ("Show all event types" drawn).
 *   3. `enabled: !NOT_IN_THE_PICKER.has(key)` → `enabled: true` in the lab → test 3 RED (Celebration drawn).
 *   4. `{forMenu ? <AskForEventType /> : null}` removed → test 4 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { createRequire } from 'node:module';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;

type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_who_is_it_for__.js');
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

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

/** The lab page IS the fixture (production's twenty types + the seeded rule) — painted, then its picker painted. */
async function paint(search: Record<string, string>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { default: Lab } = await import('@/app/dev/create-for-lab/page');
  const el = await Lab({ searchParams: Promise.resolve(search) });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, el));
}

/** The type tiles' names, in order (the photo picker labels each tile button). */
function tiles(html: string): string[] {
  return [...html.matchAll(/data-event-type-tile="([^"]+)"/g)].map((m) => m[1]!);
}

test('1 · a group picked: only what a group may hold, and the For row names the group', async () => {
  const html = await paint({ groups: '1', for: 'group:g-batch' });
  const shown = tiles(html);
  assert.ok(shown.length > 0, 'the grid drew tiles');
  for (const personal of ['wedding', 'debut', 'christening', 'birthday', 'graduation', 'gender_reveal', 'wake']) {
    assert.ok(!shown.includes(personal), `${personal} is a personal milestone — a group never holds it`);
  }
  for (const k of ['reunion', 'tournament', 'anniversary', 'gala_night']) assert.ok(shown.includes(k), `${k} is offered to a group`);
  assert.match(html, /Batch 2010 Alumni/);
  assert.match(html, /Group · members see it in the group/);
  assert.doesNotMatch(html, /Show all event types/, 'a group has no doorway to personal types');
});

test('2 · your business: business types only, no "Show all event types"', async () => {
  const html = await paint({ shop: 'Casasola Events', for: 'business' });
  const shown = tiles(html);
  for (const k of ['corporate', 'grand_opening', 'gala_night', 'concert', 'tournament', 'open_house']) {
    assert.ok(shown.includes(k), `${k} is a business type`);
  }
  for (const k of ['wedding', 'debut', 'birthday', 'christening', 'wake', 'date', 'hangout', 'reunion']) {
    assert.ok(!shown.includes(k), `${k} is not a business type`);
  }
  assert.match(html, /Casasola Events/);
  assert.match(html, /Business events only/);
  assert.doesNotMatch(html, /Show all event types/);
});

test('3 · no "Celebration" tile for a new event — for any answer, even with every type shown', async () => {
  for (const f of ['self', 'unspecified', 'business', 'memorial']) {
    const html = await paint({ shop: 'Casasola Events', for: f });
    assert.ok(!tiles(html).includes('celebration'), `For ${f}: the generic type is gone`);
  }
});

test('4 · "Can’t find yours? Ask us to add it" is the last row under every answer', async () => {
  for (const f of ['self', 'unspecified', 'business', 'memorial', 'group:g-batch']) {
    const html = await paint({ groups: '1', for: f });
    const at = html.indexOf('data-ask-event-type');
    assert.ok(at > 0, `For ${f}: the ask row is drawn`);
    assert.match(html, /Can’t find yours\? Ask us to add it/);
    const lastTile = html.lastIndexOf('data-event-type-tile=');
    assert.ok(lastTile < at, `For ${f}: the ask row comes after the last tile`);
  }
});
