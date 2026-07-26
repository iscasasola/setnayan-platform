/**
 * Shared migration-schema parser — the ONE place the repo derives "what columns
 * does table X actually have" from `supabase/migrations`.
 *
 * EXTRACTED 2026-07-26 from `lib/export-coverage-guardrail.test.ts`, which built
 * it first, so the RA 10173 ERASURE guardrail can reuse it rather than grow a
 * second, subtly-different copy. Two parsers would be worse than one imperfect
 * one: they would disagree, and the disagreement would be invisible.
 *
 * ⚠ The honesty notes in the export guardrail's own docblock apply verbatim and
 * are not repeated here. In short: only regex-visible `CREATE TABLE public.<x>`
 * and `ALTER TABLE … ADD COLUMN` are seen. A table or column created inside a DO
 * block, via dynamic SQL/EXECUTE, in a non-`public` schema, or applied straight
 * to prod without a migration file is INVISIBLE to this parser and always will
 * be. Both consumers pin their classified sets against it (T10 in the export
 * guardrail, the SEEN test in the erasure guardrail) so a future narrowing of
 * the parser fails loudly instead of silently shrinking what is guarded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib/security
/** apps/web/lib/security → repo root is four levels up. */
export const MIGRATIONS_DIR = path.resolve(HERE, '..', '..', '..', '..', 'supabase', 'migrations');

/** Trailing table-constraint keywords that look like a column name at line start. */
const NOT_A_COLUMN = /^(constraint|primary|unique|foreign|check|exclude|like)$/i;

export type TableSchema = {
  /** union of every column name seen across ALL migrations */
  cols: Set<string>;
  /** subset of `cols` that carries `REFERENCES public.users(user_id)` */
  userFks: Set<string>;
};

/** Split a CREATE TABLE body on top-level commas — one entry per column/constraint. */
function splitTopLevel(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const USER_FK = /REFERENCES\s+public\.users\s*\(\s*user_id/i;

/**
 * table -> columns + which of them FK to public.users(user_id). Union (not
 * last-write) because several migrations DROP+CREATE the same table for
 * idempotency, and later ALTERs add columns.
 *
 * Segment-oriented, NOT line-oriented: a column declaration is frequently
 * wrapped across lines with its REFERENCES clause on the next one, e.g.
 *   customer_id    UUID NOT NULL
 *                  REFERENCES public.users(user_id) ON DELETE CASCADE,
 * (marketing_share_consents, 20261203000000_social_sharing_program.sql:72-73).
 * A line-oriented parser sees the name but never the FK.
 */
export function readSchema(migrationsDir: string = MIGRATIONS_DIR): Map<string, TableSchema> {
  const schema = new Map<string, TableSchema>();
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z0-9_]+)\s*\(/gi;
    let m: RegExpExecArray | null;
    while ((m = createRe.exec(sql))) {
      const table = m[1] ?? '';
      if (!table) continue;
      // Walk forward from the opening paren, balancing parens, to find the
      // matching close — the column body can contain nested parens (CHECK,
      // numeric(10,2), …) so a lazy regex would truncate it.
      let depth = 0;
      let end = -1;
      for (let i = createRe.lastIndex - 1; i < sql.length; i++) {
        if (sql[i] === '(') depth++;
        else if (sql[i] === ')') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end < 0) continue;

      const entry = schema.get(table) ?? { cols: new Set<string>(), userFks: new Set<string>() };
      // Strip `--` comments to END OF LINE, not just whole comment LINES.
      // A trailing inline comment routinely contains a comma:
      //   … ON DELETE SET NULL,  -- the rite (kasal/binyag/kumpil), if any
      // (20270514787557_phase2_person_connections_schema.sql:39). Under a
      // whole-line filter that comma survives, splitTopLevel breaks the segment
      // there, and the NEXT real column is swallowed into a segment starting
      // with leftover comment text — so the ^-anchored column regex never sees
      // it. Measured: the whole-line filter dropped 161 columns across 55
      // tables and silently pushed `people` and `vendor_meetings` OUT of the
      // enforced tier while the suite stayed green. T10 now makes that class of
      // silent narrowing impossible to ship.
      const body = sql.slice(createRe.lastIndex, end).replace(/--[^\n]*/g, '');
      for (const seg of splitTopLevel(body)) {
        const s = seg.trim();
        const col = /^([a-z0-9_]+)\s+[A-Za-z]/.exec(s)?.[1];
        if (!col || NOT_A_COLUMN.test(col)) continue;
        entry.cols.add(col);
        if (USER_FK.test(s)) entry.userFks.add(col);
      }
      schema.set(table, entry);
    }

    const alterRe = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?([a-z0-9_]+)([\s\S]*?);/gi;
    while ((m = alterRe.exec(sql))) {
      const entry = schema.get(m[1] ?? '');
      if (!entry) continue;
      const addRe = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z0-9_]+)([^,;]*)/gi;
      let a: RegExpExecArray | null;
      while ((a = addRe.exec(m[2] ?? ''))) {
        if (!a[1]) continue;
        entry.cols.add(a[1]);
        if (USER_FK.test(a[2] ?? '')) entry.userFks.add(a[1]);
      }
    }
  }
  return schema;
}
