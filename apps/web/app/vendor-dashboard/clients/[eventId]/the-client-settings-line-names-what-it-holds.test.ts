/**
 * ⚙ CHAT-28 (walk 16 Nov 2026): the picked client's ⚙ said "Who looks after this client" — and the sheet under it had
 * no such picker, because a per-client handler does not exist (`picked-client-settings.tsx`: "No Handled by here").
 * The line names what the sheet holds. Building a handler picker is an owner call; until then the words never promise one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = join(process.cwd(), 'app/vendor-dashboard/clients/[eventId]');
const page = readFileSync(join(here, 'page.tsx'), 'utf8');
const sheet = readFileSync(join(here, '_components/picked-client-settings.tsx'), 'utf8');

test('the ⚙ line does not promise a handler the sheet cannot show', () => {
  const m = /settingsLine=\{\{\s*(?:\/\/[^\n]*\n\s*)*line:\s*'([^']+)'/.exec(page);
  assert.ok(m, 'settingsLine.line is a literal on the picked client page');
  const line = m![1]!;
  const hasHandlerPicker = /data-client-setting="handler"/.test(sheet);
  if (!hasHandlerPicker) assert.doesNotMatch(line, /looks after|handled by|who handles/i, line);
  assert.match(line, /note/i, 'the line names the Notes the sheet holds');
});
