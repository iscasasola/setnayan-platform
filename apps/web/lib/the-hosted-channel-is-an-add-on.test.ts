/**
 * the-hosted-channel-is-an-add-on.test.ts — the two pool-only defects this PR
 * fixes, pinned so neither comes back.
 *
 * Owner ruling 2026-09-02: the couple's OWN YouTube link is the DEFAULT for
 * Live Studio; Setnayan supplying the channel (LIVE_STUDIO_HOSTED_CHANNEL) is
 * an OPTIONAL extra. Before this PR, every pool-only connect surface rendered
 * "Setnayan now provides the YouTube channel… there is nothing for you to
 * connect" to EVERY host, add-on or not — true only for the minority who
 * bought it, and for everyone else a false claim that talks them out of the
 * paste-link box sitting on the same screen (their actual route to air).
 *
 * Two properties, guarded here:
 *   1. THE NOTICE — which of the two sentences a host sees must be driven by
 *      a REAL read of event ownership, not rendered unconditionally.
 *   2. THE ENTITLEMENT — the add-on must never gate the multicam controller.
 *      lib/add-on-stats.ts's ADD_ON_SKU_MAP ALSO drives lib/add-on-state.ts's
 *      'launch' resolution, so adding LIVE_STUDIO_HOSTED_CHANNEL there would
 *      let buying the channel alone unlock multicam nobody paid LIVE_STUDIO's
 *      price for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  poolOnlyConnectNotice,
  POOL_ONLY_CONNECT_NOTICE,
  POOL_ONLY_DEFAULT_NOTICE,
} from './live-studio-pool-only';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
// Unstripped — for the one test below that asserts on a DOCBLOCK'S content
// rather than code structure. stripComments would blank the very text it needs
// to read.
const readRaw = (rel: string) => readFileSync(join(HERE, rel), 'utf8');

const SETUP_PAGE = '../app/dashboard/[eventId]/studio/panood/setup/page.tsx';
const BUY_PAGE = '../app/dashboard/[eventId]/studio/live-studio-control/page.tsx';
const CONTROLLER = '../app/panood/control/[eventId]/page.tsx';
const ALL_SURFACES = [SETUP_PAGE, BUY_PAGE, CONTROLLER];

/* ── 1 · The pure function itself ─────────────────────────────────────────── */

test('poolOnlyConnectNotice returns the add-on sentence ONLY for an add-on owner', () => {
  assert.equal(poolOnlyConnectNotice(true), POOL_ONLY_CONNECT_NOTICE);
  assert.equal(poolOnlyConnectNotice(false), POOL_ONLY_DEFAULT_NOTICE);
  assert.notEqual(POOL_ONLY_CONNECT_NOTICE, POOL_ONLY_DEFAULT_NOTICE);
});

test('the default notice names the paste-link box, not a channel Setnayan already supplies', () => {
  assert.match(
    POOL_ONLY_DEFAULT_NOTICE,
    /paste.*watch link/i,
    'a default-tier host must be pointed at their actual route to air',
  );
  assert.doesNotMatch(
    POOL_ONLY_DEFAULT_NOTICE,
    /setnayan now provides|setnayan.*supplies the (youtube )?channel for your/i,
    'the default notice must not claim Setnayan already holds their channel — most hosts never bought that',
  );
});

test('the add-on notice still reads as a status, not an error, unchanged', () => {
  assert.doesNotMatch(POOL_ONLY_CONNECT_NOTICE, /error|failed|sorry|try again/i);
  assert.match(POOL_ONLY_CONNECT_NOTICE, /nothing for you to connect/i);
});

/* ── 2 · Every pool-only surface branches on a REAL read, not a hardcode ──── */

test('⭐ every pool-only connect surface calls poolOnlyConnectNotice(), never the bare add-on constant', () => {
  for (const surface of ALL_SURFACES) {
    const src = read(surface);
    assert.match(
      src,
      /poolOnlyConnectNotice\(/,
      `${surface} still renders a notice without checking hosted-channel ownership`,
    );
    // The OLD shape this replaces — rendering the shared constant unconditionally.
    // A mutation that reverts to it (e.g. `{POOL_ONLY_CONNECT_NOTICE}`) must fail here.
    assert.doesNotMatch(
      src,
      /\{POOL_ONLY_CONNECT_NOTICE\}/,
      `${surface} renders POOL_ONLY_CONNECT_NOTICE unconditionally — every host, add-on or not, would ` +
        `see the "nothing to connect" sentence that is only true for add-on owners`,
    );
  }
});

test('every pool-only surface resolves ownership from LIVE_STUDIO_HOSTED_CHANNEL_SKU via eventSkuActive', () => {
  for (const surface of ALL_SURFACES) {
    const src = read(surface);
    assert.match(
      src,
      /eventSkuActive\(\s*supabase,\s*eventId,\s*LIVE_STUDIO_HOSTED_CHANNEL_SKU\s*\)/,
      `${surface} does not read real hosted-channel ownership — poolOnlyConnectNotice() would be fed a guess`,
    );
  }
});

/* ── 3 · The add-on must never gate multicam ──────────────────────────────── */

test('🔒 LIVE_STUDIO_HOSTED_CHANNEL never enters ADD_ON_SKU_MAP', () => {
  // ADD_ON_SKU_MAP (add-on-stats.ts) ALSO drives resolveAddOnState's 'launch'
  // resolution (add-on-state.ts). Adding this code to the 'live-studio-roam'
  // entry — or anywhere in the map — would let buying the channel alone unlock
  // the multicam controller, which nobody paid LIVE_STUDIO's price for.
  const src = read('./add-on-stats.ts');
  assert.doesNotMatch(
    src,
    /LIVE_STUDIO_HOSTED_CHANNEL/,
    'the hosted-channel add-on must never appear in ADD_ON_SKU_MAP — it would gate the multicam controller',
  );
});

test('the SKU constant documents that it grants no entitlement of its own', () => {
  const src = readRaw('./live-studio-control.ts');
  assert.match(src, /LIVE_STUDIO_HOSTED_CHANNEL_SKU/, 'the SKU constant is missing');
  const at = src.indexOf('LIVE_STUDIO_HOSTED_CHANNEL_SKU');
  const docblockStart = src.lastIndexOf('/**', at);
  // Flatten JSDoc line-continuations (`\n * `) to spaces so a phrase that
  // happens to wrap across lines still matches as one sentence.
  const doc = src.slice(docblockStart, at).replace(/\n\s*\*\s?/g, ' ');
  assert.match(doc, /STACKS on LIVE_STUDIO_SKU/, 'the constant no longer documents that it stacks, not replaces');
  assert.match(doc, /grants NO entitlement/i, 'the constant no longer documents that it grants no entitlement');
});

test('the controller resolves multicam lock from LIVE_STUDIO_SKU, never the hosted-channel SKU', () => {
  const src = read(CONTROLLER);
  const lockAt = src.indexOf('liveStudioControlLock(');
  assert.ok(lockAt > -1, 'liveStudioControlLock(...) call not found — did the controller move?');
  // The lock call's own argument list must not reference the hosted-channel SKU.
  const call = src.slice(lockAt, src.indexOf(')', lockAt) + 1);
  assert.doesNotMatch(
    call,
    /LIVE_STUDIO_HOSTED_CHANNEL/,
    'the multicam lock must be resolved from LIVE_STUDIO_SKU/entitled alone',
  );
});
