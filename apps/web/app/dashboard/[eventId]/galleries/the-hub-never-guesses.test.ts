/**
 * the-hub-never-guesses.test.ts — the Galleries hub is the page a couple opens
 * to REACH photographs they already have. It may never answer a question it did
 * not ask.
 *
 * ── The defect this pins ───────────────────────────────────────────────────
 * The Papic card on this page already carries a long comment explaining that
 * binding a read's error and then throwing it away is "the defect wearing
 * careful clothes" — a refusal and a genuinely empty event give the same 0.
 *
 * The card beside it never bound an error at all. A refused read of the
 * couple's own photos resolved with `data: null`, the list read as empty, and
 * the page told them **"Collecting… · Add your own photos to your Event Hub"**
 * with an **Add photos** button — on the surface whose entire job is to reach
 * the photographs they already uploaded. An unread list is not an empty list.
 *
 * Found by an adversarial audit of the W5-E stream, which had walked past this
 * file after concluding the Gallery archetype does not describe it. Ruling out
 * a design port is not the same as reading the page.
 *
 * ── The rules, and why each is countable rather than clever ────────────────
 * 1. Every read this page makes must REPORT its own refusal. Counted, not
 *    pattern-matched: one `logQueryError` per `supabase.from(` read. Add a
 *    read without error handling and the counts diverge.
 * 2. Any action label with an empty-state branch must consult a measured flag.
 *    A `viewLabel` that chooses between "View & download" and "Add photos"
 *    without knowing whether the read succeeded is the defect above, restated.
 * 3. The hub's one control must clear the AA floor. Measurements in the table.
 *
 * 🛡 Mutation-checked by printed occurrence count, before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = join(__dirname, 'page.tsx');

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function source(): string {
  return stripComments(readFileSync(PAGE, 'utf8'));
}

/** Today: membership · the Papic photo count · the couple's own photos. */
const READ_FLOOR = 3;

test('every read this page makes reports its own refusal', () => {
  const src = source();
  const reads = [...src.matchAll(/supabase\s*\n?\s*\.from\(|supabase\.from\(/g)].length;
  const reported = [...src.matchAll(/logQueryError\(/g)].length;

  assert.ok(
    reads >= READ_FLOOR,
    `found ${reads} reads on the galleries hub, expected at least ${READ_FLOOR}. ` +
      `A scan that stops matching reports a clean page it never looked at — fix the match, do not lower the floor.`,
  );
  assert.equal(
    reported,
    reads,
    `${reads} reads, ${reported} of them report a refusal. A Supabase read does not throw — it resolves ` +
      `with { error }, and an unreported refusal reaches the screen as an ABSENCE. On this page an ` +
      `absence reads as "you have no photos yet", complete with a button inviting the couple to add ` +
      `the ones they already added.`,
  );
});

test('no card offers its empty-state action on a count it did not take', () => {
  const src = source();
  // Every action label that BRANCHES has an empty state; each must consult a
  // measured flag before choosing it.
  const branching = [...src.matchAll(/viewLabel:\s*([^\n]*(?:\n[^\n]*){0,2}?),\n/g)]
    .map((m) => m[1] ?? '')
    .filter((expr) => expr.includes('?'));

  assert.ok(
    branching.length >= 2,
    `found ${branching.length} branching action labels, expected at least 2 (Papic and the couple's own photos). ` +
      `If the shape changed, teach this guard the new one rather than deleting it.`,
  );
  const guessing = branching.filter((expr) => !/Measured/.test(expr));
  assert.deepEqual(
    guessing,
    [],
    'An action label chooses between "you have some" and "you have none" without consulting whether the ' +
      'read succeeded. Send nobody to the empty-state door on a count that was never taken.',
  );
});

/**
 * Colours MEASURED on the surface they land on. Each carries its arithmetic so
 * a future reader can check it rather than trust the table.
 */
const BANNED_ON_THIS_HUB: ReadonlyArray<{ readonly spelling: string; readonly measured: string }> = [
  {
    // In this repo the slot named `terracotta` is the atelier GOLD #A9834B.
    spelling: 'bg-terracotta text-white',
    measured: 'white on #A9834B = 3.48:1 — below the 4.5:1 AA floor. The action colour is `mulberry` (4.76:1).',
  },
  {
    spelling: 'text-ink/60',
    measured: 'ink at 60% on white = 3.99:1 — under the floor for a control label. ink/70 is 5.40:1.',
  },
  {
    spelling: 'text-ink/55 hover:',
    measured: 'ink at 55% on white = 3.45:1. Legal for a blurb under the app-wide register, never for a control.',
  },
];

test('the hub’s controls clear the AA floor', () => {
  const src = source();
  const offenders = BANNED_ON_THIS_HUB.filter((b) => src.includes(b.spelling)).map(
    (b) => `${b.spelling} — ${b.measured}`,
  );
  assert.deepEqual(
    offenders,
    [],
    'A control on the Galleries hub paints below the AA floor. Check a colour against the surface it ' +
      'lands on, never against a token name: the slot called `terracotta` here is the atelier gold.',
  );
});
