/**
 * prefill-survives-same-route.test.ts — answering the questions while ALREADY
 * on the destination page must still fill the form.
 *
 * ── THE DEAD END ────────────────────────────────────────────────────────────
 * The search box is mounted on every admin page, so the most likely place to
 * be when you ask to add a taxonomy category is /admin/taxonomy itself.
 * Pressing "Prepare the form" there is a SAME-ROUTE navigation: React
 * reconciles rather than remounting, `useSearchParams` hands over the new
 * values — and the prefill effect carried an EMPTY dependency array, so it
 * never looked again. The page did not change, nothing opened, nothing filled,
 * and no error was shown. Every answer was silently discarded.
 *
 * There is a second half that is just as quiet: the inspector was keyed on the
 * tile id alone, so a second ask about a tile that is ALREADY open changed no
 * key, and the uncontrolled `defaultValue` inputs kept the previous answers.
 *
 * ── WHY THIS IS SOURCE-SHAPED ───────────────────────────────────────────────
 * The studio is a `'use client'` component wired to Next's router, so the
 * effect cannot be executed here. What CAN be pinned exactly is the three
 * properties that make it work, each of which was individually absent and
 * individually silent. Matched against comment-stripped source so the docblock
 * describing the old empty-array bug cannot satisfy the assertions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const studio = () => stripComments(readFileSync(join(HERE, 'taxonomy-studio.tsx'), 'utf8'));

/** The prefill effect's body, located by its own guard clause. */
function prefillEffect(src: string): string {
  const start = src.indexOf("ADMIN_ASK_PARAM) !== 'createCanonicalLeaf'");
  assert.ok(start > 0, 'the prefill effect is gone from the taxonomy studio');
  const end = src.indexOf('}, [', start);
  assert.ok(end > start, 'the prefill effect has no dependency array — re-pin this test');
  // Include the dependency array itself.
  return src.slice(start, src.indexOf(']);', end) + 3);
}

test('the prefill effect re-runs on a same-route navigation', () => {
  const effect = prefillEffect(studio());
  const deps = effect.slice(effect.lastIndexOf('}, ['));
  assert.ok(
    !/^\}, \[\s*\]\);/.test(deps),
    'the prefill effect is back on an EMPTY dependency array — answering while already on /admin/taxonomy will silently discard every answer',
  );
  assert.ok(
    deps.includes('searchParams') || deps.includes('askSignature'),
    `the prefill effect no longer depends on the URL it reads: ${deps}`,
  );
});

test('re-running cannot clobber the admin\'s own edits — it is keyed on the ask params alone', () => {
  const src = studio();
  // The filter box rewrites ?q= on EVERY keystroke via syncUrl. Without a
  // signature limited to the ask params, a re-running effect would re-apply the
  // prefill over whatever the admin had typed into the form by hand.
  assert.match(
    src,
    /askSignature/,
    'the ask signature is gone — a re-running prefill will fight the ?q= sync on every keystroke',
  );
  assert.match(
    src,
    /k === ADMIN_ASK_PARAM \|\| k\.startsWith\('aa_'\)/,
    'the signature is no longer built from the ask params alone',
  );
  assert.match(
    src,
    /appliedAskRef\.current === askSignature/,
    'the already-applied check is gone — the same ask can now re-apply repeatedly',
  );
});

test('a second ask about an ALREADY-OPEN tile still refreshes the form', () => {
  const src = studio();
  // 🪤 `indexOf('<Inspector')` matched the TYPE `useState<InspectorTab | null>`
  // hundreds of lines above the JSX and this guard failed on correct code.
  // Anchor on the JSX open tag proper.
  const keyIdx = src.search(/<Inspector\s/);
  assert.ok(keyIdx > 0, 'the Inspector mount moved — re-pin this test');
  const mount = src.slice(keyIdx, keyIdx + 400);
  assert.match(
    mount,
    /key=\{`\$\{openTile\.id\}:\$\{addServicePrefill\?\.nonce \?\? ''\}`\}/,
    'the Inspector is keyed on the tile id alone again — a second ask about an open tile will not re-mount its uncontrolled inputs, so the new answers are ignored',
  );
  assert.match(
    src,
    /nonce: askSignature/,
    'the prefill no longer carries the nonce its remount key depends on',
  );
});
