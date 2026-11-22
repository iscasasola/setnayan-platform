/**
 * the-templates-tile-says-templates.test.ts — the Shop's saved-templates tile wears the word on the
 * approved HYBRID drawing (`prototypes/service_card_maker_HYBRID_2026-11-17_fable.html`): "Templates".
 * It read "Saved templates" (review of #8059, a look call decided by the controller 20 Nov).
 *
 * SABOTAGE (seen red): set the tile's title back to 'Saved templates'.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'shop-makers.tsx'), 'utf8'));

test('the templates tile is titled "Templates", the drawing’s word', () => {
  const tile = SRC.match(/\{\s*k:\s*'templates' as const,\s*title:\s*'([^']+)'/);
  assert.ok(tile, 'the templates tile moved — re-aim this guard');
  assert.equal(tile![1], 'Templates');
  assert.doesNotMatch(SRC, /title:\s*'Saved templates'/);
});
