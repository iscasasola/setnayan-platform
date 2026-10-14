/**
 * The claim links the couple's record to the shop through ONE SQL call,
 * `claim_link_record_to_shop` (migration 20271268139017) — which merges the
 * record onto a live row the shop already has on the event (a save from Find)
 * instead of tripping the one-row-per-shop rule. A bare `UPDATE … SET
 * marketplace_vendor_id` on the record is exactly the write that failed the
 * claim; it must not come back. The sibling-row pass is skipped after a merge.
 * The SQL itself is held by `tests/db/a-claim-merges-onto-a-find-save.db.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const SRC = stripComments(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'vendor-invite-actions.ts'), 'utf8'));

test('applyClaimAutoLink links through claim_link_record_to_shop, never a bare update of the record', () => {
  const start = SRC.indexOf('export async function applyClaimAutoLink(');
  assert.ok(start > 0, 're-point: applyClaimAutoLink moved');
  const body = SRC.slice(start, SRC.indexOf('\nexport ', start + 10));
  const rpc = body.indexOf(".rpc('claim_link_record_to_shop'");
  assert.ok(rpc > 0, 'the claim no longer links through claim_link_record_to_shop');
  const before = body.slice(0, rpc);
  assert.doesNotMatch(before, /\.update\(\{\s*marketplace_vendor_id:/, 'a bare marketplace_vendor_id update runs before the merge-aware link');
  assert.match(body, /if \(!merged && parentRow\?\.manual_vendor_id/, 'the sibling pass runs after a merge (it would trip the rule again)');
  assert.match(body, /vendorId: bookingVendorId/, 'the claim reports the record, not the row that now carries the booking');
});
