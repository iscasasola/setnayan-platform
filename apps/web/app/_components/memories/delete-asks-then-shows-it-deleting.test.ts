/**
 * 🗑 DELETE ASKS, THEN SHOWS IT DELETING (owner 31 Oct): "When we press delete a pop saying it cannot be undone
 * continue button then when continue is pressed. We show a deleting progress icon and delete."
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, 'memories-photo-viewer.tsx'), 'utf8');

test('the confirm says it cannot be undone and its button is Continue', () => {
  assert.match(SRC, /line="Delete this photo and every copy of it\? This cannot be undone\."/);
  assert.match(SRC, /<DeleteConfirmRow onKeep=/, 'the confirm row is not the one that shows progress');
  assert.match(SRC, /<Trash2[^>]*\/> Continue\s*<\/SubmitButton>/, 'the confirm button is not Continue');
});

test('Continue shows a deleting spinner and locks both buttons while it runs', () => {
  const row = SRC.slice(SRC.indexOf('function DeleteConfirmRow'));
  assert.ok(row.length > 0);
  assert.match(row, /<SubmitButton[\s\S]*?pendingLabel="Deleting…"/, 'no "Deleting…" while the delete runs');
  assert.match(row, /const \{ pending \} = useFormStatus\(\)/);
  assert.match(row, /onClick=\{onKeep\} disabled=\{pending\}/, 'Keep it can be pressed mid-delete');
});
