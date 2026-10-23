/**
 * the-error-line-shows-as-sent.test.ts — Helpers (`/vendor-dashboard/team`), coordinator walk 2026-10-23.
 *
 * The team actions put their sentence in `?error=` ONCE-encoded, and Next hands `searchParams` back DECODED. The view
 * decoded it a second time: a sentence carrying a "%" ("100% of seats…", a database message) threw URIError and took
 * the whole Helpers page down instead of showing the line. The view shows the value as it arrives.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

test('the Helpers page never decodes its ?error= line a second time', () => {
  const view = stripComments(readFileSync(join(__dirname, '_components', 'helpers-view.tsx'), 'utf8'));
  assert.match(view, /search\.error/, 'the error line is gone — re-point this guard');
  assert.doesNotMatch(view, /decodeURIComponent\(/, 'a "%" in the sentence throws URIError and the page falls over');
  // why it matters: a once-decoded "%" is not valid percent-encoding
  assert.throws(() => decodeURIComponent('Seats at 100% — add one'), URIError);
});
