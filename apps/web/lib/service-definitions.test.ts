/**
 * service-definitions.test.ts — 🔒 a service's ⓘ is the owner's one line from Admin › Categories, and NO line means
 * NO ⓘ (plan Track D, item D4; DECISION_LOG 2026-11-06 "EVERY CATEGORY AND SERVICE IN THE SIGN-UP PICKER GETS AN ⓘ
 * WITH A ONE-LINE DEFINITION").
 *
 *   1. the pure reader: blank / missing → null; spaces collapse; the sparse map leaves unwritten rows out;
 *   2. <ServiceInfo> renders the REAL InfoTip only for a written line — an empty one prints the name alone,
 *      never a circle and never a placeholder;
 *   3. the admin door is wired end to end: the service drawer posts `canonical_service` + `hint_en` to the
 *      `info-text` door, and that door hands a `canonical_service` to `setServiceInfoTextCore`;
 *   4. one source: no file outside Admin › Categories writes `canonical_service_schemas.hint_en`, and the
 *      migration writes no definition (the db test proves the same against the replayed schema).
 *
 * SABOTAGE PERFORMED AND UNDONE (see the PR): `cleanServiceDefinition` returning '' for blank instead of null;
 * <ServiceInfo> drawing its InfoTip for an empty line; the `info-text` door dropping its `canonical_service`
 * branch. Each turned this file red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from './strip-comments';
import {
  SERVICE_DEFINITION_MAX,
  cleanServiceDefinition,
  serviceDefinitionIn,
  serviceDefinitionsFromRows,
} from './service-definitions';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('the cap is the column CHECK: 120 characters', () => {
  assert.equal(SERVICE_DEFINITION_MAX, 120);
  const sql = readFileSync(join(WEB, '../../supabase/migrations/20271320021260_a_service_carries_its_own_info_text.sql'), 'utf8');
  assert.match(sql, /char_length\(hint_en\) <= 120/);
});

test('blank, missing or whitespace is NOT a definition (null); a written one is one line', () => {
  for (const v of [null, undefined, '', '   ', '\n\t ']) assert.equal(cleanServiceDefinition(v), null, JSON.stringify(v));
  assert.equal(cleanServiceDefinition('  Takes   the photos\non the day. '), 'Takes the photos on the day.');
});

test('the sparse map holds only written lines, and an unknown key answers null', () => {
  const defs = serviceDefinitionsFromRows([
    { canonical_service: 'photographer', hint_en: 'Takes the photos.' },
    { canonical_service: 'videographer', hint_en: '   ' },
    { canonical_service: 'caterer', hint_en: null },
    { canonical_service: null, hint_en: 'orphan' },
  ]);
  assert.deepEqual(defs, { photographer: 'Takes the photos.' });
  assert.equal(serviceDefinitionIn(defs, 'photographer'), 'Takes the photos.');
  assert.equal(serviceDefinitionIn(defs, 'videographer'), null);
  assert.equal(serviceDefinitionIn(defs, 'nobody'), null);
  assert.equal(serviceDefinitionIn(null, 'photographer'), null);
  assert.equal(serviceDefinitionIn(defs, null), null);
});

test('<ServiceInfo>: a written line draws the ⓘ; an empty one prints the name ALONE (no circle, no placeholder)', async () => {
  const { ServiceInfo } = await import('../app/_components/service-info');
  const written = renderToStaticMarkup(React.createElement(ServiceInfo, { name: 'Photographer', line: 'Takes the photos.' }));
  assert.match(written, /data-service-info="written"/);
  assert.match(written, /What is Photographer\?/, 'the ⓘ button is missing its name');
  for (const line of [null, undefined, '', '   ']) {
    const html = renderToStaticMarkup(React.createElement(ServiceInfo, { name: 'Photographer', line }));
    assert.match(html, /data-service-info="none"/, `line=${JSON.stringify(line)}`);
    assert.ok(html.includes('Photographer'), 'the name must still print');
    assert.ok(!/<button/.test(html), `an empty definition drew an ⓘ button: ${html}`);
  }
});

test('the admin door is wired: the service drawer posts canonical_service + hint_en to `info-text`, which reaches the service core', () => {
  const panels = stripComments(read('app/admin/categories/_components/category-panels.tsx'));
  const field = panels.slice(panels.indexOf('function ServiceInfoTextField'), panels.indexOf('export function GroupPanel'));
  assert.ok(field.length > 0, 'ServiceInfoTextField is gone');
  assert.match(field, /kind="info-text"/);
  assert.match(field, /hidden=\{\{ canonical_service: canonical \}\}/);
  assert.match(field, /name: 'hint_en'/);
  assert.match(field, /maxLength: SERVICE_DEFINITION_MAX/);
  const servicePanel = panels.slice(panels.indexOf('export function ServicePanel'));
  assert.match(servicePanel, /<ServiceInfoTextField canonical=\{service\.canonical\}/, 'the service drawer no longer draws the ⓘ text field');

  const door = stripComments(read('app/admin/categories/four-level-actions.ts'));
  const infoText = door.slice(door.indexOf("if (kind === 'info-text')"), door.indexOf("if (kind === 'rename-part')"));
  assert.match(infoText, /formData\.get\('canonical_service'\)/);
  assert.match(infoText, /setServiceInfoTextCore\(admin, a, canonical, str\(formData\.get\('hint_en'\)\)\)/);
});

/** Every .ts/.tsx under apps/web (not node_modules, not .next, not tests). */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('one source: only Admin › Categories writes a service definition — no file sets canonical_service_schemas.hint_en', () => {
  const writers: string[] = [];
  for (const f of sources(join(WEB, 'app')).concat(sources(join(WEB, 'lib')))) {
    const src = stripComments(readFileSync(f, 'utf8'));
    if (!src.includes('canonical_service_schemas')) continue;
    // An update/insert/upsert on the schema table that names hint_en.
    if (/from\('canonical_service_schemas'\)\s*\.(update|insert|upsert)\(\{[^}]*\bhint_en\b/.test(src)) writers.push(relative(WEB, f));
  }
  assert.deepEqual(writers, ['app/admin/categories/_components/taxonomy-writes.ts']);
});
