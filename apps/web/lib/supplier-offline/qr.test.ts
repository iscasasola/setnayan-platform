/**
 * GUARD — THE OFFLINE CLIENT QR (owner 2026-11-24, DECISION_LOG "The supplier dashboard works offline…"): a setnayan.com
 * invite link carrying the code id, the date and time, the member, the made-offline mark and the phone's time, signed
 * with THAT code's own secret — and NO personal data.
 *
 * Behaviour: a token made here verifies with its secret and with nothing else; changing ANY field (the date, the time,
 * the schedule, the member, the code, the phone's time) or the signature fails; the token's shape has no room for a
 * name or a contact. Source: the claim (`claim.server.ts`) checks the member and the signature BEFORE it touches the
 * schedule, and the shipped invite action asks it BEFORE the shop is added to the event.
 *
 * Sabotage (2026-11-24): replacing `f.date.replace(/-/g, '')` in `offlineQrMessage` with a constant (the client's date
 * no longer what is signed) turns test 1 red — the date read back from the QR is not the date the supplier picked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import {
  OFFLINE_QR_PARAM,
  OFFLINE_QR_TOKEN_RE,
  memberTagOf,
  newOfflineCodeSecret,
  offlineQrUrl,
  parseOfflineQrToken,
  signOfflineQr,
  verifyOfflineQr,
  type OfflineQrFields,
} from './qr';

const root = path.join(import.meta.dirname, '..', '..');
const read = (p: string) => stripComments(readFileSync(path.join(root, p), 'utf8'));

const MEMBER = '0b6f1c2e-7a43-4d3e-9b1f-2c5d8e9a0f11';
const CODE = '5a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const POOL = 'aa11bb22-cc33-4d44-8e55-ff6677889900';

async function fields(over: Partial<OfflineQrFields> = {}): Promise<OfflineQrFields> {
  return {
    codeId: CODE,
    date: '2026-12-12',
    time: '14:30',
    poolId: POOL,
    member: await memberTagOf(MEMBER),
    madeOffline: true,
    phoneTime: '2026-11-24T06:14:00.000Z',
    ...over,
  };
}

test('a token verifies with its own code’s secret, and with no other', async () => {
  const secret = newOfflineCodeSecret();
  assert.match(secret, /^[A-Za-z0-9_-]{43}$/, 'a secret is not the stored shape');
  const token = await signOfflineQr(await fields(), secret);
  assert.ok(token, 'a valid QR could not be signed');
  assert.match(token, OFFLINE_QR_TOKEN_RE);
  const parsed = parseOfflineQrToken(token);
  assert.ok(parsed);
  assert.deepEqual(parsed.fields, await fields(), 'the fields do not read back as signed');
  assert.equal(await verifyOfflineQr(parsed, secret), true);
  assert.equal(await verifyOfflineQr(parsed, newOfflineCodeSecret()), false, 'another code’s secret verified the QR');
});

test('every field is signed — an edited date, time, schedule, member, code, phone time or signature fails', async () => {
  const secret = newOfflineCodeSecret();
  const token = (await signOfflineQr(await fields(), secret))!;
  const parts = token.split('.');
  const edits: Array<[string, (p: string[]) => void]> = [
    ['date', (p) => void (p[2] = '20261213')],
    ['time', (p) => void (p[3] = '1530')],
    ['schedule', (p) => void (p[4] = '-')],
    ['member', (p) => void (p[5] = 'AAAAAAAAAA')],
    ['code', (p) => void (p[1] = 'f'.repeat(32))],
    ['phone time', (p) => void (p[7] = (parseInt(p[7]!, 36) + 60).toString(36))],
    ['signature', (p) => void (p[8] = `${p[8]!.slice(0, -1)}${p[8]!.endsWith('A') ? 'B' : 'A'}`)],
  ];
  for (const [what, edit] of edits) {
    const copy = [...parts];
    edit(copy);
    const parsed = parseOfflineQrToken(copy.join('.'));
    assert.ok(parsed, `an edited ${what} no longer even parses — the test is not testing the signature`);
    assert.equal(await verifyOfflineQr(parsed, secret), false, `a QR with an edited ${what} still verified`);
  }
});

test('the QR carries the made-offline mark and no personal data', async () => {
  const token = (await signOfflineQr(await fields(), newOfflineCodeSecret()))!;
  // v1 . code . date . time . schedule . member tag . made-offline . phone time . signature — nothing else fits.
  assert.equal(token.split('.')[6], '1', 'the made-offline mark is missing');
  assert.ok(!token.includes(MEMBER.replace(/-/g, '')) && !token.includes(MEMBER), 'the member’s account id is in the QR');
  assert.doesNotMatch(token, /@|\s|%20/, 'something that reads like a name or a contact is in the QR');
  assert.equal(await signOfflineQr({ ...(await fields()), madeOffline: false as unknown as true }, newOfflineCodeSecret()), null, 'a QR without the made-offline mark was signed');
  const url = offlineQrUrl('https://setnayan.com', 'luz-studio', token);
  assert.ok(url.startsWith('https://setnayan.com/'), 'the QR does not open setnayan.com');
  assert.match(url, new RegExp(`[?&]${OFFLINE_QR_PARAM}=`), 'the QR does not ride the invite door');
});

test('the claim checks the member and the signature before the schedule, and the invite asks it before the shop is added', () => {
  const claim = read('lib/supplier-offline/claim.server.ts');
  const tag = claim.indexOf('memberTagOf(');
  const sig = claim.indexOf('verifyOfflineQr(');
  const rpc = claim.indexOf("rpc('supplier_offline_code_use'");
  assert.ok(tag > -1 && sig > -1 && rpc > -1, 'the claim no longer checks the member, the signature, or uses the one-code door');
  assert.ok(tag < rpc && sig < rpc, 'the claim writes the schedule before it checks the QR');
  assert.match(claim, /\.eq\('vendor_profile_id', input\.vendorProfileId\)/, 'a code of another shop can be claimed on this shop');

  const action = read('app/vendor-invite/[slug]/actions.ts');
  const ask = action.indexOf('claimOfflineQr(');
  const add = action.indexOf('importVendorToEventShortlist(admin');
  assert.ok(ask > -1 && add > -1 && ask < add, 'the invite adds the shop before the offline QR is checked');
  assert.match(action, /if \(claim\.status !== 'applied'\) backToInvite\(slug, `oc_\$\{claim\.status\}`, scopeWithoutQr\)/, 'a refused offline date is not said to the client');
  assert.ok(action.indexOf('if (!hostEvents.some') < ask, 'the QR is claimed before the event is proven to be the client’s');
});
