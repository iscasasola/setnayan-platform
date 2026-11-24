/**
 * GUARD — THE OFFLINE CLIENT QR, NO STOCK (owner 2026-11-24, DECISION_LOG 7d618cb3; R8): each phone signs its own codes
 * with a non-extractable ECDSA P-256 key; the server keeps only the public half and checks every QR against it with
 * node:crypto. No personal data in the QR.
 *
 * Behaviour: a token signed on the phone (WebCrypto) verifies on the server (node:crypto) with THAT phone's public key
 * and no other; changing ANY field (code, phone, shop, member, date, time, schedule, amount, phone time) or the signature
 * fails; the private key cannot be exported; the token has no room for a name or a contact. Source: the shared check
 * (`claim.server.ts` · `checkOfflineQr`) refuses another shop, a stopped phone, another member and a bad signature
 * BEFORE the schedule is touched; the shipped invite action asks it BEFORE the shop is added; the supplier's own sync
 * asks the same check.
 *
 * Sabotage (2026-11-24): making `verifyOfflineQrSignature` return true when `verify(` fails turns test 2 red (an
 * edited code verified).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import {
  OFFLINE_QR_PARAM,
  OFFLINE_QR_TOKEN_RE,
  isPublicKeyJwk,
  memberTagOf,
  newPhoneKey,
  offlineQrUrl,
  parseOfflineQrToken,
  signOfflineQr,
  type OfflineQrFields,
} from './qr';

{
  const Mod = createRequire(import.meta.url)('node:module') as { _load: (r: string, ...a: unknown[]) => unknown };
  const load = Mod._load;
  Mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}
const verifier = async () => (await import('./qr.server')).verifyOfflineQrSignature;

const root = path.join(import.meta.dirname, '..', '..');
const read = (p: string) => stripComments(readFileSync(path.join(root, p), 'utf8'));

const MEMBER = '0b6f1c2e-7a43-4d3e-9b1f-2c5d8e9a0f11';
const SHOP = '11111111-2222-4333-8444-555555555555';
const POOL = 'aa11bb22-cc33-4d44-8e55-ff6677889900';

async function fields(deviceId: string, over: Partial<OfflineQrFields> = {}): Promise<OfflineQrFields> {
  return {
    codeId: crypto.randomUUID(),
    deviceId,
    shop: SHOP,
    member: await memberTagOf(MEMBER),
    date: '2026-12-12',
    time: '14:00',
    poolId: POOL,
    services: ['5a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b'],
    totalPhp: 85000,
    firstPhp: 15000,
    madeOffline: true,
    phoneTime: '2026-11-24T06:14:00.000Z',
    ...over,
  };
}

test('1 · signed on the phone, verified on the server with THAT phone’s public key — and no other; the key cannot leave', async () => {
  const verify = await verifier();
  const phone = await newPhoneKey();
  const other = await newPhoneKey();
  assert.ok(isPublicKeyJwk(phone.publicJwk), 'the registered half is not a bare EC P-256 public key');
  assert.equal(phone.privateKey.extractable, false, 'the phone’s private key can be copied off the phone');
  await assert.rejects(crypto.subtle.exportKey('jwk', phone.privateKey), 'the private key was exported');
  const f = await fields(phone.deviceId);
  const token = await signOfflineQr(f, phone.privateKey);
  assert.ok(token && OFFLINE_QR_TOKEN_RE.test(token), 'a valid QR could not be signed');
  const parsed = parseOfflineQrToken(token)!;
  assert.deepEqual(parsed.fields, f, 'the fields do not read back as signed');
  assert.equal(verify(parsed, phone.publicJwk), true);
  assert.equal(verify(parsed, other.publicJwk), false, 'another phone’s key verified the QR');
  assert.equal(verify(parsed, { ...phone.publicJwk, d: 'x' }), false, 'a key with a private part was accepted as a public key');
});

test('2 · every field is signed — an edited code, phone, shop, member, the deal, phone time or signature fails', async () => {
  const verify = await verifier();
  const phone = await newPhoneKey();
  const token = (await signOfflineQr(await fields(phone.deviceId), phone.privateKey))!;
  const parts = token.split('.');
  const hex = (n: number) => 'f'.repeat(n);
  const edits: Array<[string, (p: string[]) => void]> = [
    ['code', (p) => void (p[1] = hex(32))],
    ['phone', (p) => void (p[2] = 'A'.repeat(32))],
    ['shop', (p) => void (p[3] = hex(32))],
    ['member', (p) => void (p[4] = 'AAAAAAAAAA')],
    ['date', (p) => void (p[5] = '20261213')],
    ['time', (p) => void (p[6] = '1500')],
    ['schedule', (p) => void (p[7] = '-')],
    ['services', (p) => void (p[8] = '-')],
    ['total', (p) => void (p[9] = '1')],
    ['first payment', (p) => void (p[10] = '1')],
    ['phone time', (p) => void (p[12] = (parseInt(p[12]!, 36) + 60).toString(36))],
    ['signature', (p) => void (p[13] = `${p[13]!.slice(0, -2)}${p[13]!.endsWith('AA') ? 'BB' : 'AA'}`)],
  ];
  for (const [what, edit] of edits) {
    const copy = [...parts];
    edit(copy);
    const parsed = parseOfflineQrToken(copy.join('.'));
    assert.ok(parsed, `an edited ${what} no longer even parses — the test is not testing the signature`);
    assert.equal(verify(parsed, phone.publicJwk), false, `a QR with an edited ${what} still verified`);
  }
});

test('3 · the QR carries the made-offline mark and no personal data', async () => {
  const phone = await newPhoneKey();
  const token = (await signOfflineQr(await fields(phone.deviceId), phone.privateKey))!;
  assert.equal(token.split('.')[11], '1', 'the made-offline mark is missing');
  assert.ok(!token.includes(MEMBER) && !token.includes(MEMBER.replace(/-/g, '')), 'the member’s account id is in the QR');
  assert.doesNotMatch(token, /@|\s|%20/, 'something that reads like a name or a contact is in the QR');
  assert.equal(await signOfflineQr({ ...(await fields(phone.deviceId)), madeOffline: false as unknown as true }, phone.privateKey), null, 'a QR without the made-offline mark was signed');
  const url = offlineQrUrl('https://setnayan.com', 'luz-studio', token);
  assert.ok(url.startsWith('https://setnayan.com/'), 'the QR does not open setnayan.com');
  assert.match(url, new RegExp(`[?&]${OFFLINE_QR_PARAM}=`), 'the QR does not ride the invite door');
});

test('4 · one check for both arrivals, before the schedule; the invite asks it before the shop is added', () => {
  const claim = read('lib/supplier-offline/claim.server.ts');
  const check = claim.slice(claim.indexOf('export async function checkOfflineQr'), claim.indexOf('export type OfflineQrClaim'));
  assert.match(check, /parsed\.fields\.shop !== vendorProfileId/, 'a phone of another shop can sign for this shop');
  assert.match(check, /device\.vendor_profile_id !== vendorProfileId/, 'a phone registered on another shop is accepted');
  assert.match(check, /device\.status !== 'active'\) return \{ status: 'stopped' \}/, 'a stopped phone’s code is accepted');
  assert.match(check, /memberTagOf\(device\.member_user_id\)\) !== parsed\.fields\.member/, 'a code naming another member is accepted');
  assert.match(check, /verifyOfflineQrSignature\(parsed, device\.public_key\)/, 'the signature is not checked against the phone’s kept key');
  const body = claim.slice(claim.indexOf('export async function claimOfflineQr'));
  assert.ok(body.indexOf('checkOfflineQr(') > -1 && body.indexOf('checkOfflineQr(') < body.indexOf("rpc('supplier_offline_code_use'"), 'the claim writes the schedule before it checks the QR');

  const action = read('app/vendor-invite/[slug]/actions.ts');
  const ask = action.indexOf('claimOfflineQr(');
  const add = action.indexOf('importVendorToEventShortlist(admin');
  assert.ok(ask > -1 && add > -1 && ask < add, 'the invite adds the shop before the offline QR is checked');
  assert.match(action, /if \(claim\.status !== 'applied'\) backToInvite\(slug, `oc_\$\{claim\.status\}`, scopeWithoutQr\)/, 'a refused offline date is not said to the client');
  assert.ok(action.indexOf('if (!hostEvents.some') < ask, 'the QR is claimed before the event is proven to be the client’s');

  const engine = read('lib/supplier-offline/engine.server.ts');
  assert.match(engine, /checkOfflineQr\(ctx\.admin, f\('token'\), item\.shop\)/, 'the supplier’s own sync skips the QR check');
  assert.doesNotMatch(read('lib/supplier-offline/qr.ts'), /from 'node:crypto'/, 'node:crypto reached the module the phone loads');
  assert.match(read('lib/supplier-offline/qr.server.ts'), /from 'node:crypto'/, 'the server does not verify with node:crypto');
});
