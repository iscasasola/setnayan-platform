/**
 * a-card-needs-a-cover-and-whats-included.test.ts — H2, the rest of the
 * publish gate, in the three places it must agree.
 *
 * ⚖ Owner 2026-09-09: *"the cover-photo · title · inclusions requirements
 * stay"*. The title is B1's (a blank card is named). This is the other two.
 *
 * #5373 proved that moving the TypeScript alone leaves the database answering
 * differently ("app says yes, database says no"), so the SQL half is pinned
 * here too — comments stripped, so a docblock that QUOTES a rule cannot stand
 * in for the rule. The behaviour itself is proved against a replayed schema in
 * tests/db/a-card-needs-a-cover-and-whats-included.db.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  LIVE_CARD_KEEPS,
  PUBLISH_COACH_MESSAGE,
  PUBLISH_REFUSAL_MESSAGE,
  PUBLISH_REQUIREMENTS,
  coverIsSet,
  inclusionsAreSet,
  liveCardFlags,
  unmetForALiveCard,
  unmetPublishRequirements,
} from './service-publish-gate';
import { liveCardHealthFlags, scoreCardHealth, type CardHealthSnapshot } from './card-health';

const COMPLETE = { hasPrice: true, hasCover: true, hasInclusions: true };

// ── 1 · the rule ──────────────────────────────────────────────────────────────

test('going live needs a cover, a price and what’s included — in the pass’s order', () => {
  assert.deepEqual([...PUBLISH_REQUIREMENTS], ['cover', 'price', 'inclusions']);
  assert.deepEqual(unmetPublishRequirements(COMPLETE), []);
  assert.deepEqual(unmetPublishRequirements({ ...COMPLETE, hasCover: false }), ['cover']);
  assert.deepEqual(unmetPublishRequirements({ ...COMPLETE, hasInclusions: false }), ['inclusions']);
  assert.deepEqual(
    unmetPublishRequirements({ hasPrice: false, hasCover: false, hasInclusions: false }),
    ['cover', 'price', 'inclusions'],
  );
});

test('a blank cover and blank inclusion rows do not count', () => {
  assert.equal(coverIsSet(null), false);
  assert.equal(coverIsSet('   '), false);
  assert.equal(coverIsSet('r2://media/vendors/x/cover.webp'), true);
  assert.equal(inclusionsAreSet([]), false);
  assert.equal(inclusionsAreSet(['', '  ', null, undefined]), false);
  assert.equal(inclusionsAreSet(['', 'Sound system']), true);
});

test('a card ALREADY live is held to its price only, and FLAGGED for the rest', () => {
  assert.deepEqual([...LIVE_CARD_KEEPS], ['price']);
  const bare = { hasPrice: true, hasCover: false, hasInclusions: false };
  assert.deepEqual(unmetForALiveCard(bare), [], 'a live card missing a cover was refused an edit');
  assert.deepEqual(liveCardFlags(bare), ['cover', 'inclusions']);
  assert.deepEqual(unmetForALiveCard({ ...bare, hasPrice: false }), ['price']);
  const flags = liveCardHealthFlags(bare);
  assert.deepEqual(
    flags.map((f) => [f.code, f.sheet]),
    [
      ['live_no_cover', 'media'],
      ['live_no_inclusions', 'custom'],
    ],
  );
  for (const f of flags) assert.match(f.message, /^This card is live without/);
  assert.deepEqual(liveCardHealthFlags(COMPLETE), []);
});

test('every requirement has a refusal, a coach line and a live-card flag', () => {
  for (const r of PUBLISH_REQUIREMENTS) {
    assert.ok(PUBLISH_REFUSAL_MESSAGE[r].trim().length > 0, `${r} refusal`);
    assert.ok(PUBLISH_COACH_MESSAGE[r].trim().length > 0, `${r} coach`);
  }
  // The cover's coach line keeps the words the maker already showed.
  assert.equal(PUBLISH_COACH_MESSAGE.cover, 'Add a cover photo — required to publish.');
});

// ── 2 · the maker's meter asks the same gate ────────────────────────────────

function snap(over: Partial<CardHealthSnapshot> = {}): CardHealthSnapshot {
  return {
    hasCover: true,
    photoCount: 3,
    hasClip: true,
    hasPrice: true,
    title: 'Live band',
    inclusionLabels: ['Sound system'],
    discountConditions: [],
    lines: [],
    eventTypes: ['wedding'],
    faiths: [],
    ...over,
  };
}

test('card health blocks a card with nothing included, and sends the shop to that sheet', () => {
  const h = scoreCardHealth(snap({ inclusionLabels: ['  '] }));
  assert.equal(h.grade, 'blocked');
  const f = h.blockers.find((b) => b.code === 'no_inclusions');
  assert.ok(f, 'no "what’s included" blocker');
  assert.equal(f.sheet, 'custom');
  assert.equal(f.message, PUBLISH_COACH_MESSAGE.inclusions);
  assert.equal(scoreCardHealth(snap()).blockers.length, 0, 'a complete card is blocked');
});

test('card health’s cover blocker now COMES from the gate — one rule, not two', () => {
  const src = readFileSync(join(import.meta.dirname, 'card-health.ts'), 'utf8');
  assert.ok(
    !/if \(!snapshot\.hasCover\)/.test(src),
    'card-health.ts re-grew its own cover rule beside the shared gate',
  );
  const h = scoreCardHealth(snap({ hasCover: false }));
  assert.deepEqual(h.blockers.map((b) => b.code), ['no_cover']);
});

// ── 3 · the database says the same sentences, at the same moment ───────────

const MIGRATIONS = join(import.meta.dirname, '..', '..', '..', 'supabase', 'migrations');
function h2Sql(): string {
  const hits = readdirSync(MIGRATIONS).filter((f) =>
    f.endsWith('_a_card_needs_a_cover_and_whats_included.sql'),
  );
  assert.equal(hits.length, 1, `expected one H2 migration, found ${hits.join(', ')}`);
  return readFileSync(join(MIGRATIONS, hits[0] as string), 'utf8')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n');
}
function fnBody(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} is not re-signed by the H2 migration`);
  const end = sql.indexOf('$function$;', start);
  return sql.slice(start, end);
}
const refusal = (r: keyof typeof PUBLISH_REFUSAL_MESSAGE) => PUBLISH_REFUSAL_MESSAGE[r];

test('the trigger refuses a coverless card going live, with the app’s sentence, cover first', () => {
  const body = fnBody(h2Sql(), 'enforce_service_publish_gate');
  const cover = body.indexOf(refusal('cover'));
  const price = body.indexOf(refusal('price'));
  assert.ok(cover > 0, 'the trigger does not say the cover sentence');
  assert.ok(price > cover, 'the trigger asks the price before the cover — the order the app uses is cover first');
  assert.match(body, /IF v_going_live AND NULLIF\(btrim\(COALESCE\(NEW\.primary_photo_r2_key, ''\)\), ''\) IS NULL THEN/);
});

test('"what’s included" is judged at COMMIT, and only when a card GOES live', () => {
  const sql = h2Sql();
  const body = fnBody(sql, 'enforce_service_publish_gate_inclusions');
  assert.ok(body.includes(refusal('inclusions')), 'the deferred check does not say the inclusions sentence');
  assert.match(body, /NULLIF\(btrim\(COALESCE\(i\.label, ''\)\), ''\) IS NOT NULL/, 'a blank inclusion row counts');
  const ins = sql.slice(sql.indexOf('CREATE CONSTRAINT TRIGGER trg_enforce_service_publish_gate_inclusions_ins'));
  assert.match(ins, /^CREATE CONSTRAINT TRIGGER \w+\s+AFTER INSERT ON public\.vendor_services\s+DEFERRABLE INITIALLY DEFERRED/);
  const upd = sql.slice(sql.indexOf('CREATE CONSTRAINT TRIGGER trg_enforce_service_publish_gate_inclusions_upd'));
  assert.match(upd, /^CREATE CONSTRAINT TRIGGER \w+\s+AFTER UPDATE OF is_active ON public\.vendor_services\s+DEFERRABLE INITIALLY DEFERRED/);
  assert.match(
    upd.slice(0, upd.indexOf('EXECUTE FUNCTION')),
    /WHEN \(NEW\.is_active IS TRUE AND OLD\.is_active IS NOT TRUE\)/,
    'every save of a live card would be re-judged — a live card must be flagged, never refused',
  );
});

test('save_vendor_service refuses the same three, only when the save takes a card live', () => {
  const body = fnBody(h2Sql(), 'save_vendor_service');
  const order = (['cover', 'price', 'inclusions'] as const).map((r) => body.indexOf(refusal(r)));
  for (const [i, at] of order.entries()) assert.ok(at > 0, `the RPC does not say requirement ${i}`);
  assert.ok(order[0]! < order[1]! && order[1]! < order[2]!, 'the RPC asks in a different order from the app');
  assert.match(body, /IF p_publish THEN[\s\S]*IF NOT v_was_live THEN/, 'the RPC judges a card that is already live');
  // The two silent defects the gift work fixed must survive the re-sign.
  assert.match(body, /exclusive_perk_text\s+= CASE WHEN v_perk_given THEN v_perk\s+ELSE exclusive_perk_text END/);
  assert.match(body, /RAISE EXCEPTION 'Service not found\.'/);
});

// ── 4 · host_mc is named "Host / MC", from the taxonomy the app reads ────────

test('a blank card’s kind falls back to the taxonomy tree’s label before the humanised key', () => {
  const body = fnBody(h2Sql(), 'fill_blank_service_card_title');
  const canon = body.indexOf('FROM public.canonical_service_schemas s');
  const tree = body.indexOf('FROM public.service_categories c');
  const human = body.indexOf("initcap(replace(COALESCE(NEW.category, ''), '_', ' '))");
  assert.ok(canon > 0 && tree > canon && human > tree, 'the kind chain is out of order or missing a link');
  assert.match(body, /v_kind \|\| ' by ' \|\| v_shop/, 'the name shape changed');
});
