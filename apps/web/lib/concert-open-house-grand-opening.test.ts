/**
 * 🎤 CONCERT · OPEN HOUSE · GRAND OPENING — and "Competition" finds Tournament.
 *
 * Owner, 2026-09-29 (DECISION_LOG "DISCOVER — UNPARKED", item b: *"yes to
 * all"*). The three kinds are minted in `event_type_vocab` by migration; this
 * file reads THAT migration for the keys (never a hand-typed list beside it) and
 * holds every code map a new kind must reach:
 *   · a checklist label   — else it renders "Wedding checklist";
 *   · an AI band          — the DEFAULT made explicit ('C'), never a new price;
 *   · host roles          — else the picker offers "Maid of honor";
 *   · Papic eligibility   — "offer Papic everywhere" (owner 2026-08-01);
 *   · the llms.txt list   — the public description of what ships.
 * And "competition" is a search word for `tournament`, not a type.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { checklistChrome } from './checklist';
import { AI_TIER_BY_EVENT_TYPE } from './setnayan-ai-type-pricing';
import { HOST_ROLES_BY_EVENT_TYPE } from './host-roles';
import { PAPIC_ACCESS_PHASE_1_TYPES } from './papic-event-access';
import { LIVE_EVENT_TYPES } from './llms-txt';
import { eventSearchTerms } from './event-vocabulary';
import { matchesCommandQuery } from './command-match';

const MIGRATIONS = join(__dirname, '..', '..', '..', 'supabase', 'migrations');

function typesMigration(): string {
  const f = readdirSync(MIGRATIONS).find((n) => n.endsWith('_concert_open_house_grand_opening.sql'));
  assert.ok(f, 'the migration that mints the three kinds is missing');
  return readFileSync(join(MIGRATIONS, f), 'utf8');
}

/** The keys the migration's vocab INSERT mints — read, not retyped. */
function mintedKeys(): string[] {
  const sql = typesMigration();
  const vocab = sql.slice(sql.indexOf('INSERT INTO public.event_type_vocab'), sql.indexOf('ON CONFLICT (event_type)'));
  const keys = [...vocab.matchAll(/\(\d+,\s*'([a-z_]+)'/g)].map((m) => m[1]!);
  assert.deepEqual(keys, ['concert', 'open_house', 'grand_opening'], 'the migration mints exactly the three owner-approved kinds');
  return keys;
}

test('every new kind has its own checklist chrome — never "Wedding checklist"', () => {
  for (const k of mintedKeys()) {
    assert.notEqual(checklistChrome(k).heading, 'Wedding checklist', `${k} renders wedding chrome`);
  }
});

test('every new kind is banded C in code, and the band is left UNCHOSEN in the database', () => {
  for (const k of mintedKeys()) {
    assert.equal(AI_TIER_BY_EVENT_TYPE[k], 'C', `${k} must carry the default band, not a new price`);
  }
  // NULL = "no band chosen" — /admin/pricing asks the owner; setnayan_ai_price_tier()
  // resolves it to 'C', the same as the code map, so nothing is priced by guesswork.
  const sql = typesMigration();
  assert.match(sql, /description, ai_price_tier\)\s*SELECT [^;]*v\.description, NULL/,
    'the vocab rows must seed ai_price_tier NULL');
});

test('every new kind offers organiser roles, never the wedding cast', () => {
  for (const k of mintedKeys()) {
    const roles = HOST_ROLES_BY_EVENT_TYPE[k];
    assert.ok(roles, `${k} has no role set — the picker would fall open to the wedding list`);
    assert.ok(!roles.some((r) => /maid|bride|groom|best_man/i.test(r)), `${k} offers a wedding role`);
  }
});

test('every new kind is offered Papic, and is named in llms.txt', () => {
  const papic = PAPIC_ACCESS_PHASE_1_TYPES as readonly string[];
  for (const k of mintedKeys()) assert.ok(papic.includes(k), `${k} is not offered Papic`);
  for (const phrase of ['concerts', 'open houses', 'grand openings']) {
    assert.ok(LIVE_EVENT_TYPES.includes(phrase), `llms.txt does not name ${phrase}`);
  }
});

test('the Papic sizing row is the DEFAULT row, copied — no per-head figure is invented', () => {
  const sql = typesMigration();
  const pool = sql.slice(sql.indexOf('INSERT INTO public.papic_event_pool_config'));
  assert.match(pool, /d\.points_per_guest, d\.floor_points, d\.recommend_floor_points, d\.ceiling_points/,
    'every sizing number must come from the default row');
  assert.match(pool, /WHERE d\.config_key = 'default'/);
});

test('🔎 "competition" finds a Tournament — a search word, not a new type', () => {
  const haystack = eventSearchTerms('tournament', null, null, null);
  const item = { kind: 'event' as const, label: 'Barangay Cup', sublabel: '', terms: haystack };
  for (const q of ['competition', 'Competition', 'tournament']) {
    assert.ok(matchesCommandQuery(item, q), `"${q}" does not find a tournament`);
  }
  assert.doesNotMatch(typesMigration(), /'competition'/, 'competition must not be minted as its own type');
});
