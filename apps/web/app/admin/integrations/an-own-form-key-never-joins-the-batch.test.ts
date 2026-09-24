/**
 * an-own-form-key-never-joins-the-batch.test.ts
 *
 * 🔴 WHAT SAVING ONE KEY USED TO DO TO THE OTHER FOUR. The OAuth card's main
 * form posts EVERY config field at once, and each input is pre-filled with the
 * RESOLVED value — the database value if there is one, otherwise the env var.
 * So pressing Save to add ONE key copies every env-sourced sibling INTO the
 * database, and the database wins from then on. Nothing breaks that day: the
 * values are identical. A later change to that env var in Vercel then silently
 * does not apply, and the only evidence is a working integration reading a
 * stale value nobody remembers writing.
 *
 * Owner raised exactly this, twice, about the Google Picker API key going onto
 * the LIVE Google Drive card — whose client id and both redirect URIs are
 * env-sourced and carrying Papic today.
 *
 * 🔑 THE FIX IS FOUR PARTS AND THREE OF THEM ARE INVISIBLE. `ownForm: true` in
 * the registry, a second `<form action={saveOAuthField}>` in the card, a writer
 * that touches one column — and `page.tsx` FORWARDING the flag. Drop that last
 * line and every other part still compiles, still type-checks, still renders a
 * card that looks right: the key simply rejoins the batch form, and the bug is
 * back with no visible trace. That is what this guard is for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = join(process.cwd(), 'app', 'admin', 'integrations');
const src = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));
// 🪤 The registry carries `server-only`, so importing it here throws
// MODULE_NOT_FOUND under `tsx --test` — the flag has to be read as source.
const registry = stripComments(
  readFileSync(join(process.cwd(), 'lib', 'integrations', 'registry.ts'), 'utf8'),
);

test('⛔ some field is actually marked ownForm — otherwise this whole file is decoration', () => {
  assert.match(registry, /ownForm\?:\s*true;/, 'the flag must still exist on the field type');
  const drive = registry.slice(registry.indexOf("id: 'google_drive'"));
  const block = drive.slice(0, drive.indexOf("id: '", 5));
  const key = block.indexOf("column: 'google_picker_api_key'");
  assert.ok(key > 0, 'the Picker key left the Google Drive card');
  // Read only as far as the NEXT field, so a sibling's flag cannot stand in.
  const next = block.indexOf('column:', key + 10);
  const field = block.slice(key, next > 0 ? next : undefined);
  assert.match(field, /ownForm:\s*true/, 'the Picker key is back in the batch form');
});

test('⛔ EVERY block that builds a card\'s fields forwards ownForm — not just one of them', () => {
  const page = src('page.tsx');
  // Anchor per BLOCK, never on a file-wide count: two sections build these
  // lists from identical code, and a count of 1 passes while one card is wrong.
  const blocks = [...page.matchAll(/configFields\.map\(\(field\)\s*=>\s*\{([\s\S]*?)\n            \}\);/g)];
  assert.ok(blocks.length >= 2, `expected both card sections to map configFields, saw ${blocks.length}`);
  for (const [i, b] of blocks.entries()) {
    assert.match(
      b[1] as string,
      /ownForm:\s*field\.ownForm/,
      `card-field block #${i + 1} drops ownForm — its own-form keys rejoin the batch form`,
    );
  }
});

test('⛔ the card splits the two lists in opposite directions', () => {
  const card = src('_components/oauth-card.tsx');
  assert.match(card, /filter\(\(f\)\s*=>\s*!f\.ownForm\)/, 'the batch form must EXCLUDE own-form fields');
  assert.match(card, /filter\(\(f\)\s*=>\s*f\.ownForm\)/, 'and the lone forms must include them');
  // The lone form has to reach the lone writer, or it is the batch form again
  // wearing a border.
  assert.match(card, /action=\{saveOAuthField\}/);
  assert.match(card, /name="field_column"/, 'the writer needs to be told which column');
});

test('⛔ the batch writer skips them, so it cannot null a field that was never posted', () => {
  const actions = src('actions.ts');
  const batch = actions.slice(actions.indexOf('export async function saveOAuthConfig'));
  const body = batch.slice(0, batch.indexOf('export async function ', 10));
  assert.match(body, /if\s*\(field\.ownForm\)\s*continue;/, 'saveOAuthConfig must skip own-form fields');

  // And the lone writer asks the allowlist TWICE — right integration, and the
  // column must be own-form. A hand-posted column writes nothing.
  const lone = actions.slice(actions.indexOf('export async function saveOAuthField'));
  assert.match(lone, /configFields\.find\(\(f\)\s*=>\s*f\.column === column && f\.ownForm\)/);
  assert.match(lone, /update\(\{\s*\[field\.column\]:\s*val\s*\}\)/, 'one column, nothing else');
});
