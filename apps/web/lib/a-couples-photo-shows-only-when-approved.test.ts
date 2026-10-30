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
  assert.match(body, /s\.public_key IS NOT NULL/, 'the card reader serves a share with no frozen copy');
  // 👁 The cached public read is PUBLIC-audience only (owner 2026-10-30).
  assert.match(body, /s\.audience = 'public'/, 'the cached public read returns non-public photos');
  assert.match(body, /vs\.is_active IS TRUE/, 'a paused card would still show couple photos');
  // 🛡 #7089 F1 — the card never reads the couple's board row (any event member may edit it).
  assert.doesNotMatch(body, /event_inspiration_assets|image_url|snapshot_/, 'the card reads the live board row / the snapshot instead of the frozen copy');
  assert.match(sql, /REVOKE ALL ON TABLE public\.couple_photo_shares FROM anon, authenticated;/, 'anon may read, or a session write, the shares table');
  assert.match(sql, /GRANT SELECT ON TABLE public\.couple_photo_shares TO authenticated;/);
  assert.doesNotMatch(sql, /GRANT (?:ALL|INSERT|UPDATE|DELETE)[^;]*ON TABLE public\.couple_photo_shares/, 'a write grant on the shares table');
  const anonGrants = [...sql.matchAll(/GRANT EXECUTE ON FUNCTION public\.(\w+)\([^)]*\) TO anon/g)].map((m) => m[1]);
  assert.deepEqual(anonGrants, ['service_card_couple_photos'], 'a share door other than the card reader is open to anon');

  const reader = read('lib/couple-photo-share.server.ts');
  assert.match(reader, /\.rpc\('service_card_couple_photos'/, 'the card reader no longer goes through the approved-only door');
  assert.match(reader, /coupleLookUrl\(r\.public_key\)/, 'the card maps something other than the frozen copy’s key to a URL');
  const cardFn = reader.slice(reader.indexOf('export async function fetchServiceCardCouplePhotos('), reader.indexOf('export async function publishCoupleLook('));
  assert.ok(cardFn.length > 100, 'the card reader could not be found');
  assert.doesNotMatch(cardFn, /from\('couple_photo_shares'\)/, 'the card reader selects the table directly');
  const page = read('app/v/[slug]/page.tsx');
  assert.match(page, /fetchServiceCardCouplePhotos\(admin, activeServiceIds\)/, 'the shop page no longer reads its cards’ couple photos');
  assert.match(page, /withCoupleLooks\(/, 'the shop page no longer puts the couple photos on the card');
});

test('👁 non-public photos never reach the cached page: a separate signed-in read, after the page, under the viewer’s session', () => {
  const viewer = fn('viewer_service_card_couple_photos');
  assert.match(viewer, /auth\.uid\(\) IS NOT NULL/);
  assert.match(viewer, /s\.audience <> 'public'/);
  assert.match(viewer, /s\.audience = 'hosts' AND s\.event_id IN \(SELECT public\.current_couple_event_ids\(\)\)/, 'Only hosts is not the event’s couple');
  // ⚠ Private FAILS CLOSED to Exclusive — it is resolved exactly like Exclusive, never by anything wider.
  assert.match(viewer, /s\.audience IN \('exclusive', 'private'\) AND s\.event_id IN \(SELECT public\.current_event_ids\(\)\)/, 'Private no longer fails closed to Exclusive');
  assert.doesNotMatch(viewer, /follow|connection|people/i, 'Private was widened to "the people around me" without a ruling');
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.viewer_service_card_couple_photos\(UUID\[\]\) FROM anon;/);
  const page = read('app/v/[slug]/page.tsx');
  assert.doesNotMatch(page, /fetchViewerCouplePhotos|viewer_service_card_couple_photos|op: 'viewer_looks'/, 'the shop page reads non-public photos into its HTML');
  const gallery = read('app/v/[slug]/_components/services-gallery.tsx');
  assert.match(gallery, /useEffect\(\(\) => \{\s*if \(!viewerSignedIn \|\| cardIds\.length === 0\) return;[\s\S]{0,120}op: 'viewer_looks'/, 'the viewer’s extra photos are not read after the page, signed-in only');
  const server = read('lib/couple-photo-share.server.ts');
  assert.match(server, /return isPublic \? R2_BUCKETS\.media : R2_BUCKETS\.threadFiles;/, 'a non-public copy lives in the public bucket');
  assert.match(server, /presignDisplayUrl\(R2_BUCKETS\.threadFiles, key, SIGNED_LOOK_TTL_S\)/, 'a non-public copy is not served as a signed URL');
});

test('1b · no page outside the two parties ever selects the shares table', () => {
  const allowed = new Set([
    'app/_actions/couple-photo-share-actions.ts',
    // The frozen-copy sweep: reads which APPROVED shares name a copy, to delete the rest (service role, keys only).
    'lib/couple-photo-share.server.ts',
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

test('F1 · F3 · Approve publishes a frozen copy under a neutral key, made BEFORE the approve is recorded', () => {
  assert.match(sql, /public_key ~ \('\^couple-looks\/' \|\| share_id::text \|\| '-\[0-9a-f\]\{16\}\\\.\(jpg\|jpeg\|png\|webp\)\$'\)/, 'the public key is not pinned to the share id + one attempt + an image type');
  assert.match(sql, /CHECK \(\(state = 'approved'\) = \(public_key IS NOT NULL\)\)/, 'an approved share can exist without its copy (or a dead one keep one)');
  const trig = fn('couple_photo_shares_follow_the_board');
  assert.match(trig, /SET state = 'withdrawn', withdrawn_at = NOW\(\), public_key = NULL/);
  assert.match(sql, /CREATE TRIGGER couple_photo_shares_follow_the_board\s+BEFORE UPDATE ON public\.event_inspiration_assets/, 'a change to the board row no longer withdraws its share');
  for (const col of ['image_url', 'r2_key', 'removed_at', 'added_by_user_id', 'source_kind']) {
    assert.match(sql, new RegExp(`OLD\\.${col} IS DISTINCT FROM NEW\\.${col}`), `a change to ${col} no longer withdraws the share`);
  }
  const action = read('app/_actions/couple-photo-share-actions.ts');
  const approve = action.slice(action.indexOf('async function answerCouplePhoto('));
  const copyAt = approve.indexOf('publishCoupleLook(');
  const rpcAt = approve.indexOf(".rpc('vendor_answer_couple_photo'");
  assert.ok(copyAt > 0 && rpcAt > copyAt, 'the approve is recorded before (or without) the frozen copy');
  assert.match(approve, /p_public_key: publicKey/);
  // 🛡 #7089 round 2 — a refused approve deletes ONLY its own attempt's copy.
  assert.match(approve, /if \(r\.status !== 'ok'\) await unpublishCoupleLook\(publicKey, copyPublic\);/);
  assert.doesNotMatch(approve, /unpublishCoupleLook\(r\.unpublished_key\);\s*\n?\s*if \(r\.status !== 'ok'\)/);
  const server = read('lib/couple-photo-share.server.ts');
  assert.match(server, /copyObject\(R2_BUCKETS\.media, snapshotKey, coupleLookBucket\(isPublic\), toKey\)/, 'the copy is not made from the snapshot into its audience’s bucket');
  assert.match(server, /export async function reconcileCoupleLooks/, 'nothing sweeps the copies of withdrawn shares');
  assert.match(server, /const attempt = \(\) => randomBytes\(8\)\.toString\('hex'\);/, 'the copy key is not a fresh 64-bit attempt');
  assert.match(server, /coupleLookKey\(shareId, snapshotKey, attempt\(\)\)/, 'the copy key is not fresh per attempt');
  assert.match(server, /i \+= SWEEP_CHUNK/, 'the sweep asks about every key in one request');
  assert.match(server, /maxKeys: SWEEP_MAX_OBJECTS/);
});

test('3 · withdraw moves the row out of approved; the uploader alone may do it', () => {
  const body = fn('couple_withdraw_photo_share');
  assert.match(body, /SET state = 'withdrawn', withdrawn_at = NOW\(\), public_key = NULL/);
  assert.match(body, /v_row\.shared_by_user_id IS DISTINCT FROM auth\.uid\(\) AND NOT public\.is_admin\(\)/, 'someone other than the uploader can withdraw');
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
  // 🛡 #7089 F2 — the proof is the object: a key under THIS event's upload folder, held by no other row.
  assert.match(body, /v_photo\.r2_key NOT LIKE \('inspiration\/' \|\| v_photo\.event_id::TEXT \|\| '\/%'\)/, 'a key from anywhere can be shared');
  assert.match(body, /o\.r2_key = v_photo\.r2_key AND o\.inspiration_id <> v_photo\.inspiration_id/, 'a partner’s key re-filed on a second row can be shared');
  // 🛡 #7089 F4 — a NULL uploader is nobody's.
  assert.match(body, /v_photo\.added_by_user_id IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(sql, /CREATE TRIGGER a_board_photo_keeps_its_provenance\s+BEFORE UPDATE OF added_by_user_id, source_kind, from_suggestion_id/, 'a board photo’s uploader, kind or origin can be rewritten');
  // 🛡 #7089 round 2 — a supplier's suggested photo (stored in the couple's own folder) is never their own.
  assert.match(body, /v_photo\.r2_key LIKE \('inspiration\/' \|\| v_photo\.event_id::TEXT \|\| '\/suggestions\/%'\)/, 'a suggestions-folder object can be shared as the couple’s');
  assert.match(body, /v_photo\.from_suggestion_id IS NOT NULL/);
  assert.match(body, /FROM public\.event_inspiration_suggestions sg WHERE sg\.r2_key = v_photo\.r2_key/, 'a supplier suggestion’s key, refiled, can be shared');
  assert.match(body, /ev\.marketplace_vendor_id = v_shop[\s\S]{0,60}ev\.archived_at IS NULL/, 'a shop not on the event can be sent a photo');
});
