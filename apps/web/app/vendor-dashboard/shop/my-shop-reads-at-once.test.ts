/**
 * my-shop-reads-at-once.test.ts — My Shop's reads start together.
 *
 * ─── The bug this exists to prevent ──────────────────────────────────────
 * `loadShopData` made about twenty trips to the database ONE AFTER ANOTHER —
 * corrections, tier, switches, stats, stories, stamps, contacts, registration,
 * travel rings, branch fee, team names, logo, vocabulary, microsite, founding
 * date, thumbnails, Instagram, reviews, coverage — although nearly all of them
 * needed nothing but the shop's id. Each waited for the last, and My Shop took
 * 1.7 s to load (measured on prod 2026-09-29).
 *
 * The fix starts every read as a promise and awaits them in ONE `Promise.all`.
 * It regresses quietly: the next read gets written the way the old ones were
 * — a plain `await` at the top of the loader — and it works, passes every
 * other test, and puts a whole round trip back in front of every supplier.
 *
 * ─── What it checks ──────────────────────────────────────────────────────
 * Between the "EVERY READ BELOW STARTS AT ONCE" banner and "THE ONE WAIT", no
 * statement at the loader body's own depth may `await`. An `await` INSIDE a
 * started read (deeper indentation) is fine — that is the read's own work.
 * And the two orderings that MUST survive: the shop gate runs before any read
 * starts, and the service-role team lookup waits for the RLS-scoped team rows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'page.tsx'), 'utf8');

const START = 'EVERY READ BELOW STARTS AT ONCE';
const WAIT = 'THE ONE WAIT';

test('the read block and its one wait are both still there, in order', () => {
  const a = src.indexOf(START);
  const b = src.indexOf(WAIT);
  assert.ok(a > 0, `the "${START}" banner is gone from page.tsx`);
  assert.ok(b > a, `"${WAIT}" must come after "${START}"`);
  // The first statement after the banner: `const [ … ] = await Promise.all([`.
  const firstStatement = src.slice(b, src.indexOf(';', b));
  assert.match(
    firstStatement,
    /\]\s*=\s*await Promise\.all\(\[/,
    'the one wait is no longer a single Promise.all',
  );
});

test('no read between them is awaited at the loader body depth', () => {
  const region = src.slice(src.indexOf(START), src.indexOf(WAIT));
  const offenders = region
    .split('\n')
    // Exactly two spaces = a statement of the loader body itself.
    .filter((l) => /^ {2}\S/.test(l))
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .filter((l) => /\bawait\b/.test(l));
  assert.deepEqual(
    offenders,
    [],
    'A read on My Shop is awaited on its own, so every visit waits for it before the ' +
      'next read even starts. Start it as a promise (`const xRead = (async () => { … })();`) ' +
      'and add it to the one Promise.all under "THE ONE WAIT".',
  );
});

test('the shop gate still runs first, and the admin team lookup waits for the scoped rows', () => {
  const gate = src.indexOf("if (!profile) return 'no-vendor';");
  const start = src.indexOf(START);
  assert.ok(gate > 0 && gate < start, 'the reads must start only after the shop is known to be theirs');

  const region = src.slice(start, src.indexOf(WAIT));
  const enrich = region.indexOf('enrichTeamWithUsers(createAdminClient(), team)');
  assert.ok(enrich > 0, 'the team-name lookup left the read block');
  // The started promise that holds it must first wait for the RLS-scoped rows.
  const opens = region.lastIndexOf('(async () => {', enrich);
  const body = region.slice(opens, enrich);
  assert.match(
    body,
    /const team = await teamRead;/,
    'the service-role lookup must run on rows the RLS read already scoped to THIS shop',
  );
});
