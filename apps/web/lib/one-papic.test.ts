import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * ONE PAPIC — the cameras tab must not offer a second, separately-priced
 * Papic product beside the credit ladder.
 *
 * Owner, 2026-08-11 and again 2026-08-25: cameras are FREE and UNLIMITED; what
 * a couple buys is CREDITS into one shared pot (50 free · 100/₱50 · 3,000/₱1,000
 * · 10,000/₱3,000 · 20,000/₱5,000).
 *
 * The defect this pins: the CATALOG obeyed that lock while `papic_tier_config`
 * did not — row `mini` was is_active = TRUE under the retired display title
 * "Papic One", and the screen reads the config, not the catalog. Migration
 * 20271168715385 switches it off.
 */
const MIG = path.join(process.cwd(), '..', '..', 'supabase', 'migrations');

test('the retired per-camera rung is switched off in a migration', () => {
  const files = fs.readdirSync(MIG).filter((f) => f.endsWith('.sql'));
  const bodies = files.map((f) => fs.readFileSync(path.join(MIG, f), 'utf8'));
  const turnsMiniOff = bodies.filter(
    (b) =>
      /UPDATE\s+public\.papic_tier_config/i.test(b) &&
      /is_active\s*=\s*FALSE/i.test(b) &&
      /tier_code\s*=\s*'mini'/i.test(b),
  );
  assert.ok(
    turnsMiniOff.length >= 1,
    'no migration deactivates the mini rung — the cameras tab will sell a second Papic',
  );
});

test('no migration re-activates a paid rung', () => {
  // 🔑 A retirement that something later flips back on is not a retirement.
  //
  // 🪤 REV 1 OF THIS ASSERTION WAS DECORATION AND FAILED ON TWO FALSE
  // POSITIVES, both of which are traps this repo has already paid for:
  //   1. FILE-LEVEL MATCHING — it asked whether the file mentioned
  //      `papic_tier_config` anywhere AND `is_active = TRUE` anywhere. Migration
  //      20271019231590 does both, in two UNRELATED statements: it updates
  //      papic_tier_config, and separately activates catalog rows. Two true
  //      facts about one file are not a fact about one statement.
  //   2. NOT STRIPPING COMMENTS — this very file's sibling migration QUOTES the
  //      bug ("row mini was still is_active = TRUE") in its explanation, so a
  //      raw match reports the defect it just fixed.
  // So: strip comments, split into statements, and judge each statement alone.
  const files = fs.readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  const offenders: string[] = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(MIG, f), 'utf8');
    const sql = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    for (const stmt of sql.split(';')) {
      if (!/UPDATE\s+public\.papic_tier_config/i.test(stmt)) continue;
      if (!/is_active\s*=\s*TRUE/i.test(stmt)) continue;
      if (/tier_code\s*=\s*'free'/i.test(stmt)) continue; // free may be active
      offenders.push(f);
      break;
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a migration re-activates a paid Papic rung: ${offenders.join(', ')}`,
  );
});

test('the buy picker still filters on the active flag', () => {
  // FLOOR + the actual mechanism: deactivating the row only removes the buy
  // button because the picker filters on it. If that filter is ever dropped,
  // switching a rung off stops hiding anything — the exact bug that put two
  // retired rungs on live buy buttons before.
  const page = fs.readFileSync(
    path.join(process.cwd(), 'app', 'dashboard', '[eventId]', 'studio', 'papic', 'page.tsx'),
    'utf8',
  );
  const stripped = page
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  assert.match(
    stripped,
    /PAPIC_RUNGS\.filter\(\s*\(\s*rung\s*\)\s*=>\s*papicTierConfig\[rung\]\.isActive\s*\)/,
    'the extra-cameras picker no longer filters rungs on is_active',
  );
});
