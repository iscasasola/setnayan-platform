/**
 * same-date-demand-dpo-gate.test.ts — pins the ONE way this gate can be got wrong.
 *
 * The same-date demand signal is the marketplace's only CROSS-COUPLE disclosure,
 * and as of 2026-07-30 it is a Data-Privacy control the owner approves at
 * /admin/data-privacy (`same_date_demand`, seeded 'inactive' → fail-closed).
 *
 * ⚠⚠ THE TRAP, and the reason this file exists. The obvious implementation is
 * `honestDemand = isExploreReplanEnabled() && approved`. That is **backwards**:
 * `vendors/page.tsx` uses `honestDemand` to choose between two counting rules,
 * and its `false` branch is the RAW SAVE-COUNT — the manufactured-scarcity path
 * the owner banned on 2026-06-02 ("counting it as competition = manufactured
 * scarcity, a fineable dark pattern"). So folding the privacy control into
 * `honestDemand` would make **withholding DPO approval switch the dark pattern
 * ON**. The gate must wrap the whole block instead, so not-approved means no
 * count at all.
 *
 * Source assertions, same reason as the neighbouring scan tests: the page is a
 * server component that reaches Supabase, and the property under test is control
 * flow, not a pure function.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DATA_PRIVACY_CONTROLS } from './data-privacy-controls';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const PAGE = 'app/dashboard/[eventId]/vendors/page.tsx';
const MIGRATION =
  '../../supabase/migrations/20271021022827_data_privacy_control_same_date_demand.sql';

const code = (rel: string) =>
  readFileSync(resolve(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

test('the control is in the catalog, so the board can render it', () => {
  const def = DATA_PRIVACY_CONTROLS.find((d) => d.key === 'same_date_demand');
  assert.ok(def, 'same_date_demand must exist in DATA_PRIVACY_CONTROLS');
  // The board groups by risk kind; a missing/unknown group would drop the row.
  assert.equal(def.group, 'automated_ai');
  assert.ok(def.title.length > 0 && def.description.length > 0);
  // The risk note is the DPO's actual decision input — it must name the two
  // things that make this defensible and the one thing that doesn't.
  assert.match(def.riskNote, /re-identif/i, 'must explain WHY the min-3 floor exists');
  assert.match(def.riskNote, /manufactured scarcity/i, 'must name the 2026-06-02 ruling');
  assert.match(def.riskNote, /no per-couple opt-out/i, 'must disclose the missing opt-out');
});

test('the page gates the WHOLE block, not `honestDemand` — the dark-pattern trap', () => {
  const src = code(PAGE);
  // The gate is resolved into its own binding…
  assert.match(src, /const demandApproved = await isDataPrivacyControlActive\('same_date_demand'\)/);
  // …and it guards the computation itself.
  assert.match(
    src,
    /if \(demandApproved && eventDate && marketplaceIds\.length > 0\)/,
    'the demand block must be entered only when the control is approved',
  );
  // THE ASSERTION THAT MATTERS: the privacy control must NOT be folded into
  // honestDemand, because honestDemand=false selects the raw save-count branch.
  assert.match(
    src,
    /const honestDemand = isExploreReplanEnabled\(\);/,
    'honestDemand stays the counting-RULE switch and nothing else',
  );
  assert.doesNotMatch(
    src,
    /honestDemand\s*=[^;]*demandApproved/,
    'folding the DPO control into honestDemand would turn withholding approval into ' +
      'switching the manufactured-scarcity save-count ON',
  );
});

test('both output maps start empty, so a skipped block yields no signal', () => {
  const src = code(PAGE);
  assert.match(src, /const eyeingByVendorId = new Map<string, number>\(\);/);
  assert.match(src, /const demandByVendorId = new Map<string, number>\(\);/);
  // Declared BEFORE the gated block — otherwise skipping it would be a crash,
  // not a quiet absence.
  const eyeing = src.indexOf('const eyeingByVendorId');
  const gate = src.indexOf('if (demandApproved &&');
  assert.ok(eyeing > 0 && gate > 0 && eyeing < gate);
});

test('the migration seeds it INACTIVE and keeps any admin edit', () => {
  const sql = readFileSync(resolve(WEB, MIGRATION), 'utf8');
  // No explicit status → the column default ('inactive') applies: fail-closed.
  assert.doesNotMatch(sql, /status/i, 'must not seed a status — the default is inactive');
  assert.match(sql, /ON CONFLICT \(control_key\) DO NOTHING/);
  assert.match(sql, /'same_date_demand'/);
  // Re-running must never clobber an approval the owner already made.
  assert.doesNotMatch(sql, /DO UPDATE/i);
});
