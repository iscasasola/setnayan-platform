/**
 * THE APPLE WALLET PASS IS THE TICKET — owner ruling 2026-10-13 ("YES TO APPLE
 * WALLET + GOOGLE WALLET PASSES FOR GUESTS"; Google deferred), plan
 * controller-2026-10-12/WALLET_PASS_PLAN_2026-10-13.md.
 *
 * EXECUTED, not read: the gate over every guest state, the code's string
 * decoded back to the guest's token by the door desk's own parser, the venue
 * address sabotage, the Manila lock-screen instant, the colour fallbacks — and
 * a REAL `.pkpass` built, unzipped, every manifest hash re-computed and its
 * PKCS#7 signature verified against the certificate.
 *
 * 🔒 The certificates here are THROWAWAY, minted in memory by this test (a fake
 * "WWDR" CA and a leaf it signs). No Apple certificate, key or passphrase is in
 * the repo, and none is read by any test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createVerify, generateKeyPairSync } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import forge from 'node-forge';
import { parseGuestQrPayload } from './checkin';
import { buildInvitationUrl } from './qr';
import { PASS_CARD_REFUSED, type PassCardRow } from './pass-card';
import {
  appleWalletDevice,
  applePassJson,
  contrastRatio,
  decideWalletPassAccess,
  passCardQrUrl,
  walletColors,
  walletPassContent,
  walletRelevantDate,
  walletSerial,
  type WalletPassFacts,
} from './wallet-pass';
import { WalletSigningError, buildPkpass, pemFromEnvValue, pkpassManifest } from './wallet-pass-pkpass';

const GUEST = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const TOKEN = '0123456789abcdef0123456789abcdef';

function facts(over: Partial<WalletPassFacts> = {}): WalletPassFacts {
  return {
    guestId: GUEST,
    qrToken: TOKEN,
    guestName: 'Maria Santos',
    party: 1,
    table: null,
    seatNumber: null,
    couple: 'Indalecio & Claire',
    eyebrow: 'The wedding of',
    eventWord: 'Wedding',
    eventDate: '2026-12-18',
    arriveLabel: '3:00 PM',
    arriveAt: '2026-12-18T15:00:00Z',
    venue: 'The Glass Garden',
    venueAddress: '123 Real Street, Pasig City',
    appUrl: 'https://setnayan.com',
    slug: 'indalecio-claire',
    ownerSlug: null,
    look: { paper: '#FFFFFF', ink: '#1A1A1A', accent: '#8A5A2B' },
    ...over,
  };
}

// ─── The gate ────────────────────────────────────────────────────────────────

const row = (over: Partial<PassCardRow> = {}): PassCardRow => ({
  guest_id: GUEST,
  event_id: EVENT,
  rsvp_status: 'accepted',
  qr_token: TOKEN,
  ...over,
});
const own = { guest_id: GUEST, event_id: EVENT };

test('the gate: a guest adds THEIR OWN ticket, and every other case is the one 404', () => {
  assert.deepEqual(decideWalletPassAccess({ session: own, target: row(), bringer: null, readFailed: false }), { allow: true, as: 'guest' });
  const refused = { allow: false, status: 404, message: PASS_CARD_REFUSED };
  // can't come · removed · passed away · no code · a pending request (no real ticket yet)
  for (const t of [row({ rsvp_status: 'declined' }), row({ deleted_at: 'x' }), row({ passed_away: true }), row({ qr_token: null }), row({ entry_source: 'self_added_unlisted' })]) {
    assert.deepEqual(decideWalletPassAccess({ session: own, target: t, bringer: null, readFailed: false }), refused, JSON.stringify(t));
  }
  // another guest's seat, another event's session
  assert.deepEqual(decideWalletPassAccess({ session: { guest_id: 'other', event_id: EVENT }, target: row(), bringer: null, readFailed: false }), refused);
  assert.deepEqual(decideWalletPassAccess({ session: { guest_id: GUEST, event_id: 'other' }, target: row(), bringer: null, readFailed: false }), refused);
  // a plus-one this session BROUGHT — the PNG allows it, Wallet does not (plan Q3)
  const plusOne = row({ guest_id: 'p1', plus_one_of_guest_id: GUEST });
  assert.deepEqual(decideWalletPassAccess({ session: own, target: plusOne, bringer: row(), readFailed: false }), refused);
  // no session at all, a failed read
  assert.equal(decideWalletPassAccess({ session: null, target: row(), bringer: null, readFailed: false }).allow, false);
  assert.equal(decideWalletPassAccess({ session: own, target: row(), bringer: null, readFailed: true }).allow, false);
});

// ─── The code ───────────────────────────────────────────────────────────────

test('the code on the pass is the PNG code: the door desk reads the guest’s own token back', () => {
  for (const ownerSlug of [null, 'ice']) {
    const f = facts({ ownerSlug });
    const c = walletPassContent(f);
    assert.equal(c.qrMessage, buildInvitationUrl({ appUrl: f.appUrl, slug: f.slug, qrToken: TOKEN, ownerSlug }));
    assert.equal(c.qrMessage, passCardQrUrl(f));
    assert.equal(parseGuestQrPayload(c.qrMessage), TOKEN);
  }
  const json = applePassJson(walletPassContent(facts()), { passTypeIdentifier: 'pass.test', teamIdentifier: 'TEAM' });
  const barcodes = json.barcodes as Array<Record<string, unknown>>;
  assert.equal(barcodes.length, 1);
  assert.equal(barcodes[0]!.format, 'PKBarcodeFormatQR');
  assert.equal(barcodes[0]!.altText, undefined, 'the code is a sign-in credential — never printed as text');
  assert.equal(json.sharingProhibited, true);
  // the credential appears ONCE (the code) — never on the back, never as the public address
  assert.equal(JSON.stringify(json).split(TOKEN).length - 1, 1);
});

test('the serial is stable per guest and never carries the code', () => {
  assert.equal(walletSerial(GUEST), walletSerial(GUEST));
  assert.notEqual(walletSerial(GUEST), walletSerial('another'));
  assert.equal(walletPassContent(facts({ qrToken: 'rotated' })).serialNumber, walletPassContent(facts()).serialNumber);
  assert.ok(!walletSerial(GUEST).includes(TOKEN));
});

// ─── Privacy ────────────────────────────────────────────────────────────────

test('🏠 SABOTAGE: the street address never reaches the pass, even typed into the venue box', () => {
  const addr = '123 Real Street, Pasig City';
  for (const venue of ['The Glass Garden', addr, `${addr} (Glass Garden)`]) {
    const json = JSON.stringify(applePassJson(walletPassContent(facts({ venue, venueAddress: addr })), { passTypeIdentifier: 'p', teamIdentifier: 't' }));
    assert.ok(!json.includes('Real Street'), `the address leaked with venue=${venue}`);
    assert.ok(!json.includes('"locations"'), 'no coordinates either');
    assert.ok(!json.includes('expirationDate'), 'a keepsake — no expiry');
  }
  const named = walletPassContent(facts());
  assert.ok(named.auxiliary.some((f) => f.key === 'venue' && f.value === 'The Glass Garden'));
});

// ─── The table and the time ─────────────────────────────────────────────────

test('the table rides the kit: absent before the day (the back says when), present on the day', () => {
  const before = walletPassContent(facts({ table: null }));
  assert.ok(!before.auxiliary.some((f) => f.key === 'table'));
  assert.ok(before.back.some((f) => f.key === 'table-later'));
  const onTheDay = walletPassContent(facts({ table: 'Table 7', seatNumber: '3' }));
  assert.deepEqual(onTheDay.auxiliary.find((f) => f.key === 'table')?.value, '7');
  assert.deepEqual(onTheDay.auxiliary.find((f) => f.key === 'seat')?.value, '3');
  assert.ok(!onTheDay.back.some((f) => f.key === 'table-later'));
});

test('🕗 the lock-screen time is the parked-UTC wall clock read as Manila — never shifted 8 hours', () => {
  assert.equal(walletRelevantDate('2026-12-18', '2026-12-18T15:00:00Z'), '2026-12-18T15:00:00+08:00');
  assert.equal(walletRelevantDate('2026-12-18', '2026-12-18T09:30:00.000Z'), '2026-12-18T09:30:00+08:00');
  assert.equal(walletRelevantDate('2026-12-18', null), '2026-12-18T09:00:00+08:00');
  assert.equal(walletRelevantDate(null, '2026-12-18T15:00:00Z'), null);
});

// ─── Colours ────────────────────────────────────────────────────────────────

test('colours: the couple’s look, the label falling back to ink, the pass to Classic', () => {
  assert.deepEqual(walletColors({ paper: '#FFFFFF', ink: '#1A1A1A', accent: '#8A5A2B' }), {
    background: 'rgb(255, 255, 255)',
    foreground: 'rgb(26, 26, 26)',
    label: 'rgb(138, 90, 43)',
  });
  // a pale accent on white → labels in ink
  assert.equal(walletColors({ paper: '#FFFFFF', ink: '#1A1A1A', accent: '#F0F0F0' }).label, 'rgb(26, 26, 26)');
  // unreadable ink, or a colour that is not hex → Classic, which reads
  for (const look of [{ paper: '#FFFFFF', ink: '#FAFAFA', accent: '#000000' }, { paper: 'transparent', ink: 'red', accent: 'blue' }]) {
    const c = walletColors(look);
    const hex = (rgb: string) => '#' + rgb.match(/\d+/g)!.map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    assert.ok((contrastRatio(hex(c.foreground), hex(c.background)) ?? 0) >= 4.5, JSON.stringify(c));
  }
});

test('who is offered the button: Apple devices and Mac Safari only', () => {
  assert.equal(appleWalletDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'), true);
  assert.equal(appleWalletDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'), true);
  assert.equal(appleWalletDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'), false);
  assert.equal(appleWalletDevice('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'), false);
  assert.equal(appleWalletDevice(null), false);
});

// ─── The real file ──────────────────────────────────────────────────────────

/** A throwaway CA ("WWDR") and a leaf it signs — in memory, never on disk. */
function throwawaySigner(passphrase: string) {
  const mk = () => generateKeyPairSync('rsa', { modulusLength: 2048 });
  const ca = mk();
  const leaf = mk();
  const caKey = forge.pki.privateKeyFromPem(ca.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString());
  const cert = (pub: string, subject: string, serial: string) => {
    const c = forge.pki.createCertificate();
    c.publicKey = forge.pki.publicKeyFromPem(pub);
    c.serialNumber = serial;
    c.validity.notBefore = new Date('2026-01-01');
    c.validity.notAfter = new Date('2027-01-01');
    c.setSubject([{ name: 'commonName', value: subject }]);
    c.setIssuer([{ name: 'commonName', value: 'Throwaway WWDR' }]);
    c.sign(caKey, forge.md.sha256.create());
    return forge.pki.certificateToPem(c);
  };
  return {
    signer: {
      certPem: 'Bag Attributes\n    friendlyName: test\n' + cert(leaf.publicKey.export({ type: 'spki', format: 'pem' }).toString(), 'Pass Type ID: pass.test', '02'),
      keyPem: 'Key Attributes: <No Attributes>\n' + leaf.privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase }).toString(),
      keyPassphrase: passphrase,
      wwdrPem: cert(ca.publicKey.export({ type: 'spki', format: 'pem' }).toString(), 'Throwaway WWDR', '01'),
    },
    leafPublic: leaf.publicKey,
  };
}

/** A minimal zip reader (central directory → stored / deflated entries). */
function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, 'not a zip');
  let p = buf.readUInt32LE(eocd + 16);
  const n = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30);
    const comment = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const data = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(data, data + size);
    out.set(name, method === 8 ? inflateRawSync(raw) : Buffer.from(raw));
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test('📦 a real .pkpass: every manifest hash matches its file, and the signature verifies against the certificate', async () => {
  const { signer, leafPublic } = throwawaySigner('throwaway-test-passphrase');
  const passJson = applePassJson(walletPassContent(facts()), { passTypeIdentifier: 'pass.test', teamIdentifier: 'TEAMID1234' });
  const pkpass = await buildPkpass(passJson, { 'icon.png': PNG_1PX, 'icon@2x.png': PNG_1PX, 'logo.png': PNG_1PX }, signer, new Date('2026-10-15T00:00:00Z'));
  const files = unzip(pkpass);
  assert.deepEqual([...files.keys()].sort(), ['icon.png', 'icon@2x.png', 'logo.png', 'manifest.json', 'pass.json', 'signature']);
  assert.deepEqual(JSON.parse(files.get('pass.json')!.toString('utf8')), passJson);

  const manifest = JSON.parse(files.get('manifest.json')!.toString('utf8')) as Record<string, string>;
  assert.deepEqual(Object.keys(manifest).sort(), ['icon.png', 'icon@2x.png', 'logo.png', 'pass.json']);
  for (const [name, sha1] of Object.entries(manifest)) {
    assert.equal(createHash('sha1').update(files.get(name)!).digest('hex'), sha1, name);
  }

  // The signature: a DETACHED SignedData whose signed attributes carry the
  // manifest's SHA-256, signed by the leaf, carrying the leaf AND the "WWDR".
  const msg = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(files.get('signature')!.toString('binary'))) as forge.pkcs7.PkcsSignedData & {
    rawCapture: { authenticatedAttributes: forge.asn1.Asn1[]; signature: string; content?: unknown };
  };
  assert.equal(msg.certificates.length, 2, 'the pass certificate and the WWDR intermediate');
  assert.ok(!msg.rawCapture.content, 'detached — the manifest is not inside the signature');
  const attrs = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, msg.rawCapture.authenticatedAttributes);
  const signedBytes = Buffer.from(forge.asn1.toDer(attrs).getBytes(), 'binary');
  const verify = createVerify('sha256');
  verify.update(signedBytes);
  assert.ok(verify.verify(leafPublic, Buffer.from(msg.rawCapture.signature, 'binary')), 'the signature does not verify');
  const digest = createHash('sha256').update(files.get('manifest.json')!).digest('binary');
  assert.ok(signedBytes.toString('binary').includes(digest), 'the signed attributes do not carry the manifest digest');
});

test('🔒 a failure names the step, never a value: a wrong passphrase, a missing block, no icon', async () => {
  const { signer } = throwawaySigner('right-passphrase');
  const json = applePassJson(walletPassContent(facts()), { passTypeIdentifier: 'p', teamIdentifier: 't' });
  const err = await buildPkpass(json, { 'icon.png': PNG_1PX }, { ...signer, keyPassphrase: 'wrong' }).catch((e: unknown) => e);
  assert.ok(err instanceof WalletSigningError);
  assert.equal(err.message, 'wallet-pass: could not read the key');
  assert.ok(!err.message.includes('wrong') && !err.message.includes('BEGIN'));
  const noCert = await buildPkpass(json, { 'icon.png': PNG_1PX }, { ...signer, certPem: 'nothing here' }).catch((e: unknown) => e);
  assert.equal((noCert as Error).message, 'wallet-pass: could not read the certificate');
  const noIcon = await buildPkpass(json, {}, signer).catch((e: unknown) => e);
  assert.ok(noIcon instanceof WalletSigningError);
});

test('env values: base64 of the PEM file, or the PEM itself; anything else is absent', () => {
  const pem = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n';
  assert.equal(pemFromEnvValue(Buffer.from(pem).toString('base64')), pem);
  assert.equal(pemFromEnvValue(pem), pem.trim());
  assert.equal(pemFromEnvValue('bm90IGEgcGVt'), null);
  assert.equal(pemFromEnvValue(''), null);
  assert.equal(pemFromEnvValue(undefined), null);
  assert.deepEqual(Object.keys(pkpassManifest({ 'b.png': PNG_1PX, 'a.json': PNG_1PX })), ['a.json', 'b.png']);
});
