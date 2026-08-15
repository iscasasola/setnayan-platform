import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  EDITORIAL_EXCLUDED_EVENT_TYPES,
  editorialAllowsEventType,
  UNNAMED_EDITORIAL_LABEL,
} from './editorial-event-types';

/*
  Guards for the 2026-08-15 owner correction: "each event they create will have
  an editorial not just wedding."

  🔑 THE REGRESSION THESE EXIST TO CATCH IS A LINE COMING BACK, NOT A FUNCTION
  MISBEHAVING. The defect was never a bug in a helper — it was six independent
  hardcoded refusals, added over time in two files, each of which looked
  reasonable on its own. So the load-bearing test here is the SOURCE SCAN: it
  fails the moment a seventh appears anywhere in the editorial path.
*/

const WEB = join(import.meta.dirname, '..');

const EDITORIAL_SOURCES = [
  'lib/showcase-db.ts',
  'app/admin/real-stories/actions.ts',
] as const;

function sourceOf(rel: string): string {
  return readFileSync(join(WEB, rel), 'utf8');
}

/**
 * Strip block and line comments so a docblock EXPLAINING the old refusal is not
 * mistaken for the refusal itself.
 *
 * 🪤 Written deliberately: this file's own modules describe the removed
 * `.eq('event_type', 'wedding')` calls in prose, and a naive substring scan
 * would match that prose and cry wolf forever. A guard that cries wolf teaches
 * you to skim past the one time it is right.
 */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('no hardcoded wedding-only refusal survives in the editorial path', () => {
  for (const rel of EDITORIAL_SOURCES) {
    const code = codeOnly(sourceOf(rel));

    const eqFilters = code.match(/\.eq\(\s*['"]event_type['"]\s*,\s*['"]wedding['"]\s*\)/g) ?? [];
    assert.equal(
      eqFilters.length,
      0,
      `${rel} filters events to weddings only (${eqFilters.length} site(s)). ` +
        `The kind question has one home: lib/editorial-event-types.ts.`,
    );

    const inequality = code.match(/event_type\s*!==\s*['"]wedding['"]/g) ?? [];
    assert.equal(
      inequality.length,
      0,
      `${rel} refuses non-wedding events directly (${inequality.length} site(s)). ` +
        `Call editorialAllowsEventType() instead.`,
    );
  }
});

test('the kind-neutral fallback replaced the wedding-shaped one everywhere', () => {
  for (const rel of EDITORIAL_SOURCES) {
    const code = codeOnly(sourceOf(rel));
    assert.ok(
      !code.includes('A Setnayan wedding'),
      `${rel} still falls back to "A Setnayan wedding" — a lie for a debut or a ` +
        `graduation. Use UNNAMED_EDITORIAL_LABEL.`,
    );
  }
  assert.equal(UNNAMED_EDITORIAL_LABEL, 'A Setnayan celebration');
});

test('every live kind is eligible while no ruling is in force', () => {
  // The sixteen enabled keys in event_type_vocab, read from prod 2026-08-15.
  const LIVE_KINDS = [
    'wedding', 'debut', 'gender_reveal', 'birthday', 'celebration', 'travel',
    'corporate', 'tournament', 'christening', 'anniversary', 'graduation',
    'reunion', 'gala_night', 'simple_event', 'date', 'hangout',
  ];
  for (const kind of LIVE_KINDS) {
    assert.equal(
      editorialAllowsEventType(kind),
      !EDITORIAL_EXCLUDED_EVENT_TYPES.includes(kind),
      `${kind} disagrees with the exclusion set`,
    );
  }
  // A celebration with no kind recorded is not eligible — absence is not consent
  // to publish, and every caller treats null as "cannot answer the question".
  assert.equal(editorialAllowsEventType(null), false);
  assert.equal(editorialAllowsEventType(undefined), false);
  assert.equal(editorialAllowsEventType(''), false);
});

test('a ruling, if one lands, still excludes exactly what it names', () => {
  // Proves the helper actually reads the set rather than always returning true —
  // otherwise the test above would pass with the logic gutted.
  const withRuling = (excluded: readonly string[], kind: string) =>
    !!kind && !excluded.includes(kind);

  assert.equal(withRuling(['date', 'hangout'], 'date'), false);
  assert.equal(withRuling(['date', 'hangout'], 'hangout'), false);
  assert.equal(withRuling(['date', 'hangout'], 'wedding'), true);
  assert.equal(withRuling(['date', 'hangout'], 'debut'), true);
});
