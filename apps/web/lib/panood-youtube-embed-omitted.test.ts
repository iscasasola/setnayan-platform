/**
 * panood-youtube-embed-omitted.test.ts
 *
 * `enableEmbed: true` on liveBroadcasts.insert made YouTube reject the call
 * with 400 `invalidEmbedSetting` against the Setnayan pool channel — observed
 * live 2026-09-02, 04:52:26Z. `panood_broadcasts` was 0 as a result: nothing
 * this platform has ever tried to go live with reached YouTube.
 *
 * The fix is an omission, which a diff review can miss just as easily as it
 * shipped — so pin it here: the contentDetails payload sent to
 * liveBroadcasts.insert must not assert `enableEmbed` at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = stripComments(readFileSync(join(WEB, 'lib/panood-youtube.ts'), 'utf8'));

test('createYoutubeBroadcast does not send enableEmbed', () => {
  const fnStart = src.indexOf('export async function createYoutubeBroadcast');
  assert.ok(fnStart > -1, 'createYoutubeBroadcast must exist');
  const fnBody = src.slice(fnStart, src.indexOf('\nexport', fnStart + 1));
  const contentDetailsStart = fnBody.indexOf('contentDetails:');
  assert.ok(contentDetailsStart > -1, 'the insert call must set contentDetails');
  const contentDetailsBlock = fnBody.slice(
    contentDetailsStart,
    fnBody.indexOf('}', contentDetailsStart) + 1,
  );
  assert.doesNotMatch(
    contentDetailsBlock,
    /enableEmbed/,
    'enableEmbed made every broadcast insert fail with invalidEmbedSetting — do not reintroduce it without re-verifying channel eligibility',
  );
  assert.match(contentDetailsBlock, /enableAutoStart:\s*true/);
  assert.match(contentDetailsBlock, /enableAutoStop:\s*true/);
});
