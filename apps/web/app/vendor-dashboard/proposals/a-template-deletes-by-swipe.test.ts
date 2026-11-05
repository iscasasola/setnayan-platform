/**
 * a-template-deletes-by-swipe.test.ts — 👈 a proposal template deletes by its SWIPE, not a visible trash (owner
 * 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"), with Undo, through the
 * one `vendor_proposal_templates` delete (`deleteTemplate`, now answered instead of redirected).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const list = read('_components/template-list.tsx');
const surface = read('surface.tsx');
const actions = read('actions.ts');

test('each template row is the one SwipeToDelete, named for its template — no trash form on the surface', () => {
  assert.match(list, /<SwipeToDelete[\s\S]{0,200}?label=\{`Delete \$\{t\.template_name\}`\}/);
  assert.match(surface, /<TemplateList templates=\{templates\} \/>/);
  assert.doesNotMatch(surface, /action=\{deleteTemplate\}/);
});

test('the swipe deletes with Undo through the same template delete, which never redirects', () => {
  assert.match(list, /deleteWithUndo\(\{[\s\S]{0,600}?commit: \(\) => deleteTemplate\(t\.template_id\)/);
  assert.match(list, /<UndoToastHost \/>/);
  const drop = actions.slice(actions.indexOf('export async function deleteTemplate'));
  const body = drop.slice(0, drop.indexOf('\n}\n'));
  assert.match(body, /\.from\('vendor_proposal_templates'\)\.delete\(\)\.eq\('template_id', templateId\)/);
  assert.doesNotMatch(body, /redirect\(/);
});
