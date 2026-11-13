import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

import { stripComments } from './strip-comments';
import { parsePaperRead, type PaperRead } from './verification-pairs';
import {
  PAPER_READ_PROMPT,
  mergeReadIntoDocUploads,
  parseModelPaperJson,
  readAsSentence,
  slotR2Key,
  sniffPaperFile,
  strictIsoDate,
  toPaperRead,
} from './verification-paper-read';
import { paperToModelBlock, readPaperQr } from './verification-paper-file';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { classifyPaperQr, hostIsUnder } from './verification-paper-read';

/**
 * THE PAPER READER (owner 2026-11-14) — guards.
 *
 * Every paper here is SYNTHETIC: a model reply typed by hand, or a blank
 * picture / blank PDF made in the test. No real supplier paper is used, ever.
 *
 * What must hold (the 2026-09-09 lock + the "three papers and one submit"
 * ruling, which made the read an ADMIN aid only):
 *   · the reader writes `doc_uploads[slot].read` and nothing else;
 *   · no key / a model error leaves the upload intact (nothing is written);
 *   · PDF and JPEG both go through;
 *   · the expiry is never invented;
 *   · it is never shown raw, and the supplier screen never draws it.
 */

const WEB = join(new URL('.', import.meta.url).pathname, '..');
const SERVER = join(WEB, 'lib', 'verification-paper-read.server.ts');
const ACTIONS = join(WEB, 'app', 'vendor-dashboard', 'shop', 'inline-docs-actions.ts');
const PAIRS = join(WEB, 'app', 'vendor-dashboard', 'shop', '_components', 'verify-pairs.tsx');
const ADMIN_ACTIONS = join(WEB, 'app', 'admin', 'verify', 'actions.ts');

const src = (p: string) => stripComments(readFileSync(p, 'utf8'));

/* ── Synthetic model replies ─────────────────────────────────────────────── */

const DTI_REPLY = `\`\`\`json
{"registry":"dti","account_name":"SAMPLE BLOOMS EVENT STYLING","owner_name":"JUAN DELA CRUZ",
 "registration_number":"1234567","rdo":null,"address":null,"city":null,
 "expiration_date":"2031-05-14","read_as":"Read as a DTI business name certificate for SAMPLE BLOOMS EVENT STYLING.",
 "could_not_read":[]}
\`\`\``;

/** A BIR 2303 prints NO expiry. The fixture has none. */
const BIR_NO_EXPIRY_REPLY = JSON.stringify({
  registry: 'bir',
  account_name: 'SAMPLE BLOOMS EVENT STYLING',
  owner_name: 'JUAN DELA CRUZ',
  registration_number: '123-456-789-00000',
  rdo: '044',
  address: '1 Sample St, Barangay Uno, Quezon City',
  city: 'Quezon City',
  expiration_date: null,
  read_as: 'Read as a BIR Certificate of Registration (Form 2303).',
  could_not_read: [],
});

test('a DTI reply maps onto the DTI pair, and its printed expiry becomes a note', () => {
  const m = parseModelPaperJson(DTI_REPLY);
  assert.ok(m);
  const r = toPaperRead('dti_certificate', m, '2026-11-14T00:00:00.000Z');
  assert.equal(r.registry, 'dti');
  assert.equal(r.values.registered_business_name, 'SAMPLE BLOOMS EVENT STYLING');
  assert.equal(r.values.business_owner_name, 'JUAN DELA CRUZ');
  assert.equal(r.values.registration_number_raw, '1234567');
  assert.equal(r.expiresOn, '2031-05-14');
  assert.ok(r.notes.some((n) => n.startsWith('Valid until ')));
  assert.equal(r.registryOutcome, 'no_registry', 'no registry is called by this build');
});

test('THE EXPIRY IS NEVER INVENTED — a paper with none reads with none', () => {
  const m = parseModelPaperJson(BIR_NO_EXPIRY_REPLY);
  assert.ok(m);
  assert.equal(m.expirationDate, null);
  const r = toPaperRead('bir_2303', m, '2026-11-14T00:00:00.000Z');
  assert.equal(r.expiresOn, null);
  assert.ok(!r.notes.some((n) => /valid until/i.test(n)), 'an expiry appeared on a paper that has none');
  assert.equal(r.values.tin_number, '123-456-789-00000');
  assert.ok(r.notes.includes('RDO 044'));
  // …and it survives a round trip through the stored block with none.
  const stored = parsePaperRead({ r2_key: 'r2://x', read: r });
  assert.equal(stored?.expiresOn, null);
});

test('a date that is not a real date is a date we do not have', () => {
  assert.equal(strictIsoDate('2026-02-30'), null);
  assert.equal(strictIsoDate('December 31'), null);
  assert.equal(strictIsoDate('2026-12-31T00:00:00Z'), null);
  assert.equal(strictIsoDate(''), null);
  assert.equal(strictIsoDate(null), null);
  assert.equal(strictIsoDate('2026-12-31'), '2026-12-31');
  const m = parseModelPaperJson('{"registry":"lgu","expiration_date":"end of the year"}');
  assert.equal(m?.expirationDate, null);
  assert.equal(parsePaperRead({ read: { expiresOn: '2026-13-01' } })?.expiresOn, null);
});

test('the prompt tells the model not to guess an expiry', () => {
  assert.match(PAPER_READ_PROMPT, /expiration_date[^\n]*ONLY when the paper prints one/);
  assert.match(PAPER_READ_PROMPT, /2303 usually has no expiry/);
});

test('a paper in the wrong box fills nothing in — it parks with a person', () => {
  const m = parseModelPaperJson(BIR_NO_EXPIRY_REPLY)!;
  const r = toPaperRead('dti_certificate', m, '2026-11-14T00:00:00.000Z');
  assert.deepEqual(r.values, {});
  assert.deepEqual(
    [...r.unreadable].sort(),
    ['business_owner_name', 'registered_business_name', 'registration_number_raw'],
  );
});

test('a line the model could not make out is listed as unreadable', () => {
  const m = parseModelPaperJson(
    '{"registry":"lgu","city":"Pasig","address":null,"could_not_read":["address"]}',
  )!;
  const r = toPaperRead('mayors_permit', m, '2026-11-14T00:00:00.000Z');
  assert.equal(r.values.location_city, 'Pasig');
  assert.deepEqual(r.unreadable, ['permit_address']);
});

test('garbage from the model writes nothing (null), never a half block', () => {
  assert.equal(parseModelPaperJson('I cannot read this.'), null);
  assert.equal(parseModelPaperJson('{not json}'), null);
  assert.equal(parseModelPaperJson('[1,2]'), null);
});

test('never shown raw — a JSON-ish or shouting "read as" becomes our own sentence', () => {
  for (const bad of ['READ PERMITTED', '{"registry":"dti"}', 'STATUS: VERIFIED', 'x'.repeat(200)]) {
    const s = readAsSentence({ registry: 'dti', readAs: bad });
    assert.equal(s, 'Read as a DTI business name certificate.');
  }
  assert.equal(
    readAsSentence({ registry: 'sec', readAs: 'Read as an SEC certificate for Sample Corp' }),
    'Read as an SEC certificate for Sample Corp.',
  );
});

/* ── The one write ───────────────────────────────────────────────────────── */

const READ: PaperRead = toPaperRead('dti_certificate', parseModelPaperJson(DTI_REPLY)!, '2026-11-14T00:00:00.000Z');

test('the merge changes doc_uploads[slot].read and NOTHING else', () => {
  const before = {
    dti_certificate: { r2_key: 'r2://b/vendors/v/verification/a.pdf', uploaded_at: 't0' },
    bir_2303: { r2_key: 'r2://b/vendors/v/verification/b.jpg', uploaded_at: 't1' },
    portfolio_samples: ['r2://p/1'],
  };
  const snapshot = JSON.stringify(before);
  const next = mergeReadIntoDocUploads(before, 'dti_certificate', before.dti_certificate.r2_key, READ);
  assert.ok(next);
  assert.equal(JSON.stringify(before), snapshot, 'the input was mutated');
  const { read, ...restOfSlot } = next.dti_certificate as Record<string, unknown>;
  assert.deepEqual(read, READ);
  assert.deepEqual(restOfSlot, before.dti_certificate);
  assert.deepEqual(next.bir_2303, before.bir_2303);
  assert.deepEqual(next.portfolio_samples, before.portfolio_samples);
  assert.deepEqual(Object.keys(next).sort(), Object.keys(before).sort());
});

test('a read of a REPLACED paper is never pinned onto the new one', () => {
  const now = { dti_certificate: { r2_key: 'r2://b/new.pdf' } };
  assert.equal(mergeReadIntoDocUploads(now, 'dti_certificate', 'r2://b/old.pdf', READ), null);
  assert.equal(mergeReadIntoDocUploads({}, 'dti_certificate', 'r2://b/old.pdf', READ), null);
  assert.equal(slotR2Key(now, 'dti_certificate'), 'r2://b/new.pdf');
});

test('the reader makes ONE write, to doc_uploads, on the application table — no profile, no status', () => {
  const s = src(SERVER);
  assert.equal((s.match(/\.update\(/g) ?? []).length, 1, 'the reader grew a second write');
  assert.match(s, /\.update\(\{ doc_uploads: next \}\)/);
  for (const banned of [/\.insert\(/, /\.upsert\(/, /\.delete\(/, /\.rpc\(/, /vendor_profiles/, /\bstatus\b\s*:/, /docs_complete/]) {
    assert.ok(!banned.test(s), `the reader touches ${banned}`);
  }
  assert.equal((s.match(/\.from\('([a-z_]+)'\)/g) ?? []).every((m) => m.includes('vendor_verification_applications')), true);
});

test('no key → the model is never called; every failure returns instead of throwing', () => {
  const s = src(SERVER);
  assert.match(
    s,
    /if \(receiptReaderConfigured\(\)\) \{\s*const transcript = await transcribe\(/,
    'the model call is no longer behind the key check',
  );
  assert.equal((s.match(/transcribe\(/g) ?? []).length, 2, 'transcribe is called from somewhere else too');
  assert.ok(!/\bthrow\b/.test(s), 'the reader throws — it must return a reason');
  assert.match(s, /RECEIPT_READ_MODEL/, 'use the receipt reader’s model constant, not a new one');
});

test('the upload is saved BEFORE the read is scheduled, and the read runs in after()', () => {
  const s = src(ACTIONS);
  const write = s.indexOf("doc_uploads: nextUploads");
  const scheduled = s.indexOf('readVerificationPaper(');
  assert.ok(write > 0 && scheduled > write, 'the read must be scheduled after the upload is saved');
  const around = s.slice(s.lastIndexOf('after(', scheduled), scheduled);
  assert.ok(around.length > 0 && around.length < 200, 'the read is not inside after()');
});

test('the admin "Read it again" rides the existing document action — no new export', () => {
  const s = src(ADMIN_ACTIONS);
  assert.match(s, /intent'\) === 'read'/);
  assert.match(s, /readVerificationPaper\(\{ admin, applicationId, slotKey \}\)/);
});

test('the SUPPLIER screen never draws the read (owner: "three papers and one submit")', () => {
  const s = src(PAIRS);
  assert.ok(!/parsePaperRead\(/.test(s), 'the supplier screen parses the read block again');
});

/* ── PDF and JPEG both go through ────────────────────────────────────────── */

/** A blank, synthetic one-page PDF. Not a paper. */
const SYNTHETIC_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'latin1',
);

test('a PDF goes through as a document block', async () => {
  assert.equal(sniffPaperFile(SYNTHETIC_PDF), 'pdf');
  const b = await paperToModelBlock(SYNTHETIC_PDF);
  assert.equal(b.type, 'document');
  assert.equal(b.source.media_type, 'application/pdf');
  assert.equal(Buffer.from(b.source.data, 'base64').subarray(0, 5).toString('latin1'), '%PDF-');
});

test('a JPEG goes through as a downscaled JPEG image block', async () => {
  const jpeg = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: { r: 240, g: 236, b: 226 } },
  })
    .jpeg()
    .toBuffer();
  assert.equal(sniffPaperFile(jpeg), 'jpeg');
  const b = await paperToModelBlock(jpeg);
  assert.equal(b.type, 'image');
  assert.equal(b.source.media_type, 'image/jpeg');
  const meta = await sharp(Buffer.from(b.source.data, 'base64')).metadata();
  assert.ok(Math.max(meta.width ?? 0, meta.height ?? 0) <= 1568);
});

test('a PNG goes through as a JPEG too; a non-paper is refused (→ with a person)', async () => {
  const png = await sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
  assert.equal(sniffPaperFile(png), 'png');
  assert.equal((await paperToModelBlock(png)).type, 'image');
  await assert.rejects(paperToModelBlock(Buffer.from('hello, this is not a paper at all')));
});

/* ── 🔳 The QR — admin only, never fetched ───────────────────────────────── */

const verdict = (qrText: string | null, qrUnreadable = false) => classifyPaperQr({ qrText, qrUnreadable });

test('the host check is strict — official hosts and their subdomains only, over https', () => {
  assert.deepEqual(verdict('https://dti.gov.ph/verify?id=1'), {
    kind: 'official', label: 'Official DTI site', href: 'https://dti.gov.ph/verify?id=1',
  });
  assert.equal(verdict('https://bnrs.dti.gov.ph/x').kind, 'official');
  assert.equal(verdict('https://DTI.GOV.PH./x').kind, 'official');
  assert.equal((verdict('https://www.sec.gov.ph/x') as { label: string }).label, 'Official SEC site');
  assert.equal((verdict('https://orus.bir.gov.ph/x') as { label: string }).label, 'Official BIR site');
  for (const bad of [
    'https://dti.gov.ph.evil.com/x', // the look-alike
    'https://evil-dti.gov.ph/x', // not a label boundary
    'https://xdti.gov.ph/x',
    'https://dti.gov.ph@evil.com/x', // credentials trick — the host is evil.com
    'https://evil.com/dti.gov.ph',
    'https://evil.com/?u=https://dti.gov.ph',
    'http://dti.gov.ph/x', // not https
    'https://user:pw@dti.gov.ph/x',
    'https://gov.ph/x',
  ]) {
    const v = verdict(bad);
    assert.equal(v.kind, 'not_government', bad);
    assert.equal((v as { label: string }).label, '⚠ Not a government site');
  }
  assert.equal(hostIsUnder('dti.gov.ph.evil.com', 'dti.gov.ph'), false);
  assert.equal(hostIsUnder('a.dti.gov.ph', 'dti.gov.ph'), true);
});

test('a QR that is not a link reads as text, and is never offered as one', () => {
  for (const t of ['BN 1234567 SAMPLE BLOOMS', 'javascript:alert(1)', 'data:text/html,hi', 'dti.gov.ph/x', 'mailto:a@b.c']) {
    const v = verdict(t);
    assert.equal(v.kind, 'text', t);
    assert.equal((v as { label: string }).label, 'This QR holds text, not a link');
  }
});

test('an unreadable QR says so; an old block without QR fields says nothing', () => {
  assert.deepEqual(verdict(null, true), { kind: 'unreadable', label: 'Couldn’t read the QR — check by hand' });
  const old = parsePaperRead({ read: { registry: 'dti', readAs: 'Read as a DTI certificate.' } });
  assert.equal(old?.qrText, null);
  assert.equal(old?.qrUnreadable, false);
  assert.equal(classifyPaperQr(old).kind, 'none');
  assert.equal(classifyPaperQr(null).kind, 'none');
});

const QR_TEXT = 'https://bnrs.dti.gov.ph/verify?cert=SYNTHETIC-0000';

async function qrPng(): Promise<Buffer> {
  return QRCode.toBuffer(QR_TEXT, { type: 'png', margin: 4, width: 400 });
}

test('a JPEG paper with a QR — decoded by the shared decoder', async () => {
  const page = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#ffffff' } })
    .composite([{ input: await qrPng(), left: 760, top: 360 }])
    .jpeg({ quality: 92 })
    .toBuffer();
  assert.deepEqual(await readPaperQr(page), { qrText: QR_TEXT, qrUnreadable: false });
});

test('a PDF paper with a QR (as PNG and as JPEG inside it) — decoded', async () => {
  for (const asJpeg of [false, true]) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const png = await qrPng();
    const img = asJpeg
      ? await doc.embedJpg(await sharp(png).flatten({ background: '#ffffff' }).jpeg({ quality: 95 }).toBuffer())
      : await doc.embedPng(png);
    page.drawImage(img, { x: 380, y: 60, width: 160, height: 160 });
    const pdf = await doc.save();
    assert.equal(sniffPaperFile(pdf), 'pdf');
    assert.deepEqual(await readPaperQr(pdf), { qrText: QR_TEXT, qrUnreadable: false }, asJpeg ? 'jpeg' : 'png');
  }
});

test('a paper with no readable QR — unreadable, never an error', async () => {
  const blank = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
  assert.deepEqual(await readPaperQr(blank), { qrText: null, qrUnreadable: true });
  assert.deepEqual(await readPaperQr(SYNTHETIC_PDF), { qrText: null, qrUnreadable: true });
  assert.deepEqual(await readPaperQr(Buffer.from('not a paper at all, just words')), { qrText: null, qrUnreadable: true });
});

test('THE SERVER NEVER FETCHES THE DECODED LINK', () => {
  for (const f of [
    SERVER,
    join(WEB, 'lib', 'verification-paper-file.ts'),
    join(WEB, 'lib', 'pdf-embedded-images.ts'),
    join(WEB, 'lib', 'verification-paper-read.ts'),
    join(WEB, 'lib', 'qr-decode.ts'),
  ]) {
    const s = src(f);
    for (const banned of [/\bfetch\(/, /from 'node:https?'/, /from 'https?'/, /axios|undici|got\(/]) {
      assert.ok(!banned.test(s), `${f} can reach the network: ${banned}`);
    }
  }
  const s = src(SERVER);
  // qrText is copied into the block and goes nowhere else.
  assert.deepEqual(s.match(/qr\.qrText/g), ['qr.qrText']);
});

test('the supplier side never shows the QR, its link or its label', () => {
  const supplierFiles = [
    PAIRS,
    join(WEB, 'app', 'vendor-dashboard', 'shop', '_components', 'verify-section.tsx'),
    join(WEB, 'app', 'vendor-dashboard', 'shop', '_components', 'docs-body.tsx'),
  ];
  for (const f of supplierFiles) {
    const s = src(f);
    for (const banned of [/qrText|qrUnreadable|classifyPaperQr/, /Official DTI site|Not a government site/]) {
      assert.ok(!banned.test(s), `${f} shows the QR to the supplier: ${banned}`);
    }
  }
});
