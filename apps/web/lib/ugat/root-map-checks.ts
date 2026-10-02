/**
 * lib/ugat/root-map-checks.ts — the Root map's checks, as pure functions over
 * the committed Screens and Fields maps.
 *
 * Owner, 2026-10-02 (DECISION_LOG "ONE MAP OF THE APP" and the rows that amend
 * it): the map is a FIX LIST. Each check here turns the two generated maps into
 * findings, one per thing to fix, each with a STABLE KEY — no line numbers, no
 * counts (Rule 7: an anchor is a string) — so `scripts/check-ugat-screens.mjs`
 * can ratchet against a committed baseline: today's findings are recorded,
 * a new one fails CI, a fixed one only asks to be dropped from the baseline.
 *
 * Pure: no filesystem. The source-reading checks (landing words, shown values)
 * live in `scan-landings.ts` / `scan-shown-values.ts` and produce the same
 * `Finding` shape.
 */

import {
  EVENT_BOOKKEEPING_COLUMNS,
  isEventBookkeeping,
  EVENT_FACT_HOME_SCREENS,
  GENERIC_FACTS,
  canonicalFact,
  factOf,
  isKeyFact,
  type UgatFieldsMap,
} from './fields';
import type { UgatScreensMap } from './screens';

export type CheckId =
  | 'no-door'
  | 'broken-door'
  | 'one-home'
  | 'outside-home'
  | 'dropped-field'
  | 'never-read'
  | 'sanitizer'
  | 'missing-section'
  | 'wrong-words'
  | 'retarget'
  | 'typed-number'
  | 'duplicate';

export interface Finding {
  check: CheckId;
  /** Stable identity — what the baseline records. Never a line number or a count. */
  key: string;
  /** Screen ids (route patterns) the finding is about; empty when it is about a file. */
  screens: string[];
  /** The file to open first. */
  file: string;
  /** One plain-English sentence for the owner's report. */
  plain: string;
}

/**
 * What each check means and whether CI FAILS on a new finding (owner brief:
 * "CI fails on NEW no-door screens, new broken doors, new one-home violations,
 * new dropped fields, new typed live numbers, and new duplicates"). The others
 * are judgement calls a scanner cannot settle — a door's words, a column read
 * only by SQL nobody scanned, a sanitiser that is meant to drop keys — so they
 * are reported and baselined but warn instead of failing.
 */
export const CHECKS: Record<CheckId, { title: string; enforced: boolean; why: string }> = {
  'no-door': { title: 'Screens with no way in', enforced: true, why: 'a page nobody can reach without typing its address' },
  'broken-door': { title: 'Doors to nowhere', enforced: true, why: 'a link to an address, or a #section, that does not exist' },
  'missing-section': { title: 'Doors to a missing #section', enforced: true, why: 'the page exists but the place on it does not' },
  'one-home': { title: 'One fact, two homes', enforced: true, why: 'the same answer is saved in two places, so they can disagree' },
  'outside-home': { title: 'Event answers outside Your info', enforced: true, why: 'a screen saves an event answer that Event Details › Your info neither shows nor edits' },
  'dropped-field': { title: 'Filled in but not saved', enforced: true, why: 'a person fills a field and the save throws it away' },
  'typed-number': { title: 'Numbers that look live but are typed in', enforced: true, why: 'a count or amount written into the screen text instead of read' },
  duplicate: { title: 'The same fact shown twice on one screen', enforced: true, why: 'replace means remove — the old copy was left behind' },
  'never-read': { title: 'Saved but never used', enforced: false, why: 'a column the app writes and nothing reads' },
  sanitizer: { title: 'Sanitisers that drop keys', enforced: false, why: 'a cleaner that silently throws away what it does not know' },
  'wrong-words': { title: 'Doors whose words do not match where they land', enforced: false, why: 'a "Messages" row that opens the roster' },
  retarget: { title: 'Doors that still point at a forwarding stub', enforced: false, why: 'works, but through an old address — retarget at the real one' },
};

export const CHECK_ORDER: readonly CheckId[] = [
  'no-door',
  'broken-door',
  'missing-section',
  'one-home',
  'outside-home',
  'dropped-field',
  'typed-number',
  'duplicate',
  'never-read',
  'sanitizer',
  'wrong-words',
  'retarget',
];

/* ═══════════════════════════ shared ═══════════════════════════ */

const tableOf = (home: string) => home.split('.')[0]!;
/** Logs and audit trails record what happened; a value in one is a copy by design, never a home. */
const SNAPSHOT_TABLE = /snapshot|ledger|decision|token|_history|_versions?$|_archive/;
const LOG_TABLE = /(?:^|_)(?:audit|log|logs|history|events_log|outbox|queue)$|_audit_|^admin_audit/;
const columnOf = (home: string) => home.split('.').slice(0, 2).join('.');

/** Screens whose writes include `home` (or its column, for a jsonb key). */
function writersOf(fields: UgatFieldsMap, home: string): string[] {
  return fields.screens.filter((s) => s.writes.includes(home)).map((s) => s.id);
}

/* ═══════════════════════════ part 1's findings, ratcheted ═══════════════════════════ */

export function doorFindings(screens: UgatScreensMap): Finding[] {
  const out: Finding[] = [];
  for (const s of screens.screens) {
    if (s.status !== 'no-door') continue;
    out.push({
      check: 'no-door',
      key: s.route,
      screens: [s.id],
      file: s.file,
      plain: `${s.route} has no way in from inside the app.`,
    });
  }
  for (const b of screens.brokenDoors) {
    out.push({
      check: 'broken-door',
      key: `${b.from} → ${b.to}`,
      screens: [],
      file: b.from,
      plain: `A link in ${b.from} goes to ${b.to}, which no page answers.`,
    });
  }
  return out;
}

/* ═══════════════════════════ (2) ONE HOME ═══════════════════════════ */

/**
 * (a) ONE FACT, TWO HOMES — the same fact name written into two different
 * places that belong to the same thing (tables sharing a Root map node, or
 * one table holding it both as a column and inside a jsonb blob). Database
 * function parameters are not homes (`rpc:save.p_event_date` passes the value
 * on to a column), and bookkeeping names (`status`, `id`, `notes`…) are not
 * facts (see `GENERIC_FACTS`). A browser-store copy of an `events` fact is a
 * second home too.
 *
 * (b) EVENT ANSWERS OUTSIDE YOUR INFO — owner 2026-10-02: every answer about
 * an event lives in Event Details › Your info, and "no screen keeps its own
 * copy (it reads/writes the same field)". So a screen other than Your info that
 * writes an `events` column (or a key inside one) that Your info neither reads
 * nor writes is keeping an answer the home cannot show.
 */
export function oneHomeFindings(fields: UgatFieldsMap, tableNodes: Map<string, string[]>): Finding[] {
  const out: Finding[] = [];

  // ── (a) ──
  const homes = new Set<string>();
  for (const w of fields.writers) {
    for (const h of w.homes) {
      if (h.endsWith('.?') || h.startsWith('rpc:')) continue;
      if (LOG_TABLE.test(tableOf(h))) continue;
      homes.add(h);
    }
  }
  const eventFacts = new Set([...homes].filter((h) => tableOf(h) === 'events').map((h) => canonicalFact(factOf(h))));
  /** A browser-store key's fact is its last word: `setnayan:region` → `region`. */
  const factOfHome = (h: string) =>
    h.startsWith('store:')
      ? canonicalFact(factOf(h.replace(/^store:\w+\./, '').split(/[:./]/).pop() ?? ''))
      : canonicalFact(factOf(h));
  for (const s of fields.stores) if (eventFacts.has(factOfHome(s.key))) homes.add(s.key);
  const byFact = new Map<string, string[]>();
  for (const h of homes) {
    const fact = factOfHome(h);
    if (GENERIC_FACTS.has(fact) || isKeyFact(fact) || fact.length < 3) continue;
    if (!byFact.has(fact)) byFact.set(fact, []);
    byFact.get(fact)!.push(h);
  }
  /**
   * Which two homes are the SAME fact, not merely the same word:
   *  · one table, two different columns (`events.event_date` and a `date`
   *    inside `events.style_preferences`) — one record holding one answer twice;
   *  · an `events` column and a copy anywhere else (owner: every event answer
   *    has ONE home) — including a browser store.
   * Two different tables that happen to share a column name (`x_pos` on booths
   * and on tables, `archived` on a community) are two things with one word, so
   * the other table must be part of the EVENT's record in the Root map (its
   * node list includes TYPE-EVENTS). A snapshot, ledger or token row copies a
   * value ON PURPOSE — a frozen record of what was true at the time — and is
   * never a second home.
   */
  const isEventRecord = (t: string) => (tableNodes.get(t) ?? []).includes('TYPE-EVENTS') && !SNAPSHOT_TABLE.test(t);
  const related = (a: string, b: string): boolean => {
    if (a.startsWith('store:') || b.startsWith('store:')) return true;
    const ta = tableOf(a);
    const tb = tableOf(b);
    if (ta === tb) return columnOf(a) !== columnOf(b);
    if (ta === 'events') return isEventRecord(tb);
    if (tb === 'events') return isEventRecord(ta);
    return false;
  };
  for (const [fact, hs] of [...byFact].sort(([a], [b]) => a.localeCompare(b))) {
    if (hs.length < 2) continue;
    const left = [...hs].sort();
    while (left.length) {
      const seed = left.shift()!;
      const group = [seed];
      for (let i = 0; i < left.length; ) {
        if (group.some((g) => related(g, left[i]!))) group.push(...left.splice(i, 1));
        else i += 1;
      }
      if (group.length < 2) continue;
      group.sort();
      const screens = [...new Set(group.flatMap((h) => writersOf(fields, h)))].sort();
      const files = fields.writers.filter((w) => w.homes.some((h) => group.includes(h))).map((w) => w.from).sort();
      out.push({
        check: 'one-home',
        key: `${fact}: ${group.join(' + ')}`,
        screens,
        file: files[0] ?? '',
        plain: `"${fact.replace(/_/g, ' ')}" is saved in ${group.length} places (${group.join(', ')}), so they can disagree — pick one home.`,
      });
    }
  }

  // ── (b) ──
  const home = [...fields.screens.filter((s) => EVENT_FACT_HOME_SCREENS.includes(s.id)), ...(fields.homeParts ?? [])];
  const homeCols = new Set<string>();
  for (const s of home) for (const x of [...s.reads, ...s.writes]) homeCols.add(columnOf(x));
  const homeReadsAll = homeCols.has('events.*');
  // One finding per event field (not per screen × field): the fix is one move.
  const outside = new Map<string, Set<string>>();
  for (const s of fields.screens) {
    if (EVENT_FACT_HOME_SCREENS.includes(s.id)) continue;
    for (const w of s.writes) {
      if (tableOf(w) !== 'events' || w.endsWith('.?')) continue;
      const col = w.split('.')[1]!;
      if (isEventBookkeeping(col) || isKeyFact(col)) continue;
      if (homeReadsAll || homeCols.has(`events.${col}`)) continue;
      if (!outside.has(w)) outside.set(w, new Set());
      outside.get(w)!.add(s.id);
    }
  }
  for (const [w, ids] of outside) {
    const screens = [...ids].sort();
    out.push({
      check: 'outside-home',
      key: w,
      screens,
      file: fields.writers.find((x) => x.homes.includes(w))?.from ?? '',
      plain: `${w} is saved from ${screens.length === 1 ? screens[0] : `${screens.length} screens`}, but Event Details › Your info neither shows nor edits it.`,
    });
  }
  return dedupe(out);
}

/* ═══════════════════════════ (3) SAVED AND USED ═══════════════════════════ */

/**
 * FILLED IN BUT NOT SAVED — an input a form posts that its action never reads,
 * and a field an action reads whose value reaches no write, no row key, no
 * other function and no return. Both are a person's typing thrown away.
 */
export function droppedFieldFindings(fields: UgatFieldsMap): Finding[] {
  const out: Finding[] = [];
  const screensOfFile = (file: string) =>
    fields.screens.filter((s) => s.actions.some((a) => a.startsWith(`${file}#`))).map((s) => s.id);
  for (const a of fields.actions) {
    const [file, fn] = a.ref.split('#') as [string, string];
    for (const f of a.dropped) {
      out.push({
        check: 'dropped-field',
        key: `${a.ref} drops ${f}`,
        screens: screensOfFile(file),
        file,
        plain: `${fn} reads the field "${f}" and then does nothing with it — it is never saved.`,
      });
    }
  }
  for (const form of fields.forms) {
    for (const input of form.notRead) {
      out.push({
        check: 'dropped-field',
        key: `${form.from} posts ${input} to ${form.actions.map((x) => x.split('#')[1]).join('|')}`,
        screens: fields.screens.filter((s) => s.actions.some((a) => form.actions.includes(a))).map((s) => s.id),
        file: form.from,
        plain: `A form in ${form.from} sends "${input}", but ${form.actions.map((x) => x.split('#')[1]).join(' / ')} never reads it.`,
      });
    }
  }
  return dedupe(out);
}

/**
 * SAVED BUT NEVER USED — a column the app writes that nothing reads. `readers`
 * is every `table.column` some code or database function reads (built by the
 * caller from select lists, property reads and migration SQL — see
 * `scan-readers.ts`), so this function only does the set difference.
 */
export function neverReadFindings(fields: UgatFieldsMap, readers: Set<string>): Finding[] {
  const out: Finding[] = [];
  const written = new Map<string, string[]>();
  for (const w of fields.writers) {
    for (const h of w.homes) {
      if (h.endsWith('.?') || h.startsWith('rpc:') || h.startsWith('store:')) continue;
      const col = columnOf(h);
      if (!written.has(col)) written.set(col, []);
      written.get(col)!.push(w.from);
    }
  }
  for (const [col, files] of [...written].sort(([a], [b]) => a.localeCompare(b))) {
    const [table, column] = col.split('.') as [string, string];
    if (isKeyFact(column) || EVENT_BOOKKEEPING_COLUMNS.has(column)) continue;
    if (readers.has(col) || readers.has(`*.${column}`)) continue;
    out.push({
      check: 'never-read',
      key: col,
      screens: [...new Set(files.flatMap((f) => fields.screens.filter((s) => s.writes.some((w) => columnOf(w) === col)).map((s) => s.id)))].sort(),
      file: [...new Set(files)].sort()[0]!,
      plain: `${table}.${column} is saved but nothing in the app or the database reads it back.`,
    });
  }
  return out;
}

/* ═══════════════════════════ utilities ═══════════════════════════ */

export function dedupe(fs: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of fs) {
    const k = `${f.check}\u0000${f.key}`;
    const prev = seen.get(k);
    if (!prev) seen.set(k, { ...f, screens: [...f.screens].sort() });
    else prev.screens = [...new Set([...prev.screens, ...f.screens])].sort();
  }
  return [...seen.values()].sort((a, b) => a.check.localeCompare(b.check) || a.key.localeCompare(b.key));
}
