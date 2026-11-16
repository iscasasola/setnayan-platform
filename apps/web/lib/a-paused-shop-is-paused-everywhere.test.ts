/**
 * ⏸ A PAUSED SHOP IS PAUSED EVERYWHERE — the owner's answers of 16 Nov to PR #7890 ("1. Yes 2. Yes 3. Yes 4.yes").
 *
 *   (1) Close HIDES, never deletes — no shop-status copy says "deleted".
 *   (3) The admin's "Hide" BECAME Pause: one control on /admin/verify, through the same path as the supplier's own.
 *   (4) The Shortlist QR adds NO paused shop, and its page says "This shop is paused".
 *
 * The database rules are held by tests/db/a-shop-can-be-paused-or-closed.db.test.ts. This file holds the app doors.
 *
 * Fails if: the Shortlist QR writer inserts a row for a paused shop · the claim action or the QR page stops reading
 * the pause · the admin card keeps a Hide button, loses its Pause/Unpause, or reaches the pause by any path but
 * `applyShopStatus` · an unwired shop-status action is exported · `applyShopStatus` writes the row itself, or calls the
 * door after a failed read · /v/[slug] shows the verification line for a paused shop · any copy says "deleted".
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { importVendorToEventShortlist } from './vendor-couple-invite';
import { SHOP_PAUSED_DETAIL, SHOP_PAUSED_LINE, shopStatusRefusalForAdmin } from './shop-status';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

/** A service-role stand-in: answers the shop read, records every insert. */
function fakeAdmin(shop: Record<string, unknown> | null) {
  const inserts: Array<{ table: string; row: unknown }> = [];
  const client = {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: table === 'vendor_profiles' ? shop : null, error: null }),
        insert: (row: unknown) => {
          inserts.push({ table, row });
          return {
            select: () => ({ single: async () => ({ data: { vendor_id: 'ev-1' }, error: null }) }),
          };
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as Parameters<typeof importVendorToEventShortlist>[0], inserts };
}

const SHOP = { vendor_profile_id: 'shop-1', business_name: 'A Shop', services: ['photography'] };

test('(4) the Shortlist QR writer adds NOTHING for a paused shop, and still adds an open one', async () => {
  const paused = fakeAdmin({ ...SHOP, paused_at: '2026-11-16T00:00:00Z' });
  const r = await importVendorToEventShortlist(paused.client, { eventId: 'ev', vendorProfileId: 'shop-1', pickedBy: 'u' });
  assert.deepEqual(r, { status: 'paused' });
  assert.equal(paused.inserts.length, 0, 'a paused shop was added to a shortlist');

  const open = fakeAdmin({ ...SHOP, paused_at: null });
  const ok = await importVendorToEventShortlist(open.client, { eventId: 'ev', vendorProfileId: 'shop-1', pickedBy: 'u' });
  assert.equal(ok.status, 'ok', 'an open shop can no longer be added');
  assert.equal(open.inserts.filter((i) => i.table === 'event_vendors').length, 1);
});

test('(4) the writer selects the pause column, so a short select cannot read as open', () => {
  const src = read('lib/vendor-couple-invite.ts');
  const writer = src.slice(src.indexOf('export async function importVendorToEventShortlist'));
  assert.match(writer.slice(0, 900), /\.select\('[^']*\bpaused_at\b[^']*'\)/);
  assert.match(writer, /isShopPaused\(vendor\)\) return \{ status: 'paused' \}/);
});

test('(4) the claim action refuses a paused shop, and the QR page says "This shop is paused" instead of the form', () => {
  const action = read('app/vendor-invite/[slug]/actions.ts');
  assert.match(action, /\.select\('[^']*\bpaused_at\b[^']*'\)/, 'the claim action no longer reads the pause');
  assert.match(action, /isShopPaused\(vendor\)\) backToInvite\(slug, 'paused', scope\)/);
  assert.match(action, /result\.status === 'paused'\) backToInvite\(slug, 'paused', scope\)/);

  const page = read('app/vendor-invite/[slug]/page.tsx');
  assert.match(page, /\bpaused_at\b/, 'the QR page no longer selects the pause');
  assert.match(page, /const paused = isShopPaused\(vendor\)/);
  // The notice comes FIRST in the action zone, so a paused shop never shows the add-to-plan form.
  const zoneAt = page.indexOf('<div className="mt-6">');
  assert.ok(zoneAt > 0, 'the action zone moved — re-anchor this test');
  const zone = page.slice(zoneAt);
  assert.match(zone.slice(0, 400), /\{paused \? \(/, 'the paused notice is no longer the first branch of the action zone');
  assert.ok(zone.indexOf('{SHOP_PAUSED_LINE}') < zone.indexOf('claimVendorInviteToEvent'), 'the form renders before the notice');
  assert.equal(SHOP_PAUSED_LINE, 'This shop is paused', 'the owner\'s words changed');
  assert.ok(SHOP_PAUSED_DETAIL.length > 0);
});

test('(3) the admin card has ONE control — Pause / Unpause — and no Hide', () => {
  const page = read('app/admin/verify/page.tsx');
  assert.doesNotMatch(page, /Reject → Hidden/, 'the separate Hide button is back');
  assert.doesNotMatch(page, /\brejectVendor\b/, 'the Hide action is still wired');
  const card = page.slice(page.indexOf('function VerifyCard'));
  assert.equal((card.match(/action=\{setVendorPause\}/g) ?? []).length, 2, 'Pause and Unpause must both post to setVendorPause');
  assert.match(card, /name="status" value="paused"/);
  assert.match(card, /name="status" value="open"/);
  assert.match(card, /const paused = isShopPaused\(vendor\)/);
});

test('(3) the admin Pause and the supplier Shop status run the SAME path, and that path calls the door', () => {
  const verify = read('app/admin/verify/actions.ts');
  const fn = verify.slice(verify.indexOf('export async function setVendorPause'));
  assert.match(fn.slice(0, 1200), /await requireAdmin\(\)/, 'the admin Pause lost its admin gate');
  assert.match(fn.slice(0, 1200), /applyShopStatus\(/, 'the admin Pause no longer goes through applyShopStatus');
  assert.doesNotMatch(verify, /export async function rejectVendor/, 'the Hide export is back');

  // Audit of #7890, item 4: no exported action without a screen. The supplier's Shop status calls applyShopStatus
  // through an EXISTING action once its drawing is approved.
  assert.ok(!existsSync(join(WEB, 'app/_actions/shop-status-actions.ts')), 'an unwired shop-status action is exported again');

  const core = read('lib/shop-status.server.ts');
  assert.match(core, /\.rpc\('set_shop_status'/, 'applyShopStatus no longer calls the door');
  assert.doesNotMatch(core, /\.(update|upsert)\(/, 'applyShopStatus writes vendor_profiles itself');
  assert.doesNotMatch(core, /public_visibility\s*:\s*'archived'/, 'applyShopStatus archives the shop itself');
  // Audit item 2: a failed read of the shop REFUSES the change (no silent pause with no audit row and no notice), and
  // the refusal comes before the door is called.
  assert.match(core, /if \(beforeErr\) \{[\s\S]{0,200}return \{ ok: false, reason: 'unreadable' \}/, 'a failed read no longer refuses');
  assert.match(core, /if \(!beforeRow\) return \{ ok: false, reason: 'missing' \}/);
  assert.ok(core.indexOf("reason: 'unreadable'") < core.indexOf(".rpc('set_shop_status'"), 'the door is called before the read is checked');
});

test('(audit 1) /v/[slug] says "This shop is paused" first — never "finishing verification" for a paused shop', () => {
  const page = read('app/v/[slug]/page.tsx');
  assert.match(page, /const shopPaused = isShopPaused\(vendor\) \|\| visibility === 'archived'/);
  assert.match(page, /\{shopPaused \? \(\s*<div className=\{SHOP_CALM_COLUMN_CLASS\}>\s*<ShopPausedNotice \/>/);
  // The paused notice renders ahead of the not-yet-verified notice.
  assert.ok(page.indexOf('<ShopPausedNotice />') < page.indexOf('<NotYetVerifiedNotice />'));
  assert.match(page, /paused=\{shopPaused\}/, 'the packages section no longer hears the pause');
  // In the packages, the paused line is the FIRST branch — ahead of "Not yet bookable — finishing verification".
  const pk = page.slice(page.indexOf('function VendorPackagesSection'));
  assert.ok(pk.indexOf('if (paused)') > 0 && pk.indexOf('if (paused)') < pk.indexOf('finishing verification'));
  assert.match(pk, /if \(paused\) \{\s*cta = <p[^>]*>\{SHOP_PAUSED_LINE\}<\/p>/);
  // One source for the words.
  const notice = page.slice(page.indexOf('function ShopPausedNotice'));
  assert.match(notice.slice(0, 500), /\{SHOP_PAUSED_LINE\}/);
  assert.doesNotMatch(page, /'This shop is paused'|"This shop is paused"/, 'the words were re-typed instead of read');
});

test('(1) a close hides and keeps — no shop-status copy says "deleted"', () => {
  for (const file of ['lib/shop-status.ts', 'lib/shop-status.server.ts', 'app/admin/verify/page.tsx']) {
    const src = read(file);
    // Only rendered/sent strings: quoted literals and JSX text in these files.
    const literals = src.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) ?? [];
    for (const lit of literals) {
      assert.doesNotMatch(lit, /\bdelet/i, `${file} says "deleted" about a shop: ${lit}`);
    }
  }
  assert.match(read('lib/shop-status.server.ts'), /Your page, reviews and photos are kept/);
  assert.equal(shopStatusRefusalForAdmin('closed').includes('delet'), false);
});
