/**
 * Drift guard for the AI-crawler surface `public/llms.txt`.
 *
 * llms.txt is hand-maintained (there is no generation/sync script), so it is
 * the file most prone to silent price drift — a repriced SKU in the live
 * catalog leaves stale figures sitting in the copy that every LLM reads. This
 * test extracts every `₱…` figure from the BODY of the file and asserts the
 * set matches the explicit allow-list in `lib/llms-price-fixture.ts`. Any
 * unapproved figure (or an approved figure that no longer appears) fails
 * `pnpm test:unit` in CI — forcing a deliberate reconciliation.
 *
 * The changelog footer (from "This file was last refreshed on …" onward) is
 * excluded: it narrates prior states and legitimately carries historical,
 * now-retired figures.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { APPROVED_LLMS_PRICES } from './llms-price-fixture';

const HERE = dirname(fileURLToPath(import.meta.url));
const LLMS_PATH = join(HERE, '..', 'public', 'llms.txt');
const FOOTER_MARKER = 'This file was last refreshed on';

// Matches a peso figure like ₱0, ₱499, ₱1,299, ₱74,999 — without trailing
// punctuation (a lone comma after a figure is not captured).
const PESO = /₱[0-9](?:[0-9,]*[0-9])?/g;

function bodyOf(raw: string): string {
  const idx = raw.indexOf(FOOTER_MARKER);
  return idx === -1 ? raw : raw.slice(0, idx);
}

test('llms.txt body prices exactly match the approved fixture', () => {
  const body = bodyOf(readFileSync(LLMS_PATH, 'utf8'));
  const found = new Set(body.match(PESO) ?? []);
  const approved = new Set(APPROVED_LLMS_PRICES);

  const unapproved = [...found].filter((p) => !approved.has(p)).sort();
  assert.deepEqual(
    unapproved,
    [],
    `Unapproved peso figure(s) in public/llms.txt: ${unapproved.join(', ')}. ` +
      `If the catalog was repriced, add the figure to lib/llms-price-fixture.ts ` +
      `deliberately; otherwise this is drift — fix the file.`,
  );

  const unused = [...approved].filter((p) => !found.has(p)).sort();
  assert.deepEqual(
    unused,
    [],
    `Approved figure(s) no longer present in public/llms.txt: ${unused.join(', ')}. ` +
      `Remove them from lib/llms-price-fixture.ts, or restore them in the file.`,
  );
});

test('the fixture itself has no duplicate figures', () => {
  const list = APPROVED_LLMS_PRICES;
  assert.equal(
    new Set(list).size,
    list.length,
    'lib/llms-price-fixture.ts contains a duplicate figure.',
  );
});

test('the changelog footer is present and excluded from the guard', () => {
  const raw = readFileSync(LLMS_PATH, 'utf8');
  assert.ok(
    raw.includes(FOOTER_MARKER),
    `llms.txt is missing its "${FOOTER_MARKER}" footer marker — the guard ` +
      `relies on it to separate current copy from the historical changelog.`,
  );
});
