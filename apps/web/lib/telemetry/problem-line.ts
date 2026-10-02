/**
 * Problems · ONE PLAIN LINE per issue (owner 2026-10-02): e.g.
 *
 *     Send my reply button on the guest invitation — no answer · 6 times today · 1 in 40
 *
 * what was pressed · where · what went wrong · how often today · how often it
 * fails out of every try. The trace sits under it on the page; this line is for
 * a person, so it carries no code words where a plain one exists.
 *
 * Pure module.
 */

import type { FaultKind } from '@/lib/telemetry/fault-normalize';

/** Route pattern → the name a person would use. First match wins; order matters. */
const PAGE_NAMES: ReadonlyArray<[RegExp, string]> = [
  [/^\/\[slug\]\/invite/, 'the guest invitation'],
  [/^\/\[slug\]\/welcome/, 'the guest welcome page'],
  [/^\/\[slug\]/, "the event's public page"],
  [/^\/dashboard\/[^/]+\/launch/, 'the Maker'],
  [/^\/dashboard\/[^/]+\/guests/, 'the guest list'],
  [/^\/dashboard\/[^/]+\/budget/, 'the budget'],
  [/^\/dashboard\/[^/]+\/vendors/, "the couple's suppliers"],
  [/^\/dashboard\/[^/]+\/seating/, 'the seating plan'],
  [/^\/dashboard\/[^/]+\/orders/, 'orders'],
  [/^\/dashboard\/[^/]+\/website/, 'the Event Hub editor'],
  [/^\/dashboard\/(?:\[id\]|\[eventId\])(?:\/|$)/, 'the event dashboard'],
  [/^\/dashboard/, 'the account dashboard'],
  [/^\/vendor-dashboard\/messages/, 'supplier messages'],
  [/^\/vendor-dashboard\/services/, "the supplier's service cards"],
  [/^\/vendor-dashboard\/shop/, "the supplier's shop"],
  [/^\/vendor-dashboard/, 'the supplier dashboard'],
  [/^\/onboarding/, 'create-an-event'],
  [/^\/admin/, 'admin'],
  [/^\/login/, 'sign in'],
  [/^\/signup/, 'sign up'],
  [/^\/explore|^\/marketplace/, 'browse suppliers'],
  [/^\/api\//, 'a background request'],
  [/^\/$/, 'the home page'],
];

export function pageName(path: string | null | undefined): string | null {
  if (!path) return null;
  const p = path.split('#')[0]!;
  for (const [re, name] of PAGE_NAMES) if (re.test(p)) return name;
  return p;
}

const KIND_WORDS: Record<FaultKind, string> = {
  BUTTON_FAIL: 'did not work',
  SUPABASE_SAVE_ERROR: 'did not save',
  BLANK_FALLBACK: 'showed an empty fallback',
  OTHER: 'failed',
  SERVER_THROWN: 'broke on the server',
  ACTION_RETURNED_ERROR: 'said it failed',
  DB_WRITE_REFUSED: 'the database refused the save',
  DB_READ_REFUSED: 'the database refused the read',
  DB_ZERO_ROW: '"saved" but nothing changed',
  DB_UNREACHABLE: 'the database did not answer',
  BUTTON_TIMEOUT: 'no answer',
  UPLOAD_STALLED: 'upload stopped moving',
  PAGE_CRASH: 'the page crashed',
  DEAD_END: 'led nowhere',
  DEAD_TAP: 'tap did nothing',
  RAGE_TAP: 'tapped again and again',
  DROP_OFF: 'most people stop here',
};

export function kindWords(kind: string): string {
  return KIND_WORDS[kind as FaultKind] ?? 'failed';
}

/** "app/[slug]/actions.ts#submitRsvp" → "submit rsvp". */
function actionWords(action: string): string {
  const name = action.includes('#') ? action.slice(action.lastIndexOf('#') + 1) : action;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

const DEAD_END_WORDS: Record<string, string> = {
  not_found: 'a missing page',
  forwarded: 'an old address that forwards elsewhere',
  missing_section: 'a section that is not on the page',
};

export type ProblemLineInput = {
  kind: string;
  action: string;
  label: string | null;
  page: string | null;
  dayCount: number;
  dayDate: string | null;
  today: string;
  /** failures ÷ (successes + failures) today for this action, when both are known. */
  failures?: number;
  successes?: number;
};

/** "1 in 40" — or null when there is no success count to compare with. */
export function oneIn(failures: number | undefined, successes: number | undefined): string | null {
  if (!failures || failures <= 0 || successes === undefined || successes <= 0) return null;
  const n = Math.round((failures + successes) / failures);
  return n <= 1 ? 'every time' : `1 in ${n}`;
}

export function problemLine(i: ProblemLineInput): string {
  const where = pageName(i.page);
  let subject: string;
  if (i.kind === 'DEAD_END') {
    const reason = /^(not_found|forwarded|missing_section)\b/.exec(i.action)?.[1] ?? 'not_found';
    const to = /\s(\S+)\s←/.exec(i.action)?.[1];
    subject = `A link${to ? ` to ${to}` : ''}${where ? ` on ${where}` : ''}`;
    const head = `${subject} — led to ${DEAD_END_WORDS[reason] ?? 'nowhere'}`;
    return tail(head, i);
  }
  if (i.kind === 'DROP_OFF') {
    return tail(`${i.label ?? i.action} — ${kindWords(i.kind)}`, i);
  }
  if (i.label) {
    const l = i.label.trim();
    subject = /\b(button|link)$/i.test(l) ? l : `${l} button`;
  } else if (i.kind.startsWith('DB_')) {
    const target = i.action.replace(/^[A-Z]+\s+/, '').replace(/^rpc\//, '');
    subject = `${/^(GET|HEAD)\b/.test(i.action) ? 'Reading' : 'Saving to'} ${target.replace(/_/g, ' ')}`;
  } else if (i.action.includes('#')) {
    subject = `"${actionWords(i.action)}"`;
  } else {
    subject = i.action;
  }
  const head = `${subject}${where && !subject.includes(where) ? ` on ${where}` : ''} — ${kindWords(i.kind)}`;
  return tail(head, i);
}

function tail(head: string, i: ProblemLineInput): string {
  const parts = [head];
  const today = i.dayDate === i.today ? i.dayCount : 0;
  parts.push(today === 1 ? 'once today' : `${today} times today`);
  const rate = oneIn(i.failures, i.successes);
  if (rate) parts.push(rate);
  return parts.join(' · ');
}
