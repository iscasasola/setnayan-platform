/**
 * 🎬 The demo shop Setnayan Productions (scripts/demo-shop/) is what every plan picture on For Suppliers is taken
 * from, so what it shows at a plan must come from the plan table (`TIER_CAPS`), never from a list typed beside it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VENDOR_TIERS, tierCaps } from '@/lib/vendor-tier-caps';
import { stripComments } from '@/lib/strip-comments';
import {
  SP_IMAGE_SLOTS,
  SP_PLANS,
  SP_SERVICES,
  liveServiceTitles,
} from '@/scripts/demo-shop/setnayan-productions.fixture';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'demo-shop');

test('the five plans are the widget’s five, each a real tier', () => {
  assert.deepEqual(
    SP_PLANS.map((p) => p.plan),
    ['free', 'verified', 'solo', 'pro', 'ultra'],
  );
  for (const p of SP_PLANS) assert.ok((VENDOR_TIERS as readonly string[]).includes(p.tier), `${p.plan} → ${p.tier}`);
  assert.equal(SP_PLANS.find((p) => p.plan === 'free')?.verified, false, 'Free is the shop before it is verified');
});

test('the live cards at each plan fit that plan’s allowances, and grow with the plan', () => {
  let before = 0;
  for (const p of SP_PLANS) {
    const caps = tierCaps(p.tier);
    const live = liveServiceTitles(p.plan, caps);
    const rows = SP_SERVICES.filter((s) => live.includes(s.title));
    assert.ok(new Set(rows.map((s) => s.folder)).size <= caps.parentCategories, `${p.plan}: too many parent categories`);
    const perLeaf = new Map<string, number>();
    for (const s of rows) perLeaf.set(s.category, (perLeaf.get(s.category) ?? 0) + 1);
    for (const [leaf, n] of perLeaf) assert.ok(n <= caps.servicesPerLeaf, `${p.plan}: ${leaf} over its allowance`);
    assert.ok(live.length >= before, `${p.plan} shows fewer cards than the plan below it`);
    before = live.length;
  }
  assert.equal(liveServiceTitles('free', tierCaps('free')).length, 1, 'Free shows one live card');
  assert.equal(liveServiceTitles('pro', tierCaps('pro')).length, SP_SERVICES.length, 'Pro shows every card');
});

test('every picture is one of the stable keys the owner’s photos drop in by', () => {
  assert.deepEqual(
    SP_IMAGE_SLOTS.map((s) => s.key),
    ['sp-logo-mark', 'sp-logo-wordmark', 'sp-juan', 'sp-hero', 'sp-debut', 'sp-corporate', 'sp-livestream', 'sp-drone'],
  );
  const keys = new Set<string>(SP_IMAGE_SLOTS.map((s) => s.key));
  for (const s of SP_SERVICES) assert.ok(keys.has(s.photo), `${s.title} → ${s.photo}`);
  const files = readdirSync(join(DIR, 'images'));
  for (const k of keys) assert.ok(files.includes(`${k}.jpg`), `images/${k}.jpg is missing`);
});

test('supplier material types no peso figure and never says “Event Hub”', () => {
  for (const f of readdirSync(DIR).filter((n) => /\.(ts|mjs)$/.test(n))) {
    const src = stripComments(readFileSync(join(DIR, f), 'utf8'));
    assert.doesNotMatch(src, /₱\s?\d/, `${f} types a peso figure`);
    assert.doesNotMatch(src, /Event Hub/i, `${f} says "Event Hub"`);
  }
});

test('the shots never point at a non-local Supabase', () => {
  const shots = readFileSync(join(DIR, 'demo-shop-shots.mjs'), 'utf8');
  assert.match(shots, /host !== '127\.0\.0\.1' && host !== 'localhost'/);
  const replay = readFileSync(join(DIR, 'replay-into-postgres.ts'), 'utf8');
  assert.match(replay, /refusing non-local PGHOST/);
});
