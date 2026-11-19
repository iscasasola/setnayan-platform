/**
 * 🔓 REACH IS NOT A PLAN ALLOWANCE — owner 2026-11-19 (DECISION_LOG), verbatim:
 *   *"ok unlock the range. not plan dependend anymore."*
 *   *"Free Unverified account will have a range of 0km."*
 *   *"but the plan must depend on how many accounts are using it."*
 *
 * The rule, which REPLACES the 2026-11-18 5 · 10 · 50 · 100 km · nationwide ladder:
 *   · an UNVERIFIED shop reaches 0 km (not in search, Discover or Find — lib/findable-shop.ts; reached by its own
 *     link or QR) and cannot declare a ring;
 *   · a VERIFIED shop on ANY plan sets its own outer and free-transport range, with no plan ceiling — only the
 *     typo guard `MAX_DECLARABLE_RADIUS_KM`, the same for everyone.
 *
 * This file fails when a plan grows a distance again, when the save path reads the plan, or when a page prints a
 * km per plan. It walks the source on purpose: a second reach-per-plan table would pass its own unit tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { TIER_CAPS, VENDOR_TIERS } from '@/lib/vendor-tier-caps';
import {
  MAX_DECLARABLE_RADIUS_KM,
  REACH_NEEDS_VERIFIED,
  effectiveOuterRadiusKm,
  reachCeilingKm,
  validateServiceRadiusPair,
} from '@/lib/vendor-service-radius';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('no plan carries a distance — the caps table has no reach field', () => {
  for (const t of VENDOR_TIERS) {
    const keys = Object.keys(TIER_CAPS[t]);
    const reachy = keys.filter((k) => /radius|reach|km$/i.test(k));
    assert.deepEqual(reachy, [], `${t} carries a reach-shaped cap: ${reachy.join(', ')}`);
  }
});

test('THE RULING · a verified Free shop can save 200 km; an unverified one cannot', () => {
  // "Free" is not even an input: a verified shop's ceiling is the same on every plan.
  const verified = validateServiceRadiusPair({ inner: '20', outer: '200', verified: true });
  assert.deepEqual(verified, { ok: true, innerRadiusKm: 20, outerRadiusKm: 200 });
  assert.equal(effectiveOuterRadiusKm(200, true), 200, 'a saved 200 km is read back whole');

  const unverified = validateServiceRadiusPair({ inner: '20', outer: '200', verified: false });
  assert.equal(unverified.ok, false);
  assert.equal(unverified.ok ? '' : unverified.error, REACH_NEEDS_VERIFIED);
  assert.equal(effectiveOuterRadiusKm(200, false), 0, 'an unverified shop reads 0 km whatever is stored');
});

test('the one ceiling is verification, and the typo guard is unchanged', () => {
  assert.equal(reachCeilingKm(true), Infinity);
  assert.equal(reachCeilingKm(false), 0);
  assert.equal(MAX_DECLARABLE_RADIUS_KM, 1000, 'the sane max moved — that is an owner call, not a refactor');
});

test('the save action reads VERIFICATION from the database, never the plan or the form', () => {
  const s = code('app/vendor-dashboard/shop/radius-actions.ts');
  assert.match(s, /\.select\('verification_state'\)/, 'the save no longer reads verification itself');
  assert.match(s, /verified,\s*\}\);/, 'the validator is not handed the verification it read');
  assert.doesNotMatch(s, /tier_state|tierCaps|TIER_CAPS/, 'the save reads the plan again');
  assert.doesNotMatch(s, /formData\.get\(['"](verified|tier|verification_state)['"]\)/, 'the ceiling is taken from the form');
});

test('the radius module takes no plan at all', () => {
  const s = code('lib/vendor-service-radius.ts');
  assert.doesNotMatch(s, /vendor-tier-caps|tierCaps|tier_state/, 'lib/vendor-service-radius.ts reads the plan again');
});

/** Every non-test source file under app/ and lib/. */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const st = statSync(p);
    if (st.isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('no source reads a reach off a plan, nor names the retired ladder helpers', () => {
  const offences: string[] = [];
  for (const f of [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))]) {
    const s = stripComments(readFileSync(f, 'utf8'));
    if (/\b(?:TIER_CAPS|tierCaps\([^)]*\)|caps|c)\??\.serviceRadiusKm\b/.test(s)) offences.push(`${relative(WEB, f)} · reads serviceRadiusKm off a plan`);
    if (/\b(reachLadderWords|nextPlanReach|tierOuterRadiusCapKm)\b/.test(s)) offences.push(`${relative(WEB, f)} · names a retired reach-by-plan helper`);
  }
  assert.deepEqual(offences, []);
});

test('the Coverage reach card has no "next plan reaches" upsell and locks an unverified shop in ONE row', () => {
  const s = code('app/vendor-dashboard/shop/_components/service-radius-fields.tsx');
  assert.doesNotMatch(s, /nextReach|ladder|reaches \$\{/, 'the next-plan upsell or its ⓘ ladder came back');
  assert.match(s, /<GetVerifiedLine title=\{COVERAGE_REACH_TITLE\} line=\{COVERAGE_REACH_LOCKED_LINE\}/);
});
