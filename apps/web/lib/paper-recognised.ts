/**
 * paper-recognised.ts — 🛂 WHEN IS A READ PAPER "RECOGNISED"? One rule, used by the supplier's row (`paperState`),
 * the intake's message (`mergeIntake`) and the Submit check (`decideAutoVerify`, check 1).
 *
 * Walk W1-B34 (18 Nov 2026): a photo stamped "TEST — NOT VALID", and a paper no government office issued, both read
 * as Recognised — because "Recognised" meant only "a file is filed and the reader returned something". Automatic
 * approval was held (`AUTO_APPROVAL_HELD`) until this closed. A paper is now Recognised ONLY when ALL of these hold:
 *
 *   1. it is one of the three papers (DTI or SEC · BIR 2303 · Mayor's Permit) — never `other` / `unreadable`;
 *   2. nothing on it says it is a test: no TEST / SAMPLE / SPECIMEN / VOID / NOT VALID / DEMO… stamp, watermark or
 *      word in any value read, and no placeholder number (all one digit, 123456789);
 *   3. every line that paper type always prints was read (the table below);
 *   4. the office that issued it is the government body for that type (DTI · SEC · BIR · the city or municipality),
 *      and not a business, school or bank.
 *
 * Anything else is NOT a refusal — the machine never refuses anybody. The paper is kept and goes to a person, with
 * the reason. A read that FAILED (no model reply, a reply we could not parse) never reaches this function: it is
 * "could not read" upstream (`reader_unavailable`), never Recognised and never "not a match".
 *
 * PURE and client-safe (type-only imports): the supplier's screen draws it.
 * 🔒 lib/paper-recognised.test.ts
 */
import type { ModelPaperRead } from '@/lib/verification-paper-read';

/** Words that mark a paper as a test, sample or cancelled copy. Whole words only ("Contest" is not "test"). */
const TEST_MARKER = new RegExp(
  [
    'test(?:ing)?',
    'sample',
    'specimen',
    'void(?:ed)?',
    'dummy',
    'fake',
    'demo',
    'placeholder',
    'lorem ipsum',
    'not valid',
    'invalid',
    'not an? (?:official|valid|real) (?:document|paper|copy|certificate|permit)',
    'not for official use',
    'for (?:testing|training|demonstration) (?:purposes|only)',
    'template',
    'mock[- ]?up',
  ]
    .map((w) => `\\b${w}\\b`)
    .join('|'),
  'i',
);

/**
 * The standard notices a REAL paper prints, which are not test markers ("Not valid without the dry seal",
 * "Void if altered"). Removed before the marker scan so a genuine DTI certificate is not held for its own fine print.
 */
const STANDARD_NOTICES =
  /\b(?:not valid|invalid|void) (?:without|unless|if|when)\b[^.;\n]*|\bthis (?:certificate|permit) is not valid (?:without|unless)\b[^.;\n]*/gi;

/** A number nobody is issued: every digit the same, or the 123456789 run. */
function placeholderNumber(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const d = raw.replace(/\D+/g, '');
  // Checked on the whole number and on a TIN's 9-digit base (123-456-789-000 is the 123456789 run plus a branch code).
  return [d, d.slice(0, 9)].some((x) => x.length >= 5 && (/^(\d)\1+$/.test(x) || '1234567890'.includes(x) || '9876543210'.includes(x)));
}

/** The first test marker on the paper, as found — or null. */
export function testMarkerOn(model: ModelPaperRead): string | null {
  const texts = [
    ...(model.markings ?? []),
    model.accountName,
    model.ownerName,
    model.registrationNumber,
    model.issuer,
    model.address,
    model.readAs,
    model.tin,
  ];
  for (const t of texts) {
    if (!t) continue;
    const hit = TEST_MARKER.exec(t.replace(STANDARD_NOTICES, ' '));
    if (hit) return hit[0];
  }
  for (const n of [model.registrationNumber, model.tin]) if (placeholderNumber(n)) return n!;
  return null;
}

/** The lines each paper type always prints. A key here is a `ModelPaperRead` property, named for the person. */
type Line = { label: string; has: (m: ModelPaperRead) => boolean };
const name: Line = { label: 'the registered name', has: (m) => Boolean(m.accountName || m.ownerName) };
const num = (label: string): Line => ({ label, has: (m) => Boolean(m.registrationNumber) });
const address: Line = { label: 'the business address', has: (m) => Boolean(m.address) };
const validUntil: Line = { label: 'the valid-until date', has: (m) => Boolean(m.expirationDate) };

export const REQUIRED_LINES: Record<'dti' | 'sec' | 'bir' | 'lgu', readonly Line[]> = {
  // DTI Certificate of Business Name Registration: business name, owner, BN number, validity.
  dti: [
    { label: 'the business name', has: (m) => Boolean(m.accountName) },
    { label: "the owner's name", has: (m) => Boolean(m.ownerName) },
    num('the business name number'),
    validUntil,
  ],
  // SEC Certificate of Incorporation / Registration: the company and its registration number (no expiry).
  sec: [{ label: 'the company name', has: (m) => Boolean(m.accountName) }, num('the SEC registration number')],
  // BIR Form 2303: taxpayer, a real TIN shape, the registered address, the RDO code.
  bir: [
    name,
    { label: 'the TIN', has: (m) => /^(\d{9}|\d{12}|\d{14})$/.test((m.registrationNumber ?? '').replace(/[\s-]+/g, '')) },
    address,
    { label: 'the RDO code', has: (m) => Boolean(m.rdo) },
  ],
  // Mayor's / Business Permit: grantee, permit number, the city, the address, valid-until.
  lgu: [name, num('the permit number'), { label: 'the city or municipality', has: (m) => Boolean(m.city) }, address, validUntil],
};

/** The lines this paper type always prints that were NOT read. */
export function missingRequiredLines(model: ModelPaperRead): string[] {
  const r = model.registry;
  if (r !== 'dti' && r !== 'sec' && r !== 'bir' && r !== 'lgu') return ['the paper type'];
  return REQUIRED_LINES[r].filter((l) => !l.has(model)).map((l) => l.label);
}

/** Who must have issued each paper type. Matched on the folded issuer line, whole words. */
const ISSUER: Record<'dti' | 'sec' | 'bir' | 'lgu', RegExp> = {
  dti: /\bdepartment of trade and industry\b|\bdti\b/,
  sec: /\bsecurities and exchange commission\b|\bsec\b/,
  bir: /\bbureau of internal revenue\b|\bbir\b/,
  lgu: /\b(?:mayor|mayors|city government|municipal government|government of the (?:city|municipality)|city of [a-z]+|municipality of [a-z]+|business permits? and licens\w*|bplo|bpld|bplod|local government unit|lgu)\b/,
};

/** Words that make an issuer a private body, whatever else it says ("DTI Printing Services Inc."). */
const PRIVATE_BODY =
  /\b(?:inc|incorporated|corp|corporation|company|co|ltd|llc|opc|enterprises?|trading|printing|printers|school|academy|university|college|bank|store|shop|services?|studio|agency)\b/;

function foldIssuer(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Is the printed issuer the government body for this paper type? A missing issuer is not. */
export function issuerIsGovernmentFor(model: ModelPaperRead): boolean {
  const r = model.registry;
  if (r !== 'dti' && r !== 'sec' && r !== 'bir' && r !== 'lgu') return false;
  if (!model.issuer) return false;
  const f = foldIssuer(model.issuer);
  if (PRIVATE_BODY.test(f)) return false;
  return ISSUER[r].test(f);
}

const ISSUER_NAME: Record<'dti' | 'sec' | 'bir' | 'lgu', string> = {
  dti: 'the DTI',
  sec: 'the SEC',
  bir: 'the BIR',
  lgu: 'a city or municipal government',
};

/**
 * null = RECOGNISED. Otherwise one plain sentence saying why a person checks this paper instead.
 * Order: a test marker first (it outranks everything), then the paper type, the issuer, the missing lines.
 */
export function notRecognisedBecause(model: ModelPaperRead): string | null {
  const marker = testMarkerOn(model);
  if (marker) return `it is marked as a test or sample ("${marker.slice(0, 40)}")`;
  const r = model.registry;
  if (r !== 'dti' && r !== 'sec' && r !== 'bir' && r !== 'lgu') return 'it is not one of the three papers';
  if (!issuerIsGovernmentFor(model)) {
    return model.issuer
      ? `it was not issued by ${ISSUER_NAME[r]} ("${model.issuer.slice(0, 80)}")`
      : `no issuing office was read on it, so it cannot be shown to come from ${ISSUER_NAME[r]}`;
  }
  const missing = missingRequiredLines(model);
  if (missing.length > 0) return `it is missing ${missing.join(', ')}`;
  return null;
}

/** True only when the paper passes every rule above. */
export function isRecognisedRead(model: ModelPaperRead | null | undefined): model is ModelPaperRead {
  return Boolean(model) && notRecognisedBecause(model!) === null;
}
