/**
 * the-claim-link-has-one-door.test.ts — 🔗 A SUPPLIER NOT ON SETNAYAN GETS THEIR CLAIM LINK FROM ONE PLACE: THEIR ROW
 * ON SUPPLIERS › BOOKED › TEAM.
 *
 * Corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3 Suppliers: *"Sync: the claim link exists (`claim-link-share.tsx`,
 * `/vendor/claim/[token]`, `applyClaimAutoLink`). Move its door to the Team row. Until they join, the host enters their
 * times."* The workspace page drew the link (a copy box + "Share invite link"), an "Invite link expired" card and a
 * "Create a shareable invite link" form posting a SECOND link writer (`createAutoShareInviteAction`). They moved: the
 * Team row's `ClaimDoor` shares through the ONE idempotent writer (`createManualVendorInvite` → `ensureAutoShareInvite`),
 * which hands back the live link or makes one — so there is no "create" step, and no second copy.
 *
 * Held as properties of the source (comments stripped — the docblocks name the old door on purpose):
 *   1. the workspace page draws no claim link and posts to no link writer, and the old component is gone;
 *   2. the Team row draws the door exactly once, from the row's own `invite` fact, through the one writer;
 *   3. the door says the host enters their times until they join (the plan's own sentence, on the row).
 *
 * Sabotage (2026-11-02, each reverted, each red): the workspace's `<ClaimLinkShare` block restored (1) · a second
 * `<ClaimDoor` drawn in the waiting row (2) · the times line dropped (3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const V = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const code = (rel: string) => stripComments(readFileSync(join(V, rel), 'utf8'));
const count = (s: string, re: RegExp) => s.match(new RegExp(re.source, 'g'))?.length ?? 0;

test('1 · the workspace page draws no claim link and posts to no link writer', () => {
  const page = code('[vendorId]/workspace/page.tsx');
  for (const re of [/claim_token/, /buildClaimUrl\(/, /ClaimLinkShare/, /createAutoShareInviteAction/, /createManualVendorInvite/, /SupplierShareButton/]) {
    assert.doesNotMatch(page, re, `the workspace page offers the claim link again (${re.source}) — its one door is the Team row`);
  }
  assert.equal(existsSync(join(V, '[vendorId]', 'workspace', '_components', 'claim-link-share.tsx')), false, 'the old copy-box door is back');
  assert.doesNotMatch(code('[vendorId]/workspace/actions.ts'), /ensureAutoShareInvite\(/, 'the workspace grew its own link writer again');
});

test('2 · the Team row draws the door exactly once, from its own fact, through the one writer', () => {
  const row = code('_components/booked-row.tsx');
  assert.equal(count(row, /<ClaimDoor\b/), 1, 'the claim door is drawn more than once (or not at all) on the Booked rows');
  assert.match(row, /\{row\.invite \? <ClaimDoor\b/, 'the claim door no longer follows the row’s `invite` fact');
  const door = row.slice(row.indexOf('function ClaimDoor('), row.indexOf('function PlanRows('));
  assert.match(door, /<SupplierShareButton\b/, 'the claim door does not share through the one link writer');
  assert.equal(count(row, /<SupplierShareButton\b/), 1, 'a second Share door is drawn on the Booked rows');
  const share = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', '_components', 'supplier-share-button.tsx'), 'utf8');
  assert.match(stripComments(share), /createManualVendorInvite\(\{ eventId, vendorId, withShare: true \}\)/, 'Share no longer asks the one idempotent writer');
  const rows = stripComments(readFileSync(join(process.cwd(), 'lib', 'booked-rows.ts'), 'utf8'));
  assert.match(rows, /invite: canInviteSupplier\(\{ marketplace_vendor_id: f\.shopId \}\)/, 'the row’s invite fact is no longer the one eligibility gate');
});

test('3 · until they join, the host enters their times — said on the door', () => {
  const row = code('_components/booked-row.tsx');
  const door = row.slice(row.indexOf('function ClaimDoor('), row.indexOf('function PlanRows('));
  assert.match(door, /Until they join, you enter their times\./, 'the door no longer says who enters their times until they join');
});
