/**
 * 🍸 RW-285c (live fault, 14 Nov): "Saving the supplier cocktail editor — could not save" fired 62× in a day.
 * `get_vendor_cocktail_editor` REFUSES with an access error (42501) by design when the shop is not booked, the booking
 * fee is not settled, or the couple has not opened the cocktail area to suppliers — and the client page asked it on
 * EVERY visit, so each "no editor here" was logged as a refused write. The page asks it only when all three hold.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '../../../lib/strip-comments';

const PAGE = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/clients/[eventId]/page.tsx'), 'utf8'));

test('the client page asks the cocktail editor only when booked, fee settled and opened by the couple', () => {
  const calls = PAGE.match(/rpc\('get_vendor_cocktail_editor'/g) ?? [];
  assert.equal(calls.length, 1, 'a second, ungated ask of the editor');
  const at = PAGE.indexOf("rpc('get_vendor_cocktail_editor'");
  // The gate is the async block that ends in the ask — read from its own start, never a fixed window.
  const start = PAGE.lastIndexOf('(async (): Promise<{ data: unknown }> => {', at);
  assert.ok(start >= 0 && at - start < 1500, 'the ask is no longer inside its gate block');
  const before = PAGE.slice(start, at);
  assert.match(before, /if \(!isBooked \|\| !feeUnlocked\) return \{ data: null \};/, 'asked before the shop is booked or the fee is settled');
  assert.match(before, /\.select\('cocktail_enabled, cocktail_vendor_edit'\)/);
  assert.match(before, /if \(!plan\?\.cocktail_enabled \|\| !plan\?\.cocktail_vendor_edit\) return \{ data: null \};/, 'asked while the couple has it closed');
});
