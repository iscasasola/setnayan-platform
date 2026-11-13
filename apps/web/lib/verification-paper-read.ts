/**
 * verification-paper-read.ts — READING A VERIFICATION PAPER, the pure half.
 *
 * Owner rulings 2026-11-14 (DECISION_LOG): *"for the documents. we want to
 * detect the text on their documents. Account Name · Registration Number ·
 * Expiration Date"* and *"it will try to read their pdf/jpeg file"*.
 *
 * This module turns what a model says about one uploaded paper into the
 * {@link PaperRead} block that `lib/verification-pairs.ts` already defines and
 * the shipped "Papers Beside the Fields" screen already draws. It adds no new
 * screen and no new storage: the block lands at
 * `vendor_verification_applications.doc_uploads[slotKey].read`, the seam the
 * 2026-09-09 build left empty for exactly this.
 *
 * The network half (fetch the file, ask the model, write the block) is
 * `verification-paper-read.server.ts`. Everything that DECIDES something lives
 * here, so it is testable without a key, a network or `server-only`.
 *
 * ── THE 2026-09-09 LOCK, WHICH THIS OBEYS ────────────────────────────────────
 * · A read is EVIDENCE. Nothing here produces a profile column write, a status,
 *   or a verdict. {@link mergeReadIntoDocUploads} is the only thing that shapes
 *   a write, and it can only change `doc_uploads[slot].read`.
 * · On a mismatch the SUPPLIER picks which value stands (the screen's job).
 * · A line the reader could not make out parks with a person.
 * · The admin still approves.
 * · Never shown raw: `readAs` is a plain sentence, or our own sentence when the
 *   model's is not one (no JSON, no shouting).
 *
 * ── THE EXPIRY IS NEVER INVENTED ─────────────────────────────────────────────
 * A BIR 2303 usually carries no expiry; a DTI certificate does; a Mayor's
 * Permit does. When the model says there is none, there is none — no default,
 * no "end of the year". A date that is not a real calendar date is dropped.
 */

import {
  VERIFICATION_PAIRS,
  type PairFieldKey,
  type PaperRead,
  type VerificationPair,
} from '@/lib/verification-pairs';
import { formatLongDate } from '@/lib/format-date';

/** What the reader may say a paper is. `bank` is deliberately absent — it is not read. */
export type ReadRegistry = 'dti' | 'sec' | 'bir' | 'lgu' | 'unreadable';

/** The slots this reader reads. The bank proof is not one of them. */
export type ReadableSlotKey = 'dti_certificate' | 'bir_2303' | 'mayors_permit';

export const READABLE_SLOT_KEYS: ReadonlySet<string> = new Set<ReadableSlotKey>([
  'dti_certificate',
  'bir_2303',
  'mayors_permit',
]);

export function isReadableSlotKey(k: string): k is ReadableSlotKey {
  return READABLE_SLOT_KEYS.has(k);
}

/** Which registries belong in which slot. A paper in the wrong slot maps nothing. */
const SLOT_REGISTRIES: Record<ReadableSlotKey, ReadonlySet<ReadRegistry>> = {
  dti_certificate: new Set(['dti', 'sec']),
  bir_2303: new Set(['bir']),
  mayors_permit: new Set(['lgu']),
};

/**
 * The prompt. It asks for JSON and names, field by field, what NOT to guess.
 * The model transcribes; every judgement afterwards is plain TypeScript.
 */
export const PAPER_READ_PROMPT = `You are reading ONE Philippine business document a supplier uploaded to prove their business is real. Transcribe it; do not judge it.

Say which document it is:
- "dti": a DTI Certificate of Business Name Registration
- "sec": an SEC Certificate of Incorporation / Registration
- "bir": a BIR Certificate of Registration (Form 2303)
- "lgu": a Mayor's Permit / Business Permit from a city or municipality
- "unreadable": anything else, or you cannot tell

Reply with ONE JSON object and nothing else, with exactly these keys:
{
  "registry": "dti" | "sec" | "bir" | "lgu" | "unreadable",
  "account_name": the registered business name as printed (for a sole proprietor with no business name, the owner's name), or null,
  "owner_name": the owner / proprietor / taxpayer's personal name as printed, or null,
  "registration_number": the DTI business name no., the SEC registration no., the BIR TIN (with branch code if printed), or the permit no. — as printed, or null,
  "rdo": the BIR Revenue District Office code, or null,
  "address": the business address as printed, or null,
  "city": the city or municipality that issued or is named on the paper, or null,
  "tin": the Taxpayer Identification Number wherever it is printed on this paper, as printed, or null,
  "expiration_date": the date the document expires or is valid until, as YYYY-MM-DD, or null,
  "read_as": one short plain sentence saying what this paper is, e.g. "Read as a DTI business name certificate for ICASA ENTERPRISE.",
  "could_not_read": a list of the keys above whose value is printed but you could not make out,
  "confident": an object with one boolean per key above that has a value — true only when you read it clearly and are sure of every character
}

Rules:
- Copy values exactly as printed. Never correct, complete or guess a value.
- "expiration_date" ONLY when the paper prints one. A BIR Form 2303 usually has no expiry: use null. Never use the issue date, the registration date, or the end of the year as an expiry.
- If a value is not on the paper, use null. If it is on the paper but you cannot read it, use null AND list the key in "could_not_read".
- Mark "confident" false for any value you had to guess at, even one character.`;

/** What the model returned, after defensive parsing. */
export type ModelPaperRead = {
  registry: ReadRegistry;
  accountName: string | null;
  ownerName: string | null;
  registrationNumber: string | null;
  rdo: string | null;
  address: string | null;
  city: string | null;
  /** ISO `YYYY-MM-DD`, only when it is a real calendar date. */
  expirationDate: string | null;
  readAs: string | null;
  couldNotRead: readonly string[];
  /** The TIN wherever it is printed, as printed. */
  tin: string | null;
  /**
   * Keys that HAVE a value but the model did not mark `confident: true`. A
   * missing `confident` object makes every valued key unsure — silence is not
   * confidence.
   */
  unsure: readonly string[];
};

const REGISTRY_SET: ReadonlySet<string> = new Set(['dti', 'sec', 'bir', 'lgu', 'unreadable']);

function cleanValue(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  if (!s || /^(null|none|n\/?a|-+)$/i.test(s)) return null;
  return s.slice(0, max);
}

/**
 * A real calendar date in `YYYY-MM-DD`, or null. `2026-02-30` is null, not
 * 2 March — a date the model got wrong is a date we do not have.
 */
export function strictIsoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Pull the one JSON object out of the model's reply. Tolerates a code fence or
 * a sentence around it; anything that is not an object is null (→ nothing is
 * written, the line stays "with a person").
 */
export function parseModelPaperJson(text: string): ModelPaperRead | null {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const registry =
    typeof r.registry === 'string' && REGISTRY_SET.has(r.registry.toLowerCase())
      ? (r.registry.toLowerCase() as ReadRegistry)
      : 'unreadable';
  const couldNotRead = Array.isArray(r.could_not_read)
    ? r.could_not_read.filter((k): k is string => typeof k === 'string').slice(0, 20)
    : [];
  const valued: Record<string, unknown> = {
    account_name: r.account_name,
    owner_name: r.owner_name,
    registration_number: r.registration_number,
    tin: r.tin,
    rdo: r.rdo,
    address: r.address,
    city: r.city,
    expiration_date: r.expiration_date,
  };
  const conf =
    r.confident && typeof r.confident === 'object' && !Array.isArray(r.confident)
      ? (r.confident as Record<string, unknown>)
      : {};
  const unsure = Object.entries(valued)
    .filter(([k, v]) => cleanValue(v) !== null && conf[k] !== true)
    .map(([k]) => k);
  return {
    registry,
    tin: cleanValue(r.tin, 40),
    unsure,
    accountName: cleanValue(r.account_name),
    ownerName: cleanValue(r.owner_name),
    registrationNumber: cleanValue(r.registration_number, 80),
    rdo: cleanValue(r.rdo, 20),
    address: cleanValue(r.address, 400),
    city: cleanValue(r.city, 120),
    expirationDate: strictIsoDate(r.expiration_date),
    readAs: cleanValue(r.read_as, 400),
    couldNotRead,
  };
}

const REGISTRY_NOUN: Record<ReadRegistry, string> = {
  dti: 'a DTI business name certificate',
  sec: 'an SEC certificate of registration',
  bir: 'a BIR Certificate of Registration (Form 2303)',
  lgu: "a Mayor's / Business Permit",
  unreadable: '',
};

/**
 * The "Read as …" sentence. The model's own sentence when it is one plain
 * sentence; ours otherwise. Never raw: no braces, no quotes-as-syntax, no
 * all-caps banner text, no "READ PERMITTED" style status words.
 */
export function readAsSentence(model: Pick<ModelPaperRead, 'registry' | 'readAs'>): string {
  const fallback =
    model.registry === 'unreadable'
      ? 'We could not tell what this paper is — a person at Setnayan will look at it.'
      : `Read as ${REGISTRY_NOUN[model.registry]}.`;
  const s = model.readAs;
  if (!s) return fallback;
  if (s.length > 160) return fallback;
  if (/[{}[\]<>`|]|":|\\n/.test(s)) return fallback;
  if (/\b(READ|PERMITTED|DENIED|APPROVED|REJECTED|VERIFIED|STATUS|NULL|TRUE|FALSE)\b/.test(s)) return fallback;
  const letters = s.replace(/[^A-Za-z]/g, '');
  const upper = s.replace(/[^A-Z]/g, '');
  if (letters.length > 0 && upper.length / letters.length > 0.6) return fallback;
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

/** The model's key → the pair line it speaks to, per slot. */
const COULD_NOT_READ_MAP: Record<ReadableSlotKey, Record<string, PairFieldKey>> = {
  dti_certificate: {
    account_name: 'registered_business_name',
    owner_name: 'business_owner_name',
    registration_number: 'registration_number_raw',
  },
  bir_2303: {
    registration_number: 'tin_number',
    address: 'registered_address',
  },
  mayors_permit: {
    city: 'location_city',
    address: 'permit_address',
  },
};

/** The plain sentence for an expiry. Used by the screen as a note. */
export function validUntilNote(iso: string): string {
  return `Valid until ${formatLongDate(iso)}`;
}

/**
 * Map a model read onto the pair's own lines. Values go ONLY to field keys
 * that belong to this slot's pair, and only when the paper is the kind this
 * slot takes — a BIR form dropped into the DTI box must not produce a DTI
 * "mismatch" the supplier is then asked to fix.
 */
export function toPaperRead(
  slotKey: ReadableSlotKey,
  model: ModelPaperRead,
  readAtIso: string,
): PaperRead {
  const pair = VERIFICATION_PAIRS.find((p) => p.slotKey === slotKey) as VerificationPair;
  const pairKeys = new Set<PairFieldKey>(pair.fields.map((f) => f.key));
  const fits = SLOT_REGISTRIES[slotKey].has(model.registry);

  const values: Partial<Record<PairFieldKey, string>> = {};
  const notes: string[] = [];
  const put = (k: PairFieldKey, v: string | null) => {
    if (v && pairKeys.has(k)) values[k] = v;
  };

  if (fits) {
    if (slotKey === 'dti_certificate') {
      put('registered_business_name', model.accountName);
      put('business_owner_name', model.ownerName);
      put('registration_number_raw', model.registrationNumber);
    } else if (slotKey === 'bir_2303') {
      put('tin_number', model.registrationNumber);
      put('registered_address', model.address);
      if (model.accountName) notes.push(`Registered to ${model.accountName}`);
      if (model.rdo) notes.push(`RDO ${model.rdo}`);
    } else {
      put('location_city', model.city);
      put('permit_address', model.address);
      if (model.accountName) notes.push(`Issued to ${model.accountName}`);
      if (model.registrationNumber) notes.push(`Permit no. ${model.registrationNumber}`);
    }
    if (model.expirationDate) notes.push(validUntilNote(model.expirationDate));
  }

  const unreadable: PairFieldKey[] = fits
    ? Array.from(
        new Set(
          model.couldNotRead
            .map((k) => COULD_NOT_READ_MAP[slotKey][k])
            .filter((k): k is PairFieldKey => Boolean(k) && pairKeys.has(k as PairFieldKey)),
        ),
      )
    : pair.fields.map((f) => f.key);

  return {
    registry: model.registry,
    readAs: readAsSentence(model),
    notes,
    values,
    unreadable,
    // Keep today's answer — no registry is called by this build (out of scope).
    registryOutcome: 'no_registry',
    readAt: readAtIso,
    expiresOn: fits ? model.expirationDate : null,
    qrText: null,
    qrUnreadable: false,
  };
}

/**
 * The block written when the WORDS were not read (no key, a model error, a
 * reply we could not parse) but the paper was opened — so its QR still counts.
 * Says nothing it does not know: no registry, no values, no sentence.
 */
export function wordsNotReadPaperRead(readAtIso: string): PaperRead {
  return {
    registry: 'unreadable',
    readAs: null,
    notes: [],
    values: {},
    unreadable: [],
    registryOutcome: 'no_registry',
    readAt: readAtIso,
    expiresOn: null,
    qrText: null,
    qrUnreadable: false,
  };
}

// ---------------------------------------------------------------------------
// 🔳 The QR's link — what the ADMIN is told about it
// ---------------------------------------------------------------------------

/**
 * The registries' own hosts. A QR link counts as official ONLY when it is
 * https AND its host IS one of these or a subdomain of one — compared as a
 * whole host label by label, never as a substring, so `dti.gov.ph.evil.com`,
 * `evil-dti.gov.ph` and `https://dti.gov.ph@evil.com` all fail.
 */
export const OFFICIAL_QR_HOSTS: ReadonlyArray<{ host: string; label: string }> = [
  { host: 'dti.gov.ph', label: 'Official DTI site' },
  { host: 'sec.gov.ph', label: 'Official SEC site' },
  { host: 'bir.gov.ph', label: 'Official BIR site' },
];

export type QrVerdict =
  | { kind: 'official'; label: string; href: string }
  | { kind: 'not_government'; label: '⚠ Not a government site'; href: string }
  | { kind: 'text'; label: 'This QR holds text, not a link'; text: string }
  | { kind: 'unreadable'; label: 'Couldn’t read the QR — check by hand' }
  | { kind: 'none' };

/** Strict host match: equal, or ends in "." + the official host. */
export function hostIsUnder(hostname: string, official: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  return h === official || h.endsWith(`.${official}`);
}

/**
 * Pure. Never fetches the link — it only reads the string. `href` is the
 * parsed, re-serialised URL, so what the admin taps is exactly what was judged.
 */
export function classifyPaperQr(read: Pick<PaperRead, 'qrText' | 'qrUnreadable'> | null): QrVerdict {
  if (!read) return { kind: 'none' };
  const text = read.qrText;
  if (!text) {
    return read.qrUnreadable
      ? { kind: 'unreadable', label: 'Couldn’t read the QR — check by hand' }
      : { kind: 'none' };
  }
  let url: URL | null = null;
  try {
    url = new URL(text);
  } catch {
    url = null;
  }
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname) {
    return { kind: 'text', label: 'This QR holds text, not a link', text };
  }
  if (url.protocol === 'https:' && !url.username && !url.password) {
    const hit = OFFICIAL_QR_HOSTS.find((o) => hostIsUnder(url!.hostname, o.host));
    if (hit) return { kind: 'official', label: hit.label, href: url.href };
  }
  return { kind: 'not_government', label: '⚠ Not a government site', href: url.href };
}

/** What the bytes are. Sniffed from the file, never from its name. */
export type PaperFileKind = 'pdf' | 'jpeg' | 'png' | 'heic' | 'webp' | 'unknown';

export function sniffPaperFile(bytes: Uint8Array): PaperFileKind {
  if (bytes.length < 12) return 'unknown';
  const at = (i: number) => bytes[i]!;
  // %PDF may follow a few junk bytes in the wild; look in the first 1 KB.
  const head = Buffer.from(bytes.subarray(0, Math.min(1024, bytes.length))).toString('latin1');
  if (head.includes('%PDF-')) return 'pdf';
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpeg';
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'png';
  const box = Buffer.from(bytes.subarray(4, 12)).toString('latin1');
  if (box.startsWith('ftyp') && /^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)/.test(box)) return 'heic';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'webp';
  return 'unknown';
}

/**
 * 🔒 THE ONLY SHAPE OF WRITE THE READER MAY MAKE.
 *
 * Returns the next `doc_uploads` with `read` set on ONE slot and every other
 * byte untouched — or null when the slot no longer holds the file that was read
 * (the supplier replaced it while the model was thinking: a read of the old
 * paper must never be pinned onto the new one).
 */
export function mergeReadIntoDocUploads(
  docUploads: unknown,
  slotKey: ReadableSlotKey,
  r2KeyRead: string,
  read: PaperRead,
): Record<string, unknown> | null {
  if (!docUploads || typeof docUploads !== 'object' || Array.isArray(docUploads)) return null;
  const map = docUploads as Record<string, unknown>;
  const entry = map[slotKey];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const slot = entry as Record<string, unknown>;
  if (slot.r2_key !== r2KeyRead) return null;
  return { ...map, [slotKey]: { ...slot, read } };
}

/** The `r2_key` a slot holds, or null. */
export function slotR2Key(docUploads: unknown, slotKey: string): string | null {
  if (!docUploads || typeof docUploads !== 'object' || Array.isArray(docUploads)) return null;
  const entry = (docUploads as Record<string, unknown>)[slotKey];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const k = (entry as Record<string, unknown>).r2_key;
  return typeof k === 'string' && k.trim() ? k : null;
}
