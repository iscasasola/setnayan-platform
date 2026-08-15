import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
  Owner, 2026-08-15: "it is the owner's choice if they want this in public or
  link only or tagged accounts only."

  The public stories shelf and the weddings sitemap must honour that choice.
  Until this date the loaders asked `.neq(landing_page_visibility, 'private')`,
  which admits 'unlisted' — the value the couple's own privacy screen sells as
  "link only". A link-only celebration could be listed publicly and handed to
  Google.

  🔑 THE DEFECT IS THE SHAPE OF THE TEST, NOT THE VALUE IT NAMED. An exclusion
  test over an enum that can grow admits every future member by default. So the
  guard below bans the SHAPE on this column, not just the one old spelling —
  otherwise adding a fourth state (e.g. "tagged accounts only") would silently
  reopen exactly this hole.
*/

const WEB = join(import.meta.dirname, '..');
const SRC = join(WEB, 'lib/showcase-db.ts');

function codeOnly(src: string): string {
  // Comments in this very file describe the removed `.neq(...)`; a raw scan
  // would match the explanation and cry wolf forever.
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('the public shelf admits only landing_page_visibility = public', () => {
  const code = codeOnly(readFileSync(SRC, 'utf8'));

  const allowed = code.match(/\.eq\(\s*['"]landing_page_visibility['"]\s*,\s*['"]public['"]\s*\)/g) ?? [];
  assert.ok(
    allowed.length >= 4,
    `expected every events read in showcase-db to gate on = 'public'; found ${allowed.length}`,
  );

  // The shape ban — ANY exclusion test on this column, whatever it excludes.
  const exclusions = code.match(/\.neq\(\s*['"]landing_page_visibility['"]/g) ?? [];
  assert.equal(
    exclusions.length,
    0,
    `showcase-db excludes a visibility value instead of naming the allowed one ` +
      `(${exclusions.length} site(s)). An exclusion admits every future state — ` +
      `including "link only" and anything added after it.`,
  );

  const negated = code.match(/landing_page_visibility\s*!==\s*['"]private['"]/g) ?? [];
  assert.equal(negated.length, 0, 'same defect in JS form: !== private admits unlisted');
});

test('no events read in showcase-db is left ungated', () => {
  const code = codeOnly(readFileSync(SRC, 'utf8'));
  // Every `.from('events')` in this module feeds a PUBLIC surface (the shelf or
  // the sitemap), so each must carry the visibility gate. Counting them against
  // the gate count is what catches a SIXTH read being added without one — the
  // way the wedding-only filters accumulated in the first place.
  const reads = code.match(/\.from\(\s*['"]events['"]\s*\)/g) ?? [];
  const gates = code.match(/\.eq\(\s*['"]landing_page_visibility['"]\s*,\s*['"]public['"]\s*\)/g) ?? [];
  assert.ok(
    gates.length >= reads.length,
    `${reads.length} events read(s) in showcase-db but only ${gates.length} visibility gate(s) — ` +
      `one of them can surface a page its owner did not make public.`,
  );
});
