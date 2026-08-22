/**
 * life-flash-card.test.ts — the day's own flash is a real door, not a trap.
 *
 * Every failure this guards is SILENT: a card that renders for the wrong viewer
 * looks identical to one that renders for the right one, and a card offered on
 * an unmeasured count looks identical to one offered on a real count. You only
 * find out by pressing it and landing on an empty page.
 *
 * 🛡 Every assertion mutation-checked by occurrence count, each confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CARD = stripComments(readFileSync(resolve(HERE, 'life-flash-card.tsx'), 'utf8'));
const PAGE = stripComments(readFileSync(resolve(HERE, '..', 'page.tsx'), 'utf8'));
const GRAPH = stripComments(
  readFileSync(resolve(HERE, '..', '..', '..', '..', '..', '..', 'lib', 'life-story-moment-graph.ts'), 'utf8'),
);

test('the card is mounted', () => {
  assert.ok(/<LifeFlashCard eventId=\{eventId\} \/>/.test(PAGE),
    'A card that ships unmounted is this repo\'s most repeated defect.');
});

test('it refuses when the feature flag is off', () => {
  assert.ok(/if \(!lifeStoryEnabled\(\)\) return null;/.test(CARD),
    'The Life-Flash route calls notFound() when the flag is off, so an ungated ' +
      'card is a door onto a 404.');
});

test('it refuses anyone who is not a couple member', () => {
  assert.ok(/viewerSeesCoupleScopedPapic\(/.test(CARD),
    'This page admits a promoted coordinator; the moment graph does not. Without ' +
      'this check they follow the link to a page showing them nothing.');
  assert.ok(/return null;/.test(CARD));
});

test('an unmeasured count is NOT treated as zero — it fails closed', () => {
  assert.ok(/moments === null \|\| moments < SCOPE_MIN_MOMENTS\.event/.test(CARD),
    'countEventMoments returns null when the read was REFUSED — a rejected ' +
      'Supabase query resolves with { error } and never throws. null means "not ' +
      'measured", never "zero". Offering the card on it is a door that may open ' +
      'onto nothing.');
});

test('the threshold is the graph\'s own constant, not a copied number', () => {
  assert.ok(/SCOPE_MIN_MOMENTS\.event/.test(CARD),
    'A hand-typed 3 drifts the day somebody changes the real one — and then the ' +
      'card and the scope chip disagree about whether this event has a flash.');
  assert.ok(/event: 3/.test(GRAPH), 'the constant must still exist to be read');
});

test('the link carries the scope the parser actually understands', () => {
  assert.ok(/scope=e\$\{eventId\}/.test(CARD),
    'The key format is `e<eventId>` and the parser is /^e(.+)$/. A different ' +
      'shape silently falls back to the whole-life flash.');
  assert.ok(/\/dashboard\/life-flash\?/.test(CARD), 'one route only — there is no per-event route');
});

test('the count uses the graph\'s filters, not the gallery\'s', () => {
  assert.ok(/export async function countEventMoments/.test(GRAPH),
    'the count must live beside the filters it has to match');
  // The gallery uses a DENY-list (!== nsfw_blocked) which is wider than clean,
  // and counts vendor media the graph never reads.
  assert.ok(
    /\.eq\('moderation_state', 'clean'\)[\s\S]{0,200}\.is\('hidden_at', null\)/.test(GRAPH),
    'countEventMoments must use clean-only + not-hidden, the graph\'s own gate',
  );
  assert.equal(/fetchPapicGallery/.test(CARD), false,
    'Reusing the gallery count can read >= 3 while the flash has nothing.');
  assert.equal(/fetchPreservationTotals/.test(CARD), false,
    'That counts the RETENTION filter; six months on it reads 0 for a full flash.');
  assert.equal(/fetchMomentGraph|getMomentGraphForWall/.test(CARD), false,
    'That reads the viewer\'s WHOLE LIFE to answer a question about one event.');
});

test('the CTA is not painted in the gold slot', () => {
  // In this repo `terracotta` IS the atelier gold #A9834B — 3.37:1 on cream,
  // under the 4.5:1 AA floor. Fine on an icon (3:1 bar), never on text.
  assert.ok(/bg-mulberry/.test(CARD), 'the action uses the CTA colour');
  assert.equal(/text-terracotta[^-]/.test(CARD.replace(/className="[^"]*h-4[^"]*text-terracotta[^"]*"/g, '')), false,
    'gold may tint the icon, never the words');
});
