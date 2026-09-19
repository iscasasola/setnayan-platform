/**
 * readiness-card-is-mounted.test.ts
 *
 * 📋 BROADCAST READINESS (Live_Studio_Unified_Spec_2026-07-25.md § 4h) shipped in
 * Wave 9 as a self-contained card that "Wave 8 (or a follow-up) mounts with two
 * lines" — and then nobody mounted it. A card nobody renders tells no host that
 * their event cannot stream. This pins the mount on the control room, and pins it
 * to the SAME facts object the page already reads for `poolRouteToAir`, so the
 * one-tap Go live button and the card cannot disagree about whether a Setnayan
 * channel is there.
 *
 * Anchored per component, counts printed, comments stripped (a mount left behind in
 * a comment must not count). The mount CONDITION is parsed, not grepped: a mount
 * wrapped in a constant `false` still contains the tag, so presence alone would stay
 * green on the cheapest off-switch.
 *
 * Run from apps/web (bracketed path → use the glob form, never the literal path):
 *   npx tsx --test "app/**\/readiness-card-is-mounted.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(resolve(HERE, 'page.tsx'), 'utf8'));

const count = (re: RegExp) => (PAGE.match(re) ?? []).length;

/** The text between the JSX `{` that encloses `at` and `at` itself. */
function enclosingExpressionHead(src: string, at: number): string {
  let depth = 0;
  for (let i = at - 1; i >= 0; i--) {
    const ch = src[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) return src.slice(i + 1, at);
      depth--;
    }
  }
  return '';
}

test('📋 the card is mounted exactly once on the control room', () => {
  const mounts = count(/<BroadcastReadiness\b/g);
  console.log(`# <BroadcastReadiness mounts: ${mounts}`);
  assert.equal(mounts, 1, `expected exactly one <BroadcastReadiness> mount, found ${mounts}`);
  assert.match(
    PAGE,
    /import\s*\{\s*BroadcastReadiness\s*\}\s*from\s*'@\/app\/_components\/live-studio\/broadcast-readiness'/,
    'the shared card must be the one imported — not a local copy',
  );
});

test('📋 the mount is gated on the resolved decision and nothing else (no constant off-switch)', () => {
  const at = PAGE.indexOf('<BroadcastReadiness');
  assert.ok(at > -1);
  const head = enclosingExpressionHead(PAGE, at).replace(/\s+/g, ' ').trim();
  console.log(`# mount condition: ${JSON.stringify(head)}`);
  assert.equal(head, 'readiness ?', `the mount must read {readiness ? <BroadcastReadiness … /> : null}, got ${JSON.stringify(head)}`);
  assert.match(PAGE, /<BroadcastReadiness\s+readiness=\{readiness\}\s*\/>/, 'the card must be fed the decision itself');
});

test('📋 the decision comes from the facts the page ALREADY fetched — one read, two readers', () => {
  const fetches = count(/\bfetchReadinessFacts\s*\(/g);
  const resolves = count(/\bresolveLiveStudioReadiness\s*\(/g);
  console.log(`# fetchReadinessFacts( calls: ${fetches} · resolveLiveStudioReadiness( calls: ${resolves}`);
  assert.equal(fetches, 1, 'the readiness facts must be read exactly once on this page');
  assert.equal(resolves, 0, 'a second resolveLiveStudioReadiness would re-query the same facts');

  const read = PAGE.match(/const\s+(\w+)\s*=\s*await\s+fetchReadinessFacts\s*\(/);
  assert.ok(read, 'the fetched facts must be bound to a name both readers use');
  const facts = read[1];
  const pool = count(new RegExp(`poolRouteToAir\\(\\s*${facts}\\s*\\)`, 'g'));
  const decide = count(new RegExp(`\\breadiness\\s*=\\s*decideBroadcastReadiness\\(\\s*${facts}\\s*\\)`, 'g'));
  console.log(`# facts var: ${facts} · poolRouteToAir(${facts}): ${pool} · readiness = decideBroadcastReadiness(${facts}): ${decide}`);
  assert.equal(pool, 1, `poolRouteToAir must read the same facts object (${facts})`);
  assert.equal(decide, 1, `the card's decision must be made from the same facts object (${facts})`);
});

test('📋 it sits in the Connect section, inside the Setup sheet — zero height on the fixed surface', () => {
  const at = PAGE.indexOf('<BroadcastReadiness');
  const sheetOpen = PAGE.indexOf('<SetupSheet>');
  const sheetClose = PAGE.indexOf('</SetupSheet>');
  const connect = PAGE.indexOf('<section id="connect"');
  const connectEnd = connect > -1 ? PAGE.indexOf('</section>', connect) : -1;
  console.log(`# offsets · SetupSheet ${sheetOpen}..${sheetClose} · #connect ${connect}..${connectEnd} · mount ${at}`);
  assert.ok(sheetOpen > -1 && sheetOpen < at && at < sheetClose, 'the card must render inside <SetupSheet>, never on the scroll-free surface');
  assert.ok(connect > -1 && connect < at && at < connectEnd, 'the card must live in the #connect section with the channel status');
});
