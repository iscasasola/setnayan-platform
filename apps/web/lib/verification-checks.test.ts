/**
 * verification-checks.test.ts — the desk's rules, pinned.
 *
 * THREE PROPERTIES CARRY THE OWNER'S RULING AND ARE ASSERTED REPEATEDLY:
 *   1. **The unit is the check.** One broken thing never drags the others down.
 *   2. **A mismatch names both sides.** No result may say only "needs review".
 *   3. **Fail toward manual.** A source that did not answer is never a `pass`
 *      and never a `mismatch`.
 *
 * ⚠ These are written against SHAPES, not against prose. Asserting the exact
 * sentence would make every copy edit a red test and teach the next person to
 * regenerate the expectation — which is how a guard becomes decoration.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  grantWarning,
  resolveDocumentLocation,
  runVerificationChecks,
  sortForReview,
  summariseChecks,
  summaryLine,
  type CheckFacts,
  type CheckResult,
} from './verification-checks';
import {
  CLIENT_REFERENCES_MIN,
  PORTFOLIO_MAX,
  PORTFOLIO_MIN,
  REQUIRED_DOC_SLOT_KEYS,
} from './vendor-verification';

const NOW = new Date('2026-09-10T00:00:00.000Z');
const VENDOR = 'vp-this-shop';

/** A shop that has done everything a machine can confirm. */
function cleanFacts(over: Partial<CheckFacts> = {}): CheckFacts {
  const required = [...REQUIRED_DOC_SLOT_KEYS];
  return {
    vendorProfileId: VENDOR,
    businessName: 'Banawe Blooms',
    filedDocuments: required.map((slotKey) => ({
      slotKey,
      r2Key: `vendors/${VENDOR}/verification/${slotKey}.pdf`,
      existsInStorage: true,
      keyOwnerVendorId: VENDOR,
    })),
    completeSlotKeys: new Set([
      ...required,
      'portfolio_samples',
      'client_references',
      'social_media',
      'google_meet',
    ]),
    docUploadsUnreadable: false,
    storageUnreachable: false,
    storageNote: null,
    portfolioCount: 6,
    clientReferenceCount: CLIENT_REFERENCES_MIN,
    meetScheduledAt: '2026-09-02T04:00:00.000Z',
    registrationNumberRaw: '1234-5678-9012',
    registrationNumberDuplicate: false,
    registrationNumberHeldAlsoBy: [],
    registryAnswer: { kind: 'match', registeredName: 'Banawe Blooms' },
    contactEmail: 'hello@banaweblooms.ph',
    contactPhone: '+639170000000',
    hqAddress: '76 Sampaguita Avenue, Quezon City',
    contactEmailConfirmedAt: '2026-09-01T02:00:00.000Z',
    contactPhoneConfirmedAt: '2026-09-01T02:05:00.000Z',
    inBusinessSinceYear: 2019,
    experienceVerifiedAt: '2026-09-03T00:00:00.000Z',
    ...over,
  };
}

const byKey = (results: CheckResult[], key: string): CheckResult => {
  const r = results.find((x) => x.key === key);
  assert.ok(r, `expected a check named "${key}" — the desk lost one`);
  return r;
};

// ---------------------------------------------------------------------------
// 1 · THE UNIT IS THE CHECK
// ---------------------------------------------------------------------------

test('a shop with everything in comes back all clear', () => {
  const results = runVerificationChecks(cleanFacts(), NOW);
  const s = summariseChecks(results);
  assert.equal(s.mismatched, 0);
  assert.equal(s.manual, 0);
  assert.equal(s.allClear, true);
  assert.equal(s.passed, s.total);
});

test('ONE mismatch leaves every other check standing — four-fifths done stays done', () => {
  const clean = summariseChecks(runVerificationChecks(cleanFacts(), NOW));
  const results = runVerificationChecks(cleanFacts({ portfolioCount: 2 }), NOW);
  const s = summariseChecks(results);
  assert.equal(s.mismatched, 1, 'exactly one check should have moved');
  assert.equal(s.manual, 0, 'a bad portfolio count must not send anything else to a human');
  assert.equal(s.passed, clean.passed - 1);
  assert.equal(byKey(results, 'portfolio_count').outcome, 'mismatch');
  assert.equal(byKey(results, 'required_documents').outcome, 'pass');
  assert.equal(byKey(results, 'contact_validate').outcome, 'pass');
});

test('storage being down marks ONLY the storage check — it is not an opinion about the paperwork', () => {
  const results = runVerificationChecks(
    cleanFacts({
      storageUnreachable: true,
      storageNote: '504 from the bucket',
      filedDocuments: cleanFacts().filedDocuments.map((d) => ({ ...d, existsInStorage: null })),
    }),
    NOW,
  );
  const storage = byKey(results, 'documents_in_storage');
  assert.equal(storage.outcome, 'manual');
  assert.match(storage.reason ?? '', /504 from the bucket/);
  assert.equal(byKey(results, 'required_documents').outcome, 'pass');
  assert.equal(byKey(results, 'registration_number').outcome, 'pass');
  assert.equal(byKey(results, 'contact_validate').outcome, 'pass');
  assert.equal(summariseChecks(results).manual, 1);
});

test('"all manual" is a case, never a mode — it is simply every check landing on a person', () => {
  const results = runVerificationChecks(
    {
      vendorProfileId: VENDOR,
      businessName: null,
      filedDocuments: [],
      completeSlotKeys: new Set(),
      docUploadsUnreadable: true,
      storageUnreachable: true,
      storageNote: null,
      portfolioCount: null,
      clientReferenceCount: null,
      meetScheduledAt: null,
      registrationNumberRaw: null,
      registrationNumberDuplicate: false,
      registrationNumberHeldAlsoBy: [],
      registryAnswer: { kind: 'unreachable', note: '504' },
      contactEmail: 'a@b.c',
      contactPhone: '+63917',
      hqAddress: 'somewhere',
      contactEmailConfirmedAt: null,
      contactPhoneConfirmedAt: null,
      inBusinessSinceYear: null,
      experienceVerifiedAt: null,
    },
    NOW,
  );
  const s = summariseChecks(results);
  // `shop_reachable` still passes on this input, so allManual must be FALSE —
  // proving the flag is computed, not assumed from "lots of things are missing".
  assert.equal(byKey(results, 'shop_reachable').outcome, 'pass');
  assert.equal(s.allManual, false);
  assert.equal(s.mismatched, 0, 'not knowing is never a disagreement');
});

test('every check keeps a stable key, and the set does not silently shrink', () => {
  const results = runVerificationChecks(cleanFacts(), NOW);
  const keys = results.map((r) => r.key);
  assert.deepEqual(new Set(keys).size, keys.length, 'two checks share a key');
  for (const expected of [
    'required_documents',
    'documents_in_storage',
    'document_tenancy',
    'registration_number',
    'contact_validate',
    'portfolio_count',
    'client_references',
    'identity_meeting',
    'shop_reachable',
    'declared_experience',
  ]) {
    assert.ok(keys.includes(expected), `the "${expected}" check disappeared`);
  }
});

// ---------------------------------------------------------------------------
// 2 · A MISMATCH NAMES WHAT DISAGREED WITH WHAT
// ---------------------------------------------------------------------------

test('EVERY mismatch carries two named sides with two sources — never bare "needs review"', () => {
  const scenarios: Array<Partial<CheckFacts>> = [
    { completeSlotKeys: new Set(['portfolio_samples']) },
    {
      filedDocuments: [
        {
          slotKey: 'bir_2303',
          r2Key: `vendors/${VENDOR}/verification/bir_2303.pdf`,
          existsInStorage: false,
          keyOwnerVendorId: VENDOR,
        },
      ],
    },
    {
      filedDocuments: [
        {
          slotKey: 'mayors_permit',
          r2Key: 'vendors/vp-some-other-shop/verification/mayors_permit.pdf',
          existsInStorage: true,
          keyOwnerVendorId: 'vp-some-other-shop',
        },
      ],
    },
    { registrationNumberDuplicate: true, registrationNumberHeldAlsoBy: ['Riverside Catering'] },
    { contactPhoneConfirmedAt: null },
    { portfolioCount: PORTFOLIO_MAX + 3 },
    { clientReferenceCount: 1 },
    { contactPhone: null, hqAddress: null },
    { inBusinessSinceYear: 2031 },
    { registryAnswer: { kind: 'no_match' } },
  ];
  let seen = 0;
  for (const over of scenarios) {
    const results = runVerificationChecks(cleanFacts(over), NOW);
    const mismatches = results.filter((r) => r.outcome === 'mismatch');
    assert.ok(mismatches.length > 0, `scenario produced no mismatch: ${JSON.stringify(over)}`);
    for (const m of mismatches) {
      seen++;
      assert.ok(m.disagreement, `${m.key} is a mismatch with nothing to compare`);
      for (const side of [m.disagreement!.left, m.disagreement!.right]) {
        assert.ok(side.label.trim().length > 3, `${m.key}: a side has no label`);
        assert.ok(side.value.trim().length > 0, `${m.key}: a side has no value`);
        assert.ok(side.source.trim().length > 3, `${m.key}: a side does not say where it came from`);
      }
      assert.notEqual(
        m.disagreement!.left.value,
        m.disagreement!.right.value,
        `${m.key}: both sides say the same thing, so nothing disagreed`,
      );
      assert.ok(m.detail.trim().length > 0, `${m.key}: a mismatch with no sentence`);
    }
  }
  assert.ok(seen >= scenarios.length, 'fewer findings than scenarios');
});

test('the duplicate registration number names the OTHER shop, not just "duplicate"', () => {
  const results = runVerificationChecks(
    cleanFacts({
      registrationNumberRaw: '1234-5678-9012',
      registrationNumberDuplicate: true,
      registrationNumberHeldAlsoBy: ['Riverside Catering'],
    }),
    NOW,
  );
  const r = byKey(results, 'registration_number');
  assert.equal(r.outcome, 'mismatch');
  assert.match(r.disagreement!.left.value, /1234-5678-9012/);
  assert.match(r.disagreement!.right.value, /Riverside Catering/);
});

test('a duplicate whose other shop could not be named still says a duplicate exists', () => {
  const r = byKey(
    runVerificationChecks(
      cleanFacts({ registrationNumberDuplicate: true, registrationNumberHeldAlsoBy: [] }),
      NOW,
    ),
    'registration_number',
  );
  assert.equal(r.outcome, 'mismatch', 'an unreadable name must not downgrade the flag');
  assert.match(r.disagreement!.right.value, /another shop/i);
});

test('a document filed under another shop names both shops', () => {
  const r = byKey(
    runVerificationChecks(
      cleanFacts({
        filedDocuments: [
          {
            slotKey: 'dti_certificate',
            r2Key: 'vendors/vp-someone-else/verification/dti_certificate.pdf',
            existsInStorage: true,
            keyOwnerVendorId: 'vp-someone-else',
          },
        ],
      }),
      NOW,
    ),
    'document_tenancy',
  );
  assert.equal(r.outcome, 'mismatch');
  // The shop is named by its NAME, not its internal id — this desk is read by
  // the owner, who does not read the schema. The OTHER shop is all we have an
  // id for, and a reviewer chasing a misfiled permit needs something to chase.
  assert.match(r.disagreement!.left.value, /Banawe Blooms/);
  assert.match(r.disagreement!.right.value, /vp-someone-else/);
});

test('one confirmed channel and one silent one is a MISMATCH, both silent is MANUAL', () => {
  const half = byKey(
    runVerificationChecks(cleanFacts({ contactPhoneConfirmedAt: null }), NOW),
    'contact_validate',
  );
  assert.equal(half.outcome, 'mismatch');
  assert.match(half.disagreement!.right.value, /never/i);

  const neither = byKey(
    runVerificationChecks(
      cleanFacts({ contactEmailConfirmedAt: null, contactPhoneConfirmedAt: null }),
      NOW,
    ),
    'contact_validate',
  );
  assert.equal(neither.outcome, 'manual', 'nothing attempted is not a disagreement');
  assert.equal(neither.disagreement, undefined);
});

// ---------------------------------------------------------------------------
// 3 · FAIL TOWARD MANUAL — never pass, never fail the others
// ---------------------------------------------------------------------------

test('a storage probe that did not answer is never read as "the file is gone"', () => {
  const unknown = byKey(
    runVerificationChecks(
      cleanFacts({
        filedDocuments: [
          {
            slotKey: 'bir_2303',
            r2Key: `vendors/${VENDOR}/verification/bir_2303.pdf`,
            existsInStorage: null,
            keyOwnerVendorId: VENDOR,
          },
        ],
      }),
      NOW,
    ),
    'documents_in_storage',
  );
  assert.equal(unknown.outcome, 'manual');
  assert.notEqual(unknown.outcome, 'mismatch');
});

test('an unreadable checklist reports "could not read", never "nothing filed"', () => {
  const results = runVerificationChecks(cleanFacts({ docUploadsUnreadable: true }), NOW);
  const req = byKey(results, 'required_documents');
  assert.equal(req.outcome, 'manual', 'an unreadable map must not look like an empty one');
  assert.match(req.reason ?? '', /could not be read/i);
});

test('a registry that did not answer marks its own check manual and passes nothing', () => {
  for (const answer of [
    { kind: 'unreachable' as const, note: '504 Gateway Timeout' },
    { kind: 'not_attempted' as const, note: 'No lookup is connected yet.' },
  ]) {
    const r = byKey(runVerificationChecks(cleanFacts({ registryAnswer: answer }), NOW), 'registration_number');
    assert.equal(r.outcome, 'manual', `${answer.kind} must not pass`);
    assert.ok((r.reason ?? '').length > 10);
  }
});

test('a registry 504 does not become a mismatch — an outage has no opinion about this shop', () => {
  const r = byKey(
    runVerificationChecks(
      cleanFacts({ registryAnswer: { kind: 'unreachable', note: '504' } }),
      NOW,
    ),
    'registration_number',
  );
  assert.notEqual(r.outcome, 'mismatch');
});

test('the identity call is marked as always a person, not as an outage', () => {
  const results = runVerificationChecks(cleanFacts({ meetScheduledAt: null }), NOW);
  const meet = byKey(results, 'identity_meeting');
  assert.equal(meet.outcome, 'manual');
  assert.equal(meet.alwaysHuman, true);
});

test('reading the number off a certificate is always-human while no registry is wired', () => {
  const r = byKey(
    runVerificationChecks(
      cleanFacts({ registryAnswer: { kind: 'not_attempted', note: 'No lookup is connected yet.' } }),
      NOW,
    ),
    'registration_number',
  );
  assert.equal(r.outcome, 'manual');
  assert.equal(r.alwaysHuman, true);
});

test('a correct reference COUNT passes — the check is the count, and the call is the meeting', () => {
  // An earlier draft returned `manual` here to remember that Setnayan rings a
  // reference, which made a correct count permanently un-passable and put a
  // mark on every clean application forever. A check nobody can satisfy is a
  // gate with no handle; this pins the correction.
  const refs = byKey(runVerificationChecks(cleanFacts(), NOW), 'client_references');
  assert.equal(refs.outcome, 'pass');
  assert.match(refs.detail, /ring/i, 'the pass must still tell the reviewer to make the call');
  assert.equal(
    summariseChecks(runVerificationChecks(cleanFacts(), NOW)).allClear,
    true,
    'a fully-satisfied shop must be able to reach all-clear',
  );
});

test('a transient manual mark is NOT flagged as always-human — the two must stay tellable apart', () => {
  const storage = byKey(
    runVerificationChecks(
      cleanFacts({
        storageUnreachable: true,
        storageNote: 'timeout',
        filedDocuments: cleanFacts().filedDocuments.map((d) => ({ ...d, existsInStorage: null })),
      }),
      NOW,
    ),
    'documents_in_storage',
  );
  assert.equal(storage.outcome, 'manual');
  assert.notEqual(storage.alwaysHuman, true);
});

test('every manual result says WHY, and no result is left speechless', () => {
  const facts = [
    cleanFacts(),
    cleanFacts({ docUploadsUnreadable: true }),
    cleanFacts({ portfolioCount: null, clientReferenceCount: null }),
    cleanFacts({ registrationNumberRaw: null, inBusinessSinceYear: null }),
  ];
  for (const f of facts) {
    for (const r of runVerificationChecks(f, NOW)) {
      assert.ok(r.detail.trim().length > 0, `${r.key} has no sentence`);
      if (r.outcome === 'manual') {
        assert.ok((r.reason ?? '').trim().length > 10, `${r.key} is manual with no reason`);
      }
    }
  }
});

test('a rule that throws is caught as manual and does not take the other checks down', () => {
  const poisoned = cleanFacts();
  // A getter that throws is the shape a malformed JSONB read produces.
  Object.defineProperty(poisoned, 'portfolioCount', {
    get() {
      throw new Error('boom');
    },
  });
  const results = runVerificationChecks(poisoned, NOW);
  assert.ok(results.length >= 10, 'the run stopped early');
  assert.ok(
    results.some((r) => r.outcome === 'manual' && /threw/i.test(r.reason ?? '')),
    'the throwing rule was not caught as manual',
  );
  assert.equal(byKey(results, 'required_documents').outcome, 'pass');
});

// ---------------------------------------------------------------------------
// The reviewer's reading order + what the grant button is told
// ---------------------------------------------------------------------------

test('mismatches sort above the human pile, which sorts above what is already clear', () => {
  const results = runVerificationChecks(
    cleanFacts({ portfolioCount: 1, meetScheduledAt: null }),
    NOW,
  );
  const order = sortForReview(results).map((r) => r.outcome);
  const firstPass = order.indexOf('pass');
  const lastMismatch = order.lastIndexOf('mismatch');
  const lastManual = order.lastIndexOf('manual');
  assert.ok(lastMismatch < order.indexOf('manual'), 'a mismatch sank below a manual mark');
  assert.ok(lastManual < firstPass, 'a clear check floated above one needing a person');
});

test('the summary line states the split and never a verdict', () => {
  const clean = summaryLine(summariseChecks(runVerificationChecks(cleanFacts(), NOW)));
  assert.match(clean, /clear/i);
  const mixed = summaryLine(
    summariseChecks(runVerificationChecks(cleanFacts({ portfolioCount: 1, meetScheduledAt: null }), NOW)),
  );
  assert.match(mixed, /mismatch/i);
  assert.match(mixed, /for you/i);
  for (const line of [clean, mixed]) {
    assert.doesNotMatch(line, /ready to approve|safe to approve|looks good/i);
  }
});

test('the grant button is warned when anything is unchecked, and left silent when nothing is', () => {
  assert.equal(grantWarning(summariseChecks(runVerificationChecks(cleanFacts(), NOW))), null);

  const withMismatch = grantWarning(
    summariseChecks(runVerificationChecks(cleanFacts({ portfolioCount: 1 }), NOW)),
  );
  assert.ok(withMismatch);
  assert.match(withMismatch!, /disagrees|disagree/);

  const withManual = grantWarning(
    summariseChecks(runVerificationChecks(cleanFacts({ meetScheduledAt: null }), NOW)),
  );
  assert.ok(withManual);
  assert.match(withManual!, /not been decided/i);
});

test('a shop with NO checks at all is warned that the badge rests on the reviewer alone', () => {
  const warning = grantWarning(summariseChecks([]));
  assert.ok(warning);
  assert.match(warning!, /no automatic checks/i);
});

test('the portfolio range in the message is the shipped range, not a re-typed pair', () => {
  const r = byKey(runVerificationChecks(cleanFacts({ portfolioCount: 1 }), NOW), 'portfolio_count');
  assert.match(r.disagreement!.left.value, new RegExp(`${PORTFOLIO_MIN}.{0,3}${PORTFOLIO_MAX}`));
});

// ---------------------------------------------------------------------------
// WHERE A FILED DOCUMENT LIVES — the bug that would have been the loudest
// ---------------------------------------------------------------------------

/**
 * 🔴 The first cut of the storage probe HEADed a HARDCODED verification bucket
 * with the whole `r2://…` string as the key. `doc_uploads` holds a REFERENCE,
 * and the vendor-side writer accepts TWO buckets — the private one for the four
 * documents, the PUBLIC media one for portfolio samples. Every document of
 * every application would have come back "no object — nothing is stored there".
 * Not a missed finding: a LOUD INVENTED ONE, on every row.
 */
const BUCKETS = [
  'setnayan-media',
  'setnayan-thread-files',
  'setnayan-vendor-contracts',
  'setnayan-samples',
  'setnayan-vendor-verification',
];
const FALLBACK = 'setnayan-vendor-verification';

test('a stored reference is read for its OWN bucket, not a guessed one', () => {
  assert.deepEqual(
    resolveDocumentLocation(
      'r2://setnayan-vendor-verification/vendors/vp-1/verification/dti.pdf',
      BUCKETS,
      FALLBACK,
    ),
    { kind: 'r2', bucket: 'setnayan-vendor-verification', key: 'vendors/vp-1/verification/dti.pdf' },
  );
  // The portfolio case — a DIFFERENT bucket, and the one a hardcoded constant
  // would have got wrong on every single row.
  assert.deepEqual(
    resolveDocumentLocation('r2://setnayan-media/vendors/vp-1/portfolio/shot.jpg', BUCKETS, FALLBACK),
    { kind: 'r2', bucket: 'setnayan-media', key: 'vendors/vp-1/portfolio/shot.jpg' },
  );
});

test('the resolved key never carries the r2:// prefix — that is what made the key wrong', () => {
  const where = resolveDocumentLocation(
    'r2://setnayan-media/vendors/vp-1/portfolio/shot.jpg',
    BUCKETS,
    FALLBACK,
  );
  assert.equal(where.kind, 'r2');
  assert.doesNotMatch((where as { key: string }).key, /^r2:\/\//);
});

test('a bare verification path is accepted; anything else is not a file we hold', () => {
  assert.deepEqual(
    resolveDocumentLocation('vendors/vp-1/verification/bir.pdf', BUCKETS, FALLBACK),
    { kind: 'r2', bucket: FALLBACK, key: 'vendors/vp-1/verification/bir.pdf' },
  );
  for (const v of [
    'https://example.com/a.pdf',
    '',
    '   ',
    'r2://',
    'r2://setnayan-media',
    'some/other/path.pdf',
  ]) {
    assert.equal(
      resolveDocumentLocation(v, BUCKETS, FALLBACK).kind,
      'not_a_file',
      `"${v}" was read as a file we hold`,
    );
  }
});

test('an UNKNOWN bucket is never probed against a guessed one', () => {
  // Guessing here is exactly the mistake: it would HEAD a real bucket for a key
  // that was never in it and report the file as missing.
  assert.equal(
    resolveDocumentLocation('r2://somebody-elses-bucket/vendors/vp-1/x.pdf', BUCKETS, FALLBACK).kind,
    'not_a_file',
  );
});

test('an unprobeable reference is MANUAL, never a mismatch', () => {
  const r = byKey(
    runVerificationChecks(
      cleanFacts({
        filedDocuments: [
          {
            slotKey: 'dti_certificate',
            r2Key: 'https://example.com/somebodys-link.pdf',
            existsInStorage: null,
            keyOwnerVendorId: null,
          },
        ],
      }),
      NOW,
    ),
    'documents_in_storage',
  );
  assert.equal(r.outcome, 'manual');
});

// ---------------------------------------------------------------------------
// THE REVIEWER IS THE OWNER — the desk speaks to a person, not to a schema
// ---------------------------------------------------------------------------

/**
 * 🗣 The house rule for anything the owner reads: say what a PERSON
 * experiences — no table names, no column names, no flag names. He steers the
 * product and does not read the code, and a correct answer he cannot act on is
 * worth the same as a wrong one.
 *
 * This desk is a screen HE uses, so the rule applies to every string it draws.
 * The first cut told him a value came "from
 * vendor_verification_applications.contact_email_confirmed_at". The repo's
 * engineering-notes lint passed on it, because that lint has a different job —
 * ⚠ a guard being green is not the same as a rule being kept.
 */
const SCHEMA_WORDS = [
  'vendor_profiles',
  'vendor_verification_applications',
  'vendor_verification_bypasses',
  'doc_uploads',
  'public_visibility',
  'verification_state',
  'registration_number_raw',
  'registration_number_needs_review',
  'contact_email_confirmed_at',
  'contact_phone_confirmed_at',
  'in_business_since_year',
  'experience_verified_at',
  'r2_key',
];

/** Every string this module puts in front of a person, for one set of facts. */
function renderedStrings(facts: CheckFacts): string[] {
  const out: string[] = [];
  const results = runVerificationChecks(facts, NOW);
  for (const r of results) {
    out.push(r.label, r.detail);
    if (r.reason) out.push(r.reason);
    if (r.disagreement) {
      for (const side of [r.disagreement.left, r.disagreement.right]) {
        out.push(side.label, side.value, side.source);
      }
    }
  }
  out.push(summaryLine(summariseChecks(results)));
  const w = grantWarning(summariseChecks(results));
  if (w) out.push(w);
  return out;
}

test('nothing the desk draws names a table, a column, or a flag', () => {
  const batteries: Array<Partial<CheckFacts>> = [
    {},
    { completeSlotKeys: new Set() },
    { contactPhoneConfirmedAt: null },
    { contactEmailConfirmedAt: null, contactPhoneConfirmedAt: null },
    { registrationNumberDuplicate: true, registrationNumberHeldAlsoBy: ['Riverside Catering'] },
    { registryAnswer: { kind: 'no_match' } },
    { registryAnswer: { kind: 'unreachable', note: '504 Gateway Timeout' } },
    { portfolioCount: 0, clientReferenceCount: 0 },
    { contactPhone: null, hqAddress: null, contactEmail: null },
    { inBusinessSinceYear: 2031 },
    { docUploadsUnreadable: true },
    { storageUnreachable: true, storageNote: 'connection reset' },
    {
      filedDocuments: [
        {
          slotKey: 'dti_certificate',
          r2Key: 'r2://setnayan-vendor-verification/vendors/vp-other/verification/dti.pdf',
          existsInStorage: false,
          keyOwnerVendorId: 'vp-other',
        },
      ],
    },
  ];
  let checked = 0;
  for (const over of batteries) {
    for (const line of renderedStrings(cleanFacts(over))) {
      checked++;
      for (const word of SCHEMA_WORDS) {
        assert.ok(
          !line.includes(word),
          `the desk shows the owner a schema name: "${word}" in — ${line}`,
        );
      }
      // The generic shape too, so a column this list has never heard of is
      // still caught. A stored file path is exempt: `vendors/x/verification/
      // dti.pdf` is genuinely where the file is, and a reviewer chasing a
      // missing document wants it.
      const withoutPaths = line.replace(/\S*\/\S*/g, ' ');
      assert.doesNotMatch(
        withoutPaths,
        /\b[a-z]+_[a-z_]+\.[a-z_]+\b/,
        `the desk shows the owner a table.column: ${line}`,
      );
    }
  }
  // 🔑 THE FLOOR IS THE GUARD ON THE GUARD. Without it, thinning this battery
  // to one entry makes the whole test pass on almost nothing — measured: 13
  // entries down to 1, still green. Proved by mutation, not assumed.
  assert.ok(checked > 300, `only ${checked} strings were checked — the battery has gone thin`);
});
