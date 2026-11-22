/**
 * The day-of broadcast card never draws a FAILED read as "Coming soon · No broadcast yet",
 * and its stub carries no switch that saves nothing (couple-dashboard audit, 2026-11-17).
 *
 * The page's `broadcastCardRead` caught a thrown read and returned `undefined`; the card
 * reads `undefined` as "the feature is off" and drew the pre-P3 stub — on the event day,
 * over a read that never answered. The stub also held a "Receive broadcasts on this
 * device" checkbox in local state only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const page = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const card = stripComments(readFileSync(join(HERE, '_components/day-of-mode/coordinator-broadcast-card.tsx'), 'utf8'));

test('a thrown broadcast read reaches the card as UNMEASURED, never as undefined', () => {
  const start = page.indexOf('const broadcastCardRead');
  assert.ok(start > 0, 'broadcastCardRead moved — re-anchor this guard');
  const body = page.slice(start, page.indexOf('})();', start));
  const catchBody = body.match(/catch\s*(?:\([^)]*\))?\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
  assert.ok(catchBody, 'broadcastCardRead has no catch — a thrown read would take Home down');
  assert.match(catchBody, /broadcastsMeasured:\s*false/, 'the catch no longer hands the card an unmeasured read');
  assert.doesNotMatch(catchBody, /return undefined/, 'a thrown read draws the "Coming soon" stub again');
});

test('the stub has no switch that saves nothing', () => {
  const stub = card.slice(card.indexOf('function CoordinatorBroadcastStub'));
  assert.doesNotMatch(stub, /type="checkbox"|useState\(/, 'the stub grew a local-only control again');
});
