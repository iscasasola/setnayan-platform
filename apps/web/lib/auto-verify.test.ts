import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideAutoVerify,
  foldBusinessName,
  maskTin,
  nameSimilarity,
  tinDigits,
  urlCarriesNumber,
  type AutoVerifyInput,
  type PaperEvidence,
} from './auto-verify';
import type { ModelPaperRead } from './verification-paper-read';
import type { LivePageResult } from './qr-live-check';

/**
 * CLEAN PAPERS VERIFY THE SHOP ON SUBMIT — every check failing ON ITS OWN.
 *
 * One clean, SYNTHETIC application (a fake shop, fake numbers) passes all six;
 * each test then breaks exactly one thing and asserts the decision becomes
 * `to_admin` with that check, and only that check, failing. Never `refuse`:
 * the machine has no such answer.
 */

const model = (over: Partial<ModelPaperRead>): ModelPaperRead => ({
  registry: 'dti',
  accountName: 'SAMPLE BLOOMS EVENT STYLING',
  ownerName: 'JUAN DELA CRUZ',
  registrationNumber: '5512034',
  rdo: null,
  address: null,
  city: null,
  expirationDate: null,
  readAs: null,
  couldNotRead: [],
  tin: null,
  unsure: [],
  ...over,
});

const clean = (): AutoVerifyInput => ({
  todayManila: '2026-11-14',
  duplicates: { registrationNumber: false, tin: false },
  livePage: null,
  papers: [
    {
      slotKey: 'dti_certificate',
      fileProblem: null,
      qrTexts: ['https://bnrs.dti.gov.ph/verify?bn=5512034'],
      model: model({ registry: 'dti', expirationDate: '2030-02-02' }),
    },
    {
      slotKey: 'bir_2303',
      fileProblem: null,
      qrTexts: [],
      model: model({ registry: 'bir', registrationNumber: '210-334-871-000', tin: '210-334-871-000', accountName: 'Sample Blooms Event Styling' }),
    },
    {
      slotKey: 'mayors_permit',
      fileProblem: null,
      qrTexts: [],
      model: model({ registry: 'lgu', registrationNumber: '2026-0042', city: 'Pasig', expirationDate: '2026-12-31', accountName: 'Sample Blooms Event Styling Enterprises' }),
    },
  ],
});

function paper(i: AutoVerifyInput, slot: PaperEvidence['slotKey']): PaperEvidence {
  return i.papers.find((p) => p.slotKey === slot)!;
}

function onlyFails(i: AutoVerifyInput, key: string) {
  const d = decideAutoVerify(i);
  assert.equal(d.decision, 'to_admin');
  const failed = d.checks.filter((c) => !c.pass).map((c) => c.key);
  assert.deepEqual(failed, [key], `expected only ${key} to fail, got ${failed.join(',')}`);
  assert.ok(d.reason.length > 10, 'the admin is given the exact reason');
  return d;
}

test('clean papers → verify, six of six', () => {
  const d = decideAutoVerify(clean());
  assert.equal(d.decision, 'verify', d.reason);
  assert.equal(d.checks.length, 6);
  assert.ok(d.checks.every((c) => c.pass));
  assert.deepEqual(
    d.checks.map((c) => c.label),
    [
      'All three papers read',
      'The name agrees across them',
      'Nothing expired',
      'The DTI/SEC QR is official and carries the same number',
      'The number and TIN are on no other shop',
      'The reader was confident',
    ],
  );
});

/* 1 */
test('1 fails alone — a paper not read', () => {
  const i = clean();
  paper(i, 'bir_2303').model = null;
  const d = decideAutoVerify(i);
  assert.equal(d.decision, 'to_admin');
  assert.equal(d.checks.find((c) => c.key === 'papers_read')!.pass, false);
});
test('1 fails alone — a line listed as unreadable', () => {
  const i = clean();
  paper(i, 'mayors_permit').model = { ...paper(i, 'mayors_permit').model!, couldNotRead: ['address'] };
  onlyFails(i, 'papers_read');
});
test('1 fails alone — the wrong kind of paper in a box', () => {
  const i = clean();
  paper(i, 'mayors_permit').model = { ...paper(i, 'mayors_permit').model!, registry: 'bir' };
  onlyFails(i, 'papers_read');
});
test('1 fails alone — a damaged / refused file', () => {
  const i = clean();
  paper(i, 'mayors_permit').fileProblem = 'The PDF does not open — it may be damaged.';
  onlyFails(i, 'papers_read');
});
test('TYPED VALUES NEVER AUTO-VERIFY — a manual slot goes to a person even when every value is perfect', () => {
  const i = clean();
  paper(i, 'mayors_permit').manual = true;
  const d = onlyFails(i, 'papers_read');
  assert.match(d.reason, /typed in by the supplier/);
});

/* 2 */
test('2 fails alone — a different name; "similar" never passes', () => {
  const i = clean();
  paper(i, 'bir_2303').model = { ...paper(i, 'bir_2303').model!, accountName: 'SAMPLE BLOOM EVENT STYLING', ownerName: 'JUAN DELA CRUS' };
  const d = onlyFails(i, 'name_agrees');
  assert.match(d.reason, /SAMPLE BLOOMS EVENT STYLING/);
  assert.match(d.reason, /% alike/);
});
test('names fold case, punctuation, &/and and legal suffixes — then must match EXACTLY', () => {
  assert.equal(foldBusinessName('Rosa & Co. Catering, INC.'), foldBusinessName('ROSA AND CO CATERING'));
  assert.equal(foldBusinessName('Bituin Enterprises'), foldBusinessName('BITUIN ENTERPRISE'));
  assert.equal(foldBusinessName('Bituin Corp.'), 'bituin');
  assert.equal(foldBusinessName('Co Ling Catering'), 'co ling catering', 'a leading "Co" is a name, not a suffix');
  assert.notEqual(foldBusinessName('Bituin Photo'), foldBusinessName('Bituin Photos'));
  assert.ok(nameSimilarity('Bituin Photo', 'Bituin Photos') > 0.85, 'shown as close…');
});
test('a sole proprietor: the owner name carries the match when the trade names differ', () => {
  const i = clean();
  paper(i, 'mayors_permit').model = { ...paper(i, 'mayors_permit').model!, accountName: 'JDC LIGHTS' };
  assert.equal(decideAutoVerify(i).decision, 'verify');
});

/* 3 */
test('3 fails alone — an expired permit', () => {
  const i = clean();
  paper(i, 'mayors_permit').model = { ...paper(i, 'mayors_permit').model!, expirationDate: '2026-11-13' };
  onlyFails(i, 'nothing_expired');
});
test("3 fails alone — last year's permit, and a permit with no date", () => {
  const i = clean();
  i.todayManila = '2027-01-05';
  paper(i, 'mayors_permit').model = { ...paper(i, 'mayors_permit').model!, expirationDate: '2026-12-31' };
  onlyFails(i, 'nothing_expired');
  const j = clean();
  paper(j, 'mayors_permit').model = { ...paper(j, 'mayors_permit').model!, expirationDate: null };
  onlyFails(j, 'nothing_expired');
});
test('3 fails alone — an expired DTI certificate; a BIR with no expiry passes', () => {
  const i = clean();
  paper(i, 'dti_certificate').model = { ...paper(i, 'dti_certificate').model!, expirationDate: '2025-01-01' };
  onlyFails(i, 'nothing_expired');
  assert.equal(decideAutoVerify(clean()).checks.find((c) => c.key === 'nothing_expired')!.detail.includes('BIR 2303 has no expiry date'), true);
});

/* 4 */
test('4 fails alone — a COPIED official QR whose number differs from the paper', () => {
  const i = clean();
  paper(i, 'dti_certificate').qrTexts = ['https://bnrs.dti.gov.ph/verify?bn=9900001'];
  const d = onlyFails(i, 'qr_official');
  assert.match(d.reason, /different number/);
});
test('4 fails alone — a look-alike host', () => {
  for (const evil of ['https://bnrs.dti.gov.ph.evil.com/verify?bn=5512034', 'https://evil-dti.gov.ph/?bn=5512034', 'https://dti.gov.ph@evil.com/?bn=5512034', 'http://bnrs.dti.gov.ph/verify?bn=5512034']) {
    const i = clean();
    paper(i, 'dti_certificate').qrTexts = [evil];
    onlyFails(i, 'qr_official');
  }
});
test('4 — the number must be a whole token, not a substring of a longer one', () => {
  assert.equal(urlCarriesNumber('https://bnrs.dti.gov.ph/v?bn=55120345', '5512034'), false);
  assert.equal(urlCarriesNumber('https://bnrs.dti.gov.ph/v/5512034', '5512034'), true);
  assert.equal(urlCarriesNumber('https://bnrs.dti.gov.ph/v?bn=5512034', 'BN 5512-034'), false, 'the B N letters are part of the folded number');
});
test('4 fails alone — no QR; a SEC paper with a DTI QR', () => {
  const i = clean();
  paper(i, 'dti_certificate').qrTexts = [];
  onlyFails(i, 'qr_official');
  const j = clean();
  paper(j, 'dti_certificate').model = { ...paper(j, 'dti_certificate').model!, registry: 'sec' };
  onlyFails(j, 'qr_official');
});
const live = (over: Partial<LivePageResult>): LivePageResult => ({
  url: 'https://bnrs.dti.gov.ph/verify?bn=5512034', outcome: 'reached', httpStatus: 200, numberOnPage: true,
  nameOnPage: true, status: 'Registered', validity: null, scriptOnly: false, note: '', ...over,
});
test('4 — a live page that disagrees fails; one that agrees is recorded as stronger; an unreachable one falls back', () => {
  const i = clean();
  i.livePage = live({ nameOnPage: false });
  onlyFails(i, 'qr_official');
  const j = clean();
  j.livePage = live({});
  assert.match(decideAutoVerify(j).checks.find((c) => c.key === 'qr_official')!.detail, /registry page shows the same/);
  for (const outcome of ['timeout', 'unreachable', 'redirect_off_list', 'blocked_address'] as const) {
    const k = clean();
    k.livePage = live({ outcome, numberOnPage: null, nameOnPage: null });
    assert.equal(decideAutoVerify(k).decision, 'verify', `a ${outcome} page falls back to the number-in-link rule`);
  }
  // …and never passes on its own: a page that agrees cannot rescue a copied QR.
  const m = clean();
  paper(m, 'dti_certificate').qrTexts = ['https://bnrs.dti.gov.ph/verify?bn=9900001'];
  m.livePage = live({});
  onlyFails(m, 'qr_official');
});

/* 5 */
test('5 fails alone — a duplicate TIN; a duplicate number; a lookup that could not run', () => {
  for (const dup of [{ registrationNumber: false, tin: true }, { registrationNumber: true, tin: false }, { registrationNumber: null, tin: false }]) {
    const i = clean();
    i.duplicates = dup;
    onlyFails(i, 'not_on_another_shop');
  }
});
test('5 fails alone — a TIN that is not 9–12 digits, or differs where it is printed again', () => {
  const i = clean();
  paper(i, 'bir_2303').model = { ...paper(i, 'bir_2303').model!, registrationNumber: '210-334-87', tin: null };
  onlyFails(i, 'not_on_another_shop');
  const j = clean();
  paper(j, 'mayors_permit').model = { ...paper(j, 'mayors_permit').model!, tin: '999-334-871-000' };
  onlyFails(j, 'not_on_another_shop');
  assert.equal(tinDigits('210 334 871 000'), '210334871000');
  assert.equal(tinDigits('210-334-871'), '210334871');
  assert.equal(tinDigits('21033487'), null);
  assert.equal(tinDigits('210-334-871-0000A'), null);
  assert.equal(maskTin('210-334-871-000'), '•••••••••000');
});

/* 6 */
test('6 fails alone — the model marked a line unsure', () => {
  const i = clean();
  paper(i, 'bir_2303').model = { ...paper(i, 'bir_2303').model!, unsure: ['registration_number'] };
  onlyFails(i, 'reader_confident');
});

test('THE MODEL BEING DOWN → to_admin, never a refusal', () => {
  const i = clean();
  for (const p of i.papers) p.model = null;
  const d = decideAutoVerify(i);
  assert.equal(d.decision, 'to_admin');
  assert.ok(['verify', 'to_admin'].includes(d.decision));
});

/* ── NO CLIENT PATH CAN VERIFY ───────────────────────────────────────────── */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(new URL('.', import.meta.url).pathname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const SOURCES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
const rel = (p: string) => p.slice(WEB.length + 1);

test('the decision engine lives in a plain server module, never a "use server" file', () => {
  const engine = stripComments(readFileSync(join(WEB, 'lib', 'verification-decision.server.ts'), 'utf8'));
  assert.ok(!/^\s*['"]use server['"]/m.test(engine), 'the engine became a server-action route');
  assert.match(engine, /^import 'server-only';/m);
});

test('only the admin actions and the automatic path call the engine', () => {
  const callers = SOURCES.filter((f) => /\bapplyApplicationDecision\s*\(/.test(stripComments(readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(callers, ['app/admin/verify/actions.ts', 'lib/auto-verify.server.ts', 'lib/verification-decision.server.ts']);
});

test('the automatic path is reached only from Submit, and nothing from the form reaches it', () => {
  const callers = SOURCES.filter((f) => /\brunAutoVerifyOnSubmit\s*\(/.test(stripComments(readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(callers, ['app/vendor-dashboard/shop/inline-docs-actions.ts', 'lib/auto-verify.server.ts']);
  const src = stripComments(readFileSync(join(WEB, 'app', 'vendor-dashboard', 'shop', 'inline-docs-actions.ts'), 'utf8'));
  const call = src.slice(src.indexOf('runAutoVerifyOnSubmit({'), src.indexOf('runAutoVerifyOnSubmit({') + 260);
  assert.ok(!/formData|_formData/.test(call), 'the form reaches the automatic decision');
  assert.match(call, /applicationId: app\.application_id/);
  assert.match(call, /vendorProfileId: auth\.vendorProfileId/);
  // …and it runs only after the application has moved to pending_review.
  assert.ok(src.indexOf("status: 'pending_review'") < src.indexOf('runAutoVerifyOnSubmit({'));
});

test('the automatic decision reads only SEALED slots', () => {
  const s = stripComments(readFileSync(join(WEB, 'lib', 'auto-verify.server.ts'), 'utf8'));
  assert.match(s, /openSealedSlot\(k, row\.doc_uploads\?\.\[k\], key\)/);
  assert.ok(!/parsePaperRead|\.read\b(?!\()/.test(s.replace(/readFile|\.read\(\)/g, '')), 'the decision reads the unsealed display block');
  assert.match(s, /actor: \{ user_id: null \},\s*automatic:/);
});

test('verification_state is written by the engine alone in the automatic path', () => {
  for (const f of ['lib/auto-verify.server.ts', 'lib/auto-verify.ts', 'lib/paper-intake.ts', 'lib/paper-intake.server.ts', 'lib/qr-live-check.server.ts']) {
    const s = stripComments(readFileSync(join(WEB, f), 'utf8'));
    assert.ok(!/verification_state|public_visibility|\.from\('vendor_profiles'\)\s*\.update/.test(s), `${f} writes the badge itself`);
  }
});
