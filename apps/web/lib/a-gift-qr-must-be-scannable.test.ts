import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pabuyaQrVerdict, railExpectsQrPh, QR_PH_RAILS } from '@/lib/pabuya-qr-verdict';
import { decodeQrPayloadFromImage } from '@/lib/qr-decode';
import { isQrPhPayload } from '@/lib/emv-qr';
import { EGIFT_METHOD_KINDS, type EgiftMethodKind } from '@/lib/egift-kinds';

/**
 * A GIFT QR MUST BE SCANNABLE — or the couple must be told at upload, not at
 * the wedding.
 *
 * Measured on the owner's own event, 2026-09-16: a `bank` e-gift method whose
 * QR was `IMG_4424.jpg`, a phone photo. Nothing had ever checked that an
 * uploaded gift QR decodes, let alone that it is QR Ph. The owner found out by
 * scanning a code in GCash and being told it was invalid.
 *
 * 🔑 THIS SUITE EXECUTES THE REAL CHAIN. It generates actual QR images, decodes
 * them through the SAME shared decoder the server action uses, and asserts the
 * verdict — rather than grepping source for the word "isQrPhPayload", which
 * passes while the thing it names does nothing.
 */

/** A real decoded GCash receiving QR — the fixture lib/emv-qr.test.ts uses. */
const REAL_QR_PH =
  '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWIWRDY5204601653036085802PH5908Setnayan6011Holy Spirit6104123463045E2D';

async function qrPng(payload: string): Promise<Uint8Array> {
  const QR = (await import('qrcode')).default;
  return new Uint8Array(
    await QR.toBuffer(payload, { type: 'png', width: 800, margin: 4 }),
  );
}

// ── The fixture must really be QR Ph, or every test below proves nothing. ───

test('the fixture is a genuine QR Ph payload', () => {
  assert.ok(isQrPhPayload(REAL_QR_PH), 'fixture rejected — re-point this suite');
});

// ── The pure verdict, every rail × every outcome, executed. ────────────────

test('a real QR Ph code is accepted on every rail that expects one', () => {
  for (const kind of QR_PH_RAILS) {
    const v = pabuyaQrVerdict({ kind, decoded: REAL_QR_PH, decoderRan: true });
    assert.equal(v.ok, true, `${kind} rejected a valid QR Ph code`);
  }
});

test('a QR that is not QR Ph is refused on the payment rails', () => {
  for (const kind of QR_PH_RAILS) {
    const v = pabuyaQrVerdict({
      kind,
      decoded: 'https://www.setnayan.com/cale-ice/pabuya',
      decoderRan: true,
    });
    assert.equal(v.ok, false, `${kind} accepted a plain URL as a payment QR`);
  }
});

test('an image with no QR in it is refused on the payment rails', () => {
  for (const kind of QR_PH_RAILS) {
    const v = pabuyaQrVerdict({ kind, decoded: null, decoderRan: true });
    assert.equal(v.ok, false, `${kind} accepted an image with no QR`);
  }
});

test('🔑 the two refusals say DIFFERENT things — the couple must know which fault it is', () => {
  const noQr = pabuyaQrVerdict({ kind: 'bank', decoded: null, decoderRan: true });
  const notPh = pabuyaQrVerdict({
    kind: 'bank',
    decoded: 'https://example.com',
    decoderRan: true,
  });
  assert.equal(noQr.ok, false);
  assert.equal(notPh.ok, false);
  if (noQr.ok || notPh.ok) return;
  assert.notEqual(
    noQr.error,
    notPh.error,
    '"no QR here" and "wrong kind of QR" need different fixes and must read differently',
  );
  // Each must be actionable, not a bare "invalid".
  for (const m of [noQr.error, notPh.error]) {
    assert.ok(m.length > 60, `too terse to act on: ${m}`);
  }
});

test('⚠ a decoder that never ran must NOT blame the couple (fail-open)', () => {
  for (const kind of QR_PH_RAILS) {
    const v = pabuyaQrVerdict({ kind, decoded: null, decoderRan: false });
    assert.equal(
      v.ok,
      true,
      `${kind} turned OUR outage into "your QR is broken" — the couple cannot act on that`,
    );
  }
});

test('⚖ paypal and other are not held to QR Ph — a URL QR is correct there', () => {
  const notHeld = EGIFT_METHOD_KINDS.filter((k) => !railExpectsQrPh(k));
  assert.deepEqual([...notHeld].sort(), ['other', 'paypal']);
  for (const kind of notHeld) {
    for (const decoded of [null, 'https://paypal.me/someone', REAL_QR_PH]) {
      const v = pabuyaQrVerdict({ kind, decoded, decoderRan: true });
      assert.equal(v.ok, true, `${kind} was held to QR Ph with decoded=${decoded}`);
    }
  }
});

test('every declared rail is classified — a new kind cannot slip through unconsidered', () => {
  for (const kind of EGIFT_METHOD_KINDS as readonly EgiftMethodKind[]) {
    assert.equal(
      typeof railExpectsQrPh(kind),
      'boolean',
      `${kind} has no classification`,
    );
  }
  assert.equal(
    QR_PH_RAILS.length + EGIFT_METHOD_KINDS.filter((k) => !railExpectsQrPh(k)).length,
    EGIFT_METHOD_KINDS.length,
    'the two sets do not partition the rails',
  );
});

// ── End to end: real pixels through the real decoder. ──────────────────────

test('END TO END: a rendered QR Ph image decodes and passes', async () => {
  const png = await qrPng(REAL_QR_PH);
  const decoded = await decodeQrPayloadFromImage(png);
  assert.equal(decoded, REAL_QR_PH, 'the shared decoder could not read a clean QR Ph image');
  assert.equal(pabuyaQrVerdict({ kind: 'bank', decoded, decoderRan: true }).ok, true);
});

test('END TO END: a link QR image decodes and is REFUSED — the owner’s real case', async () => {
  // This is precisely the image handed over on 2026-09-16 and scanned in
  // GCash, which called it invalid. The upload must now say so first.
  const url = 'https://www.setnayan.com/cale-ice/pabuya';
  const decoded = await decodeQrPayloadFromImage(await qrPng(url));
  assert.equal(decoded, url);
  assert.equal(
    pabuyaQrVerdict({ kind: 'bank', decoded, decoderRan: true }).ok,
    false,
    'a link QR was accepted as a bank payment QR',
  );
});

// ── The call site: asked at upload, and only on a CHANGED image. ───────────

test('the save action checks a newly attached QR, and only a changed one', () => {
  const src = readFileSync(
    join(
      process.cwd(),
      'app/dashboard/[eventId]/pabuya/actions.ts',
    ),
    'utf8',
  );
  assert.ok(
    src.includes('checkPabuyaQrImage'),
    'saveEgiftMethod never asks whether the QR is scannable',
  );
  // The guard must be conditional on the ref having CHANGED — checking every
  // save would trap an existing bad row, so the couple could not even fix the
  // account number on it.
  assert.match(
    src,
    /if \(qrR2Key !== previousRef\) \{[\s\S]{0,300}?checkPabuyaQrImage/,
    'the check is not gated on the ref changing — an existing bad row becomes uneditable',
  );
  // And a refusal must actually stop the write.
  assert.match(
    src,
    /if \(!verdict\.ok\) return verdict;/,
    'the verdict is computed but not enforced',
  );
});

test('the decoder is SHARED, not re-implemented for this surface', () => {
  const src = readFileSync(join(process.cwd(), 'lib/pabuya-qr-check.server.ts'), 'utf8');
  assert.ok(src.includes("from '@/lib/qr-decode'"), 'a third decoder copy appeared');
  assert.ok(
    !/require\(['"]jsqr|from ['"]jsqr/.test(src),
    'this surface reaches jsqr directly instead of through the shared decoder',
  );
});
