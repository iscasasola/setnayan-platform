/**
 * A CODE WE GENERATE PAYS THE SAME ACCOUNT AS THE ONE WE STARTED FROM.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🚨 THE WORST OUTCOME IN THIS WHOLE AREA IS NOT A BROKEN QR. A malformed
 * payload is refused by the wallet and somebody complains; a wrong amount is
 * caught by the payer reading the screen. A payload whose merchant identifier
 * drifted by one byte **scans perfectly, pre-fills the right figure, and sends
 * the money to somebody else.** Nothing downstream can notice — not the payer,
 * not the admin reconciling, not Sentry.
 *
 * 🔑 SO THIS SUITE ASKS THE ARTEFACT, NOT THE INTENT. It renders a real PNG
 * with the same renderer and settings the product uses, decodes it back with
 * the repo's own detector (`lib/qr-decode.ts` — sharp + jsQR, the same one
 * that reads a supplier's upload), and asserts on what came out of the image:
 *
 *   · the payload survives the round trip byte for byte;
 *   · tag 54 is the charge to the centavo;
 *   · tag 01 is '12' — without it GCash REJECTS the amount outright;
 *   · the CRC checks out;
 *   · every merchant-identifying tag is BYTE-IDENTICAL to the source.
 *
 * ⚠ AND IT PROVES THE REFUSAL, not only the success. A tampered source is fed
 * in and `mintOrderQr` must return null rather than a code that pays it — a
 * suite that only ever mints valid things cannot tell a guard from a wish.
 *
 * ⛔ NONE OF THIS SAYS A REAL WALLET ACCEPTS THE CODE. That was established by
 * the owner scanning real money on 2026-07-31 (see lib/emv-qr.ts) and must be
 * re-established for any new rail. A test cannot open GCash.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { decodeQrPayloadFromImage } from './qr-decode';
import {
  buildTlv,
  crc16,
  isQrPhPayload,
  mintOrderQr,
  parseTlv,
  verifyCrc,
  verifyMintedAgainstSource,
} from './emv-qr';

/** Setnayan's real GCash receiving payload (platform_settings, prod). */
const GCASH =
  '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWIWRDY5204601653036085802PH5908Setnayan6011Holy Spirit6104123463045E2D';
/** Setnayan's real BDO receiving payload (platform_settings, prod). */
const BDO =
  '00020101021127590012com.p2pqrpay0111BNORPHMMXXX02089996440304120065400279655204601653036085802PH5903BDO6011Makati City6304EA14';

/** The exact settings the product renders with — `lib/qr-image.server.ts`. */
const RENDER = { margin: 1, width: 520, errorCorrectionLevel: 'M' as const };

const tags = (payload: string) => new Map(parseTlv(payload).map((f) => [f.id, f.value]));

async function throughAnImage(payload: string): Promise<string> {
  const png = await QRCode.toBuffer(payload, { ...RENDER, type: 'png' });
  const back = await decodeQrPayloadFromImage(new Uint8Array(png));
  assert.ok(back, 'the code we drew could not be read back at all');
  return back;
}

test('the renderer and the detector agree — a control, before anything is claimed', async () => {
  // ⚠ A ZERO FROM A HARNESS IS NOT EVIDENCE. If the decoder silently failed,
  // every assertion below would be vacuous, so the harness is proven on a
  // trivial payload first.
  assert.equal(await throughAnImage('SETNAYAN-HARNESS-CHECK'), 'SETNAYAN-HARNESS-CHECK');
});

for (const [name, source] of [['GCash', GCASH], ['BDO', BDO]] as const) {
  test(`${name}: a minted code survives being drawn and read back`, async () => {
    // The owner's own charge, to the centavo.
    const minted = mintOrderQr(source, 837.5);
    assert.ok(minted, `${name} would not mint`);
    const back = await throughAnImage(minted);
    assert.equal(back, minted, `${name} did not survive the round trip byte for byte`);

    const out = tags(back);
    assert.equal(out.get('54'), '837.50', `${name} carries the wrong amount`);
    assert.equal(out.get('01'), '12', `${name} is not marked dynamic, so a wallet will refuse it`);
    assert.equal(verifyCrc(back).ok, true, `${name}'s CRC does not check out after the round trip`);

    // The bytes that decide WHOSE account this is.
    const src = tags(source);
    for (const id of ['52', '53', '58', '59', '60', '61']) {
      if (!src.has(id)) continue;
      assert.equal(out.get(id), src.get(id), `${name} tag ${id} changed`);
    }
    for (const [id, value] of src) {
      if (Number(id) < 26 || Number(id) > 51) continue;
      assert.equal(
        out.get(id),
        value,
        `${name} merchant account template ${id} changed — this code pays a DIFFERENT account`,
      );
    }
  });
}

test('centavos survive — the figure is not rounded anywhere on the way', async () => {
  for (const php of [49.05, 837.5, 2500.99, 1.01, 0.5]) {
    const minted = mintOrderQr(GCASH, php);
    assert.ok(minted, `${php} would not mint`);
    const back = await throughAnImage(minted);
    assert.equal(tags(back).get('54'), php.toFixed(2), `${php} lost its centavos`);
  }
});

test('the verifier catches a merchant identifier that moved', () => {
  const minted = mintOrderQr(GCASH, 837.5);
  assert.ok(minted);
  assert.equal(verifyMintedAgainstSource(GCASH, minted, 837.5).ok, true);

  // Same code, one byte of the merchant account template different — the
  // failure that scans perfectly and pays the wrong person.
  const fields = parseTlv(minted).filter((f) => f.id !== '63');
  const acct = fields.find((f) => Number(f.id) >= 26 && Number(f.id) <= 51);
  assert.ok(acct, 'the fixture has no merchant account template to tamper with');
  acct.value = acct.value.slice(0, -1) + (acct.value.endsWith('Y') ? 'Z' : 'Y');
  const body = buildTlv(fields) + '6304';
  const tampered = body + crc16(body);
  assert.equal(verifyCrc(tampered).ok, true, 'the tampered fixture is merely malformed, which proves nothing');

  const check = verifyMintedAgainstSource(GCASH, tampered, 837.5);
  assert.equal(check.ok, false, 'a code paying a different account verified clean');
  assert.match(check.problems.join(' '), /changed/);
});

test('the verifier catches an amount that does not match the charge', () => {
  const minted = mintOrderQr(GCASH, 837.5);
  assert.ok(minted);
  const check = verifyMintedAgainstSource(GCASH, minted, 837.51);
  assert.equal(check.ok, false, 'a one-centavo mismatch verified clean');
  assert.match(check.problems.join(' '), /amount is 837\.50, not 837\.51/);
});

test('the verifier catches a code that forgot it is dynamic', () => {
  // Built by hand: an amount on a STATIC payload. Real GCash rejects this, so
  // it must never leave the mint.
  const fields = parseTlv(GCASH).filter((f) => f.id !== '63');
  const at = fields.findIndex((f) => Number(f.id) > 54);
  fields.splice(at, 0, { id: '54', value: '837.50' });
  const body = buildTlv(fields) + '6304';
  const staticWithAmount = body + crc16(body);
  assert.equal(tags(staticWithAmount).get('01'), '11');

  const check = verifyMintedAgainstSource(GCASH, staticWithAmount, 837.5);
  assert.equal(check.ok, false);
  assert.match(check.problems.join(' '), /point-of-initiation is 11/);
});

test('mintOrderQr itself refuses what the verifier refuses', () => {
  /**
   * 🪤 THE FIRST VERSION OF THIS TEST PROVED NOTHING — measured. It fed in a
   * payload with no currency tag, which `isQrPhPayload` already refuses at the
   * door, so deleting the verifier call from `mintOrderQr` left the whole
   * suite GREEN. The case has to be one the OLD checks let through and only
   * the verifier stops.
   *
   * A duplicated identity tag is exactly that: `isQrPhPayload` is satisfied
   * (format indicator, PHP, a merchant template), the CRC self-check passes,
   * and the minted code is well-formed — but it names the merchant twice, with
   * two different names, and we do not know which one a wallet will show the
   * payer. Anything we do not fully understand is refused.
   */
  const twoNames = (() => {
    const fields = parseTlv(GCASH).filter((f) => f.id !== '63');
    const at = fields.findIndex((f) => f.id === '59');
    assert.notEqual(at, -1, 'the fixture has no merchant name to duplicate');
    fields.splice(at + 1, 0, { id: '59', value: 'Not Setnayan' });
    const body = buildTlv(fields) + '6304';
    return body + crc16(body);
  })();
  // The door the verifier is BEHIND — proven open, so the refusal below can
  // only be the verifier's.
  assert.equal(isQrPhPayload(twoNames), true, 'the fixture never reached the verifier');
  assert.equal(verifyCrc(twoNames).ok, true);
  assert.equal(
    mintOrderQr(twoNames, 837.5),
    null,
    'minted a code whose merchant is named twice, differently',
  );
});

test('the payment page draws the code on the server', () => {
  // ⛔ The browser path is what put a ₱0 code on screen. The assertion is on
  // the SOURCE because no unit test can observe a first paint.
  const panel = readFileSync(
    join(process.cwd(), 'app', 'pay', '[reference]', '_components', 'pay-panel.tsx'),
    'utf8',
  );
  assert.doesNotMatch(
    stripComments(panel),
    /import\(\s*'qrcode'\s*\)/,
    'the payment panel renders the QR in the browser again — the static code will hold the screen',
  );
  const page = stripComments(
    readFileSync(join(process.cwd(), 'app', 'pay', '[reference]', 'page.tsx'), 'utf8'),
  );
  assert.match(page, /mintedQrImage\(/, 'the payment page no longer mints its code on the server');
});
