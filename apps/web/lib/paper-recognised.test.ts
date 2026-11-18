/**
 * paper-recognised.test.ts — 🛂 W1-B34: A FAKE PAPER IS NEVER "RECOGNISED".
 *
 * Walk W1-B34 (18 Nov 2026): a photo stamped "TEST — NOT VALID" and a paper no government office issued both read as
 * Recognised, so automatic approval was held (`AUTO_APPROVAL_HELD`). Each fixture below is the reader's REPLY TEXT for
 * one paper, run through the real parser (`parseModelPaperJson`) and then through all three places that decide:
 *   · the supplier's row  — `paperState` must never say "Recognised";
 *   · the intake          — `mergeIntake` must never say "Read as your …";
 *   · the Submit check    — `decideAutoVerify` check 1 must fail, so the shop goes to a person.
 * Every fixture failed on main before this change (each read as Recognised). The genuine fixtures must still pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseModelPaperJson, type ModelPaperRead, type ReadableSlotKey } from '@/lib/verification-paper-read';
import { paperState, latestReportBySlot, NOT_RECOGNISED_PREFIX } from '@/lib/paper-intake-shared';
import { mergeIntake, INTAKE_MESSAGE, type PageRead } from '@/lib/paper-intake';
import { decideAutoVerify, holdAutoApproval, AUTO_APPROVAL_HELD, type AutoVerifyInput } from '@/lib/auto-verify';
import { isRecognisedRead, notRecognisedBecause, testMarkerOn } from '@/lib/paper-recognised';

const KEY = 'test-only-derived-key-not-a-secret';
const CTX = { nowIso: '2026-11-18T02:00:00.000Z', todayManila: '2026-11-18', key: KEY };

const reply = (o: Record<string, unknown>) => JSON.stringify(o);
const confident = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([k, v]) => v !== null && !['registry', 'read_as', 'could_not_read', 'markings'].includes(k)).map(([k]) => [k, true]));
const withConfidence = (o: Record<string, unknown>) => reply({ could_not_read: [], ...o, confident: confident(o) });

// ── GENUINE replies (synthetic shop, synthetic numbers) ─────────────────────────────────────────────────────────────
const GENUINE = {
  dti: withConfidence({
    registry: 'dti', account_name: 'LIWANAG BLOOMS EVENT STYLING', owner_name: 'MARIA REYES SANTOS',
    registration_number: '5512034', tin: null, rdo: null, address: '12 Kalayaan Ave, Brgy. San Antonio, Pasig City',
    city: 'Pasig', barangay: 'San Antonio', expiration_date: '2030-02-02',
    issuer: 'Department of Trade and Industry', markings: [],
    read_as: 'Read as a DTI business name certificate for LIWANAG BLOOMS EVENT STYLING.',
  }),
  bir: withConfidence({
    registry: 'bir', account_name: 'LIWANAG BLOOMS EVENT STYLING', owner_name: 'MARIA REYES SANTOS',
    registration_number: '210-334-871-000', tin: '210-334-871-000', rdo: '043',
    address: '12 Kalayaan Ave, Brgy. San Antonio, Pasig City', city: 'Pasig', barangay: 'San Antonio',
    expiration_date: null, issuer: 'Bureau of Internal Revenue', markings: [],
  }),
  lgu: withConfidence({
    registry: 'lgu', account_name: 'LIWANAG BLOOMS EVENT STYLING', owner_name: 'MARIA REYES SANTOS',
    registration_number: '2026-0042', tin: null, rdo: null, address: '12 Kalayaan Ave, Brgy. San Antonio, Pasig City',
    city: 'Pasig', barangay: 'San Antonio', expiration_date: '2026-12-31',
    issuer: 'Office of the City Mayor, Business Permits and Licensing Office, Pasig City', markings: [],
  }),
};

const parsed = (text: string): ModelPaperRead => {
  const m = parseModelPaperJson(text);
  assert.ok(m, `fixture did not parse: ${text.slice(0, 80)}`);
  return m!;
};
const swap = (text: string, over: Record<string, unknown>) => {
  const o = JSON.parse(text) as Record<string, unknown>;
  return withConfidence({ ...o, ...over, confident: undefined });
};

// ── FAKE replies — each one the walker's B34 case, or one of its siblings ──────────────────────────────────────────
const FAKES: Array<{ name: string; slot: ReadableSlotKey; text: string; why: RegExp }> = [
  { name: 'a DTI photo stamped "TEST — NOT VALID"', slot: 'dti_certificate', text: swap(GENUINE.dti, { markings: ['TEST — NOT VALID'] }), why: /test or sample/ },
  { name: 'a BIR 2303 with a SPECIMEN watermark', slot: 'bir_2303', text: swap(GENUINE.bir, { markings: ['SPECIMEN'] }), why: /test or sample/ },
  { name: 'a permit whose business name is "TEST SHOP"', slot: 'mayors_permit', text: swap(GENUINE.lgu, { account_name: 'TEST SHOP', owner_name: null }), why: /test or sample/ },
  { name: 'a DTI certificate made out to "SAMPLE BUSINESS NAME"', slot: 'dti_certificate', text: swap(GENUINE.dti, { account_name: 'SAMPLE BUSINESS NAME' }), why: /test or sample/ },
  { name: 'a BIR 2303 with the placeholder TIN 123-456-789-000', slot: 'bir_2303', text: swap(GENUINE.bir, { registration_number: '123-456-789-000', tin: '123-456-789-000' }), why: /test or sample/ },
  { name: 'a permit stamped VOID', slot: 'mayors_permit', text: swap(GENUINE.lgu, { markings: ['VOID'] }), why: /test or sample/ },
  { name: 'the reader itself calling it a sample', slot: 'bir_2303', text: swap(GENUINE.bir, { read_as: 'This looks like a sample BIR Form 2303 from a tutorial.' }), why: /test or sample/ },
  // Missing the lines each type always prints.
  { name: 'a DTI certificate with no owner and no validity', slot: 'dti_certificate', text: swap(GENUINE.dti, { owner_name: null, expiration_date: null }), why: /missing the owner's name, the valid-until date/ },
  { name: 'a BIR 2303 with no RDO code and no address', slot: 'bir_2303', text: swap(GENUINE.bir, { rdo: null, address: null }), why: /missing the business address, the RDO code/ },
  { name: 'a BIR 2303 whose "TIN" is not a TIN', slot: 'bir_2303', text: swap(GENUINE.bir, { registration_number: 'OR-88812' }), why: /missing the TIN/ },
  { name: "a Mayor's Permit with no permit number and no validity", slot: 'mayors_permit', text: swap(GENUINE.lgu, { registration_number: null, expiration_date: null }), why: /missing the permit number, the valid-until date/ },
  // An issuer that is not the government body for that type.
  { name: 'a "DTI certificate" issued by a printing shop', slot: 'dti_certificate', text: swap(GENUINE.dti, { issuer: 'Quickprint Document Services' }), why: /not issued by the DTI/ },
  { name: 'a "BIR 2303" issued by a review school', slot: 'bir_2303', text: swap(GENUINE.bir, { issuer: 'Tax Review Academy Inc.' }), why: /not issued by the BIR/ },
  { name: 'a "Mayor\'s Permit" that is a barangay clearance of a mall', slot: 'mayors_permit', text: swap(GENUINE.lgu, { issuer: 'SM Megamall Tenant Services' }), why: /not issued by a city or municipal government/ },
  { name: 'a DTI form with the BIR named as issuer', slot: 'dti_certificate', text: swap(GENUINE.dti, { issuer: 'Bureau of Internal Revenue' }), why: /not issued by the DTI/ },
  { name: 'a paper with no issuing office printed', slot: 'mayors_permit', text: swap(GENUINE.lgu, { issuer: null }), why: /no issuing office/ },
];

const SLOT_OF: Record<string, ReadableSlotKey> = { dti: 'dti_certificate', sec: 'dti_certificate', bir: 'bir_2303', lgu: 'mayors_permit' };

function fileOne(text: string, r2Key = 'r2://vendor-verification/x/p.jpg') {
  const page: PageRead = { r2Key, page: null, fileProblem: null, model: parseModelPaperJson(text), qrTexts: [] };
  return mergeIntake({}, [page], CTX);
}

test('the genuine fixtures are Recognised — the rule does not hold a real paper', () => {
  for (const [kind, text] of Object.entries(GENUINE)) {
    const m = parsed(text);
    assert.equal(notRecognisedBecause(m), null, `${kind}: ${notRecognisedBecause(m)}`);
    const out = fileOne(text);
    const slot = SLOT_OF[kind]!;
    const st = paperState(out.next[slot], latestReportBySlot(out.reports)[slot]!);
    assert.equal(st.text, 'Recognised', kind);
    assert.match(out.reports[0]!.message, /^Read as your /);
  }
});

for (const f of FAKES) {
  test(`never Recognised: ${f.name}`, () => {
    const m = parsed(f.text);
    // The rule names why.
    const why = notRecognisedBecause(m);
    assert.ok(why, 'read as Recognised');
    assert.match(why!, f.why);
    assert.equal(isRecognisedRead(m), false);

    // The supplier's row: KEPT for a person (the machine never refuses), never "Recognised", and it says why.
    const out = fileOne(f.text);
    const st = paperState(out.next[f.slot], latestReportBySlot(out.reports)[f.slot]!);
    assert.notEqual(st.text, 'Recognised');
    assert.equal(st.kind, 'person');
    assert.equal(st.isIn, true, 'the paper is kept, not refused');
    assert.ok(st.note?.startsWith(NOT_RECOGNISED_PREFIX), `the row does not say why: ${st.note}`);
    assert.doesNotMatch(out.reports[0]!.message, /^Read as your /);

    // The Submit check: check 1 fails with the reason, so the decision is a person — even with the hold lifted.
    const input = genuineInput();
    input.papers = input.papers.map((p) => (p.slotKey === f.slot ? { ...p, model: m } : p));
    const d = decideAutoVerify(input);
    assert.equal(d.decision, 'to_admin');
    const c1 = d.checks.find((c) => c.key === 'papers_read')!;
    assert.equal(c1.pass, false);
    assert.match(c1.detail, /is not recognised: /);
    assert.equal(holdAutoApproval(d, false).decision, 'to_admin', 'lifting the hold would approve it');
  });
}

function genuineInput(): AutoVerifyInput {
  const dti = parsed(GENUINE.dti);
  return {
    todayManila: CTX.todayManila,
    duplicates: { registrationNumber: false, tin: false },
    livePage: null,
    papers: [
      { slotKey: 'dti_certificate', fileProblem: null, qrTexts: [`https://bnrs.dti.gov.ph/verify?bn=${dti.registrationNumber}`], model: dti },
      { slotKey: 'bir_2303', fileProblem: null, qrTexts: [], model: parsed(GENUINE.bir) },
      { slotKey: 'mayors_permit', fileProblem: null, qrTexts: [], model: parsed(GENUINE.lgu) },
    ],
  };
}

test('the genuine application passes every check (so each fake above fails for ITS reason, not a broken fixture)', () => {
  const d = decideAutoVerify(genuineInput());
  assert.deepEqual(d.checks.filter((c) => !c.pass).map((c) => `${c.key}: ${c.detail}`), []);
  assert.equal(d.decision, 'verify');
  // …and the hold still sends it to a person. Lifting it is the owner's call.
  assert.equal(AUTO_APPROVAL_HELD, true);
  assert.equal(holdAutoApproval(d).decision, 'to_admin');
});

test('a read stored before issuer/markings existed is not Recognised (a person checks it), never silently passed', () => {
  const m = parsed(GENUINE.dti);
  const old = { ...m } as Partial<ModelPaperRead>;
  delete old.issuer;
  delete old.markings;
  assert.match(notRecognisedBecause(old as ModelPaperRead)!, /no issuing office/);
  const st = paperState({ r2_key: 'r2://old', attempts: 0, evidence: { model: old } }, null);
  assert.equal(st.kind, 'person');
});

test("a real paper's own fine print is not a test marker; a business that merely contains the letters is not either", () => {
  const m = parsed(swap(GENUINE.dti, { markings: ['Not valid without the dry seal of the DTI', 'VOID IF ALTERED'], account_name: 'CONTEST WINNERS CATERING' }));
  assert.equal(testMarkerOn(m), null);
  assert.equal(notRecognisedBecause(m), null);
});

// ── A FAILED read is "could not read" — never Recognised, never "not a match" ─────────────────────────────────────
for (const [name, text] of [
  ['no reply at all', null],
  ['a reply that is not JSON', 'Sorry, I cannot help with that.'],
  ['an error object', '{"error":{"type":"overloaded_error","message":"Overloaded"}}'],
  ['a reply with a registry we do not know', reply({ registry: 'DTI Certificate', account_name: 'LIWANAG BLOOMS EVENT STYLING' })],
  ['a reply with no registry', reply({ account_name: 'LIWANAG BLOOMS EVENT STYLING', registration_number: '5512034' })],
] as const) {
  test(`a failed read is "could not read": ${name}`, () => {
    const model = text === null ? null : parseModelPaperJson(text);
    assert.equal(model, null, 'a failed read was turned into a read');
    const out = mergeIntake({}, [{ r2Key: 'r2://x', page: null, fileProblem: null, model, qrTexts: [] }], CTX);
    assert.equal(out.reports[0]!.outcome, 'reader_unavailable');
    assert.equal(out.reports[0]!.message, INTAKE_MESSAGE.readerDown);
    assert.notEqual(out.reports[0]!.message, INTAKE_MESSAGE.other, 'a failed read said "not one of the three papers"');
    assert.equal(out.touched.length, 0, 'nothing is filed from a failed read');
    // At Submit, an unread paper is "could not be read" — a person checks.
    const input = genuineInput();
    input.papers = input.papers.map((p) => (p.slotKey === 'dti_certificate' ? { ...p, model: null } : p));
    const d = decideAutoVerify(input);
    assert.equal(d.decision, 'to_admin');
    assert.match(d.checks.find((c) => c.key === 'papers_read')!.detail, /DTI or SEC certificate could not be read/);
  });
}

test('the prompt asks the reader for the issuer and for test markings', async () => {
  const { PAPER_READ_PROMPT } = await import('@/lib/verification-paper-read');
  assert.match(PAPER_READ_PROMPT, /"issuer":/);
  assert.match(PAPER_READ_PROMPT, /"markings":[^\n]*TEST[^\n]*SPECIMEN/);
});
