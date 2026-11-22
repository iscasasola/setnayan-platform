/**
 * 📏 THE METER COUNTS EVERY UPLOAD ROOT (owner 2026-11-23, DECISION_LOG "THE SUPPLIER STORAGE METER COUNTS EVERYTHING
 * THE SHOP OWNS — FILES AND DATA": "every file of any kind … counts for the shop that uploaded it").
 *
 * Every folder an upload is written under (`pathPrefix` in the app) must be EITHER a shop root the meter counts
 * (`SHOP_UPLOAD_ROOTS`, each with how it is sized) OR a root that is never a shop's own storage, with its reason
 * (`NOT_SHOP_UPLOAD_ROOTS`). A new upload folder in neither list turns this red, so a shop upload path cannot ship
 * uncounted. The database half (every TABLE that names a shop) is tests/db/the-meter-counts-every-shop-table.db.test.ts.
 *
 * Plus: the server-stored shop files (handover, mood-board suggestion, marked public copy) record their size, and a
 * delete releases a ledger row.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { NOT_SHOP_UPLOAD_ROOTS, SHOP_UPLOAD_ROOTS, keyMayBeLedgered } from './supplier-storage';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.lab\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

const ROOT_RE = /pathPrefix(?:=|:\s*)\{?\s*[`'"]([a-z0-9-]+)[/`'"$]/g;

test('every upload folder in the app is a counted shop root or a named non-shop root', () => {
  const found = new Map<string, string>();
  for (const dir of ['app', 'lib', 'components']) {
    for (const f of walk(join(WEB, dir))) {
      const src = stripComments(readFileSync(f, 'utf8'));
      for (const m of src.matchAll(ROOT_RE)) if (!found.has(m[1]!)) found.set(m[1]!, relative(WEB, f));
    }
  }
  console.log(`  upload roots seen: ${[...found.keys()].sort().join(' · ')}`);
  // A sweep that sees nothing must not pass quietly.
  assert.ok(found.size >= 15, `only ${found.size} upload roots seen — the scan stopped seeing them`);
  for (const must of ['vendors', 'supplier-files', 'vendor-originals', 'vendor-payment-qr', 'chat', 'handovers']) {
    assert.ok(found.has(must), `the scan no longer sees the shop root "${must}"`);
  }
  const shop = SHOP_UPLOAD_ROOTS as Record<string, string>;
  for (const [root, file] of found) {
    assert.ok(
      root in shop || root in NOT_SHOP_UPLOAD_ROOTS,
      `"${root}/" (${file}) is a new upload folder the storage meter does not know: add it to SHOP_UPLOAD_ROOTS with how ` +
        'it is sized, or to NOT_SHOP_UPLOAD_ROOTS with why it is never a shop’s storage (lib/supplier-storage.ts)',
    );
  }
  for (const [root, why] of Object.entries(NOT_SHOP_UPLOAD_ROOTS)) {
    assert.ok(!(root in shop), `"${root}" is both a shop root and not one`);
    assert.ok(why.length > 8, `"${root}" is left out with no reason`);
  }
});

test('the server-stored shop files record their size; a delete releases it', () => {
  const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
  assert.match(read('app/vendor-dashboard/clients/[eventId]/actions.ts'), /recordServerShopUpload\(createAdminClient\(\), profile\.vendor_profile_id/);
  const sug = read('app/vendor-dashboard/clients/[eventId]/mood-board/suggestion-actions.ts');
  assert.match(sug, /checkSupplierStorage\(admin, door\.vendor_profile_id, photo\.bytes\.byteLength\)[\s\S]*uploadPublicAsset[\s\S]*recordServerShopUpload\(admin, door\.vendor_profile_id/);
  const pub = read('lib/supplier-photo-publish.server.ts');
  assert.match(pub, /deps\.counted\?\.\(vendorProfileId, ORIGINALS, originalKey/);
  assert.match(pub, /deps\.counted\?\.\(vendorProfileId, MEDIA, publicKey/);
  assert.match(read('lib/r2.ts'), /keyMayBeLedgered\(args\.key\)[\s\S]{0,300}releaseShopUpload/);
  assert.equal(keyMayBeLedgered('vendors/abc/logo/x.jpg'), true);
  assert.equal(keyMayBeLedgered('handovers/ev/x.pdf'), true);
  assert.equal(keyMayBeLedgered('inspiration/ev/suggestions/slot/x.jpg'), true);
  assert.equal(keyMayBeLedgered('inspiration/ev/slot/x.jpg'), false, 'the couple’s own board photo is not a shop’s');
  assert.equal(keyMayBeLedgered('papic/seat-1/x.jpg'), false);
  assert.equal(keyMayBeLedgered('supplier-files/s/e/x.pdf'), false);
});
