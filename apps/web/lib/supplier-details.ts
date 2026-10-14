/**
 * YOUR DETAILS — the one list a supplier fills in, and the line that says how far they are
 * (simpler supplier dashboard, step 5 · prototype `supplier_easy_dashboard_2026-10-14_fable.html` moment 6,
 * `SCREENS.details`: "4 of 6 done · left: documents · how clients pay you").
 *
 * 🔑 THE SIX ARE THE SHIPPED CHECKS, GROUPED — NOTHING NEW IS COUNTED.
 *   · Name and logo   — `businessProfileChecklist` keys logo · business_name · business_owner_name · in_business_since_year
 *   · What you do     — `services` (+ `venue_size`, which the checklist adds only for a venue)
 *   · Where you work  — `maps_pin` (the HQ address)
 *   · Contact         — `contact_phone` · `contact_email`
 *   · Your documents  — the verification application (`requiredDocsComplete` + its status)
 *   · How clients pay you — at least one payment method (`vendor_payment_methods`)
 * About is the page's own paragraph — optional, never counted, so an empty About can never drag a finished shop
 * back below six. "Something wrong?" is a door, not a task.
 *
 * 🔑 A READ THAT FAILED IS NEVER "DONE" AND NEVER "NOT YET". The documents and the payment methods are their own
 * reads; when one could not be read its row says so ("Not read") and is left out of BOTH the count and the "left:"
 * list — telling a supplier who has three bank accounts that they have none is the failure this repo keeps fencing
 * (`reads-are-honest.test.ts`).
 *
 * Pure: no React, no database — the screen, the Shop row and the lab all read the same answer.
 */

import type { BadgeTone } from '@/app/_components/badge';
import { formatCount } from './format-number';

export type DetailsKey = 'name' | 'what' | 'where' | 'contact' | 'docs' | 'pay';

/** done · something for the supplier to do · Setnayan is checking · refused (fix it) · the read failed. */
export type DetailsState = 'done' | 'todo' | 'checking' | 'fix' | 'unknown';

export type DetailsRow = {
  key: DetailsKey;
  title: string;
  state: DetailsState;
  /** The state, as a badge (kind 11): icon-free, a colour AND 1–2 words. */
  badge: { tone: BadgeTone; word: string };
  /** The word that names this row in "left: …". */
  leftWord: string;
};

/** Checklist item keys (`businessProfileChecklist`) that each fold holds. */
export const DETAILS_CHECKLIST_KEYS: Readonly<Record<'name' | 'what' | 'where' | 'contact', readonly string[]>> = {
  name: ['logo', 'business_name', 'business_owner_name', 'in_business_since_year'],
  what: ['services', 'venue_size'],
  where: ['maps_pin'],
  contact: ['contact_phone', 'contact_email'],
};

export const DETAILS_TITLE: Readonly<Record<DetailsKey, string>> = {
  name: 'Name and logo',
  what: 'What you do',
  where: 'Where you work',
  contact: 'Contact',
  docs: 'Your documents',
  pay: 'How clients pay you',
};

const LEFT_WORD: Readonly<Record<DetailsKey, string>> = {
  name: 'name and logo',
  what: 'what you do',
  where: 'where you work',
  contact: 'contact',
  docs: 'documents',
  pay: 'how clients pay you',
};

export type DocsStatus =
  | 'draft'
  | 'pending_review'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | null;

export type DetailsInput = {
  /** `businessProfileChecklist(profile).items` — key + ok. */
  checklist: ReadonlyArray<{ key: string; ok: boolean }>;
  docs: {
    /** The application read. False = it failed; the row says "Not read". */
    measured: boolean;
    /** The shop is verified (`public_visibility = 'verified'`). */
    isVerified: boolean;
    status: DocsStatus;
    /** How many of the required papers are in. */
    requiredIn: number;
    requiredTotal: number;
  };
  /** How many payment methods the shop has; null = the read failed. */
  payMethods: number | null;
};

function checklistRow(
  key: 'name' | 'what' | 'where' | 'contact',
  checklist: DetailsInput['checklist'],
): DetailsRow {
  const mine = checklist.filter((i) => DETAILS_CHECKLIST_KEYS[key].includes(i.key));
  const missing = mine.filter((i) => !i.ok).length;
  const done = mine.length > 0 && missing === 0;
  return {
    key,
    title: DETAILS_TITLE[key],
    state: done ? 'done' : 'todo',
    badge: done
      ? { tone: 'ok', word: 'Done' }
      : { tone: 'wait', word: missing === 1 ? '1 left' : `${missing} left` },
    leftWord: LEFT_WORD[key],
  };
}

/** The documents row — the papers are done for the SUPPLIER once they are sent; Setnayan's check is ours. */
export function docsRow(docs: DetailsInput['docs']): DetailsRow {
  const base = { key: 'docs' as const, title: DETAILS_TITLE.docs, leftWord: LEFT_WORD.docs };
  if (docs.isVerified || docs.status === 'approved') {
    return { ...base, state: 'done', badge: { tone: 'ok', word: 'Verified' } };
  }
  if (!docs.measured) return { ...base, state: 'unknown', badge: { tone: 'quiet', word: 'Not read' } };
  if (docs.status === 'pending_review' || docs.status === 'in_review') {
    return { ...base, state: 'checking', badge: { tone: 'wait', word: 'Checking' } };
  }
  if (docs.status === 'rejected') return { ...base, state: 'fix', badge: { tone: 'no', word: 'Needs a fix' } };
  const left = Math.max(0, docs.requiredTotal - docs.requiredIn);
  return {
    ...base,
    state: 'todo',
    // All papers in but not sent yet: the one thing left is Send.
    badge: { tone: 'wait', word: left === 0 ? 'Send them' : `${left} left` },
  };
}

export function payRow(payMethods: number | null): DetailsRow {
  const base = { key: 'pay' as const, title: DETAILS_TITLE.pay, leftWord: LEFT_WORD.pay };
  if (payMethods === null) return { ...base, state: 'unknown', badge: { tone: 'quiet', word: 'Not read' } };
  return payMethods > 0
    ? { ...base, state: 'done', badge: { tone: 'ok', word: 'Done' } }
    : { ...base, state: 'todo', badge: { tone: 'wait', word: 'Not yet' } };
}

export type DetailsProgress = {
  rows: DetailsRow[];
  /** Rows the supplier has nothing left to do on (done, or sent and being checked). */
  done: number;
  of: 6;
  /** Rows with something left for the supplier, in list order. */
  left: DetailsRow[];
  /** A row could not be read — the count is then not a claim about the shop. */
  incomplete: boolean;
  /** The first row the thumb's "Add what is left" opens, or null. */
  firstLeft: DetailsKey | null;
};

export function detailsProgress(input: DetailsInput): DetailsProgress {
  const rows: DetailsRow[] = [
    checklistRow('name', input.checklist),
    checklistRow('what', input.checklist),
    checklistRow('where', input.checklist),
    checklistRow('contact', input.checklist),
    docsRow(input.docs),
    payRow(input.payMethods),
  ];
  const done = rows.filter((r) => r.state === 'done' || r.state === 'checking').length;
  const left = rows.filter((r) => r.state === 'todo' || r.state === 'fix');
  return {
    rows,
    done,
    of: 6,
    left,
    incomplete: rows.some((r) => r.state === 'unknown'),
    firstLeft: left[0]?.key ?? null,
  };
}

/**
 * The answer line (kind: the screen's one sentence). "4 of 6 done · left: documents · how clients pay you".
 * Six of six names what happens next instead of a count that only looks finished: papers sent → Setnayan is
 * checking your documents; verified → everything is in. (The prototype said "couples can book you" — that is not
 * true of a shop with no live service yet, and these details cannot know that; booking is the Shop row's claim.)
 */
export function detailsLine(p: DetailsProgress): string {
  const head = `${formatCount(p.done)} of ${formatCount(p.of)} done`;
  if (p.left.length > 0) return `${head} · left: ${p.left.map((r) => r.leftWord).join(' · ')}`;
  if (p.incomplete) return `${head} · some of it could not be read just now`;
  const docs = p.rows.find((r) => r.key === 'docs');
  if (docs?.state === 'checking') return `${head} · Setnayan is checking your documents`;
  return `${head} · everything is in`;
}
