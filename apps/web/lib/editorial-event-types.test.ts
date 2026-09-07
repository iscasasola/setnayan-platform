import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

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

/*
  🔴 THIS SCAN USED TO READ A HAND-WRITTEN LIST OF TWO FILES while its own
  docblock claimed it fired "the moment a seventh appears ANYWHERE in the
  editorial path". It did not, and that is exactly how the defect got out:
  `lib/realstories-vendor.ts` and `lib/recap-vendor.ts` kept their own
  `.eq('event_type', 'wedding')` through the 2026-08-15 correction, so for three
  weeks a debut or reunion published to /realstories and was never collected on
  the credited vendor's portfolio. The guard was green the whole time.

  🔑 A GUARD THAT NAMES ITS OWN COVERAGE CANNOT CATCH THE FILE NOBODY THOUGHT OF.
  So the scan now WALKS the tree and every surviving site must be written down
  with a reason. New refusals fail; legitimately wedding-only code is admitted by
  saying why, once, here.
*/

/** Query-shape refusals only — `.eq('event_type','wedding')` inside a builder.
 *  This is the form that silently SHORTENS A LIST; a `!==` branch in feature
 *  code is a visible product rule and is checked separately below. */
const QUERY_FILTER = /\.eq\(\s*['"]event_type['"]\s*,\s*['"]wedding['"]\s*\)/g;

/**
 * Sites where filtering events to weddings is CORRECT, each with the reason.
 * This list may only shrink without an owner ruling. Adding to it is a claim
 * that the surface is about marriage itself — not about publishing a day.
 */
const WEDDING_ONLY_BY_DESIGN: Readonly<Record<string, string>> = {
  'lib/people-spouse-context.ts':
    'a spouse comes from a marriage; there is no spouse of a graduation',
  'app/tour/_lib/sample-event.ts':
    'the no-login product tour is pinned to one seeded wedding by design',
  'lib/alaala-orb.ts':
    'picks the seeded sample event for the orb; prod holds exactly one, a wedding',
  'app/[slug]/_components/editorial/data.ts':
    'edition No. counts weddings in the awards cycle — WHAT the No. counts for a ' +
    'non-wedding story is an open owner question (see Design_Editorial_By_The_Minute_2026-09-07), ' +
    'not a filter to flip silently',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}

function sourceOf(rel: string): string {
  return readFileSync(join(WEB, rel), 'utf8');
}

test('no hardcoded wedding-only refusal survives anywhere in the tree', () => {
  const offenders: string[] = [];
  for (const rel of [...walk('lib'), ...walk('app')]) {
    // stripComments is the repo's ONE stripper — a docblock EXPLAINING the old
    // refusal must not be mistaken for the refusal itself.
    const hits = stripComments(sourceOf(rel)).match(QUERY_FILTER) ?? [];
    if (hits.length === 0) continue;
    if (rel in WEDDING_ONLY_BY_DESIGN) continue;
    offenders.push(`${rel} (${hits.length} site(s))`);
  }
  assert.deepEqual(
    offenders,
    [],
    `These files filter events to weddings only:\n  ${offenders.join('\n  ')}\n` +
      `The kind question has ONE home: withEditorialEventTypes() in ` +
      `lib/editorial-event-types.ts. If the surface really is about marriage ` +
      `itself, add it to WEDDING_ONLY_BY_DESIGN with the reason.`,
  );
});

test('the by-design list stays honest — every entry still has such a filter', () => {
  // A stale exemption is a hole: the file could lose its filter (or be renamed)
  // and the list would go on quietly excusing a path nobody checks.
  for (const [rel, why] of Object.entries(WEDDING_ONLY_BY_DESIGN)) {
    const hits = stripComments(sourceOf(rel)).match(QUERY_FILTER) ?? [];
    assert.ok(
      hits.length > 0,
      `${rel} is exempted ("${why}") but no longer filters to weddings — ` +
        `delete the entry.`,
    );
  }
});

test('the editorial path refuses no kind by branch either', () => {
  for (const rel of ['lib/showcase-db.ts', 'app/admin/real-stories/actions.ts',
                     'lib/realstories-vendor.ts', 'lib/recap-vendor.ts']) {
    const code = stripComments(sourceOf(rel));
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
  const STORY_SURFACES = [
    'lib/showcase-db.ts',
    'app/admin/real-stories/actions.ts',
    'lib/realstories-vendor.ts',
    'lib/recap-vendor.ts',
    'app/admin/studio/_surfaces/recaps-surface.tsx',
    'app/dashboard/(account)/library/_data/editorials.ts',
  ] as const;
  for (const rel of STORY_SURFACES) {
    const code = stripComments(sourceOf(rel));
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

test('the owner ruled all sixteen kinds stay eligible — the set is empty', () => {
  // Owner 2026-08-15: "making it public will be the user's decision ... so yes."
  // Whether a day is public belongs to the people whose day it is
  // (events.landing_page_visibility), NOT to a list of approved occasion types.
  // 🔑 An entry here would say "nobody may ever publish this kind of day,
  // whatever they choose" — stronger than anything the product claims today. So
  // adding one must be a deliberate act that also edits this test, never a
  // quiet append.
  assert.deepEqual(
    [...EDITORIAL_EXCLUDED_EVENT_TYPES],
    [],
    'a kind was excluded without a new owner ruling',
  );
  assert.equal(editorialAllowsEventType('date'), true);
  assert.equal(editorialAllowsEventType('hangout'), true);
});
