/**
 * 📁🏷 THE LIVE FILES PAGE DRAWS THE BOARD — so a supplier can reach "Select" and "Tag to inspiration" (#7622, CHAT-03).
 *
 * The client page built a `FilesPage` WITH the board (`filesNode`), but the picked-client shell renders the bodies from
 * `pickedPageBodies` (`_pages/switch.tsx`), and that `files` body drew `<FilesPage …>` with NO `board` prop. Every
 * inspiration-tag screen shipped and was unreachable: the Files page showed the shared-files list only.
 *
 *   1. The switch's `files` body hands `FilesPage` the board: `board={<EventFilesSection ctx={ctx} mode="files" />}`.
 *   2. It is the ONLY `<FilesPage` the switch draws (a second, board-less one would bring the gap back).
 *   3. The board's section still reads the tags and hands them to the board (`readEventTagBoard` → `tags=` · `offered=`),
 *      or "Select" never renders even with the board present.
 *
 * Comments are stripped first (the canonical stripper), so a comment naming the prop cannot satisfy the guard.
 * SABOTAGE (done once, 14 Nov): deleting the `board=` line from the switch → test 1 RED; adding a second board-less
 * `<FilesPage` to the switch → test 2 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

/** The `files:` entry of `pickedPageBodies` — from its key to the `hub:` key that follows it. */
function filesBody(src: string): string {
  const start = src.indexOf('files: only(');
  assert.notEqual(start, -1, 'the switch has no `files: only(` body');
  const end = src.indexOf('hub: only(', start);
  assert.notEqual(end, -1, 'the switch has no `hub: only(` body after files');
  return src.slice(start, end);
}

test('1 · the switch’s Files body hands FilesPage the board (Select · Tag to inspiration)', () => {
  const body = filesBody(read('_pages/switch.tsx'));
  assert.match(body, /<FilesPage\b/, 'the Files body no longer draws FilesPage');
  assert.match(
    body,
    /board=\{<EventFilesSection\s+ctx=\{ctx\}\s+mode="files"\s*\/>\}/,
    'the Files body draws FilesPage without the board — Select and "Tag to inspiration" are unreachable (CHAT-03)',
  );
  assert.match(read('_pages/switch.tsx'), /import \{ EventFilesSection \} from '\.\/event-files';/);
});

test('2 · the switch draws exactly one FilesPage, and it carries the board', () => {
  const src = read('_pages/switch.tsx');
  assert.equal(src.split('<FilesPage').length - 1, 1, 'a second <FilesPage in the switch — one of them can lose the board');
  assert.equal(src.split('board={<EventFilesSection').length - 1, 1);
});

test('3 · the board’s section reads the tags and hands them to the board', () => {
  const section = read('_pages/event-files.tsx');
  assert.match(section, /readEventTagBoard\(/, 'the Files section no longer reads the inspiration tags');
  assert.match(section, /tags=\{/, 'the board is not handed its tags — "Select" never renders');
  assert.match(section, /offered=\{/, 'the board is not handed the parts each card offers');
});
