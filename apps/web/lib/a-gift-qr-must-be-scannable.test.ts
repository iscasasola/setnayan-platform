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
 * Nothing had ever checked that an uploaded gift QR decodes, let alone that it
 * is QR Ph — so an unusable upload would first be discovered by a guest at the
 * reception.
 *
 * ⚠ CORRECTED 2026-09-17. This said the owner "found out by scanning a code in
 * GCash and being told it was invalid", implying his own upload was broken. It
 * was not: `IMG_4424.jpg` decodes to a valid QR Ph payload (CRC ok, currency
 * 608, BDO's `BNORPHMMXXX`, static). What GCash rejected was a LINK QR
 * generated for him by mistake. The gap this suite covers is real; the incident
 * it cited was a different one.
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

// ── And it has to be scannable ON THE PAGE, not just in the database. ──────

test('🔑 the guest card draws the QR big enough to scan, and lets you open it full size', () => {
  const src = readFileSync(
    join(process.cwd(), 'app/_components/pabuya/pabuya-card-list.tsx'),
    'utf8',
  );
  // Find the element that wraps the QR <img>, and read its size classes.
  const at = src.indexOf('src={m.qrUrl}');
  assert.ok(at > 0, 'the QR image mount is gone — re-point this guard');
  const wrapper = src.slice(Math.max(0, at - 900), at);

  const h = [...wrapper.matchAll(/\bh-(\d+)\b/g)].map((m) => Number(m[1]));
  assert.ok(h.length > 0, 'the QR wrapper declares no height');
  /*
    ⚠ A FLOOR, NOT AN EXACT VALUE. It shipped at h-20 (80px) and a couple
    uploads a banking-app SCREENSHOT — logo, name, masked account, footnote —
    so the code itself is roughly a third of the image. 80px left ~25px of
    real QR and the owner reported it as the QR not being visible. h-28
    (112px) is the floor; larger is fine, which is why this asserts >= and
    not ===.
  */
  assert.ok(
    Math.min(...h) >= 28,
    `the QR is drawn at h-${Math.min(...h)} — too small to scan (floor is h-28)`,
  );

  // Tappable: a guest scans from a SECOND phone, so they need it full-screen.
  assert.match(
    wrapper,
    /<a\s[^>]*href=\{m\.qrUrl\}/s,
    'the QR is not a link — there is no way to open it full size or save it',
  );
  assert.match(wrapper, /rel="noopener noreferrer"/, 'target=_blank without rel');
});

test('⚠ the shared gift card stays presentational — no client bundle', () => {
  const src = readFileSync(
    join(process.cwd(), 'app/_components/pabuya/pabuya-card-list.tsx'),
    'utf8',
  );
  // It is rendered by BOTH the server guest page and the client dashboard
  // preview; making it a client component is how those two start to drift.
  assert.ok(
    !/^\s*['"]use client['"]/m.test(src),
    'the shared card became a client component — the preview and the guest page can now diverge',
  );
  assert.ok(!/onClick=/.test(src), 'an event handler appeared in a shared presentational card');
});

// ── The two things a guest actually does: copy the number, save the QR. ────

const CARD = 'app/_components/pabuya/pabuya-card-list.tsx';
const ACTIONS = 'app/_components/pabuya/pabuya-method-actions.tsx';
const readWeb = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('the account number is LABELLED — it is the fallback when a scan fails', () => {
  const src = readWeb(CARD);
  // It rendered as bare mono digits with nothing saying what they were.
  // `handleLabel` is per-rail ("Account number", "GCash number", …).
  assert.match(
    src,
    /\{meta\.handleLabel\}/,
    'the handle is unlabelled again — a bare number reads as decoration, not as the thing to type',
  );
});

test('the card wires the copy + save controls, and stays inert itself', () => {
  const src = readWeb(CARD);
  assert.match(src, /<PabuyaMethodActions\b/, 'the actions control is not mounted');
  assert.match(src, /handle=\{m\.handle\}/, 'copy has nothing to copy');
  assert.match(src, /qrUrl=\{m\.qrUrl\}/, 'save has nothing to save');
  // The whole point of putting them in a child: this file ships no JS.
  assert.ok(!/^\s*['"]use client['"]/m.test(src), 'the shared card became a client component');
  assert.ok(!/onClick=/.test(src), 'a handler leaked into the shared card');
});

test('the actions control is a client component with BOTH controls', () => {
  const src = readWeb(ACTIONS);
  assert.match(src, /^['"]use client['"]/m, 'clipboard needs a client component');
  assert.match(src, /navigator\.clipboard/, 'no copy-to-clipboard');
  assert.match(src, /download=1/, 'the save link does not ask the route for an attachment');
});

test('🔑 a FAILED copy must not report success', () => {
  const src = readWeb(ACTIONS);
  const fn = src.slice(src.indexOf('async function copy'), src.indexOf('if (!handle && !qrUrl)'));
  assert.ok(fn.length > 0, 'copy() is gone — re-point this guard');
  const catchBlock = fn.slice(fn.indexOf('} catch'));
  assert.ok(catchBlock.length > 0, 'copy() has no catch — a rejected clipboard throws into the void');
  /*
    `navigator.clipboard` is undefined on an insecure origin and throws when
    the document is unfocused or permission is refused. Setting 'copied' in the
    catch is the exact disease this repo keeps finding: a failure rendered
    identically to success. The catch must land on a DIFFERENT state.
  */
  assert.ok(
    !/setState\('copied'\)/.test(catchBlock),
    'the failure path reports "Copied" — a failure that renders as success',
  );
  assert.match(catchBlock, /setState\('manual'\)/, 'the failure path says nothing to the guest');
});

test('the route serves a download on request, with a sanitised filename', () => {
  const src = readWeb('app/api/pabuya/qr/[publicId]/route.ts');
  assert.match(src, /searchParams\.get\('download'\) === '1'/, 'no download mode');
  assert.match(
    src,
    /wantsDownload[\s\S]{0,120}attachment; filename=/,
    'download mode does not set Content-Disposition: attachment',
  );
  /*
    ⚠ `label` is COUPLE-AUTHORED TEXT going into an HTTP header. A raw quote or
    newline there is header injection; a slash escapes the download folder.
    Assert the value is reduced to a conservative alphabet before it is used.
  */
  assert.match(
    src,
    /replace\(\/\[\^A-Za-z0-9\]\+\/g/,
    'the filename is built from unsanitised couple-authored text',
  );
  assert.ok(
    !/filename="\$\{method\.label/.test(src),
    'the raw label is interpolated straight into the Content-Disposition header',
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
