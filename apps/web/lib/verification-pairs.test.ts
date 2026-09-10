import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CHECK_STATE_BUCKET,
  CHECK_STATE_SENTENCE,
  PAIR_CHECK_KEYS,
  PAIR_COLUMNS,
  VERIFICATION_PAIRS,
  deriveCheck,
  pairFieldLockedKey,
  parsePaperRead,
  tallyChecks,
  valuesAgree,
  type CheckState,
  type PairField,
  type PaperRead,
} from './verification-pairs';
import { LOCKED_IDENTITY_FIELD_KEYS } from './vendor-corrections';
import { DOC_SLOTS, REQUIRED_DOC_SLOT_KEYS, isSlotComplete } from './vendor-verification';

/**
 * Guards for "the paper beside the fields it proves".
 *
 * Every one of these is mutation-checked — break the guarded thing, the count
 * moves, the test goes red. The three that matter most are the ones that pin an
 * OWNER RULING rather than a behaviour: one registration slot (never a second
 * SEC one), the comparison anchored on the registered name (never the shop
 * name), and no legal-form question anywhere.
 */

const field = (over: Partial<PairField> = {}): PairField => ({
  key: 'registered_business_name',
  column: 'registered_business_name',
  label: 'Registered business name',
  ...over,
});

const read = (over: Partial<PaperRead> = {}): PaperRead => ({
  registry: 'dti',
  readAs: 'Read as a DTI Business Name certificate',
  notes: [],
  values: {},
  unreadable: [],
  registryOutcome: 'agreed',
  readAt: '2026-09-09T06:12:00.000Z',
  ...over,
});

/* ── The shape the drawing counts ───────────────────────────────────────── */

test('the page carries EIGHT checks across FOUR papers — the drawn number', () => {
  assert.equal(VERIFICATION_PAIRS.length, 4);
  assert.equal(PAIR_CHECK_KEYS.length, 8);
  assert.deepEqual(
    VERIFICATION_PAIRS.map((p) => p.fields.length),
    [3, 2, 2, 1],
  );
});

test('each of the six owner-named columns appears exactly once, and nothing else does', () => {
  const columns = VERIFICATION_PAIRS.flatMap((p) =>
    p.fields.map((f) => f.column).filter((c): c is NonNullable<typeof c> => c !== null),
  );
  assert.deepEqual([...columns].sort(), [...PAIR_COLUMNS].sort());
  assert.equal(new Set(columns).size, columns.length, 'a column is asked for twice');
});

test('OWNER RULING — the comparison anchors on the registered name, never the shop name', () => {
  const columns = VERIFICATION_PAIRS.flatMap((p) => p.fields.map((f) => f.column));
  assert.ok(
    !columns.includes('business_name' as never),
    'business_name must never be a check: a shop may legitimately trade under a different name than the one on its DTI certificate',
  );
  assert.ok(columns.includes('registered_business_name'));
  assert.ok(columns.includes('business_owner_name'));
});

test('OWNER RULING — DTI or SEC, never both: ONE registration paper, and it is the shipped slot', () => {
  const slots = VERIFICATION_PAIRS.map((p) => p.slotKey);
  assert.deepEqual(slots, [
    'dti_certificate',
    'bir_2303',
    'mayors_permit',
    'bank_account_proof',
  ]);
  // No second registration slot may appear anywhere in the checklist.
  const secLike = DOC_SLOTS.filter((s) => /(^|_)sec(_|$)/.test(s.key));
  assert.equal(secLike.length, 0, 'a separate SEC slot would force a supplier to choose a legal form');
  // The one slot must SAY it takes either, or an incorporated supplier is stuck.
  const reg = DOC_SLOTS.find((s) => s.key === 'dti_certificate');
  assert.ok(reg, 'the registration slot is gone');
  assert.match(reg.label, /SEC/i);
  assert.match(VERIFICATION_PAIRS[0]!.hint, /SEC/i);
  // Every pair must be a slot the submit gate already requires.
  for (const p of VERIFICATION_PAIRS) assert.ok(REQUIRED_DOC_SLOT_KEYS.has(p.slotKey));
});

test('OWNER RULING — the supplier is never asked to declare their legal form', () => {
  const copy = [
    ...VERIFICATION_PAIRS.map((p) => `${p.title} ${p.hint} ${p.why ?? ''}`),
    ...VERIFICATION_PAIRS.flatMap((p) => p.fields.map((f) => `${f.label} ${f.purpose ?? ''}`)),
  ].join(' ');
  // A question, not a mention: the hint may say "DTI or SEC" about the PAPER.
  for (const forbidden of [
    /sole proprietor/i,
    /are you (a|an) (corporation|partnership)/i,
    /legal form/i,
    /business structure/i,
    /select your registration type/i,
  ]) {
    assert.ok(!forbidden.test(copy), `the page asks the supplier their legal form: ${forbidden}`);
  }
  // And no field stores one.
  const columns = VERIFICATION_PAIRS.flatMap((p) => p.fields.map((f) => f.column ?? ''));
  assert.ok(!columns.some((c) => /legal_form|entity_type|registration_type/.test(c)));
});

/* ── The design's own instruction: never claim the QR was checked ────────── */

test('nothing on the page claims a QR was verified — the QR is a link anyone can print', () => {
  const here = new URL('.', import.meta.url).pathname;
  const files = [
    join(here, 'verification-pairs.ts'),
    join(here, '..', 'app', 'vendor-dashboard', 'shop', '_components', 'verify-pairs.tsx'),
  ];
  let scanned = 0;
  for (const f of files) {
    let src: string;
    try {
      src = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    scanned += 1;
    // Strip comments — a docblock EXPLAINING why we never say it is not a claim.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');
    for (const forbidden of [/QR\s+(verified|checked|confirmed)/i, /verified\s+(the\s+)?QR/i]) {
      assert.ok(!forbidden.test(stripped), `${f} claims the QR was checked`);
    }
  }
  assert.ok(scanned >= 2, `expected to scan both files, scanned ${scanned}`);
});

/* ── Locked fields are DERIVED, never hand-listed ────────────────────────── */

test('a locked identity column resolves from the shipped list, and only while verified', () => {
  const locked = VERIFICATION_PAIRS.flatMap((p) => p.fields).filter(
    (f) => f.column !== null && (LOCKED_IDENTITY_FIELD_KEYS as readonly string[]).includes(f.column),
  );
  // Measured 2026-09-10: business_owner_name and location_city are on that list.
  assert.deepEqual(
    locked.map((f) => f.column).sort(),
    ['business_owner_name', 'location_city'],
  );
  for (const f of locked) {
    assert.equal(pairFieldLockedKey(f, true), f.column);
    assert.equal(pairFieldLockedKey(f, false), null, 'an unverified shop types its own details');
  }
  for (const f of VERIFICATION_PAIRS.flatMap((p) => p.fields)) {
    if (f.column === null) assert.equal(pairFieldLockedKey(f, true), null);
  }
});

/* ── The state machine ──────────────────────────────────────────────────── */

test('no paper yet: a filled line reads "typed", an empty one "not sent" — never a problem', () => {
  assert.equal(
    deriveCheck({ field: field(), typedValue: 'ICASA ENTERPRISE', paperPresent: false, read: null }),
    'typed',
  );
  assert.equal(
    deriveCheck({ field: field(), typedValue: null, paperPresent: false, read: null }),
    'not_sent',
  );
  assert.equal(
    deriveCheck({ field: field(), typedValue: '   ', paperPresent: false, read: null }),
    'not_sent',
  );
});

test('paper in and nothing has read it → with a person. That is TODAY, everywhere.', () => {
  assert.equal(
    deriveCheck({ field: field(), typedValue: 'ICASA ENTERPRISE', paperPresent: true, read: null }),
    'with_a_person',
  );
  assert.equal(
    deriveCheck({ field: field(), typedValue: null, paperPresent: true, read: null }),
    'with_a_person',
  );
});

test('a line the reader could not make out parks with a person, and only that line', () => {
  const r = read({
    values: { registered_business_name: 'ICASA ENTERPRISE AUTO PARTS' },
    unreadable: ['business_owner_name'],
  });
  assert.equal(
    deriveCheck({
      field: field({ key: 'business_owner_name', column: 'business_owner_name' }),
      typedValue: 'Anything',
      paperPresent: true,
      read: r,
    }),
    'with_a_person',
  );
  assert.equal(
    deriveCheck({
      field: field(),
      typedValue: 'ICASA ENTERPRISE AUTO PARTS',
      paperPresent: true,
      read: r,
    }),
    'matched',
  );
});

test('a registry outage parks the registry-backed lines ONLY — never passes, never fails', () => {
  const r = read({
    registryOutcome: 'unreachable',
    values: { registered_business_name: 'X', tin_number: '123-456-789-000' },
  });
  assert.equal(
    deriveCheck({
      field: field({ registryBacked: true }),
      typedValue: 'X',
      paperPresent: true,
      read: r,
    }),
    'waiting_registry',
  );
  // The TIN is not a registry lookup — an outage must not freeze it.
  assert.equal(
    deriveCheck({
      field: field({ key: 'tin_number', column: 'tin_number' }),
      typedValue: '123-456-789-000',
      paperPresent: true,
      read: r,
    }),
    'matched',
  );
});

test('a value lifted off a photo with nothing typed beside it is NOT a match', () => {
  assert.equal(
    deriveCheck({
      field: field(),
      typedValue: null,
      paperPresent: true,
      read: read({ values: { registered_business_name: 'ICASA ENTERPRISE' } }),
    }),
    'with_a_person',
  );
});

test('a real difference is a mismatch the supplier can fix', () => {
  assert.equal(
    deriveCheck({
      field: field(),
      typedValue: 'ICASA OFFROAD',
      paperPresent: true,
      read: read({ values: { registered_business_name: 'ICASA ENTERPRISE AUTO PARTS' } }),
    }),
    'mismatch',
  );
});

test('folding forgives case, spacing and punctuation — and nothing else', () => {
  assert.ok(valuesAgree('123-456-789-000', '123 456 789 000'));
  assert.ok(valuesAgree('  Icasa   Enterprise ', 'ICASA ENTERPRISE'));
  assert.ok(valuesAgree('Maria Cristina L. Villanueva', 'MARIA CRISTINA L VILLANUEVA'));
  assert.ok(!valuesAgree('ICASA OFFROAD', 'ICASA ENTERPRISE'));
  assert.ok(!valuesAgree('123456789001', '123456789000'));
  assert.ok(!valuesAgree('', ''), 'two blanks are not an agreement');
  assert.ok(!valuesAgree('   ', 'ICASA'));
});

/* ── The tally ──────────────────────────────────────────────────────────── */

test('every state lands in exactly one bucket and the tally always sums to what it was given', () => {
  const all: CheckState[] = [
    'matched',
    'mismatch',
    'with_a_person',
    'waiting_registry',
    'typed',
    'not_sent',
  ];
  for (const s of all) assert.ok(CHECK_STATE_BUCKET[s], `${s} has no bucket`);
  const t = tallyChecks(all);
  assert.deepEqual(t, { matched: 1, to_fix: 1, with_person: 2, not_yet: 2 });
  assert.equal(Object.values(t).reduce((a, b) => a + b, 0), all.length);
  // A brand-new shop: eight not-sent, nothing else.
  const fresh = tallyChecks(PAIR_CHECK_KEYS.map(() => 'not_sent' as CheckState));
  assert.deepEqual(fresh, { matched: 0, to_fix: 0, with_person: 0, not_yet: 8 });
});

test('every state has a sentence, and none of them says "manual check"', () => {
  for (const [state, sentence] of Object.entries(CHECK_STATE_SENTENCE)) {
    assert.ok(sentence.trim().length > 0, `${state} has no sentence`);
    assert.ok(!/manual/i.test(sentence), `${state} says "manual"`);
  }
});

/* ── The seam ───────────────────────────────────────────────────────────── */

test('the seam is EMPTY today: a shipped slot value carries no read block', () => {
  assert.equal(parsePaperRead({ r2_key: 'r2://x', uploaded_at: '2026-09-09' }), null);
  assert.equal(parsePaperRead(null), null);
  assert.equal(parsePaperRead([{ r2_key: 'r2://x' }]), null);
  assert.equal(parsePaperRead('nonsense'), null);
});

test('a read block parses, and every hostile shape degrades instead of throwing', () => {
  const parsed = parsePaperRead({
    r2_key: 'r2://x',
    read: {
      registry: 'sec',
      readAs: 'Read as an SEC Certificate of Registration',
      notes: ['Registered 22 Apr 2019', 42],
      values: { registered_business_name: '  ICASA  ', nonsense_key: 'x', tin_number: 7 },
      unreadable: ['business_owner_name', 'not_a_field', 9],
      registryOutcome: 'not_found',
      readAt: '2026-09-09T06:12:00.000Z',
    },
  });
  assert.ok(parsed);
  assert.equal(parsed.registry, 'sec');
  assert.deepEqual(parsed.values, { registered_business_name: 'ICASA' });
  assert.deepEqual(parsed.unreadable, ['business_owner_name']);
  assert.deepEqual(parsed.notes, ['Registered 22 Apr 2019']);
  assert.equal(parsed.registryOutcome, 'not_found');

  // Unknown registry / outcome fall to the safe values, never to a claim.
  const junk = parsePaperRead({ read: { registry: 'made_up', registryOutcome: 'made_up' } });
  assert.ok(junk);
  assert.equal(junk.registry, 'unreadable');
  assert.equal(junk.registryOutcome, 'no_registry');
  assert.equal(junk.readAs, null);
});

test('a read block never changes whether the paper counts as sent', () => {
  // The seam rides beside r2_key inside doc_uploads, so completeness is
  // unmoved — an application carrying a read block behaves like one without.
  assert.equal(isSlotComplete('dti_certificate', { r2_key: 'r2://x' } as never), true);
  assert.equal(
    isSlotComplete('dti_certificate', { r2_key: 'r2://x', read: { registry: 'dti' } } as never),
    true,
  );
  assert.equal(isSlotComplete('dti_certificate', { read: { registry: 'dti' } } as never), false);
});
