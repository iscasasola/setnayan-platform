/** FINAL CHECK A1-123: a package saved at ₱0 (the table allows it) never shows "₱0" to couples — "Price on request". */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../lib/strip-comments';

const card = stripComments(readFileSync(join(process.cwd(), 'app/_components/vendor-packages/package-card.tsx'), 'utf8'));

test('every price the card draws falls back to "Price on request" at ₱0', () => {
  const draws = card.match(/formatCentavosPhp\(pkg\.total_price_centavos\)/g) ?? [];
  assert.equal(draws.length, 2);
  const guarded = card.match(/pkg\.total_price_centavos > 0 \? formatCentavosPhp\(pkg\.total_price_centavos\) : PRICE_ON_REQUEST/g) ?? [];
  assert.equal(guarded.length, draws.length, 'a package price is drawn without the ₱0 rule');
});
