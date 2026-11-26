/**
 * save-the-date-has-no-second-reveal-picker.test.ts — final check N-10 (owner Add 18, 25 Nov 2026).
 *
 * The reveal is chosen in ONE place: the Event Hub's reveal picker. Save the Date's Step 5 used to mount its own
 * `RevealPreviewCard` picker, a second copy that could disagree with the Event Hub's. It now names the opening the
 * preview plays and links to the one picker.
 *
 * 🔒 Fails if the picker comes back or the link goes: StdBuilderClient never imports `RevealPreviewCard`, never
 * mounts it, and links `detailsItemHref(eventId, 'reveal')`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const STD = stripComments(
  readFileSync(
    join(process.cwd(), 'app/dashboard/[eventId]/studio/save-the-date/_components/StdBuilderClient.tsx'),
    'utf8',
  ),
);

test('N-10 · Save the Date does not import or mount RevealPreviewCard', () => {
  const imports = STD.match(/^import[\s\S]*?from\s+'[^']+';/gm) ?? [];
  assert.ok(
    !imports.some((line) => /\bRevealPreviewCard\b/.test(line)),
    'StdBuilderClient imports RevealPreviewCard — the second reveal picker is back',
  );
  assert.doesNotMatch(STD, /<RevealPreviewCard\b/);
});

test('N-10 · Step 5 links to the Event Hub\'s one reveal picker', () => {
  assert.match(STD, /href=\{detailsItemHref\(eventId, 'reveal'\)\}/);
  assert.match(STD, /Choose your reveal in the Event Hub/);
});
