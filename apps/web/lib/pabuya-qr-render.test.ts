import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { redrawQrPhPayload, PABUYA_QR_RENDER } from '@/lib/pabuya-qr-render';
import { decodeQrPayloadFromImage } from '@/lib/qr-decode';
import { isQrPhPayload, parseTlv } from '@/lib/emv-qr';
import { stripComments } from '@/lib/strip-comments';

/**
 * WE REDRAW THE COUPLE'S PAYMENT QR, AND WE PROVE IT SAYS THE SAME THING.
 *
 * A couple uploads what their banking app hands them — a screenshot wrapped in
 * the bank's logo, their name, a masked account number, sometimes photographed
 * off a second screen. Measured: a 1194×1565 JPEG whose actual code was about a
 * third of the frame, so the card's QR slot held ~25px of real modules.
 *
 * 🔑 THE ONLY THING THAT MAKES A REDRAW SAFE IS READING IT BACK. An image that
 * looks like a QR code is not evidence that it encodes the same instruction.
 * Every case below renders real pixels and decodes them through the SAME shared
 * decoder the upload check uses.
 */

/** A real GCash QR Ph payload — the fixture lib/emv-qr.test.ts uses. */
const GCASH =
  '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWIWRDY5204601653036085802PH5908Setnayan6011Holy Spirit6104123463045E2D';

/** A BDO QR Ph payload of the shape a couple actually uploads (static, no amount). */
const BDO =
  '00020101021127590012com.p2pqrpay0111BNORPHMMXXX02089996440304120065402839535204601653036085802PH5914Joint Casasola6011Makati City63048FA5';

let drawn = 0;

test('the fixtures are genuine QR Ph payloads', () => {
  assert.ok(isQrPhPayload(GCASH), 'GCASH fixture rejected — re-point this suite');
  assert.ok(isQrPhPayload(BDO), 'BDO fixture rejected — re-point this suite');
});

test('🔑 a redraw decodes back to the IDENTICAL payload', async () => {
  for (const payload of [GCASH, BDO]) {
    const out = await redrawQrPhPayload(payload);
    drawn++;
    assert.ok(out, 'a valid QR Ph payload was refused');
    assert.equal(out.payload, payload);
    const back = await decodeQrPayloadFromImage(out.png);
    assert.equal(
      back,
      payload,
      'the redrawn image does not say what the original said — this would fail in a guest’s wallet',
    );
  }
});

test('the redraw preserves every field a bank needs', async () => {
  const out = await redrawQrPhPayload(BDO);
  assert.ok(out);
  const before = new Map(parseTlv(BDO).map((f) => [f.id, f.value]));
  const after = new Map(parseTlv(out.payload).map((f) => [f.id, f.value]));
  for (const id of ['00', '01', '52', '53', '58', '59', '60', '63']) {
    assert.equal(after.get(id), before.get(id), `tag ${id} changed in the redraw`);
  }
  // Tag 27 carries the merchant template: the scheme, the BIC and the account.
  assert.equal(after.get('27'), before.get('27'), 'the merchant account template changed');
});

test('the redraw is big and full-bleed — that is the entire point', async () => {
  const sharp = (await import('sharp')).default;
  const out = await redrawQrPhPayload(BDO);
  assert.ok(out);
  const meta = await sharp(Buffer.from(out.png)).metadata();
  assert.equal(meta.width, PABUYA_QR_RENDER.width);
  assert.equal(meta.height, PABUYA_QR_RENDER.width, 'a QR must be square');
  /*
    ⚠ A FLOOR WITH A REASON. The uploaded screenshot that motivated this was
    1194px wide with the code occupying roughly a third of it. Anything at or
    below that is not an improvement worth destroying the original for.
  */
  assert.ok(
    (meta.width ?? 0) >= 1200,
    `redrawn at ${meta.width}px — no better than the screenshots this replaces`,
  );
});

test('⚠ error correction stays M — higher is WORSE here', () => {
  /*
    'H' adds modules, so at a fixed pixel width each module gets SMALLER, which
    is the opposite of the problem. Nothing is overlaid on this code that would
    need the redundancy — the invitation QR carries a monogram and is a
    different case (lib/qr-monogram-raster.ts).
  */
  assert.equal(PABUYA_QR_RENDER.errorCorrectionLevel, 'M');
});

test('⚠ true black on true white, not the brand palette', () => {
  // A scanner thresholds luminance. Cream + mulberry narrows that margin for a
  // code most guests see for four seconds on somebody else's phone.
  assert.equal(PABUYA_QR_RENDER.dark, '#000000');
  assert.equal(PABUYA_QR_RENDER.light, '#FFFFFF');
});

test('🔒 we redraw ONLY what we understand — anything else keeps the original', async () => {
  for (const payload of [
    'https://www.setnayan.com/cale-ice/pabuya', // a link QR
    'JUST SOME TEXT',
    '00020101021163041234', // EMV-shaped but not a valid QR Ph payload
    '',
    null,
    undefined,
  ]) {
    drawn++;
    assert.equal(
      await redrawQrPhPayload(payload as string | null | undefined),
      null,
      `${JSON.stringify(payload)} was redrawn — we would have replaced a code we do not understand`,
    );
  }
});

test('🔒 a payload with a broken CRC is refused', async () => {
  // Flip the last checksum digit. isQrPhPayload verifies CRC16, so this must
  // never be redrawn — re-encoding a corrupt instruction would launder it into
  // something that LOOKS freshly generated.
  const corrupt = `${BDO.slice(0, -1)}${BDO.endsWith('5') ? '6' : '5'}`;
  drawn++;
  assert.equal(await redrawQrPhPayload(corrupt), null);
});

// ── The call site ──────────────────────────────────────────────────────────

test('the save action redraws, and retires the couple’s raw upload', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/pabuya/actions.ts'), 'utf8'),
  );
  assert.match(src, /storeRedrawnPabuyaQr\(\{/, 'the save path never redraws');
  assert.match(
    src,
    /payload: inspection\.payload/,
    'the redraw is not fed the payload the check already decoded',
  );
  /*
    The redraw makes the couple's own upload a SECOND displaced object — a bank
    screenshot carrying their name and a masked account. Both write paths must
    retire it, or the redraw quietly doubles the number of payment images we
    hold instead of replacing one.
  */
  const retires = (src.match(/previousKey: rawUploadRef/g) ?? []).length;
  assert.equal(
    retires,
    2,
    `the raw upload is retired on ${retires} of the 2 write paths (insert + update)`,
  );
  // The original must survive a refused redraw.
  assert.match(
    src,
    /if \(redrawn\) \{/,
    'the redraw result is not checked — a refused redraw would blank the QR',
  );
});

test('the stored redraw lands in the same home as an upload', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'lib/pabuya-qr-store.server.ts'), 'utf8'),
  );
  // A fourth home for the same class of object would be refused by the serving
  // route's own policy check, and missed by the cleanup scope.
  assert.match(src, /pabuya-qr\/\$\{args\.eventId\}\//, 'the redraw is written outside the pabuya prefix');
  assert.match(src, /R2_BUCKETS\.threadFiles/, 'the redraw is not written to the private bucket');
  assert.ok(
    !src.includes('R2_BUCKETS.media'),
    'the redraw is written to the PUBLIC bucket — the whole point was to leave it',
  );
});

test('case count', () => {
  console.log(`      (${drawn} redraw decisions executed)`);
  /* ⚠ 9 IS THE MEASURED COUNT, not a guess. Written as 10 first and corrected
     after the run printed 9 — the fourth time today a floor was authored before
     the number existed. A floor above the real count fails honest code; a floor
     below it stops catching anything. Re-measure when cases are added. */
  assert.ok(drawn >= 9, `expected >= 9 executed redraw decisions, ran ${drawn}`);
});
