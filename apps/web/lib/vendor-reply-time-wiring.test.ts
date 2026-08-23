/**
 * THE FLOOR IS ACTUALLY IN THE PATH — the wiring, not the rule.
 *
 * `replyTimeBadgeLabel` is proved by its own unit tests, and every one of them
 * would still pass if the marketplace card quietly went back to deciding this
 * itself. That is exactly what happened before: the "no data yet" sentinel was
 * honoured in `isFirstLookEligible` and ignored in the card, so two readers of
 * one number disagreed and the one couples read got it wrong.
 *
 * Source-scanned, comments stripped first — the files below carry prose naming
 * the strings hunted here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const code = (p: string) =>
  readFileSync(join(ROOT, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const CARD = 'app/(shell)/explore/_components/vendor-card.tsx';

test('the card asks the shared rule and does not re-decide it', () => {
  const src = code(CARD);
  assert.equal(
    [...src.matchAll(/replyTimeBadgeLabel\(\{/g)].length,
    1,
    'the badge must come from the shared derivation',
  );
  // The old inline decision, in every piece it was made of.
  assert.doesNotMatch(
    src,
    /avgResponseMinutes < FAST_REPLY_THRESHOLD_MIN/,
    'the threshold comparison belongs to the shared module now',
  );
  assert.doesNotMatch(
    src,
    /Usually responds in \$\{/,
    'the card must not format the claim itself — that is where the 0m bug lived',
  );
  assert.doesNotMatch(
    src,
    /const FAST_REPLY_THRESHOLD_MIN/,
    'a second copy of the threshold is a second rule',
  );
});

test('the sample size actually reaches the card', () => {
  const src = code(CARD);
  assert.equal(
    [...src.matchAll(/repliedThreadCount=\{vendor\.replied_thread_count \?\? null\}/g)].length,
    1,
    'without this the floor is fed null forever and the badge never shows',
  );

  // …and the page reads the column at all. A floor fed by a column nobody
  // selects is a floor that silently switches the feature off — the same shape
  // as a phantom column, refused rather than thrown.
  const page = code('app/(shell)/explore/page.tsx');
  assert.match(
    page,
    /avg_response_minutes, replied_thread_count'/,
    'the explore query must select the sample count',
  );
  assert.match(
    page,
    /v\.replied_thread_count = activity\?\.replied_thread_count \?\? null;/,
    'and hand it to the card',
  );
});

test('the stats pass writes the sample count beside the median', () => {
  const src = code('lib/vendor-activity.ts');
  assert.match(src, /const repliedThreadCount = replyDeltas\.length;/);
  assert.match(
    src,
    /replied_thread_count: repliedThreadCount,/,
    'a column nothing writes is a floor nothing can ever clear',
  );
});
