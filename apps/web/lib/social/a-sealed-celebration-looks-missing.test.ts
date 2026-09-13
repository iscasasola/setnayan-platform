import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../strip-comments';

/**
 * ST-9 · THE JOIN — that the two card routes actually ASK the rule.
 *
 * `og-card-audience.test.ts` proves the rule. It cannot prove either route
 * consults it, and "every stage built, nothing calling it" is this codebase's
 * most expensive recurring defect.
 *
 * These assertions PARSE the constructs they are about — the `if` condition and
 * the `.select()` column list — rather than checking a string appears nearby.
 * That is not style: a guard I wrote yesterday sliced a fixed window after an
 * anchor and matched its target inside a TYPE ANNOTATION, so deleting the real
 * thing passed straight through its own sabotage.
 */

const WEB = process.cwd();
const STORY = join(WEB, 'app/api/og/realstory-slug/[slug]/route.ts');
const RECAP = join(WEB, 'app/api/og/recap/[slug]/route.ts');
const MODEL = join(WEB, 'app/api/og/v/[slug]/route.tsx');

function code(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const stripped = stripComments(raw);
  assert.ok(
    stripped.length > raw.length * 0.15,
    `stripping ${path} removed too much (${raw.length} -> ${stripped.length})`,
  );
  return stripped;
}

/**
 * The condition text of the `if (...)` wrapping a CALL to `name`.
 *
 * ⚠ Walks EVERY occurrence. The first one is the `import` line, and anchoring on
 * it made this helper report "not inside an if" against a correctly sealed
 * route — the same first-match trap the file header warns about, reproduced in
 * the guard's own helper within the hour. It failed loudly here; the dangerous
 * direction is the one that passes.
 */
function ifConditionMentioning(src: string, name: string): string {
  const sites: number[] = [];
  for (let i = src.indexOf(name); i !== -1; i = src.indexOf(name, i + 1)) sites.push(i);
  assert.ok(sites.length > 0, `${name} is not called at all — the route stopped asking`);

  for (const at of sites) {
    const open = src.lastIndexOf('if (', at);
    if (open === -1) continue;
    let depth = 0;
    for (let i = open + 3; i < src.length; i += 1) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          const condition = src.slice(open + 4, i);
          // Only the `if` that actually contains this call — not some earlier
          // unrelated branch that merely precedes it in the file.
          if (condition.includes(name)) return condition;
          break;
        }
      }
    }
  }
  throw new Error(`${name} is called but never inside an if — the seal is not a branch`);
}

/** The quoted column list of the `.select(` that follows `.from('events')`. */
function selectedColumns(src: string): string[] {
  const from = src.indexOf(".from('events')");
  assert.ok(from > -1, "the route no longer reads 'events' — re-aim this guard");
  const sel = src.indexOf('.select(', from);
  assert.ok(sel > from, 'no .select() after the events read — re-aim this guard');
  const literal = src.slice(sel).match(/'([^']*)'/)?.[1];
  assert.ok(literal, 'the select is no longer a quoted column list');
  return literal.split(',').map((c) => c.trim());
}

for (const [label, path] of [
  ['the invitation card', STORY],
  ['the recap card', RECAP],
] as const) {
  test(`${label} asks who may see it, exactly once`, () => {
    const src = code(path);
    const calls = src.match(/ogCardVisibleToStrangers\(/g) ?? [];
    assert.equal(calls.length, 1, `expected one visibility question, found ${calls.length}`);
  });

  test(`${label} SELECTS the column the rule reads`, () => {
    // Resolving a column never selected yields undefined. Here that fails
    // CLOSED (normalizeVisibility -> 'private'), so it would seal every
    // celebration including public ones — loud, but still wrong.
    const columns = selectedColumns(code(path));
    assert.ok(
      columns.includes('landing_page_visibility'),
      `select omits the visibility column — columns were: ${columns.join(' | ')}`,
    );
    assert.ok(
      columns.includes('scheduled_launch_at'),
      `select omits scheduled_launch_at, so a due launch would stay sealed — got: ${columns.join(' | ')}`,
    );
  });

  test(`${label} seals in the SAME branch as a missing celebration`, () => {
    // The oracle dies only if both answers are one response. Two branches
    // returning "the same" thing are two things that drift apart.
    const condition = ifConditionMentioning(code(path), 'ogCardVisibleToStrangers');
    assert.match(
      condition,
      /!event/,
      'the visibility seal is not folded together with the missing-event check — ' +
        `condition was: ${condition}`,
    );
    assert.match(condition, /\|\|/, `expected one combined condition, got: ${condition}`);
  });
}

test('the invitation card returns the missing-event response, not a 403', () => {
  // A 403 closes the disclosure and KEEPS the oracle: it still says "this exists".
  const src = code(STORY);
  const condition = ifConditionMentioning(src, 'ogCardVisibleToStrangers');
  const at = src.indexOf(condition);
  const body = src.slice(at, at + 220);
  assert.match(body, /Response\.redirect\(DEFAULT_OG, 302\)/, `sealed response was: ${body}`);
  assert.doesNotMatch(body, /403|status:\s*40/, 'a status code that admits existence');
});

test('the recap card seals BEFORE the publish gate, not behind it', () => {
  // It returns the fallback today only because isRecapPublished declines. That
  // made the leak latent: the moment a private couple published a recap, their
  // names and date became fetchable. The seal must not depend on an unrelated gate.
  const src = code(RECAP);
  const seal = src.indexOf('ogCardVisibleToStrangers');
  const publish = src.indexOf('isRecapPublished');
  assert.ok(seal > -1 && publish > -1, 'one of the two gates moved — re-aim this guard');
  assert.ok(seal < publish, 'the visibility seal must come before the publish check');
});

test('the model route is untouched — it already checked visibility', () => {
  // /api/og/v/[slug] is the shape these two were missing. Changing it was never
  // part of this row.
  const src = code(MODEL);
  assert.match(src, /isPubliclyVisible\(/);
  assert.doesNotMatch(src, /ogCardVisibleToStrangers/, 'the vendor route was dragged in');
});
