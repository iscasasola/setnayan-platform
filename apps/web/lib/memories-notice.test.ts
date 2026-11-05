/**
 * GUARD — a press that lands on Memories is answered there (review 2026-10-24): a failure is said, never silence.
 * Sabotage: drop the `error` arm → 1 red; the Memories page stops drawing the notice → 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { memoriesNotice } from './memories-notice';
import { stripComments } from './strip-comments';

test('1 · every failure the actions send back is said, in the bad tone; a success in the good one', () => {
  for (const e of ['bad_input', 'bad_reason', 'not_found', 'report_failed', 'hide_failed', 'block_failed', 'approve_failed', 'unblock_failed', 'delete_failed', 'delete_partial']) {
    assert.equal(memoriesNotice({ error: e })?.tone, 'bad', `?error=${e} is silent`);
  }
  assert.match(memoriesNotice({ error: 'delete_partial' })!.text, /still here/);
  for (const k of ['uploads_error', 'drive_error']) assert.equal(memoriesNotice({ [k]: 'x' })?.tone, 'bad', `?${k} is silent`);
  assert.equal(memoriesNotice({ vendorMedia: 'error' })?.tone, 'bad');
  for (const k of ['reported', 'hidden', 'unhidden', 'blocked', 'unblocked', 'approved', 'deleted', 'uploads_ready', 'drive_connected', 'drive_disconnected']) {
    assert.equal(memoriesNotice({ [k]: '1' })?.tone, 'ok', `?${k}=1 is silent`);
  }
  assert.equal(memoriesNotice({}), null);
});

test('2 · the Memories page reads the address and draws the notice', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/memories/page.tsx'), 'utf8'));
  assert.match(page, /memoriesNotice\(search\)/, 'the page never reads what the press answered');
  assert.match(page, /data-memories-notice=/, 'the notice is not drawn');
});
