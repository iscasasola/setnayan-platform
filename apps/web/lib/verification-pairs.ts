/**
 * THE PAPER BESIDE THE FIELDS IT PROVES — the pure half.
 *
 * Ported from the binding drawing
 * `prototypes/shop_verification_2026-09-09.html` ("Papers Beside the Fields").
 * It does NOT introduce a new screen: it re-shapes the four REQUIRED slots of
 * the shipped My Shop → Get verified section so each document sits beside the
 * details it proves, and every line reports on its own.
 *
 * ── WHAT THIS MODULE IS AND IS NOT ──────────────────────────────────────────
 * It is the MODEL: which paper proves which typed field, what state each of
 * the eight checks is in, and how the tally adds up. It is pure — no Supabase,
 * no React — so the screen and the guards read the same rules.
 *
 * It is NOT the automation. Reading a document, resolving the QR, and calling
 * DTI's or SEC's registry are a separate build. This module defines the SEAM
 * they attach through ({@link PaperRead}) and behaves correctly while that seam
 * is empty — which is what production looks like today.
 *
 * ── OWNER RULINGS THIS ENCODES (DECISION_LOG 2026-09-09) ────────────────────
 * · Verification needs BIR (Form 2303) + Business Permit + DTI **or** SEC, and
 *   a complete profile.
 * · DTI or SEC, NEVER BOTH — and never as two slots. There is ONE registration
 *   paper and it takes either. The document itself says which registry it
 *   belongs to, so the supplier is NEVER asked to declare their legal form.
 * · The typed field sits BESIDE the document that proves it.
 * · A shop name may legitimately DIFFER from the registered name (shop "ICASA
 *   OFFROAD", DTI "ICASA ENTERPRISE AUTO PARTS"). `business_name` and
 *   `registered_business_name` are separate columns and NOTHING here couples
 *   them: the comparison anchors on the REGISTERED name and the OWNER, never
 *   on the shop name. `PAIR_FIELDS` deliberately contains no `business_name`,
 *   and `verification-pairs.test.ts` fails if one appears.
 *
 * ── THE HARD STOP THIS REPLACES ─────────────────────────────────────────────
 * Measured on production 2026-09-10: BOTH shops are `public_visibility =
 * 'verified'` and carry every one of the six identity columns NULL. One of them
 * already holds a `draft` application it could not reach, because the shipped
 * section returns its badge card and nothing else the moment a shop is
 * verified. So the page has to work for a shop carrying a badge and no papers.
 */

import {
  isLockedIdentityFieldKey,
  type LockedIdentityFieldKey,
} from '@/lib/vendor-corrections';

// ---------------------------------------------------------------------------
// The six columns, plus the two lines that prove something without storing it
// ---------------------------------------------------------------------------

/**
 * `vendor_profiles` columns a supplier types beside a paper. All six exist in
 * production (verified 2026-09-10 against `information_schema.columns`) and all
 * six are UPDATE-granted to `authenticated` at COLUMN level, so this build needs
 * no migration and no grant. `anon` reaches none of them except `location_city`
 * (SELECT), which was already public.
 */
export const PAIR_COLUMNS = [
  'registered_business_name',
  'business_owner_name',
  'registration_number_raw',
  'tin_number',
  'registered_address',
  'location_city',
] as const;

export type PairColumn = (typeof PAIR_COLUMNS)[number];

/** Every check on the page, whether or not it stores a value. */
export type PairFieldKey =
  | PairColumn
  // Read-only. The permit's address line confirms `registered_address`; it is
  // not a second address to keep.
  | 'permit_address'
  // Read-only. The bank proof's whole job is one sentence — the account name is
  // one of the two names already on the papers above. Inventing a box for it
  // would be a fifth thing to type that we then compare against a screenshot of
  // itself (the drawing's own reasoning).
  | 'bank_account_name';

export type PairField = {
  key: PairFieldKey;
  /** The column this writes, or null when the line proves without storing. */
  column: PairColumn | null;
  label: string;
  /** Rendered under a read-only line instead of an input. */
  purpose?: string;
  /** Monospace input (numbers people read digit by digit). */
  mono?: boolean;
  /** Multi-line value. */
  long?: boolean;
  /**
   * True when the value is one a registry could confirm. Only these lines park
   * on `waiting_registry` — a registry outage must not freeze the whole pair.
   */
  registryBacked?: boolean;
};

/** The four papers, in the drawn order. Slot keys are the SHIPPED ones. */
export type VerificationPair = {
  /** `DOC_SLOTS` key — unchanged, so every existing upload keeps working. */
  slotKey: 'dti_certificate' | 'bir_2303' | 'mayors_permit' | 'bank_account_proof';
  number: 1 | 2 | 3 | 4;
  title: string;
  hint: string;
  /** Why this paper is slower, said once, in plain words. Never "manual check". */
  why?: string;
  fields: readonly PairField[];
};

export const VERIFICATION_PAIRS: readonly VerificationPair[] = [
  {
    slotKey: 'dti_certificate',
    number: 1,
    title: 'Business registration',
    hint: 'DTI or SEC — whichever your business has. One box takes either; we can tell which from the paper.',
    fields: [
      {
        key: 'registered_business_name',
        column: 'registered_business_name',
        label: 'Registered business name',
        registryBacked: true,
      },
      {
        key: 'business_owner_name',
        column: 'business_owner_name',
        label: "Owner's name",
        registryBacked: true,
      },
      {
        key: 'registration_number_raw',
        column: 'registration_number_raw',
        label: 'Registration number',
        mono: true,
        registryBacked: true,
      },
    ],
  },
  {
    slotKey: 'bir_2303',
    number: 2,
    title: 'BIR Certificate of Registration',
    hint: 'Your COR — Form 2303.',
    fields: [
      { key: 'tin_number', column: 'tin_number', label: 'TIN', mono: true },
      {
        key: 'registered_address',
        column: 'registered_address',
        label: 'Registered address',
        long: true,
      },
    ],
  },
  {
    slotKey: 'mayors_permit',
    number: 3,
    title: "Mayor's / Business Permit",
    hint: "This year's, from your city.",
    why: 'Every city prints its permit its own way and there is no registry to ask, so this one is matched against your registration certificate, your COR and your profile. It is the slow one — usually a day.',
    fields: [
      { key: 'location_city', column: 'location_city', label: 'City' },
      {
        key: 'permit_address',
        column: null,
        label: 'Address on the permit',
        purpose: 'Confirms your registered address.',
      },
    ],
  },
  {
    slotKey: 'bank_account_proof',
    number: 4,
    title: 'Bank account proof',
    hint: 'So money meant for you cannot land somewhere else.',
    fields: [
      {
        key: 'bank_account_name',
        column: null,
        label: 'What this proves',
        purpose:
          'The name on the account is your registered business name or the owner’s name — the two names on your papers above. Nothing to type here.',
      },
    ],
  },
] as const;

/** Every check on the page, flattened. The drawing counts EIGHT. */
export const PAIR_CHECK_KEYS: readonly PairFieldKey[] = VERIFICATION_PAIRS.flatMap((p) =>
  p.fields.map((f) => f.key),
);

export const PAIR_SLOT_KEYS: ReadonlySet<string> = new Set(
  VERIFICATION_PAIRS.map((p) => p.slotKey),
);

// ---------------------------------------------------------------------------
// The seam the automation attaches through
// ---------------------------------------------------------------------------

/**
 * Which registry a paper turned out to belong to. Read OFF THE DOCUMENT — the
 * supplier is never asked. `unreadable` is a real answer: it parks the pair with
 * a person rather than becoming a question.
 */
export type PaperRegistry = 'dti' | 'sec' | 'bir' | 'lgu' | 'bank' | 'unreadable';

/**
 * What happened when we asked the registry about this paper.
 *
 * `no_registry` is the Mayor's Permit's permanent answer — there is nothing to
 * ask — and it must never read as a failure.
 * `unreachable` is the drawing's frame 1b: the registry did not answer. The
 * affected checks park; they never pass and never fail.
 */
export type RegistryOutcome = 'agreed' | 'not_found' | 'unreachable' | 'no_registry';

/**
 * ⚠ THE SEAM. Written by the document reader / registry caller — NOT by this
 * session, and not by the screen. It lives at
 * `vendor_verification_applications.doc_uploads[slotKey].read`, beside the
 * `r2_key` the upload already stores:
 *
 *   "dti_certificate": { "r2_key": "r2://…", "uploaded_at": "…",
 *                        "read": { …PaperRead… } }
 *
 * That location was chosen so the automation needs NO migration, NO new grant
 * and NO second write path: `isSlotComplete` reads `r2_key` and ignores every
 * other key, so an application carrying a `read` block behaves exactly as one
 * without it. Until something writes it, {@link parsePaperRead} returns null
 * everywhere and every filled line honestly reads "with a person at Setnayan".
 *
 * 🔒 A `read` block is EVIDENCE, never an instruction: nothing here may write a
 * profile column on its own. A supplier chooses, on the mismatch, which value
 * stands.
 */
export type PaperRead = {
  registry: PaperRegistry;
  /** The "Read as …" sentence, in the reader's own words. */
  readAs: string | null;
  /** Read-only extras — validity, scope, RDO. Shown, never stored as columns. */
  notes: readonly string[];
  /** field key → what the paper says. Absent = the reader produced nothing. */
  values: Partial<Record<PairFieldKey, string>>;
  /** Lines the reader could not make out. These park with a person. */
  unreadable: readonly PairFieldKey[];
  registryOutcome: RegistryOutcome;
  readAt: string | null;
};

const REGISTRIES: ReadonlySet<string> = new Set([
  'dti',
  'sec',
  'bir',
  'lgu',
  'bank',
  'unreadable',
]);
const OUTCOMES: ReadonlySet<string> = new Set([
  'agreed',
  'not_found',
  'unreachable',
  'no_registry',
]);
const FIELD_KEYS: ReadonlySet<string> = new Set(PAIR_CHECK_KEYS);

/**
 * Read a `read` block off a stored slot value. Defensive on every field: a
 * malformed block degrades to null (the honest "nothing has checked this yet")
 * rather than throwing inside a server component.
 */
export function parsePaperRead(entry: unknown): PaperRead | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const raw = (entry as Record<string, unknown>).read;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const registry =
    typeof r.registry === 'string' && REGISTRIES.has(r.registry)
      ? (r.registry as PaperRegistry)
      : 'unreadable';
  const registryOutcome =
    typeof r.registryOutcome === 'string' && OUTCOMES.has(r.registryOutcome)
      ? (r.registryOutcome as RegistryOutcome)
      : 'no_registry';

  const values: Partial<Record<PairFieldKey, string>> = {};
  if (r.values && typeof r.values === 'object' && !Array.isArray(r.values)) {
    for (const [k, v] of Object.entries(r.values as Record<string, unknown>)) {
      if (FIELD_KEYS.has(k) && typeof v === 'string' && v.trim()) {
        values[k as PairFieldKey] = v.trim();
      }
    }
  }
  const unreadable = Array.isArray(r.unreadable)
    ? r.unreadable.filter((k): k is PairFieldKey => typeof k === 'string' && FIELD_KEYS.has(k))
    : [];
  const notes = Array.isArray(r.notes)
    ? r.notes.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    : [];

  return {
    registry,
    readAs: typeof r.readAs === 'string' && r.readAs.trim() ? r.readAs.trim() : null,
    notes,
    values,
    unreadable,
    registryOutcome,
    readAt: typeof r.readAt === 'string' && r.readAt.trim() ? r.readAt.trim() : null,
  };
}

// ---------------------------------------------------------------------------
// One check, one state
// ---------------------------------------------------------------------------

/**
 * The state of ONE line.
 *
 * The drawing's tally has four buckets. Six states map onto them because two of
 * the buckets each cover two honest situations — and saying which one is the
 * whole point of a line reporting on its own:
 *
 *   matched          → "matched"
 *   mismatch         → "for you to fix"
 *   with_a_person    → "with a person at Setnayan"
 *   waiting_registry → "with a person at Setnayan"  (frame 1b: parks, retries)
 *   typed            → "not sent"  (you typed it; the paper hasn't arrived)
 *   not_sent         → "not sent"
 *
 * 🔑 `with_a_person` is what EVERY filled line reads today, and that is not a
 * placeholder — it is true. Until the reader ships, a person at Setnayan is the
 * only thing that compares a paper with a field. A state called "checked" here
 * would be a lie the page tells before anything has looked.
 */
export type CheckState =
  | 'matched'
  | 'mismatch'
  | 'with_a_person'
  | 'waiting_registry'
  | 'typed'
  | 'not_sent';

export type TallyBucket = 'matched' | 'to_fix' | 'with_person' | 'not_yet';

export const CHECK_STATE_BUCKET: Record<CheckState, TallyBucket> = {
  matched: 'matched',
  mismatch: 'to_fix',
  with_a_person: 'with_person',
  waiting_registry: 'with_person',
  typed: 'not_yet',
  not_sent: 'not_yet',
};

/**
 * Compare a typed value with what the paper says.
 *
 * Case, spacing and the punctuation people scatter through registration numbers
 * are noise, so both sides are folded before comparing. Anything else is a real
 * difference and belongs in front of the supplier — a comparison that forgives
 * too much is a check that never catches anything.
 */
export function valuesAgree(typed: string, onPaper: string): boolean {
  const fold = (s: string) =>
    s
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[.,#/\\’'"()-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const a = fold(typed);
  const b = fold(onPaper);
  return a.length > 0 && a === b;
}

export type CheckInput = {
  field: PairField;
  /** What the supplier has on their profile right now. */
  typedValue: string | null;
  /** Whether the paper for this pair has been sent. */
  paperPresent: boolean;
  /** The reader's block for this pair, or null while the seam is empty. */
  read: PaperRead | null;
};

/**
 * Derive one line's state. Total — every input shape produces a state, and the
 * order below is the whole rule:
 *
 *   1. No paper yet → `typed` if they filled it in, else `not_sent`. A line that
 *      cannot be compared is never reported as a problem.
 *   2. Paper in, nothing has read it → `with_a_person`.
 *   3. The reader could not make this line out → `with_a_person`.
 *   4. The registry did not answer, and this line is one a registry could
 *      confirm → `waiting_registry`. A line the registry never had an opinion
 *      about (the TIN, the permit's city) is unaffected by an outage.
 *   5. The reader has a value: agrees → `matched`, differs → `mismatch`.
 *      Nothing typed to compare it with → `with_a_person`, never `matched`:
 *      a value we lifted off a photo and nobody confirmed is not a match.
 */
export function deriveCheck(input: CheckInput): CheckState {
  const typed = (input.typedValue ?? '').trim();
  if (!input.paperPresent) return typed ? 'typed' : 'not_sent';
  const read = input.read;
  if (!read) return 'with_a_person';
  if (read.unreadable.includes(input.field.key)) return 'with_a_person';
  if (read.registryOutcome === 'unreachable' && input.field.registryBacked) {
    return 'waiting_registry';
  }
  const onPaper = read.values[input.field.key];
  if (!onPaper) return 'with_a_person';
  if (!typed) return 'with_a_person';
  return valuesAgree(typed, onPaper) ? 'matched' : 'mismatch';
}

export type Tally = Record<TallyBucket, number>;

export function tallyChecks(states: readonly CheckState[]): Tally {
  const out: Tally = { matched: 0, to_fix: 0, with_person: 0, not_yet: 0 };
  for (const s of states) out[CHECK_STATE_BUCKET[s]] += 1;
  return out;
}

// ---------------------------------------------------------------------------
// Which lines the supplier may type
// ---------------------------------------------------------------------------

/**
 * Whether this line's column is one of the identity fields that LOCK once a
 * shop is verified.
 *
 * 🔑 DERIVED from `LOCKED_IDENTITY_FIELD_KEYS`, never hand-listed — that list
 * has grown twice (location_city 2026-08-10, business_slug) and a hand-listed
 * copy here would go stale silently, which is how a shipped screen ends up
 * offering a box whose save the server refuses.
 *
 * ⚠ MEASURED, and it decides how this page behaves for the only two shops that
 * exist: `business_owner_name` and `location_city` ARE on that list, and BOTH
 * production shops are `public_visibility = 'verified'`. So two of the six
 * fields the owner named cannot be typed by either real shop. They render as a
 * locked line with the shipped "ask Setnayan to correct it" door beside them —
 * NOT as a box whose save comes back "your shop is verified, so these details
 * are locked".
 */
export function pairFieldLockedKey(
  field: PairField,
  isVerified: boolean,
): LockedIdentityFieldKey | null {
  if (!isVerified || field.column === null) return null;
  return isLockedIdentityFieldKey(field.column) ? field.column : null;
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/** The per-line sentence. One place, so the screen and the guards agree. */
export const CHECK_STATE_SENTENCE: Record<CheckState, string> = {
  matched: 'Same on your paper and on your profile.',
  mismatch: 'Two different answers. Pick the right one — nobody at Setnayan needs to look unless you ask.',
  with_a_person: 'With a person at Setnayan — nothing for you to do.',
  waiting_registry:
    'The registry did not answer when we asked — it happens. We keep trying; if it still does not answer, a person at Setnayan checks it. Your photo and your details are saved. Nothing to redo.',
  typed: 'Typed — we check it against your paper once it is in.',
  not_sent: 'Not sent yet.',
};

export const TALLY_LABEL: Record<TallyBucket, string> = {
  matched: 'matched',
  to_fix: 'for you to fix',
  with_person: 'with a person at Setnayan',
  not_yet: 'not sent',
};

/**
 * The banner a shop that already carries the badge reads. Owner ruling: the
 * papers are being collected behind every badge from now on.
 *
 * ⛔ It sets NO deadline and threatens NO removal of the badge — whether a
 * verified shop that never sends its papers eventually loses it is the owner's
 * call and was NOT made. This sentence is written so it stays true either way.
 */
export const VERIFIED_WITHOUT_PAPERS_BANNER =
  'You’re verified, and the badge stays. Setnayan now keeps the papers behind every badge, so send yours when they’re handy. Start with your DTI or SEC certificate — it fills in the most.';
