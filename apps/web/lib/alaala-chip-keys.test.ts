/**
 * lib/alaala-chip-keys.test.ts — every chip on the Alaala page must name a
 * real add-on.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * `app/dashboard/[eventId]/alaala/page.tsx` renders a chip per feature and
 * resolves its label from ADD_ONS with a fall-through:
 *
 *     const label = chip.label ?? entry?.label ?? chip.key ?? '';
 *
 * A key with no catalog entry therefore does NOT error. It renders THE RAW
 * SLUG as the button's text and links to a page that 404s. That shipped on
 * 2026-08-11: the LED wall backdrop was removed from the catalog and this list
 * was not swept, so on the one screen whose whole job is to feel finished, a
 * couple saw a lowercase button reading "led" between "Pakanta" and
 * "Playlist", and tapping it took them nowhere.
 *
 * ── WHY A SOURCE READ AND NOT AN IMPORT ────────────────────────────────────
 * The page is a server component importing `next/link` and the Supabase admin
 * client; it cannot be imported by the node test runner. The page carries its
 * own module-level throw (which fails `next build`) — this test is the half
 * that can be RUN and PROVEN to fire, and it reads the same source the build
 * compiles. Attempting to prove the page's own throw by importing it produces
 * a false green: baseline and sabotage both die on `next/link` first.
 *
 * ⚠ Lives in lib/ rather than beside the page because the page's directory
 * name contains `[eventId]`, and square brackets are a glob character class —
 * a test path containing them can silently match nothing and report
 * "# tests 0 … # fail 0", which reads exactly like success.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADD_ONS } from '@/lib/add-ons-catalog';

const PAGE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'alaala', 'page.tsx');

/** The chip entries declared in the page's ARC constant. */
function chipsInArc(src: string): { key: string; hasOwnLabel: boolean }[] {
  const from = src.indexOf('const ARC');
  assert.notEqual(from, -1, 'could not find `const ARC` in the Alaala page — update this test');
  // Stop at the guard block that follows ARC, so we never read past the data.
  const to = src.indexOf('const known = new Set', from);
  const block = src.slice(from, to === -1 ? src.length : to);
  return [...block.matchAll(/\{[^{}]*\bkey:\s*'([a-z0-9-]+)'[^{}]*\}/g)].map((m) => ({
    key: m[1]!,
    hasOwnLabel: /\blabel:\s*'/.test(m[0]),
  }));
}

test('Alaala: the page still declares chips (the extractor did not silently match nothing)', () => {
  // Without this, every assertion below passes vacuously the day the page's
  // shape changes — the failure mode this whole file exists to prevent.
  const found = chipsInArc(readFileSync(PAGE, 'utf8'));
  assert.ok(found.length >= 8, `expected the Alaala arc to declare several chips, found ${found.length}`);
});

test('Alaala: every chip key names a real add-on (no raw slug, no 404)', () => {
  const known = new Set(ADD_ONS.map((a) => a.key));
  const stale = chipsInArc(readFileSync(PAGE, 'utf8'))
    // A chip carrying its own label is legitimately keyless-in-catalog.
    .filter((c) => !c.hasOwnLabel && !known.has(c.key))
    .map((c) => c.key);
  assert.deepEqual(
    stale,
    [],
    `Alaala chip key(s) ${stale.join(', ')} are not in ADD_ONS. The page falls through ` +
      `to the raw key, so each renders as a lowercase slug on a button that links to a ` +
      `404. Remove the chip, or give it an explicit label + href.`,
  );
});

test('Alaala: the LED backdrop chip specifically stays gone', () => {
  // Named on purpose. The check above fails as "some key is stale", which reads
  // like a typo; this one says what the product decision was, so a future
  // session re-adding it learns the reason instead of just the symptom.
  const keys = chipsInArc(readFileSync(PAGE, 'utf8')).map((c) => c.key);
  assert.equal(
    keys.includes('led'),
    false,
    'The LED wall backdrop was removed from the product 2026-08-11 (owner: "remove ' +
      'wall backdrop") because nothing could produce the file it promised. It must not ' +
      'come back as a chip on the memories page.',
  );
});
