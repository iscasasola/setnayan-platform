/**
 * `build-sessions/PROVE-THE-FLOW.md` must keep pointing at things that exist.
 *
 * ── WHY ────────────────────────────────────────────────────────────────────
 * That file is the resume path for the two-sided live test — the owner on the
 * supplier side, a session on the couple side, proving a booking can actually
 * be completed on setnayan.com. It is the kind of document this repo has been
 * burned by twice: CLAUDE.md's own "what is left" block pointed at two finished
 * jobs for an unknown stretch of sessions, and `WHAT_IS_LEFT.md` went stale the
 * week it was written. **A handoff decays fastest exactly where it is read
 * most**, and nothing failed when it did.
 *
 * So the parts of it that CAN be checked mechanically, are. This does not — and
 * cannot — verify that its prose is still true; it verifies that every file it
 * sends a reader to still exists and every SQL identifier it names is still in
 * a migration. A dead path in a resume document is worse than no document,
 * because the reader concludes the feature was deleted.
 *
 * ⚠ WHEN THIS FAILS, FIX THE DOCUMENT — do not delete the reference to make it
 * green. A moved file means the doc's reader would have been sent nowhere.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const DOC = join(REPO, 'build-sessions', 'PROVE-THE-FLOW.md');

const doc = (() => {
  assert.ok(
    existsSync(DOC),
    'build-sessions/PROVE-THE-FLOW.md is gone — it is the resume path for the live ' +
      'two-sided test. If it was deliberately retired, delete this guard in the same PR.',
  );
  return readFileSync(DOC, 'utf8');
})();

/** Repo-relative paths the doc sends a reader to, taken from `backticked` spans only. */
function referencedPaths(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/`([A-Za-z0-9_./\-[\]]+\.(?:ts|tsx|mjs|sql|md|yml))`/g)) {
    const p = m[1]!;
    // Only things that look repo-rooted; bare filenames are prose, not links.
    if (p.includes('/') && !p.startsWith('.') && !p.includes('*')) out.add(p);
  }
  return [...out];
}

test('every file the resume document points at still exists', () => {
  const paths = referencedPaths(doc);
  assert.ok(paths.length >= 6, `only ${paths.length} paths found — re-point this guard`);
  const missing = paths.filter((p) => !existsSync(join(REPO, p)));
  assert.deepEqual(
    missing,
    [],
    `PROVE-THE-FLOW.md sends the reader to files that no longer exist:\n  ` +
      missing.join('\n  ') +
      `\nUpdate the document — a dead path reads as "the feature was deleted".`,
  );
});

test('the SQL identifiers it names are still in a migration', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const all = readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .map((n) => readFileSync(join(dir, n), 'utf8'))
    .join('\n');
  // Named in the doc as the things a resuming session must not re-invent.
  for (const ident of [
    'event_basket_orders_granting',
    'current_couple_event_ids',
    'vendor_verification_bypasses',
  ]) {
    assert.ok(
      all.includes(ident),
      `PROVE-THE-FLOW.md names ${ident}, which no migration defines any more`,
    );
  }
});

test('it still carries the two claims a resuming session must not lose', () => {
  // Whitespace-collapsed: these sentences wrap, and a guard that fails when a
  // paragraph is REFLOWED is a guard nobody will keep. Match the words, not the
  // line breaks.
  const flat = doc.replace(/\s+/g, ' ');
  // 1 · the side-assignment, which is a hard constraint and not a preference.
  assert.match(
    flat,
    /supplier side is the owner's to drive/i,
    'the doc no longer says who drives which side — a session cannot take the supplier side',
  );
  // 2 · the frontier: chat_threads is the number that has never moved.
  assert.match(
    flat,
    /chat_threads/,
    'the doc no longer names chat_threads — that count is the whole point of the test',
  );
});
