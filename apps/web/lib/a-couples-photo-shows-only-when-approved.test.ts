/**
 * a-couples-photo-shows-only-when-approved.test.ts — 📸 THE SOURCE-SIDE FENCES ON A COUPLE'S SHARED PHOTO (owner
 * 2026-10-30, DECISION_LOG "A CUSTOMER'S PHOTO SHARED TO A SUPPLIER'S INSPIRATION — THE SUPPLIER APPROVES, IT SYNCS TO
 * THEIR SERVICE CARD …"). The behaviour is proven against the replayed schema in
 * tests/db/a-couples-photo-reaches-a-card-only-when-approved.db.test.ts; these hold the WIRING that test cannot see:
 *
 *   1 · PENDING NEVER PUBLIC — the public card reads ONLY `service_card_couple_photos` (approved, still on the board,
 *       card active); no public page selects the table; anon holds no grant on the table.
 *   2 · ONLY THAT SUPPLIER CAN APPROVE — the answer runs under the SHOP'S OWN session (never the admin client), and the
 *       door checks `current_vendor_profile_ids()`.
 *   3 · WITHDRAW REMOVES IT — the take-back door moves the row to 'withdrawn' and the card reads 'approved' only.
 *   4 · CONSENT REQUIRED — the action refuses without the box, the door refuses without a version, the Send button
 *       is disabled until the box is ticked.
 *
 * Every assertion reads the code with comments stripped (a comment naming the rule must not satisfy it).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const sql = (() => {
  const f = readdirSync(MIGRATIONS).find((n) => n.endsWith('_a_couples_photo_on_a_suppliers_card.sql'));
  assert.ok(f, 'the couple-photo migration is gone');
  return readFileSync(join(MIGRATIONS, f), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*--/.test(l))
    .map((l) => l.replace(/\s--.*$/, ''))
    .join('\n');
})();
/** One function's body, from its CREATE to the `$$;` that closes it. */
function fn(name: string): string {
  const at = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.ok(at >= 0, `${name} is gone from the migration`);
  const open = sql.indexOf('$$', at);
  const close = sql.indexOf('$$', open + 2);
  assert.ok(open > at && close > open, `${name}'s body could not be read`);
  return sql.slice(open, close);
}

test('1 · the public card reads approved rows only, through the one door', () => {
  const body = fn('service_card_couple_photos');
  assert.match(body, /s\.state = 'approved'/, 'the card reader no longer filters to approved');
  assert.match(body, /a\.removed_at IS NULL/, 'a photo removed from the board would stay on the card');
  assert.match(body, /vs\.is_active IS TRUE/, 'a paused card would still show couple photos');
  assert.match(sql, /REVOKE ALL ON TABLE public\.couple_photo_shares FROM anon;/, 'anon may read the shares table');
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.couple_photo_shares FROM authenticated;/, 'a session may write the shares table directly');
  const anonGrants = [...sql.matchAll(/GRANT EXECUTE ON FUNCTION public\.(\w+)\([^)]*\) TO anon/g)].map((m) => m[1]);
  assert.deepEqual(anonGrants, ['service_card_couple_photos'], 'a share door other than the card reader is open to anon');

  const reader = read('lib/couple-photo-share.server.ts');
  assert.match(reader, /\.rpc\('service_card_couple_photos'/, 'the card reader no longer goes through the approved-only door');
  assert.doesNotMatch(reader, /from\('couple_photo_shares'\)/, 'the card reader selects the table directly');
  const page = read('app/v/[slug]/page.tsx');
  assert.match(page, /fetchServiceCardCouplePhotos\(admin, activeServiceIds\)/, 'the shop page no longer reads its cards’ couple photos');
  assert.match(page, /withCoupleLooks\(/, 'the shop page no longer puts the couple photos on the card');
});

test('1b · no page outside the two parties ever selects the shares table', () => {
  const allowed = new Set([
    'app/_actions/couple-photo-share-actions.ts',
    'app/_actions/couple-photo-share-actions.ts',
  ]);
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(WEB, dir))) {
      if (name === 'node_modules' || name === '.next') continue;
      const rel = `${dir}/${name}`;
      if (statSync(join(WEB, rel)).isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && /from\('couple_photo_shares'\)/.test(read(rel))) hits.push(rel);
    }
  };
  walk('app');
  walk('lib');
  assert.deepEqual(hits.filter((h) => !allowed.has(h)), [], 'a page reads couple_photo_shares directly — read it through the doors');
});

test('2 · only that shop answers — under its own session, checked in SQL', () => {
  const body = fn('vendor_answer_couple_photo');
  assert.match(body, /v_row\.vendor_profile_id NOT IN \(SELECT public\.current_vendor_profile_ids\(\)\)/, 'the answer no longer checks the shop');
  assert.match(body, /RAISE EXCEPTION 'not_yours'/);
  const action = read('app/_actions/couple-photo-share-actions.ts');
  assert.match(action, /\.rpc\('vendor_answer_couple_photo'/);
  assert.doesNotMatch(action, /createAdminClient|supabase\/admin/, 'the answer runs on the admin client — auth.uid() would be nobody and the shop check meaningless');
  const list = fn('vendor_couple_photo_shares');
  assert.match(list, /s\.vendor_profile_id IN \(SELECT public\.current_vendor_profile_ids\(\)\)/, 'the shop list reads other shops’ photos');
});

test('3 · withdraw moves the row out of approved; the uploader alone may do it', () => {
  const body = fn('couple_withdraw_photo_share');
  assert.match(body, /SET state = 'withdrawn', withdrawn_at = NOW\(\)/);
  assert.match(body, /v_row\.shared_by_user_id <> auth\.uid\(\) AND NOT public\.is_admin\(\)/, 'someone other than the uploader can withdraw');
  const action = read('app/_actions/couple-photo-share-actions.ts');
  assert.match(action, /\.rpc\('couple_withdraw_photo_share'/);
});

test('4 · consent is required at every layer', () => {
  const body = fn('couple_share_photo_with_supplier');
  assert.match(body, /p_consent_version IS NULL OR length\(btrim\(p_consent_version\)\) = 0[\s\S]{0,80}'no_consent'/, 'the door shares without consent');
  assert.match(sql, /consent_version\s+TEXT NOT NULL/);
  assert.match(sql, /consented_at\s+TIMESTAMPTZ NOT NULL/);
  const action = read('app/_actions/couple-photo-share-actions.ts');
  assert.match(action, /if \(!input\.consent\) return \{ status: 'refused'/, 'the action sends without the box ticked');
  assert.match(action, /p_consent_version: COUPLE_PHOTO_CONSENT_VERSION/);
  const sheet = read('app/dashboard/[eventId]/studio/mood-board/_components/share-photo-sheet.tsx');
  assert.match(sheet, /type="checkbox"/, 'the consent checkbox is gone');
  assert.match(sheet, /disabled=\{!consent \|\| !chosen \|\| busy\}/, 'Send works before the box is ticked');
  assert.match(sheet, /couplePhotoConsentText\(shop\)/);
});

test('5 · only the couple’s own upload, by its uploader, to a shop on the event', () => {
  const body = fn('couple_share_photo_with_supplier');
  assert.match(body, /colour_access_caller_is_couple\(v_photo\.event_id\)/);
  assert.match(body, /v_photo\.source_kind <> 'file_upload'/, 'a supplier’s photo could be re-shared as the couple’s');
  assert.match(body, /v_photo\.added_by_user_id <> auth\.uid\(\)/);
  assert.match(body, /ev\.marketplace_vendor_id = v_shop[\s\S]{0,60}ev\.archived_at IS NULL/, 'a shop not on the event can be sent a photo');
});
