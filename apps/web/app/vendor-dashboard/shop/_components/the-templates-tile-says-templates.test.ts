/**
 * the-templates-tile-says-templates.test.ts — the Shop's saved-templates tile wears the word on the
 * approved HYBRID drawing (`prototypes/service_card_maker_HYBRID_2026-11-17_fable.html`): "Templates".
 * It read "Saved templates" (review of #8059, a look call decided by the controller 20 Nov).
 * RE-AIMED 23 Nov 2026 (Store drawing `supplier_store_graphs_badges_2026-11-23` v10): the SECTION is "Templates" and its
 * four tiles are Chat forms · Card forms · Offer maker · Payment plans (the shelf word, owner 23 Nov) — Card forms and Payment plans open the Templates
 * panel on Quick Forms and Payment Strategies.
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

test('the section is "Templates"; its four tiles are the drawing’s words, in its order', () => {
  assert.match(SRC, /<h2 id="shop-makers-h"[^>]*>\s*Templates\s*<\/h2>/);
  const titles = [...SRC.matchAll(/\{ id: '(\w+)' as const,[^}]*?title: '([^']+)'/g)].map((m) => `${m[1]}=${m[2]}`);
  assert.deepEqual(titles, ['chat_forms=Chat forms', 'card_forms=Card forms', 'offers=Offer maker', 'plans=Payment plans']);
  assert.match(SRC, /id: 'card_forms' as const, k: 'templates' as const, tpl: 'forms' as const/);
  assert.match(SRC, /id: 'plans' as const, k: 'templates' as const, tpl: 'plans' as const/);
  assert.doesNotMatch(SRC, /title:\s*'Saved templates'/);
});
