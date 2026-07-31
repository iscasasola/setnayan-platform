/**
 * Unit suite for the QR Ph per-order minter (2026-07-31).
 *
 * The fixtures are the REAL decoded payloads from Setnayan's own uploaded
 * GCash and BDO receiving QRs — the same strings the owner scanned live when
 * establishing the wallet rules encoded in lib/emv-qr.ts. Keeping them here
 * means a regression that would break a live checkout fails in CI first.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc16, parseTlv, verifyCrc, isQrPhPayload, mintOrderQr } from './emv-qr';

const GCASH =
  '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWIWRDY5204601653036085802PH5908Setnayan6011Holy Spirit6104123463045E2D';
const BDO =
  '00020101021127590012com.p2pqrpay0111BNORPHMMXXX02089996440304120065400279655204601653036085802PH5903BDO6011Makati City6304EA14';

test('crc16 matches the canonical CRC-16/CCITT-FALSE check value', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('both real merchant QRs pass their own CRC', () => {
  assert.ok(verifyCrc(GCASH).ok, 'GCash payload CRC');
  assert.ok(verifyCrc(BDO).ok, 'BDO payload CRC');
});

test('both real merchant QRs are recognised as re-mintable QR Ph', () => {
  assert.ok(isQrPhPayload(GCASH));
  assert.ok(isQrPhPayload(BDO));
});

test('minted QR sets dynamic + amount and preserves the account', () => {
  const minted = mintOrderQr(GCASH, 2999);
  assert.ok(minted, 'expected a payload');
  const f = new Map(parseTlv(minted!).map((x) => [x.id, x.value]));
  assert.equal(f.get('01'), '12', 'must declare dynamic — GCash rejects an amount on static');
  assert.equal(f.get('54'), '2999.00');
  assert.ok(minted!.includes('GXCHPHM2XXX'), 'institution preserved');
  assert.ok(minted!.includes('DWQM4TK3JDNWIWRDY'), 'account identifier preserved');
  assert.ok(verifyCrc(minted!).ok, 'recomputed CRC valid');
});

test('centavos survive minting — the whole matching key depends on it', () => {
  const f = new Map(parseTlv(mintOrderQr(GCASH, 2999.43)!).map((x) => [x.id, x.value]));
  assert.equal(f.get('54'), '2999.43');
});

test('tag 62 is NEVER emitted — GCash rejects the template outright', () => {
  for (const src of [GCASH, BDO]) {
    const fields = parseTlv(mintOrderQr(src, 1500)!);
    assert.ok(!fields.some((x) => x.id === '62'), 'tag 62 must be absent');
  }
});

test('BDO mints the same shape as GCash', () => {
  const f = new Map(parseTlv(mintOrderQr(BDO, 1.43)!).map((x) => [x.id, x.value]));
  assert.equal(f.get('01'), '12');
  assert.equal(f.get('54'), '1.43');
  assert.ok(mintOrderQr(BDO, 1.43)!.includes('006540027965'), 'BDO account preserved');
});

test('fails soft — returns null instead of a broken code', () => {
  assert.equal(mintOrderQr(null, 100), null, 'null source');
  assert.equal(mintOrderQr('', 100), null, 'empty source');
  assert.equal(mintOrderQr('not a qr at all', 100), null, 'garbage source');
  assert.equal(mintOrderQr(GCASH.slice(0, -1) + 'X', 100), null, 'bad CRC');
  assert.equal(mintOrderQr(GCASH, 0), null, 'zero amount');
  assert.equal(mintOrderQr(GCASH, -5), null, 'negative amount');
  assert.equal(mintOrderQr(GCASH, Number.NaN), null, 'NaN amount');
  assert.equal(mintOrderQr(GCASH, 1e12), null, 'absurd amount');
});

test('refuses a non-PHP code — never mint an amount onto foreign currency', () => {
  const usd = (() => {
    const body = parseTlv(GCASH)
      .filter((x) => x.id !== '63')
      .map((x) => (x.id === '53' ? { id: '53', value: '840' } : x))
      .map((x) => x.id + String(new TextEncoder().encode(x.value).length).padStart(2, '0') + x.value)
      .join('') + '6304';
    return body + crc16(body);
  })();
  assert.ok(verifyCrc(usd).ok, 'fixture itself is well-formed');
  assert.equal(isQrPhPayload(usd), false);
  assert.equal(mintOrderQr(usd, 100), null);
});

test('byte-accurate lengths — a ñ in the merchant name must not desync', () => {
  const body =
    '000201010211' +
    '2845' + '0011ph.ppmi.p2m' + '0112ACCT12345678' + '0210GXCHANGEPH' +
    '5303608' + '5802PH' + '5913JUAN PEÑA JR' + '6006MANILA' + '6304';
  const src = body + crc16(body);
  assert.ok(isQrPhPayload(src), 'ñ payload should parse');
  const minted = mintOrderQr(src, 999);
  assert.ok(minted?.includes('JUAN PEÑA JR'), 'name preserved');
  assert.ok(verifyCrc(minted!).ok, 'CRC over UTF-8 bytes');
});
