/**
 * A SELF-ADDED SUPPLIER GETS A SHARE BUTTON — ON BOTH CARDS, AND ONLY THEM (DECISION_LOG 2026-10-30, "THE INVITE
 * TEXTS — GUEST AND SELF-ADDED SUPPLIER — APPROVED; A SELF-ADDED SUPPLIER GETS A SHARE BUTTON, AN AUTOMATIC CLAIM
 * LINK AND A DIGITAL CARD"; owner: *"for the manual suppliers. we will use the same share button"*).
 *
 * Source guard (comments stripped) — the halves a unit test of the message cannot see:
 *   1. the SERVICE CARD (Event › Suppliers, `bench-vendor-actions.tsx`) draws Share only under `actions.connect`, which
 *      is the one predicate `canInviteSupplier` (a supplier the couple added, not on Setnayan);
 *   2. the RECORD CARD's head (`SupplierConnectPanel layout="top"`, mounted only for a self-added record) and the
 *      panel draw the same `SupplierShareButton` — the bare-link `navigator.share` is gone;
 *   3. the button IS the guest card's share (`shareInvite` from send-invite.tsx), never a second share sheet;
 *   4. its ONE request is the one link writer (`createManualVendorInvite({ …, withShare: true })`) — no "create link"
 *      step, no second token mechanism, no new action or route — which hands back the APPROVED message and the card;
 *   5. reading the facts for the message and the card writes nothing.
 * The message's words are held by `lib/the-supplier-invite-text-is-the-approved-one.test.ts`; the card's look by
 * `lib/the-supplier-card-is-the-prototype.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, '..', '..', '..');
const read = (...p: string[]) => stripComments(readFileSync(path.join(app, '..', ...p), 'utf8'));

const BENCH = read('app', 'dashboard', '[eventId]', 'vendors', '_components', 'bench-vendor-actions.tsx');
const RESOLVER = read('lib', 'bench-card-actions.ts');
const PANEL = read('app', 'dashboard', '[eventId]', '_components', 'supplier-connect-panel.tsx');
const MODAL = read('app', 'dashboard', '[eventId]', '_components', 'new-manual-vendor-modal.tsx');
const BUTTON = read('app', 'dashboard', '[eventId]', '_components', 'supplier-share-button.tsx');
const ACTIONS = read('app', 'dashboard', '[eventId]', 'vendors', 'actions.ts');
const FACTS = read('lib', 'supplier-share.server.ts');

function bodyOf(src: string, fn: string): string {
  const a = src.indexOf(`function ${fn}(`);
  assert.ok(a >= 0, `${fn} not found — re-point this guard`);
  const end = src.indexOf('\n}\n', a);
  return src.slice(a, end > a ? end : undefined);
}

test('the service card draws Share only for a supplier the couple added who is not on Setnayan', () => {
  const mounts = [...BENCH.matchAll(/<SupplierShareButton\b/g)];
  assert.equal(mounts.length, 1, `the service card draws Share ${mounts.length} times (expected once)`);
  const before = BENCH.slice(Math.max(0, mounts[0]!.index! - 40), mounts[0]!.index!);
  assert.match(before, /\{actions\.connect \? $/, 'Share on the service card is no longer gated on the self-added predicate');
  assert.match(RESOLVER, /const connect = canInviteSupplier\(/, '`actions.connect` is no longer the one predicate');
});

test('the record card’s head and the panel draw the same Share', () => {
  const top = bodyOf(PANEL, 'ConnectTop');
  assert.match(top, /<SupplierShareButton eventId=\{eventId\} vendorId=\{vendorId\} vendorName=\{vendorName\} iconOnly prepareOnMount \/>/);
  const panel = bodyOf(PANEL, 'SupplierConnectPanel');
  assert.match(panel, /<SupplierShareButton eventId=\{eventId\} vendorId=\{vendorId\} vendorName=\{vendorName\} prepareOnMount \/>/);
  assert.doesNotMatch(PANEL, /navigator\s*\.share\s*\(/, 'the panel shares the bare link again — a second share');
  // The record card's head is mounted only for a supplier the couple added and who has not joined.
  assert.match(MODAL, /mode\.kind === 'manual' && !edit\.claimAsk \? \(\s*<RecordLinkBlock/);
  assert.match(bodyOf(MODAL, 'RecordLinkBlock'), /<SupplierConnectPanel [^>]*layout="top"/);
});

test('the button is the guest card’s own share', () => {
  assert.match(BUTTON, /import \{ shareInvite \} from '\.\.\/guests\/_components\/send-invite';/);
  assert.doesNotMatch(BUTTON, /navigator\s*\.share\s*\(/, 'the supplier Share calls the share sheet itself instead of shareInvite');
  const press = bodyOf(BUTTON, 'press');
  assert.equal((press.match(/shareInvite\(/g) ?? []).length, 2, 'both paths (in hand · just got) go through shareInvite');
  assert.match(BUTTON, /createManualVendorInvite\(\{ eventId, vendorId, withShare: true \}\)/, 'the Share asks for its link some other way than the one writer');
});

test('its one request is the one link writer, which builds the approved message and the card', () => {
  const fn = bodyOf(ACTIONS, 'createManualVendorInvite');
  const ensure = fn.indexOf('await ensureAutoShareInvite(');
  const share = fn.indexOf('supplierSharePayload(supabase, input.eventId, input.vendorId, url)');
  assert.ok(ensure > 0 && share > ensure, 'the Share is not built from the link the writer just made or found');
  assert.match(FACTS, /buildSupplierInviteMessage\(/);
  assert.match(FACTS, /renderSupplierCardPng\(/);
  assert.doesNotMatch(FACTS, /ensureAutoShareInvite|generateClaimToken|from\('vendor_invites'\)/, 'a second way to make or read a link');
  assert.match(FACTS, /canInviteSupplier\(row\)/, 'the facts are read for a supplier on Setnayan too');
});

test('reading the facts writes nothing', () => {
  // (A hash's or a map's `.update(` is not a write; a table's is.)
  assert.doesNotMatch(FACTS, /\.(insert|upsert)\(|\.from\([^)]*\)\s*\.(update|delete)\(|\.rpc\(|createManualVendorInvite/, 'looking writes something');
});
