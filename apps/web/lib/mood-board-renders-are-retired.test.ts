/**
 * 🗑 MOOD BOARD RENDERS ARE RETIRED — NO DOOR SELLS, GRANTS OR STARTS ONE.
 *
 * Owner, 2026-10-26, verbatim: *"mood board render is no longer available. can
 * we delete that? there is no more button for this"*. The "Make it real" UI, its
 * server actions, the Gemini client, the shared-render pool picker, the admin
 * "All creations" page, the web pack Buy, the App Store product
 * (`mood_board_renders_50`) and the credit grant/reversal in sku-activation were
 * deleted, and migration 20271289025011 switched the catalogue row off.
 *
 * Measured on prod before deleting: 0 orders and 0 App Store purchases for the
 * pack, 0 renders. The render TABLES and RPCs were then DROPPED (owner-approved
 * 2026-10-26, migration 20271289858095_drop_retired_mood_board_render_schema),
 * so a call to one would now fail at runtime — this guard keeps any app code
 * from reaching for them again, and fails in CI first.
 *
 * What it asserts, each a property (not a file list that can go stale):
 *   1 · no App Store product sells the pack, and the retired id is never reused;
 *   2 · no app/lib source (comments stripped, tests excluded) calls a render
 *       RPC, writes the render-credit ledger, or names the pack SKU — except
 *       the retired BUILD_STATUS line in lib/v2-catalog.ts (positive control:
 *       the scan can see the string where it legitimately remains) and the
 *       Ugat map (lib/ugat/), which describes the schema that still exists;
 *   3 · the latest migration that sets the pack's `is_active` sets it FALSE;
 *   4 · the Mood Board navigator lists no "Make it real" part.
 *
 * 🛡 Sabotaged once (2026-10-26): re-adding `supabase.rpc('moodboard_begin_render', …)`
 * to the mood-board actions turned 2 red naming that file; re-adding the
 * `mood_board_renders_50` product turned 1 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { stripComments } from './strip-comments';
import { IAP_PRODUCTS, iapProductById, iapProductForServiceKey } from './iap/products';

const WEB = join(__dirname, '..');
const REPO = join(WEB, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Every render RPC the retired feature called — they remain in the database with no app caller. */
const RENDER_RPCS = [
  'moodboard_begin_render',
  'moodboard_finish_render',
  'moodboard_fail_render',
  'moodboard_reserve_render_credits',
  'moodboard_release_render_credits',
  'moodboard_render_balance',
  'moodboard_render_caller_may_act',
  'moodboard_set_share_consent',
  'moodboard_set_render_featured',
  'moodboard_set_render_reuse_blocked',
  'moodboard_admin_all_renders',
  'moodboard_attach_gallery_copy',
  'moodboard_inspiration_pool',
];
const FORBIDDEN: ReadonlyArray<[string, RegExp]> = [
  ['a render RPC', new RegExp(`\\b(${RENDER_RPCS.join('|')})\\b`)],
  ['the render-credit ledger', /\bevent_render_credit_(grants|usage)\b/],
  ['the render config', /\bmoodboard_render_config\b/],
  ['the render pack SKU', /\bMOODBOARD_RENDER_PACK\b/],
  ['the retired App Store product', /\bmood_board_renders_50\b/],
];
/** The Ugat map DESCRIBES the schema (the tables and RPCs still exist) — it names them as data and calls nothing. */
const DESCRIBES_THE_SCHEMA = 'lib/ugat/';
/** The one place the SKU code legitimately remains: its retired build status. */
const ALLOWED: Record<string, RegExp> = {
  'lib/v2-catalog.ts': /\bMOODBOARD_RENDER_PACK\b/,
};

test('1 · no App Store product sells the retired Mood Board pack, and its id is never reused', () => {
  assert.equal(iapProductById('com.setnayan.app.mood_board_renders_50'), null);
  assert.equal(iapProductForServiceKey('MOODBOARD_RENDER_PACK'), null);
  assert.deepEqual(
    IAP_PRODUCTS.filter((p) => /mood_board|MOODBOARD/i.test(`${p.productId} ${p.serviceKey}`)).map((p) => p.productId),
    [],
  );
});

test('2 · no app or lib code calls a render RPC, writes render credits, or sells the pack', () => {
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib')), ...walk(join(WEB, 'components'))];
  assert.ok(files.length > 1000, `only ${files.length} source files scanned — the walk is blind`);
  const offenders: string[] = [];
  let allowedSeen = 0;
  for (const abs of files) {
    const rel = relative(WEB, abs).split(sep).join('/');
    if (rel.startsWith(DESCRIBES_THE_SCHEMA)) continue;
    const code = stripComments(readFileSync(abs, 'utf8'));
    for (const [what, re] of FORBIDDEN) {
      if (!re.test(code)) continue;
      if (ALLOWED[rel] && ALLOWED[rel]!.source === re.source) {
        allowedSeen += 1;
        continue;
      }
      offenders.push(`${rel}: ${what} (${code.match(re)![0]})`);
    }
  }
  // Positive control: the scanner does see the SKU where it legitimately remains.
  assert.equal(allowedSeen, 1, 'lib/v2-catalog.ts no longer lists the retired SKU — the scan may be blind');
  assert.deepEqual(offenders, [], `Mood Board renders are retired (owner 2026-10-26):\n${offenders.join('\n')}`);
});

test('3 · the latest migration that switches the pack sets it OFF', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const touching = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => {
      const sql = readFileSync(join(dir, f), 'utf8').replace(/--.*$/gm, '');
      return /MOODBOARD_RENDER_PACK/.test(sql) && /is_active/i.test(sql);
    });
  const last = touching.at(-1);
  assert.ok(last, 'no migration sets the render pack’s is_active');
  const sql = readFileSync(join(dir, last!), 'utf8').replace(/--.*$/gm, '');
  assert.match(sql, /SET\s+is_active\s*=\s*FALSE[\s\S]*?WHERE\s+service_code\s*=\s*'MOODBOARD_RENDER_PACK'/i, `${last} does not switch the pack off`);
});

test('4 · the Mood Board navigator lists no "Make it real" part', () => {
  const parts = readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-parts.tsx'), 'utf8');
  assert.match(parts, /export const MOOD_BOARD_PARTS = \[/, 'the navigator moved — move this check with it');
  assert.doesNotMatch(stripComments(parts), /make-it-real|Make it real/);
});
