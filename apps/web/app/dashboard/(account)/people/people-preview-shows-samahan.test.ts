/**
 * people-preview-shows-samahan.test.ts — the People page never hides a live
 * feature behind a coming-soon preview.
 *
 * ─── The bug this exists to prevent ──────────────────────────────────────
 * `people/page.tsx` returns early when the connections AND dependents flags are
 * both off:
 *
 *     if (!showConnections && !showDependents) return <PeoplePreview />;
 *
 * `PeoplePreview` never rendered `<SamahanPeopleSection />` — even though this
 * very file's own comment says samahan is *"Not flag-gated — samahan is live
 * product."* So the **phone pill nav's People target**, the most thumb-prominent
 * People door in the app, told a user with samahans:
 *
 *     "There's nothing to do on this page yet."
 *
 * The owner walked the live app on 2026-08-11 and asked "how do i find my
 * samahan" — this was the answer. Two features gated together, one of which was
 * never supposed to be gated at all.
 *
 * ─── ⚠ WHY THIS TEST MATTERS MORE THAN THE FIX ──────────────────────────
 * The connections and dependents flags were switched **ON** in production hours
 * after the fix, which means the preview branch **is not currently reached**. So
 * the bug is MASKED, not gone: a reader can no longer reproduce it, and the next
 * person to turn a flag back off — for legal review, for a rollback, for a
 * staging environment — silently restores it. A fix nobody can see is a fix
 * nobody will preserve. This test is what preserves it.
 *
 * ─── Why a source scan ───────────────────────────────────────────────────
 * The hazard is a component that ISN'T rendered. There is nothing to observe at
 * runtime — a unit test of the preview would assert whatever the preview
 * currently returns and pass either way. Only the source distinguishes "samahan
 * is in this branch" from "samahan was dropped from this branch".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = resolve(HERE, 'page.tsx');

/** The preview branch's source, isolated from the functional branch. */
function previewSource(): string {
  const src = stripComments(readFileSync(PAGE, 'utf8'));
  const start = src.indexOf('function PeoplePreview');
  assert.ok(
    start !== -1,
    'PeoplePreview is gone. If the coming-soon branch was removed entirely that is ' +
      'fine — delete this test WITH it, in the same change, and say so.',
  );
  return src.slice(start);
}

test('the coming-soon preview still renders the live samahan section', () => {
  assert.match(
    previewSource(),
    /<SamahanPeopleSection\s*\/>/,
    'PeoplePreview no longer renders <SamahanPeopleSection />. Samahan is NOT ' +
      'flag-gated — it is live product with its own routes, and this preview is what ' +
      'the phone nav\'s People tab lands on when the connections/dependents flags are ' +
      'off. Dropping it tells a user with samahans that there is nothing here.',
  );
});

test('the preview never claims the whole PAGE is empty', () => {
  // The exact sentence the owner read. It was false for anyone with a samahan,
  // and it is the reason the feature looked missing rather than merely quiet.
  const src = previewSource();
  for (const lie of [
    'nothing to do on this page',
    'nothing here yet',
    'nothing to see here',
  ]) {
    assert.ok(
      !src.toLowerCase().includes(lie),
      `PeoplePreview claims "${lie}". Scope the coming-soon wording to CONNECTIONS — ` +
        'the page also carries samahan, which works today.',
    );
  }
});

test('samahan is imported by the page at all', () => {
  // Cheap backstop: catches the case where the JSX survives a refactor but the
  // import is dropped, which fails the build rather than this test — and a
  // build failure names the symbol, not the reason.
  assert.match(
    stripComments(readFileSync(PAGE, 'utf8')),
    /from\s+['"]\.\/_components\/samahan-people-section['"]/,
    'The samahan section import is gone from people/page.tsx.',
  );
});
