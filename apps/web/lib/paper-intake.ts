/**
 * paper-intake.ts — ONE UPLOAD PLACE; THE APP TELLS WHICH PAPER IT IS. The pure half.
 *
 * Owner rulings (DECISION_LOG, 2026-11-14):
 *   · "ONE UPLOAD PLACE — THE APP TELLS WHICH PAPER IT IS": no boxes chosen by
 *     the supplier, no order. Each file (each PAGE of a PDF) is classified and
 *     filed under the paper it turns out to be.
 *   · "VERIFICATION GOES ONE PAPER AT A TIME, UP TO THREE TRIES EACH": a try
 *     counts only when the paper was RECOGNISED but could not be read cleanly.
 *     Wrong kind, unknown, expired: not a try.
 *   · "ONLY CLEAN FILES ARE ACCEPTED": "we reject files that are unreadable. we
 *     only accept clean files." An unclear copy on try 1 or 2 is REFUSED and NOT
 *     KEPT — only its try is counted. Try 3 keeps the file and opens the typed
 *     form ("Yes, keep it"), which marks the paper MANUAL: it always goes to a
 *     person.
 *   · DTI and SEC are ONE paper (2026-09-09): if both arrive, the clearer read
 *     stays and the supplier is told only one is needed.
 *
 * 🔒 SEALED. Every slot this writes carries `sig`, an HMAC over what the final
 * decision will rely on (file, page, kind, tries, manual, the evidence). A
 * supplier CAN patch their own draft's `doc_uploads` through RLS, so on Submit
 * an unsealed or altered slot is treated as unread and goes to a person
 * (`openSealedEvidence`). The secret never leaves the server; this module is
 * handed only the derived key.
 *
 * PURE: no network, no database, no clock.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  toPaperRead,
  type ModelPaperRead,
  type ReadableSlotKey,
} from '@/lib/verification-paper-read';
import type { PaperRead } from '@/lib/verification-pairs';
import { formatLongDate } from '@/lib/format-date';

export const MAX_TRIES = 3;

export type DetectedKind = 'dti' | 'sec' | 'bir' | 'lgu' | 'other' | 'unknown';

/** What reading ONE page produced, before any filing decision. */
export type PageRead = {
  r2Key: string;
  /** 0-based page inside a PDF, or null for a picture. */
  page: number | null;
  /** The file failed the type / size / damage check — nothing was read. */
  fileProblem: string | null;
  /** null = the reader could not run (no key, model down). */
  model: ModelPaperRead | null;
  qrTexts: string[];
};

export type IntakeOutcome =
  | 'read_ok'
  | 'replaced'
  | 'only_one_needed'
  | 'unreadable'
  | 'tries_used_kept'
  | 'tries_used'
  | 'unknown'
  | 'other'
  | 'expired'
  | 'file_refused'
  | 'reader_unavailable';

export type IntakeReport = {
  r2Key: string;
  page: number | null;
  outcome: IntakeOutcome;
  slot: ReadableSlotKey | null;
  /** The plain sentence for the supplier. Never raw. */
  message: string;
  /** read_ok / replaced: the fields, for READ-ONLY autofill. */
  fields?: Record<string, string>;
  /** Tries used on that slot after this file. */
  attempts?: number;
};

export type SlotEvidence = {
  model: ModelPaperRead | null;
  qrTexts: string[];
  read_at: string;
};

/** What a filed paper looks like in `doc_uploads[slot]`. */
export type IntakeSlot = {
  r2_key?: string;
  uploaded_at?: string;
  page?: number | null;
  kind?: 'dti' | 'sec' | 'bir' | 'lgu';
  attempts: number;
  /** Set on the third unclear try: the file is kept and the supplier types. */
  manual?: boolean;
  typed?: Record<string, string>;
  typed_by_supplier?: boolean;
  evidence?: SlotEvidence;
  read?: PaperRead;
  /** The permit's address, geocoded — a PROPOSAL. Never the shop's pin until confirmed. */
  pin_proposal?: { lat: number; lng: number; address: string; city: string | null } | null;
  sig?: string;
};

const SLOT_OF: Record<'dti' | 'sec' | 'bir' | 'lgu', ReadableSlotKey> = {
  dti: 'dti_certificate',
  sec: 'dti_certificate',
  bir: 'bir_2303',
  lgu: 'mayors_permit',
};

const PAPER_WORD: Record<ReadableSlotKey, string> = {
  dti_certificate: 'DTI or SEC certificate',
  bir_2303: 'BIR 2303',
  mayors_permit: "Mayor's Permit",
};

export const INTAKE_MESSAGE = {
  unclear: 'This copy isn’t clear enough — please upload a cleaner one.',
  keptTyped: 'We still can’t read this copy, so we kept it. Type the details from the paper and a person at Setnayan will check them.',
  triesUsed: 'You’ve used your three tries for this paper — type the details from it instead.',
  unknown: 'We couldn’t tell which paper this is. Upload your DTI or SEC certificate, BIR 2303, or Mayor’s Permit.',
  other: 'This isn’t one of the three papers we need.',
  readerDown: 'We couldn’t read papers just now. Try again in a minute.',
} as const;

// ---------------------------------------------------------------------------

export function kindOf(model: ModelPaperRead | null): DetectedKind {
  if (!model) return 'unknown';
  const r = model.registry;
  if (r === 'dti' || r === 'sec' || r === 'bir' || r === 'lgu' || r === 'other') return r;
  return 'unknown';
}

/** A recognised paper is CLEAN when nothing is unreadable and its key lines are there. */
export function isCleanRead(model: ModelPaperRead): boolean {
  if (model.couldNotRead.length > 0) return false;
  if (!model.accountName && !model.ownerName) return false;
  if ((model.registry === 'dti' || model.registry === 'sec' || model.registry === 'bir') && !model.registrationNumber) {
    return false;
  }
  return true;
}

/** Higher = clearer. Used only to choose between a DTI and an SEC read. */
export function clarity(model: ModelPaperRead | null): number {
  if (!model) return -100;
  return -(model.unsure.length + model.couldNotRead.length * 2);
}

/** Has this paper run out (Manila date)? A permit must also be THIS year's. */
export function expiredOn(model: ModelPaperRead, todayManila: string): string | null {
  const exp = model.expirationDate;
  if (!exp) return null;
  if (exp < todayManila) return exp;
  if (model.registry === 'lgu' && exp.slice(0, 4) < todayManila.slice(0, 4)) return exp;
  return null;
}

function fieldsFor(slot: ReadableSlotKey, model: ModelPaperRead): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (k: string, v: string | null) => {
    if (v) out[k] = v;
  };
  if (slot === 'dti_certificate') {
    set('registered_business_name', model.accountName);
    set('business_owner_name', model.ownerName);
    set('registration_number_raw', model.registrationNumber);
  } else if (slot === 'bir_2303') {
    set('tin_number', model.registrationNumber);
    set('registered_address', model.address);
  } else {
    set('location_city', model.city);
    set('permit_address', model.address);
  }
  set('valid_until', model.expirationDate);
  return out;
}

function asSlot(v: unknown): IntakeSlot | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  return { ...(o as IntakeSlot), attempts: typeof o.attempts === 'number' && o.attempts >= 0 ? Math.floor(o.attempts) : 0 };
}

function hasCleanFile(slot: IntakeSlot | null): boolean {
  return Boolean(slot?.r2_key && slot.evidence?.model && !slot.manual);
}

// ---------------------------------------------------------------------------
// The seal
// ---------------------------------------------------------------------------

/** Exactly what the final decision relies on, in a fixed order. */
function sealPayload(slotKey: string, s: IntakeSlot): string {
  return JSON.stringify([
    'setnayan-paper-seal:v1',
    slotKey,
    s.r2_key ?? null,
    s.page ?? null,
    s.kind ?? null,
    s.attempts,
    s.manual === true,
    s.typed ?? null,
    s.evidence ?? null,
  ]);
}

export function sealSlot(slotKey: string, s: IntakeSlot, key: Uint8Array | string): IntakeSlot {
  const sig = createHmac('sha256', key).update(sealPayload(slotKey, s)).digest('base64url');
  return { ...s, sig };
}

/** The slot, if its seal is intact; else null (→ treated as unread → a person). */
export function openSealedSlot(slotKey: string, raw: unknown, key: Uint8Array | string): IntakeSlot | null {
  const s = asSlot(raw);
  if (!s || typeof s.sig !== 'string') return null;
  const want = createHmac('sha256', key).update(sealPayload(slotKey, s)).digest();
  let got: Buffer;
  try {
    got = Buffer.from(s.sig, 'base64url');
  } catch {
    return null;
  }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  return s;
}

// ---------------------------------------------------------------------------
// The merge — ONE pass over the whole request, applied to the CURRENT row
// ---------------------------------------------------------------------------

export type IntakeResult = {
  next: Record<string, unknown>;
  reports: IntakeReport[];
  /** Objects to DELETE from storage: everything not filed (only clean files are kept). */
  discard: string[];
  /** Slots this request changed (to be sealed). */
  touched: ReadableSlotKey[];
};

/**
 * File one request's pages into `doc_uploads`. Re-runnable on a fresher row
 * (the caller's compare-and-set retry), because it is a pure function of
 * (current row, pages): that is what keeps parallel uploads from losing a slot.
 */
export function mergeIntake(
  current: unknown,
  pages: readonly PageRead[],
  ctx: { nowIso: string; todayManila: string; key: Uint8Array | string },
): IntakeResult {
  const base: Record<string, unknown> =
    current && typeof current === 'object' && !Array.isArray(current) ? { ...(current as Record<string, unknown>) } : {};
  const reports: IntakeReport[] = [];
  const touched = new Set<ReadableSlotKey>();
  const keep = new Set<string>();
  const seen = new Set<string>();

  // A slot whose seal does not hold is not trusted as a clean file; only its
  // stored try count carries over.
  const slotNow = (k: ReadableSlotKey): IntakeSlot => {
    // Filed earlier in THIS request: the working copy (sealed at the end).
    if (touched.has(k)) return asSlot(base[k]) ?? { attempts: 0 };
    const raw = base[k];
    const sealed = openSealedSlot(k, raw, ctx.key);
    if (sealed) return sealed;
    const loose = asSlot(raw);
    return { attempts: loose?.attempts ?? 0 };
  };

  for (const p of pages) {
    seen.add(p.r2Key);
    const say = (r: Omit<IntakeReport, 'r2Key' | 'page'>) => reports.push({ r2Key: p.r2Key, page: p.page, ...r });

    if (p.fileProblem) {
      say({ outcome: 'file_refused', slot: null, message: p.fileProblem });
      continue;
    }
    if (!p.model) {
      say({ outcome: 'reader_unavailable', slot: null, message: INTAKE_MESSAGE.readerDown });
      continue;
    }
    const kind = kindOf(p.model);
    if (kind === 'unknown') {
      say({ outcome: 'unknown', slot: null, message: INTAKE_MESSAGE.unknown });
      continue;
    }
    if (kind === 'other') {
      say({ outcome: 'other', slot: null, message: INTAKE_MESSAGE.other });
      continue;
    }
    const slot = SLOT_OF[kind];
    const cur = slotNow(slot);

    if (!isCleanRead(p.model)) {
      if (hasCleanFile(cur)) {
        // A clean copy is already filed: an unclear one never knocks it out, and is not a try.
        say({ outcome: 'unknown', slot, message: `Your ${PAPER_WORD[slot]} is already in — this copy was not clearer, so we kept the one you sent before.` });
        continue;
      }
      if (cur.attempts >= MAX_TRIES) {
        say({ outcome: 'tries_used', slot, message: INTAKE_MESSAGE.triesUsed, attempts: cur.attempts });
        continue;
      }
      const attempts = cur.attempts + 1;
      if (attempts < MAX_TRIES) {
        // REFUSED AND NOT KEPT — only the try is written.
        base[slot] = { ...stripFile(cur), attempts };
        touched.add(slot);
        say({ outcome: 'unreadable', slot, message: INTAKE_MESSAGE.unclear, attempts });
        continue;
      }
      // The third unclear try: KEEP the file, open the typed form.
      base[slot] = {
        r2_key: p.r2Key,
        uploaded_at: ctx.nowIso,
        page: p.page,
        kind,
        attempts,
        manual: true,
        evidence: { model: p.model, qrTexts: p.qrTexts, read_at: ctx.nowIso },
        read: toPaperRead(slot, p.model, ctx.nowIso),
      } satisfies IntakeSlot;
      touched.add(slot);
      keep.add(p.r2Key);
      say({ outcome: 'tries_used_kept', slot, message: INTAKE_MESSAGE.keptTyped, attempts });
      continue;
    }

    const exp = expiredOn(p.model, ctx.todayManila);
    if (exp) {
      // REFUSED, NOT STORED, NOT A TRY (owner: "we also detect if the document is expired").
      say({ outcome: 'expired', slot, message: `This ${PAPER_WORD[slot]} ended on ${formatLongDate(exp)} — please upload your current one.` });
      continue;
    }

    // DTI or SEC — ONE paper. Keep the clearer; tell them only one is needed.
    if (slot === 'dti_certificate' && cur.kind && cur.kind !== kind && hasCleanFile(cur)) {
      if (clarity(cur.evidence?.model ?? null) >= clarity(p.model)) {
        say({ outcome: 'only_one_needed', slot, message: 'Only one of DTI or SEC is needed — we kept the clearer one you sent before.' });
        continue;
      }
    }

    const replacing = hasCleanFile(cur);
    const prior = cur.r2_key ?? null;
    base[slot] = {
      r2_key: p.r2Key,
      uploaded_at: ctx.nowIso,
      page: p.page,
      kind,
      attempts: cur.attempts,
      evidence: { model: p.model, qrTexts: p.qrTexts, read_at: ctx.nowIso },
      read: { ...toPaperRead(slot, p.model, ctx.nowIso), qrText: p.qrTexts[0] ?? null, qrUnreadable: p.qrTexts.length === 0 },
    } satisfies IntakeSlot;
    touched.add(slot);
    keep.add(p.r2Key);
    if (prior && prior !== p.r2Key) keep.delete(prior);
    const crossKind = replacing && cur.kind && cur.kind !== kind && slot === 'dti_certificate';
    say({
      outcome: replacing ? (crossKind ? 'only_one_needed' : 'replaced') : 'read_ok',
      slot,
      message: replacing
        ? crossKind
          ? 'Only one of DTI or SEC is needed — this one was clearer, so it replaced the other.'
          : `This replaced the ${PAPER_WORD[slot]} you sent before.`
        : `Read as your ${PAPER_WORD[slot]}.`,
      fields: fieldsFor(slot, p.model),
      attempts: cur.attempts,
    });
  }

  // Anything this request brought that is not filed now is not kept.
  const filed = new Set<string>();
  for (const k of ['dti_certificate', 'bir_2303', 'mayors_permit'] as const) {
    const s = asSlot(base[k]);
    if (s?.r2_key) filed.add(s.r2_key);
  }
  const discard = [...seen].filter((r) => !filed.has(r));

  for (const k of touched) {
    base[k] = sealSlot(k, base[k] as IntakeSlot, ctx.key);
  }
  return { next: base, reports, discard, touched: [...touched] };
}

function stripFile(s: IntakeSlot): IntakeSlot {
  return { attempts: s.attempts };
}

/**
 * The typed form, after the third try (owner: "Yes, keep it"). Only for a
 * slot that is MANUAL — never to overwrite a clean read — and the typed values
 * are stored apart from the evidence: they are never evidence.
 */
export function fileTypedValues(
  current: unknown,
  slot: ReadableSlotKey,
  typed: Record<string, string>,
  key: Uint8Array | string,
): { ok: true; next: Record<string, unknown> } | { ok: false; error: string } {
  const base: Record<string, unknown> =
    current && typeof current === 'object' && !Array.isArray(current) ? { ...(current as Record<string, unknown>) } : {};
  const s = openSealedSlot(slot, base[slot], key);
  if (!s || !s.manual || s.attempts < MAX_TRIES || !s.r2_key) {
    return { ok: false, error: 'Type the details only after three tries.' };
  }
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(typed)) {
    if (typeof v === 'string' && v.trim()) clean[k.slice(0, 40)] = v.trim().slice(0, 300);
  }
  base[slot] = sealSlot(slot, { ...s, typed: clean, typed_by_supplier: true, manual: true }, key);
  return { ok: true, next: base };
}

/**
 * Compare-and-set loop: load the row, merge, save only if nobody wrote in
 * between; otherwise merge AGAIN on the fresher row. The merge is pure, so a
 * retry can never lose a slot another upload filed meanwhile.
 */
export async function casMerge<T>(args: {
  load: () => Promise<{ docUploads: unknown; version: string | null } | null>;
  save: (next: Record<string, unknown>, version: string | null) => Promise<boolean>;
  merge: (current: unknown) => T & { next: Record<string, unknown> };
  tries?: number;
}): Promise<(T & { next: Record<string, unknown> }) | null> {
  for (let i = 0; i < (args.tries ?? 5); i++) {
    const row = await args.load();
    if (!row) return null;
    const out = args.merge(row.docUploads);
    if (await args.save(out.next, row.version)) return out;
  }
  return null;
}
