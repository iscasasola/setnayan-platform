/**
 * verification-checks.ts — THE UNIT IS THE CHECK, NOT THE APPLICATION.
 *
 * ── THE OWNER'S RULING (2026-09-09) ─────────────────────────────────────────
 * *"we need to be informed which on the verification needs manual checking. the
 * rest will be automatic unless all needs manual. we want an automation to also
 * tell us if there are mismatches."*
 *
 * Four clean checks and one mismatch is FOUR-FIFTHS DONE — the reviewer opens
 * only the fifth. "All manual" is not a mode; it is simply the case where every
 * check happened to land on a human. Nothing in this file has a whole-of-
 * application verdict, on purpose: the moment one exists, somebody reads it and
 * stops looking at the five results underneath it.
 *
 * ── A FAILING CHECK NAMES WHAT DISAGREED WITH WHAT ──────────────────────────
 * `mismatch` carries two sides, each with its own VALUE and its own SOURCE. Not
 * "needs review" — a reviewer handed "needs review" has to redo the whole check
 * to find out what the machine already knew. `left` is what verification
 * expects; `right` is what this shop actually filed.
 *
 * ── FAIL TOWARD MANUAL, PER CHECK ───────────────────────────────────────────
 * Unreadable, undecidable, or a source that did not answer marks THAT check
 * `manual` — never `pass`, and never a failure of the other four. A registry
 * 504 (measured twice on 2026-09-09; unreachable is a NORMAL condition for the
 * DTI lookup) is a manual mark on the registration check and has no opinion
 * about the bank proof. `manual` is therefore three different things wearing
 * one label, and the `reason` string is what tells them apart.
 *
 * 🔑 `alwaysHuman` separates *"we tried and could not tell"* from *"a person
 * was always going to have to do this one"* (the 15-minute Meet; reading a name
 * off the face of a permit). Without it, a reviewer learns to skim every manual
 * mark, including the transient ones that mean something is broken.
 *
 * PURE — no DB, no network, no `server-only`. Every fact arrives in
 * `CheckFacts`, which is what makes each rule testable and what lets the server
 * half degrade one read without touching the rest.
 */

import {
  CLIENT_REFERENCES_MAX,
  CLIENT_REFERENCES_MIN,
  PORTFOLIO_MAX,
  PORTFOLIO_MIN,
  REQUIRED_DOC_SLOT_KEYS,
  type DocSlot,
  DOC_SLOTS,
} from '@/lib/vendor-verification';

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export type CheckOutcome = 'pass' | 'mismatch' | 'manual';

/** One half of a named disagreement: a value, and where it came from. */
export type CheckSide = {
  /** What this side IS, in the reviewer's words ("What verification requires"). */
  label: string;
  /** The value itself, already rendered as text. Never null — use a phrase. */
  value: string;
  /** Where it was read from, precisely enough to go and look. */
  source: string;
};

export type CheckResult = {
  /** Stable key — the UI, the audit row and the tests all address a check by it. */
  key: string;
  /** What this check asks, as a reviewer would say it. */
  label: string;
  outcome: CheckOutcome;
  /** One line stating the finding. Present on every outcome, including `pass`. */
  detail: string;
  /** Only on `mismatch`: the two values, side by side, each with its source. */
  disagreement?: { left: CheckSide; right: CheckSide };
  /** Only on `manual`: why the machine could not decide. */
  reason?: string;
  /**
   * Only on `manual`: TRUE when this was never automatable in the first place
   * (a meeting; reading a name off a permit). FALSE means something did not
   * answer and may answer next time — which is a different thing to chase.
   */
  alwaysHuman?: boolean;
  /** The checklist slot this check speaks about, when it speaks about one. */
  slotKey?: string;
};

export type CheckSummary = {
  total: number;
  passed: number;
  mismatched: number;
  manual: number;
  /** Every single check landed on a human. Not a mode — just this case. */
  allManual: boolean;
  /** No check found a disagreement AND no check needed a human. */
  allClear: boolean;
};

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

/** One document the shop has filed, as the storage probe found it. */
export type FiledDocument = {
  slotKey: string;
  /** The R2 key recorded in `doc_uploads`. */
  r2Key: string;
  /**
   * Did an object actually exist at that key?
   * `null` means STORAGE DID NOT ANSWER — never "no". The difference decides
   * whether this is a mismatch or a manual mark.
   */
  existsInStorage: boolean | null;
  /**
   * The vendor id the key itself is filed under, parsed from its path.
   * `null` when the key does not match the uploaders' shape at all.
   */
  keyOwnerVendorId: string | null;
};

/** What a business-registry lookup came back with, when one was attempted. */
export type RegistryAnswer =
  | { kind: 'match'; registeredName: string }
  | { kind: 'no_match' }
  /** The registry did not answer — a 504, a timeout, a rate limit. NORMAL. */
  | { kind: 'unreachable'; note: string }
  /** Nobody asked. No lookup is wired for this registry yet. */
  | { kind: 'not_attempted'; note: string };

export type CheckFacts = {
  vendorProfileId: string;
  businessName: string | null;

  /** Every slot that carries something, with its storage probe result. */
  filedDocuments: FiledDocument[];
  /**
   * Slot keys the shop has filled in a way `isSlotComplete` accepts, including
   * the structured slots that carry no R2 key at all.
   */
  completeSlotKeys: ReadonlySet<string>;
  /**
   * TRUE when the `doc_uploads` map itself could not be read/parsed. Every
   * document-shaped check then goes manual rather than reporting "nothing filed",
   * which is what an unreadable map looks like from the outside.
   */
  docUploadsUnreadable: boolean;
  /** TRUE when the storage probe could not run at all (R2 unconfigured/down). */
  storageUnreachable: boolean;
  storageNote: string | null;

  portfolioCount: number | null;
  clientReferenceCount: number | null;
  /** `scheduled_at` on the google_meet slot, when stamped. */
  meetScheduledAt: string | null;

  registrationNumberRaw: string | null;
  /** The anti-farm flag: this number normalises onto another shop's. */
  registrationNumberDuplicate: boolean;
  /** The other shop(s) holding the same normalised number, when known. */
  registrationNumberHeldAlsoBy: string[];
  registryAnswer: RegistryAnswer;

  contactEmail: string | null;
  contactPhone: string | null;
  hqAddress: string | null;
  contactEmailConfirmedAt: string | null;
  contactPhoneConfirmedAt: string | null;

  inBusinessSinceYear: number | null;
  experienceVerifiedAt: string | null;
};

// ---------------------------------------------------------------------------
// Where a filed document actually lives
// ---------------------------------------------------------------------------

/**
 * Where one `doc_uploads` value points, resolved from the value itself.
 *
 * 🔴 THE BUG THIS EXISTS TO PREVENT, CAUGHT BEFORE IT SHIPPED. The first cut of
 * the storage probe HEADed a HARDCODED `setnayan-vendor-verification` with the
 * stored string as the key. But `doc_uploads` holds an `r2://bucket/key`
 * REFERENCE, and the vendor-side writer accepts TWO buckets: the private
 * verification one for the four documents, and the PUBLIC media bucket for
 * portfolio samples (`vendor-portfolio-ref-tenancy.test.ts`: *"a portfolio is
 * public by definition"*). So the probe would have looked for every file under
 * the wrong name, in the wrong bucket, and reported **"no object — nothing is
 * stored there" on every document of every application.**
 *
 * 🔑 That is the worst failure this desk could have: not a missed finding, but a
 * LOUD INVENTED ONE, on every row, in the automation the reviewer is being asked
 * to trust. **Read the bucket out of the value; never assume one.**
 */
export type DocumentLocation =
  | { kind: 'r2'; bucket: string; key: string }
  /** A plain link or an unrecognised shape — we hold no file to look for. */
  | { kind: 'not_a_file'; value: string };

export function resolveDocumentLocation(
  storedValue: string,
  knownBuckets: readonly string[],
  fallbackBucket: string,
): DocumentLocation {
  const v = storedValue.trim();
  if (!v) return { kind: 'not_a_file', value: storedValue };
  if (v.startsWith('r2://')) {
    const rest = v.slice('r2://'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0 || slash === rest.length - 1) return { kind: 'not_a_file', value: v };
    const bucket = rest.slice(0, slash);
    const key = rest.slice(slash + 1);
    // An unknown bucket is NOT probed against a guessed one — that is how the
    // hardcoded-bucket bug produced a confident wrong answer.
    if (!knownBuckets.includes(bucket)) return { kind: 'not_a_file', value: v };
    return { kind: 'r2', bucket, key };
  }
  // A BARE key is legal too: the vendor-side writer lets a non-`r2://` value
  // through, and the storage-hygiene page's own classifier assumes exactly this
  // shape. Only accept it when it looks like one of our verification paths.
  if (/^vendors\/[^/]+\/verification\//.test(v)) {
    return { kind: 'r2', bucket: fallbackBucket, key: v };
  }
  return { kind: 'not_a_file', value: v };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function pass(key: string, label: string, detail: string, slotKey?: string): CheckResult {
  return { key, label, outcome: 'pass', detail, slotKey };
}

function manual(
  key: string,
  label: string,
  detail: string,
  reason: string,
  opts?: { alwaysHuman?: boolean; slotKey?: string },
): CheckResult {
  return {
    key,
    label,
    outcome: 'manual',
    detail,
    reason,
    alwaysHuman: opts?.alwaysHuman ?? false,
    slotKey: opts?.slotKey,
  };
}

function mismatch(
  key: string,
  label: string,
  detail: string,
  left: CheckSide,
  right: CheckSide,
  slotKey?: string,
): CheckResult {
  return { key, label, outcome: 'mismatch', detail, disagreement: { left, right }, slotKey };
}

function slotLabel(slotKey: string): string {
  const slot: DocSlot | undefined = DOC_SLOTS.find((s) => s.key === slotKey);
  return slot?.label ?? slotKey;
}

function list(items: readonly string[]): string {
  if (items.length === 0) return 'none';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]!}`;
}

/** The four documents verification cannot proceed without, in slot order. */
const REQUIRED_KEYS_IN_ORDER: readonly string[] = DOC_SLOTS.filter((s) =>
  REQUIRED_DOC_SLOT_KEYS.has(s.key),
).map((s) => s.key);

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

function checkRequiredDocuments(f: CheckFacts): CheckResult {
  const key = 'required_documents';
  const label = 'The four required documents are on file';
  if (f.docUploadsUnreadable) {
    return manual(
      key,
      label,
      'The checklist could not be read.',
      'The stored checklist could not be read, so "nothing filed" and "we could not look" are the same value here. Open the application and check by hand.',
    );
  }
  const missing = REQUIRED_KEYS_IN_ORDER.filter((k) => !f.completeSlotKeys.has(k));
  if (missing.length === 0) {
    return pass(key, label, `All ${REQUIRED_KEYS_IN_ORDER.length} required documents are filed.`);
  }
  const filed = REQUIRED_KEYS_IN_ORDER.length - missing.length;
  return mismatch(
    key,
    label,
    `${filed} of ${REQUIRED_KEYS_IN_ORDER.length} required documents are filed — missing ${list(
      missing.map(slotLabel),
    )}.`,
    {
      label: 'What verification requires',
      value: list(REQUIRED_KEYS_IN_ORDER.map(slotLabel)),
      source: 'The verification checklist (the four documents a shop cannot be verified without)',
    },
    {
      label: 'What this shop filed',
      value:
        filed === 0
          ? 'none of them'
          : list(REQUIRED_KEYS_IN_ORDER.filter((k) => f.completeSlotKeys.has(k)).map(slotLabel)),
      source: "This application's own checklist",
    },
  );
}

function checkDocumentsInStorage(f: CheckFacts): CheckResult {
  const key = 'documents_in_storage';
  const label = 'Every filed document is really there';
  if (f.docUploadsUnreadable) {
    return manual(key, label, 'The checklist could not be read.', 'Nothing to probe — the checklist itself was unreadable.');
  }
  if (f.filedDocuments.length === 0) {
    return manual(
      key,
      label,
      'No document files are filed yet.',
      'There is nothing filed to look for. This becomes automatic the moment a document is uploaded.',
    );
  }
  if (f.storageUnreachable) {
    return manual(
      key,
      label,
      `${f.filedDocuments.length} document${f.filedDocuments.length === 1 ? '' : 's'} filed; storage did not answer.`,
      f.storageNote
        ? `Storage did not answer (${f.storageNote}). Absence of an answer is not absence of the file — open each document by hand.`
        : 'Storage did not answer. Absence of an answer is not absence of the file — open each document by hand.',
    );
  }
  const gone = f.filedDocuments.filter((d) => d.existsInStorage === false);
  const unknown = f.filedDocuments.filter((d) => d.existsInStorage === null);
  if (gone.length > 0) {
    return mismatch(
      key,
      label,
      `${gone.length} filed document${gone.length === 1 ? ' has' : 's have'} no file behind ${gone.length === 1 ? 'it' : 'them'}.`,
      {
        label: 'What the checklist says is filed',
        value: list(gone.map((d) => slotLabel(d.slotKey))),
        source: "This application's checklist (doc_uploads)",
      },
      {
        label: 'What storage actually holds at those keys',
        value: 'no object — nothing is stored there',
        source: `The vendor-verification bucket, probed at ${list(gone.map((d) => d.r2Key))}`,
      },
      gone[0]!.slotKey,
    );
  }
  if (unknown.length > 0) {
    return manual(
      key,
      label,
      `${f.filedDocuments.length - unknown.length} of ${f.filedDocuments.length} confirmed present.`,
      `Storage did not answer for ${list(unknown.map((d) => slotLabel(d.slotKey)))}. Open ${
        unknown.length === 1 ? 'it' : 'those'
      } by hand.`,
    );
  }
  return pass(
    key,
    label,
    `All ${f.filedDocuments.length} filed document${f.filedDocuments.length === 1 ? '' : 's'} confirmed present in storage.`,
  );
}

function checkDocumentTenancy(f: CheckFacts): CheckResult {
  const key = 'document_tenancy';
  const label = "Every filed document is filed under this shop";
  if (f.docUploadsUnreadable || f.filedDocuments.length === 0) {
    return manual(
      key,
      label,
      'No document files to place.',
      'There is nothing filed to place against this shop yet.',
    );
  }
  const foreign = f.filedDocuments.filter(
    (d) => d.keyOwnerVendorId !== null && d.keyOwnerVendorId !== f.vendorProfileId,
  );
  if (foreign.length > 0) {
    const d = foreign[0]!;
    return mismatch(
      key,
      label,
      `${foreign.length} document${foreign.length === 1 ? ' is' : 's are'} filed under a different shop.`,
      {
        label: 'The shop this application belongs to',
        value: `${f.businessName ?? 'this shop'} (${f.vendorProfileId})`,
        source: 'vendor_verification_applications.vendor_profile_id',
      },
      {
        label: 'The shop the document file is stored under',
        value: d.keyOwnerVendorId ?? 'unknown',
        source: `The storage path of ${slotLabel(d.slotKey)} — ${d.r2Key}`,
      },
      d.slotKey,
    );
  }
  const unparsed = f.filedDocuments.filter((d) => d.keyOwnerVendorId === null);
  if (unparsed.length > 0) {
    return manual(
      key,
      label,
      `${f.filedDocuments.length - unparsed.length} of ${f.filedDocuments.length} placed.`,
      `${list(unparsed.map((d) => slotLabel(d.slotKey)))} ${
        unparsed.length === 1 ? 'is' : 'are'
      } stored under a path this check does not recognise, so it cannot say whose ${
        unparsed.length === 1 ? 'it is' : 'they are'
      }.`,
    );
  }
  return pass(key, label, `All ${f.filedDocuments.length} filed documents are stored under this shop.`);
}

function checkRegistrationNumber(f: CheckFacts): CheckResult {
  const key = 'registration_number';
  const label = 'The government registration number is this shop’s alone';
  const raw = f.registrationNumberRaw?.trim();
  if (!raw) {
    return manual(
      key,
      label,
      'No registration number has been submitted.',
      'The shop has not typed a registration number, so there is nothing to compare. Read it off the DTI/SEC certificate and enter it.',
    );
  }
  if (f.registrationNumberDuplicate) {
    return mismatch(
      key,
      label,
      'This registration number is already on another shop.',
      {
        label: 'The number this shop submitted',
        value: raw,
        source: 'vendor_profiles.registration_number_raw on this shop',
      },
      {
        label: 'Already registered to',
        value:
          f.registrationNumberHeldAlsoBy.length > 0
            ? list(f.registrationNumberHeldAlsoBy)
            : 'another shop on Setnayan (name not readable)',
        source: 'The same normalised number on another vendor_profiles row',
      },
    );
  }
  switch (f.registryAnswer.kind) {
    case 'match':
      return pass(
        key,
        label,
        `Unique on Setnayan, and the registry returns "${f.registryAnswer.registeredName}".`,
      );
    case 'no_match':
      return mismatch(
        key,
        label,
        'The registry does not know this number.',
        {
          label: 'The number this shop submitted',
          value: raw,
          source: 'vendor_profiles.registration_number_raw on this shop',
        },
        {
          label: 'What the business registry returned for it',
          value: 'no registered business with that number',
          source: 'Business-registry lookup',
        },
      );
    case 'unreachable':
      return manual(
        key,
        label,
        `Unique on Setnayan. Registry not consulted.`,
        `The business registry did not answer (${f.registryAnswer.note}). A registry that is down says nothing about this shop — check the number against the certificate by hand.`,
      );
    case 'not_attempted':
    default:
      return manual(
        key,
        label,
        'Unique on Setnayan — no other shop holds this number.',
        `${f.registryAnswer.kind === 'not_attempted' ? f.registryAnswer.note : 'No registry lookup ran.'} Read the number off the certificate to confirm it is real.`,
        { alwaysHuman: true },
      );
  }
}

function checkContactValidate(f: CheckFacts): CheckResult {
  const key = 'contact_validate';
  const label = 'The VALIDATE token arrived by email AND by text';
  const email = Boolean(f.contactEmailConfirmedAt);
  const phone = Boolean(f.contactPhoneConfirmedAt);
  if (email && phone) {
    return pass(key, label, 'Both channels confirmed.');
  }
  if (!email && !phone) {
    return manual(
      key,
      label,
      'Neither channel confirmed yet.',
      'The shop has not sent the token on either channel, or nobody has stamped it. Nothing has been attempted, so there is nothing to disagree with.',
    );
  }
  const confirmedSide = email ? 'email' : 'text message';
  const missingSide = email ? 'text message' : 'email';
  const at = email ? f.contactEmailConfirmedAt! : f.contactPhoneConfirmedAt!;
  return mismatch(
    key,
    label,
    `The token arrived by ${confirmedSide} but never by ${missingSide}.`,
    {
      label: `Confirmed by ${confirmedSide}`,
      value: at,
      source: `vendor_verification_applications.contact_${email ? 'email' : 'phone'}_confirmed_at`,
    },
    {
      label: `Confirmed by ${missingSide}`,
      value: 'never — no stamp on this application',
      source: `vendor_verification_applications.contact_${email ? 'phone' : 'email'}_confirmed_at`,
    },
  );
}

function checkPortfolio(f: CheckFacts): CheckResult {
  const key = 'portfolio_count';
  const label = `${PORTFOLIO_MIN}–${PORTFOLIO_MAX} portfolio samples`;
  if (f.portfolioCount === null) {
    return manual(
      key,
      label,
      'The portfolio slot could not be read.',
      'The stored value did not parse into a list of photos. Open the slot and count by hand.',
      { slotKey: 'portfolio_samples' },
    );
  }
  if (f.portfolioCount >= PORTFOLIO_MIN && f.portfolioCount <= PORTFOLIO_MAX) {
    return pass(key, label, `${f.portfolioCount} samples uploaded.`, 'portfolio_samples');
  }
  return mismatch(
    key,
    label,
    `${f.portfolioCount} sample${f.portfolioCount === 1 ? '' : 's'} uploaded — the range is ${PORTFOLIO_MIN}–${PORTFOLIO_MAX}.`,
    {
      label: 'What verification asks for',
      value: `${PORTFOLIO_MIN}–${PORTFOLIO_MAX} samples`,
      source: 'The portfolio slot on the verification checklist',
    },
    {
      label: 'What this shop uploaded',
      value: `${f.portfolioCount}`,
      source: "This application's portfolio slot",
    },
    'portfolio_samples',
  );
}

function checkClientReferences(f: CheckFacts): CheckResult {
  const key = 'client_references';
  const label = `${CLIENT_REFERENCES_MIN}–${CLIENT_REFERENCES_MAX} past client references`;
  if (f.clientReferenceCount === null) {
    return manual(
      key,
      label,
      'The references slot could not be read.',
      'The stored value did not parse into references. Open the slot and read them by hand.',
      { slotKey: 'client_references' },
    );
  }
  if (
    f.clientReferenceCount >= CLIENT_REFERENCES_MIN &&
    f.clientReferenceCount <= CLIENT_REFERENCES_MAX
  ) {
    // 🔑 THIS CHECK IS THE COUNT, NOT THE PHONE CALL. Setnayan still rings 1–2
    // of them, and an earlier draft returned `manual` here to say so — which
    // made a correct count permanently un-passable and put a mark on every
    // clean application forever. A check nobody can ever satisfy is a gate with
    // no handle; the call belongs to the identity step, which has a stamp.
    return pass(
      key,
      label,
      `${f.clientReferenceCount} references given — ring 1–2 of them before you decide.`,
      'client_references',
    );
  }
  return mismatch(
    key,
    label,
    `${f.clientReferenceCount} reference${f.clientReferenceCount === 1 ? '' : 's'} given — the range is ${CLIENT_REFERENCES_MIN}–${CLIENT_REFERENCES_MAX}.`,
    {
      label: 'What verification asks for',
      value: `${CLIENT_REFERENCES_MIN}–${CLIENT_REFERENCES_MAX} references`,
      source: 'The client-references slot on the verification checklist',
    },
    {
      label: 'What this shop gave',
      value: `${f.clientReferenceCount}`,
      source: "This application's client-references slot",
    },
    'client_references',
  );
}

function checkIdentityMeeting(f: CheckFacts): CheckResult {
  const key = 'identity_meeting';
  const label = 'The 15-minute identity call happened';
  if (f.meetScheduledAt) {
    return pass(key, label, `Scheduled ${f.meetScheduledAt}.`, 'google_meet');
  }
  return manual(
    key,
    label,
    'No call is on the record.',
    'Identity is confirmed face to face. Nothing automatic can stand in for it — book the call, hold it, then stamp the slot.',
    { alwaysHuman: true, slotKey: 'google_meet' },
  );
}

function checkReachable(f: CheckFacts): CheckResult {
  const key = 'shop_reachable';
  const label = 'The shop can be reached and located';
  const missing: string[] = [];
  if (!f.contactEmail?.trim()) missing.push('an email address');
  if (!f.contactPhone?.trim()) missing.push('a phone number');
  if (!f.hqAddress?.trim()) missing.push('a business address');
  if (missing.length === 0) {
    return pass(key, label, 'Email, phone and address are all on the profile.');
  }
  return mismatch(
    key,
    label,
    `The profile is missing ${list(missing)}.`,
    {
      label: 'What a reviewer needs to reach and place this shop',
      value: 'an email address, a phone number and a business address',
      source: 'The three contact fields every verified shop carries',
    },
    {
      label: 'What this profile carries',
      value: `missing ${list(missing)}`,
      source: 'vendor_profiles (contact_email, contact_phone, hq_address)',
    },
  );
}

function checkDeclaredExperience(f: CheckFacts, now: Date): CheckResult {
  const key = 'declared_experience';
  const label = 'The declared years in business are credible';
  if (f.inBusinessSinceYear === null) {
    return manual(
      key,
      label,
      'No start year declared.',
      'The shop has not said when it started trading, so there is nothing to compare against the DTI certificate.',
    );
  }
  const thisYear = now.getUTCFullYear();
  if (f.inBusinessSinceYear > thisYear) {
    return mismatch(
      key,
      label,
      `The shop says it started trading in ${f.inBusinessSinceYear}, which has not happened yet.`,
      {
        label: 'The latest a start year can be',
        value: `${thisYear}`,
        source: "Today's date",
      },
      {
        label: 'What this shop declared',
        value: `${f.inBusinessSinceYear}`,
        source: 'vendor_profiles.in_business_since_year',
      },
    );
  }
  if (f.experienceVerifiedAt) {
    return pass(
      key,
      label,
      `Trading since ${f.inBusinessSinceYear}, already confirmed against the DTI certificate.`,
    );
  }
  return manual(
    key,
    label,
    `The shop says it has been trading since ${f.inBusinessSinceYear}.`,
    'The year is credible, but only a person reading the DTI certificate can confirm it matches. Use "Confirm — matches DTI" once you have opened the document.',
    { alwaysHuman: true, slotKey: 'dti_certificate' },
  );
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/**
 * Run every check. Order is the reviewer's reading order, not importance —
 * the UI sorts mismatches to the top, and this array is what the tests pin.
 *
 * ⚠ Nothing here throws. A check that cannot decide returns `manual`; a check
 * that throws would take the other nine down with it, which is precisely the
 * failure this per-check design exists to prevent.
 */
export function runVerificationChecks(facts: CheckFacts, now: Date = new Date()): CheckResult[] {
  const runners: Array<(f: CheckFacts) => CheckResult> = [
    checkRequiredDocuments,
    checkDocumentsInStorage,
    checkDocumentTenancy,
    checkRegistrationNumber,
    checkContactValidate,
    checkPortfolio,
    checkClientReferences,
    checkIdentityMeeting,
    checkReachable,
    (f) => checkDeclaredExperience(f, now),
  ];
  return runners.map((run, i) => {
    try {
      return run(facts);
    } catch (err) {
      // A rule that threw has NOT passed and has NOT found a disagreement.
      return manual(
        `check_${i}`,
        'A check could not run',
        'This check failed to run.',
        `The rule threw (${err instanceof Error ? err.message : 'unknown error'}). Treat this item as unchecked.`,
      );
    }
  });
}

export function summariseChecks(results: readonly CheckResult[]): CheckSummary {
  let passed = 0;
  let mismatched = 0;
  let manualCount = 0;
  for (const r of results) {
    if (r.outcome === 'pass') passed++;
    else if (r.outcome === 'mismatch') mismatched++;
    else manualCount++;
  }
  return {
    total: results.length,
    passed,
    mismatched,
    manual: manualCount,
    allManual: results.length > 0 && manualCount === results.length,
    allClear: results.length > 0 && mismatched === 0 && manualCount === 0,
  };
}

/**
 * The one line at the top of the card. States the split and NEVER states a
 * verdict — "4 of 5 done" is a fact; "ready to approve" would be an opinion the
 * owner did not ask this automation to hold.
 */
export function summaryLine(s: CheckSummary): string {
  if (s.total === 0) return 'No checks ran.';
  if (s.allClear) return `All ${s.total} checks clear.`;
  const parts: string[] = [];
  if (s.passed > 0) parts.push(`${s.passed} clear`);
  if (s.mismatched > 0)
    parts.push(`${s.mismatched} ${s.mismatched === 1 ? 'mismatch' : 'mismatches'}`);
  if (s.manual > 0) parts.push(`${s.manual} for you`);
  return `${parts.join(' · ')} — of ${s.total}.`;
}

/** Mismatches first, then the human's pile, then what is already clear. */
export function sortForReview(results: readonly CheckResult[]): CheckResult[] {
  const rank: Record<CheckOutcome, number> = { mismatch: 0, manual: 1, pass: 2 };
  return [...results].sort((a, b) => rank[a.outcome] - rank[b.outcome]);
}

// ---------------------------------------------------------------------------
// What the grant surfaces are told
// ---------------------------------------------------------------------------

/**
 * The sentence a grant button shows before the badge is handed over.
 *
 * ⚖ THIS DOES NOT REFUSE, AND THAT IS DELIBERATE. Offered "refuse with an
 * override", the owner did not take it — he answered with the automation
 * instead (2026-09-09). So the machine's job here is to make it impossible to
 * press Approve while BELIEVING the paper was checked. Whether the button
 * should hard-refuse is his ruling and nobody else's; when he makes it, the
 * refusal goes in the actions that call this, and this sentence is already the
 * message it would refuse with.
 */
export function grantWarning(s: CheckSummary): string | null {
  if (s.total === 0) {
    return 'No automatic checks ran for this shop. Verifying now grants the badge on your word alone.';
  }
  if (s.allClear) return null;
  const bits: string[] = [];
  if (s.mismatched > 0) {
    bits.push(
      `${s.mismatched} ${s.mismatched === 1 ? 'check disagrees' : 'checks disagree'} with what this shop filed`,
    );
  }
  if (s.manual > 0) {
    bits.push(`${s.manual} ${s.manual === 1 ? 'check has' : 'checks have'} not been decided by anyone`);
  }
  return `${bits.join(', and ')}. Verifying now grants the badge anyway.`;
}
