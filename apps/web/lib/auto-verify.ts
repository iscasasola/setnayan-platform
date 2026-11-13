/**
 * auto-verify.ts — CLEAN PAPERS VERIFY THE SHOP ON SUBMIT. The pure decision.
 *
 * Owner ruling (DECISION_LOG "CLEAN PAPERS VERIFY THE SHOP ON SUBMIT"): *"by the
 * time they save it, they can be verified right there."* Supersedes "the read is
 * admin-only and never verifies" — for CLEAN papers only. Anything in doubt goes
 * to a person, exactly as before.
 *
 * ── THE ONE RULE ABOVE THE SIX ──────────────────────────────────────────────
 * The machine NEVER REFUSES anybody. Its two answers are `verify` and
 * `to_admin` ("Waiting for Setnayan"). There is no third. A check that cannot
 * be run — a model down, a registry unreachable, a duplicate lookup that
 * errored — is a check that did NOT pass, so it goes to a person.
 *
 * ── THE SIX CHECKS (named as the approved design names them) ────────────────
 *   1. All three papers read — DTI or SEC · BIR 2303 · the city's permit, each
 *      identified as the paper its box asks for, every needed line present and
 *      nothing listed as unreadable.
 *   2. The name agrees across them — after folding case, punctuation, spacing,
 *      "&"/"and" and legal suffixes, an EXACT match. "Similar" (one letter off)
 *      is a different business until a person says otherwise.
 *   3. Nothing expired — no printed expiry is past (Manila date), and the
 *      Mayor's Permit is valid for THIS year. No printed expiry passes (a BIR
 *      2303 has none).
 *   4. The DTI/SEC QR is official and carries the same number — an https link
 *      on the registry's own host (strict host match) whose URL holds the
 *      number printed on the paper. Without this, a real QR copied onto a fake
 *      paper would pass. When the live registry page was read and names the
 *      same name and number, that is recorded as the stronger proof; when it
 *      was read and says otherwise, the check fails.
 *   5. The number and TIN are on no other shop — and the TIN is 9–12 digits,
 *      the same TIN wherever it is printed.
 *   6. The reader was confident — every line marked `confident`.
 *
 * PURE. No network, no database, no clock (`todayManila` is passed in).
 */

import {
  OFFICIAL_QR_HOSTS,
  hostIsUnder,
  type ModelPaperRead,
  type ReadableSlotKey,
} from '@/lib/verification-paper-read';
import type { LivePageResult } from '@/lib/qr-live-check';

export type PaperEvidence = {
  slotKey: ReadableSlotKey;
  /** What the reader saw, or null when the words could not be read. */
  model: ModelPaperRead | null;
  /** Every QR found on the paper (every page of a PDF). */
  qrTexts: readonly string[];
  /** Set when the file itself was refused (type, size, damaged). */
  fileProblem: string | null;
  /**
   * TRUE when, after three unreadable tries, the supplier TYPED this paper's
   * details (owner ruling "ONE PAPER AT A TIME, UP TO THREE TRIES EACH").
   * Typed values are never evidence: a manual slot always goes to a person.
   */
  manual?: boolean;
};

export type AutoVerifyInput = {
  papers: readonly PaperEvidence[];
  /** The live registry page for the DTI/SEC QR, when one was opened. */
  livePage: LivePageResult | null;
  /** null = the lookup could not be run → not a pass. */
  duplicates: { registrationNumber: boolean | null; tin: boolean | null };
  /** `YYYY-MM-DD`, Asia/Manila. */
  todayManila: string;
};

export type CheckKey =
  | 'papers_read'
  | 'name_agrees'
  | 'nothing_expired'
  | 'qr_official'
  | 'not_on_another_shop'
  | 'reader_confident';

export type AutoCheck = {
  key: CheckKey;
  label: string;
  pass: boolean;
  /** One plain sentence: what was found (pass) or the exact reason (fail). */
  detail: string;
};

export type AutoVerifyDecision = {
  decision: 'verify' | 'to_admin';
  checks: AutoCheck[];
  /** The first failing check's detail, or the pass sentence. */
  reason: string;
};

export const CHECK_LABELS: Record<CheckKey, string> = {
  papers_read: 'All three papers read',
  name_agrees: 'The name agrees across them',
  nothing_expired: 'Nothing expired',
  qr_official: 'The DTI/SEC QR is official and carries the same number',
  not_on_another_shop: 'The number and TIN are on no other shop',
  reader_confident: 'The reader was confident',
};

const PAPER_NAME: Record<ReadableSlotKey, string> = {
  dti_certificate: 'DTI or SEC certificate',
  bir_2303: 'BIR 2303',
  mayors_permit: "Mayor's Permit",
};

const FITS: Record<ReadableSlotKey, ReadonlySet<string>> = {
  dti_certificate: new Set(['dti', 'sec']),
  bir_2303: new Set(['bir']),
  mayors_permit: new Set(['lgu']),
};

const SLOTS: readonly ReadableSlotKey[] = ['dti_certificate', 'bir_2303', 'mayors_permit'];

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Legal-form words that do not make two names different businesses. */
const LEGAL_SUFFIXES: ReadonlySet<string> = new Set([
  'inc',
  'incorporated',
  'corp',
  'corporation',
  'co',
  'company',
  'enterprise',
  'enterprises',
  'opc',
]);

/**
 * Fold a business name for comparison: case, accents, punctuation, spacing,
 * "&" = "and", and the legal-form words at the END ("INC.", "CORP.", "CO.",
 * "ENTERPRISE(S)"). Only trailing ones: "Co Ling Catering" keeps its "Co".
 */
export function foldBusinessName(name: string): string {
  const words = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1]!)) words.pop();
  return words.join(' ');
}

/** 0..1 similarity (Levenshtein), for SHOWING the admin how close — never for passing. */
export function nameSimilarity(a: string, b: string): number {
  const x = foldBusinessName(a);
  const y = foldBusinessName(b);
  if (!x.length && !y.length) return 1;
  const prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (x[i - 1] === y[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return 1 - prev[y.length]! / Math.max(x.length, y.length);
}

function namesOn(m: ModelPaperRead): string[] {
  return [m.accountName, m.ownerName].filter((n): n is string => Boolean(n && n.trim()));
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export function digitsOnly(s: string): string {
  return s.replace(/\D+/g, '');
}

/**
 * The TIN, if it is one: digits after stripping dashes and spaces, 9–12 long.
 * Any other character (a letter, a slash) and it is not a TIN we accept.
 */
export function tinDigits(raw: string | null): string | null {
  if (!raw) return null;
  const stripped = raw.replace(/[\s-]+/g, '');
  if (!/^\d{9,12}$/.test(stripped)) return null;
  return stripped;
}

/** For logs: only the last three digits survive. */
export function maskTin(raw: string | null): string | null {
  if (!raw) return null;
  const d = digitsOnly(raw);
  if (d.length < 4) return '•••';
  return `${'•'.repeat(d.length - 3)}${d.slice(-3)}`;
}

/** The paper's number folded to letters+digits, for finding it inside a URL. */
function foldNumber(s: string): string {
  return s.replace(/[^0-9a-z]/gi, '').toLowerCase();
}

/** Does the link carry this number? Whole-token on letters+digits, decoded. */
export function urlCarriesNumber(href: string, number: string): boolean {
  const n = foldNumber(number);
  if (n.length < 5) return false;
  let decoded = href;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    decoded = href;
  }
  // Split on anything that is not a letter or digit, so "5512034" does not match "55120340".
  const tokens = decoded.split(/[^0-9a-z]+/i).map((t) => t.toLowerCase());
  return tokens.includes(n);
}

/** The registry host a paper's QR must sit on. */
function officialFor(registry: string): { host: string; label: string } | null {
  if (registry === 'dti') return OFFICIAL_QR_HOSTS.find((o) => o.host === 'dti.gov.ph') ?? null;
  if (registry === 'sec') return OFFICIAL_QR_HOSTS.find((o) => o.host === 'sec.gov.ph') ?? null;
  return null;
}

/** The official https link on this paper for this registry, if any. */
export function officialQrLink(qrTexts: readonly string[], registry: string): URL | null {
  const off = officialFor(registry);
  if (!off) return null;
  for (const t of qrTexts) {
    let u: URL;
    try {
      u = new URL(t);
    } catch {
      continue;
    }
    if (u.protocol !== 'https:' || u.username || u.password) continue;
    if (hostIsUnder(u.hostname, off.host)) return u;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

export function decideAutoVerify(input: AutoVerifyInput): AutoVerifyDecision {
  const bySlot = new Map(input.papers.map((p) => [p.slotKey, p]));
  const checks: AutoCheck[] = [];
  const push = (key: CheckKey, pass: boolean, detail: string) =>
    checks.push({ key, label: CHECK_LABELS[key], pass, detail });

  // ── 1 · All three papers read ────────────────────────────────────────────
  const readProblems: string[] = [];
  for (const slot of SLOTS) {
    const p = bySlot.get(slot);
    const name = PAPER_NAME[slot];
    if (!p) { readProblems.push(`the ${name} is missing`); continue; }
    if (p.manual) { readProblems.push(`the ${name} was typed in by the supplier after three unreadable tries`); continue; }
    if (p.fileProblem) { readProblems.push(`the ${name}: ${p.fileProblem}`); continue; }
    const m = p.model;
    if (!m) { readProblems.push(`the ${name} could not be read`); continue; }
    if (!FITS[slot].has(m.registry)) { readProblems.push(`the paper in the ${name} box is not a ${name}`); continue; }
    if (m.couldNotRead.length > 0) { readProblems.push(`a line on the ${name} could not be made out (${m.couldNotRead.join(', ')})`); continue; }
    if (namesOn(m).length === 0) { readProblems.push(`no name was read on the ${name}`); continue; }
    if (slot !== 'mayors_permit' && !m.registrationNumber) { readProblems.push(`no number was read on the ${name}`); continue; }
  }
  const dti = bySlot.get('dti_certificate')?.model ?? null;
  const bir = bySlot.get('bir_2303')?.model ?? null;
  const permit = bySlot.get('mayors_permit')?.model ?? null;
  push(
    'papers_read',
    readProblems.length === 0,
    readProblems.length === 0
      ? `${dti?.registry === 'sec' ? 'SEC' : 'DTI'} certificate · BIR 2303 · ${permit?.city ? `${permit.city} ` : ''}Mayor's Permit — each read at Submit`
      : `Not read cleanly: ${readProblems.join('; ')}.`,
  );

  // ── 2 · The name agrees across them ──────────────────────────────────────
  {
    const sets = [dti, bir, permit].map((m) => (m ? namesOn(m) : []));
    const folded = sets.map((ns) => new Set(ns.map(foldBusinessName).filter(Boolean)));
    let common: string | null = null;
    if (folded.every((s) => s.size > 0)) {
      for (const cand of folded[0]!) {
        if (folded.every((s) => s.has(cand))) { common = cand; break; }
      }
    }
    if (common) {
      const shown = sets[0]!.find((n) => foldBusinessName(n) === common) ?? common;
      push('name_agrees', true, `"${shown}" on all three`);
    } else {
      // Show the admin the two closest names that are NOT the same.
      const a = sets[0]![0] ?? null;
      let best: { b: string; sim: number } | null = null;
      for (const other of [sets[1]!, sets[2]!]) {
        for (const b of other) {
          const sim = a ? nameSimilarity(a, b) : 0;
          if (!best || sim < best.sim) best = { b, sim };
        }
      }
      push(
        'name_agrees',
        false,
        a && best
          ? `The names differ: "${a}" and "${best.b}" (${Math.round(best.sim * 100)}% alike — a person decides).`
          : 'A name is missing on at least one paper, so they cannot be compared.',
      );
    }
  }

  // ── 3 · Nothing expired ──────────────────────────────────────────────────
  {
    const today = input.todayManila;
    const year = today.slice(0, 4);
    const bits: string[] = [];
    const problems: string[] = [];
    if (dti?.expirationDate) {
      if (dti.expirationDate < today) problems.push(`the ${dti.registry === 'sec' ? 'SEC' : 'DTI'} certificate ran out on ${dti.expirationDate}`);
      else bits.push(`${dti.registry === 'sec' ? 'SEC' : 'DTI'} valid until ${dti.expirationDate}`);
    }
    if (!permit?.expirationDate) {
      problems.push("the Mayor's Permit shows no valid-until date for this year");
    } else if (permit.expirationDate < today) {
      problems.push(`the Mayor's Permit ran out on ${permit.expirationDate}`);
    } else if (permit.expirationDate.slice(0, 4) < year) {
      problems.push(`the Mayor's Permit is not this year's`);
    } else {
      bits.push(`permit until ${permit.expirationDate}`);
    }
    if (bir?.expirationDate && bir.expirationDate < today) problems.push(`the BIR paper ran out on ${bir.expirationDate}`);
    else bits.push(bir?.expirationDate ? `BIR until ${bir.expirationDate}` : 'BIR 2303 has no expiry date');
    push('nothing_expired', problems.length === 0, problems.length === 0 ? bits.join(' · ') : `Out of date: ${problems.join('; ')}.`);
  }

  // ── 4 · The DTI/SEC QR is official and carries the same number ───────────
  {
    const p = bySlot.get('dti_certificate');
    const reg = dti?.registry ?? 'dti';
    const label = reg === 'sec' ? 'SEC' : 'DTI';
    const link = p && dti ? officialQrLink(p.qrTexts, dti.registry) : null;
    const number = dti?.registrationNumber ?? null;
    const live = input.livePage;
    if (!p || p.qrTexts.length === 0) {
      push('qr_official', false, `No QR could be read on the ${label} certificate — check it by hand.`);
    } else if (!link) {
      push('qr_official', false, `The ${label} QR is not a link on the official ${label} site (${p.qrTexts[0]!.slice(0, 120)}).`);
    } else if (!number) {
      push('qr_official', false, `No ${label} number was read on the paper to compare with the QR.`);
    } else if (live && live.outcome === 'reached' && !live.scriptOnly && (live.numberOnPage === false || live.nameOnPage === false)) {
      push(
        'qr_official',
        false,
        `The ${label} page the QR opens does not show ${live.numberOnPage === false ? `number ${number}` : 'the same name'} — a person checks.`,
      );
    } else if (!urlCarriesNumber(link.href, number)) {
      push('qr_official', false, `The official ${label} QR carries a different number from the one printed (${number}) — it may be copied from another paper.`);
    } else {
      const stronger =
        live && live.outcome === 'reached' && live.numberOnPage === true && live.nameOnPage === true
          ? ' · the registry page shows the same name and number'
          : '';
      push('qr_official', true, `${link.hostname} · number ${number}, same as printed on the paper${stronger}`);
    }
  }

  // ── 5 · The number and TIN are on no other shop (and the TIN is a TIN) ───
  {
    const problems: string[] = [];
    const tin = tinDigits(bir?.registrationNumber ?? null);
    if (!tin) problems.push('the TIN on the BIR 2303 is not 9–12 digits');
    else {
      // The same TIN wherever it is printed (base = first 9 digits; the branch code may differ).
      for (const [m, where] of [[dti, 'DTI/SEC certificate'], [bir, 'BIR 2303'], [permit, "Mayor's Permit"]] as const) {
        if (!m?.tin) continue;
        const other = digitsOnly(m.tin);
        if (other.length < 9 || other.slice(0, 9) !== tin.slice(0, 9)) problems.push(`the TIN on the ${where} is not the BIR 2303's`);
      }
    }
    if (input.duplicates.registrationNumber === null || input.duplicates.tin === null) {
      problems.push('the other-shop lookup could not be run');
    } else {
      if (input.duplicates.registrationNumber) problems.push('the same registration number is on another shop');
      if (input.duplicates.tin) problems.push('the same TIN is on another shop');
    }
    push(
      'not_on_another_shop',
      problems.length === 0,
      problems.length === 0
        ? `${dti?.registry === 'sec' ? 'SEC' : 'DTI'} ${dti?.registrationNumber ?? ''} and TIN ${maskTin(bir?.registrationNumber ?? null)} — no other shop has either`
        : `${problems[0]!.charAt(0).toUpperCase()}${problems.join('; ').slice(1)}.`,
    );
  }

  // ── 6 · The reader was confident ─────────────────────────────────────────
  {
    const unsure: string[] = [];
    for (const slot of SLOTS) {
      const m = bySlot.get(slot)?.model;
      if (!m) { unsure.push(`${PAPER_NAME[slot]} (not read)`); continue; }
      for (const k of m.unsure) unsure.push(`${PAPER_NAME[slot]} ${k.replace(/_/g, ' ')}`);
    }
    push(
      'reader_confident',
      unsure.length === 0,
      unsure.length === 0 ? 'Every line read clearly; none marked unsure' : `Marked unsure: ${unsure.join(', ')}.`,
    );
  }

  const failed = checks.find((c) => !c.pass);
  return {
    decision: failed ? 'to_admin' : 'verify',
    checks,
    reason: failed ? failed.detail : 'All six checks passed.',
  };
}
