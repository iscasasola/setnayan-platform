/**
 * scan-readers.ts — the two source-reading halves of the SAVED-AND-USED check
 * (Root map part 2, slice 3).
 *
 * Owner, 2026-10-02 (DECISION_LOG "THE ROOT MAP ALSO CATCHES … 'FILLED IN BUT
 * NOT SAVED'"): every field a person fills must be written into its one home
 * AND read back somewhere — "filled-but-dropped and saved-but-ignored are both
 * failures; a sanitiser that silently drops keys is flagged".
 *
 *   readers      every place a column can be READ: a select list (`t.c`), a
 *                property read off a row (`row.c`, `{ c } = row` — `*.c`, any
 *                table), a filter (`.eq('c', …)`), a string naming it, and the
 *                database's own SQL (functions, views, policies, triggers).
 *                Generous on purpose: "saved but never used" must mean nothing
 *                at all reads it, so every doubt counts as a read.
 *   sanitizers   functions that keep only the keys they know
 *                (`Object.entries(x).filter(…)`, `ALLOWED.has(k)`, `delete o[k]`)
 *                and whose output a writing file uses.
 *
 * Filesystem access — generator, tests and the CI check only.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

import { listSources, readQuoted, readTemplate } from './scan-screens';
import { parseSelect } from './scan-fields';
import type { Finding } from './root-map-checks';

const COLUMN_WORD = /^[a-z][a-z0-9_]*$/;

/** Every string literal in `src` with its start index. */
function stringsIn(src: string): Array<{ value: string; at: number }> {
  const out: Array<{ value: string; at: number }> = [];
  let k = 0;
  while (k < src.length) {
    const c = src[k];
    if (c === "'" || c === '"') {
      const r = readQuoted(src, k);
      out.push({ value: r.value, at: k });
      k = r.end;
      continue;
    }
    if (c === '`') {
      const r = readTemplate(src, k);
      out.push({ value: r.lit.value, at: k });
      k = r.end;
      continue;
    }
    k += 1;
  }
  return out;
}

export function scanReaders(webRoot: string, migrationsDir = join(webRoot, '../../supabase/migrations')): Set<string> {
  const out = new Set<string>();
  for (const rel of listSources(webRoot)) {
    let src: string;
    try {
      src = stripComments(readFileSync(join(webRoot, rel), 'utf8'));
    } catch {
      continue;
    }
    // Property reads: `row.c`, `row?.c` — not an assignment `row.c = …`.
    for (const m of src.matchAll(/\??\.([a-z][a-z0-9_]*)\b(?!\s*=(?![=>]))/g)) out.add(`*.${m[1]}`);
    // Destructuring off a row: `const { a, b: x } = row`.
    for (const m of src.matchAll(/\{([^{}()=;]{1,600})\}\s*=(?![=>])/g)) {
      for (const part of m[1]!.split(',')) {
        const name = part.trim().split(/[:=\s]/)[0]!;
        if (COLUMN_WORD.test(name)) out.add(`*.${name}`);
      }
    }
    // Strings: a select list, a filter column, a key list — anything but a
    // form field name (`formData.get('c')` is the WRITE path).
    for (const s of stringsIn(src)) {
      const before = src.slice(Math.max(0, s.at - 12), s.at);
      if (/\.(?:get|getAll|has|set|append)\(\s*$/.test(before)) continue;
      const v = s.value.replace(/\u0000/g, '');
      if (COLUMN_WORD.test(v)) {
        out.add(`*.${v}`);
        continue;
      }
      if (/[,(]/.test(v) && v.length < 4000) for (const c of parseSelect('*', v)) out.add(c);
    }
    // Explicit select lists with their table, for the record.
    for (const m of src.matchAll(/\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)\s*\.select\(\s*['"`]([^'"`]*)['"`]/g)) {
      for (const c of parseSelect(m[1]!, m[2]!)) out.add(c);
    }
  }
  // The database reads too: functions, views, policies, triggers, constraints.
  if (existsSync(migrationsDir)) {
    for (const f of readdirSync(migrationsDir).sort()) {
      if (!f.endsWith('.sql')) continue;
      const sql = readFileSync(join(migrationsDir, f), 'utf8').replace(/--[^\n]*/g, '');
      for (const line of sql.split('\n')) {
        // A column's own definition is not a read of it.
        if (/^\s*(?:add\s+column\s+(?:if\s+not\s+exists\s+)?)?"?[a-z_][a-z0-9_]*"?\s+(?:text|int|integer|bigint|smallint|numeric|boolean|bool|uuid|jsonb|json|date|timestamptz|timestamp|time|real|double|serial|bigserial|varchar|char|citext|inet|bytea|interval)\b/i.test(line)) continue;
        if (/^\s*comment\s+on\s+column/i.test(line)) continue;
        for (const m of line.matchAll(/\b([a-z][a-z0-9_]*)\b/g)) out.add(`*.${m[1]}`);
      }
    }
  }
  return out;
}

/* ═══════════════════════════ sanitizers ═══════════════════════════ */

const SANITIZER_NAME = /^(?:sanitize|sanitise|clean|strip|scrub|whitelist|allowlist|pick|filterKnown|onlyKnown)\w*$/;
const DROPS_KEYS =
  /(?:Object\.(?:entries|keys)\([^)]*\)[\s\S]{0,240}?\.filter\()|(?:\b\w*(?:ALLOWED|ALLOW|KNOWN|VALID|PERMITTED|allowed|known|permitted)\w*\.(?:has|includes)\(\s*(?:k|key|name|field|prop)\b)|(?:\bdelete\s+\w+\[\s*\w+\s*\])/;

export function scanSanitizers(webRoot: string, writerFiles: Set<string>): Finding[] {
  const out: Finding[] = [];
  const sources = listSources(webRoot);
  const srcOf = new Map<string, string>();
  const read = (rel: string) => {
    if (!srcOf.has(rel)) {
      try {
        srcOf.set(rel, stripComments(readFileSync(join(webRoot, rel), 'utf8')));
      } catch {
        srcOf.set(rel, '');
      }
    }
    return srcOf.get(rel)!;
  };
  // name → files that call it AND write.
  const writers = [...writerFiles].filter((f) => sources.includes(f));
  for (const rel of sources) {
    const src = read(rel);
    for (const m of src.matchAll(/\b(?:export\s+)?(?:function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\(|const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:<[^>]*>)?\()/g)) {
      const name = (m[1] ?? m[2])!;
      if (!SANITIZER_NAME.test(name)) continue;
      const body = src.slice(m.index!, m.index! + 2500);
      const end = body.search(/\n(?:export\s+)?(?:async\s+)?function\s|\nexport\s+const\s/);
      const fnText = end > 0 ? body.slice(0, end) : body;
      if (!DROPS_KEYS.test(fnText)) continue;
      const callRe = new RegExp(`(?<![\\w$.])${name}\\s*\\(`);
      const users = writers.filter((w) => w !== rel ? callRe.test(read(w)) : (src.match(new RegExp(`(?<![\\w$.])${name}\\s*\\(`, 'g'))?.length ?? 0) > 1);
      if (users.length === 0) continue;
      out.push({
        check: 'sanitizer',
        key: `${rel}#${name}`,
        screens: [],
        file: rel,
        plain: `${name} (${rel}) keeps only the keys it knows and silently drops the rest before ${users.length === 1 ? users[0] : `${users.length} files`} save${users.length === 1 ? 's' : ''}.`,
      });
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}
