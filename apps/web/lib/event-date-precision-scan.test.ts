/**
 * event-date-precision-scan.test.ts — a REPO SCAN, not a unit test.
 *
 * THE DEFECT THIS EXISTS FOR (found live 2026-07-30). `events.event_date` and
 * `events.event_date_precision` are two columns describing one fact. Precision
 * is `NOT NULL DEFAULT 'year'` (migration 20260603100000), so an `UPDATE` that
 * sets a real calendar day and forgets precision leaves the row saying
 * *"sometime in 2026"* — and countdown maths only runs at `'day'`
 * (`lib/progress-stages.ts`), so **everything that counts down skips that
 * event.** It is silent: no error, no empty state, just a wedding the app
 * refuses to count toward.
 *
 * BOTH production events carried it. The Save-the-Date builder backfills the
 * canonical `event_date` from the film's date, and it was the one writer of the
 * five that didn't set precision alongside — so `event_date = std_film_date`
 * with precision `'year'` on every event that had ever opened that builder.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────
 * Any `.update({ … })` on the `events` table whose payload names `event_date`
 * must also name `event_date_precision`.
 *
 * INSERTs are deliberately NOT covered: a new event legitimately starts at the
 * `'year'` default with a null date, and every creation path relies on it.
 * Non-literal payloads (`.update(patch)`) can't be read statically and are
 * skipped — they are listed in the failure message so a reviewer knows the
 * scan's blind spot rather than trusting a false green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const ROOTS = ['app', 'lib'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Strip comments so a doc-comment quoting `event_date:` can't trip the scan. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * The balanced `{ … }` object literal starting at `open`, or null when the call
 * passes something else (an identifier, a spread of a variable, a helper call).
 */
function objectLiteralAt(src: string, open: number): string | null {
  if (src[open] !== '{') return null;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

type Finding = { file: string; payload: string };

function scan(): { violations: Finding[]; opaque: string[]; checked: number } {
  const violations: Finding[] = [];
  const opaque: string[] = [];
  let checked = 0;

  for (const root of ROOTS) {
    for (const file of walk(resolve(WEB, root))) {
      const src = stripComments(readFileSync(file, 'utf8'));
      // Cheap pre-filter: the file must touch both the table and the column.
      if (!/from\(\s*['"]events['"]\s*\)/.test(src)) continue;
      if (!/\bevent_date\b/.test(src)) continue;

      const rel = relative(WEB, file);
      const re = /from\(\s*['"]events['"]\s*\)\s*(?:\r?\n\s*)?\.update\(\s*/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const open = m.index + m[0].length;
        const payload = objectLiteralAt(src, open);
        if (payload === null) {
          opaque.push(`${rel} (non-literal .update() payload)`);
          continue;
        }
        checked += 1;
        // `event_date:` as a KEY — not `event_date_precision:`, and not a read
        // of some other identifier that merely contains the substring.
        const setsDate = /(^|[{,\s])event_date\s*:/.test(payload);
        const setsPrecision = /(^|[{,\s])event_date_precision\s*:/.test(payload);
        if (setsDate && !setsPrecision) {
          violations.push({ file: rel, payload: payload.replace(/\s+/g, ' ').slice(0, 160) });
        }
      }
    }
  }
  return { violations, opaque, checked };
}

test('no events.event_date UPDATE forgets event_date_precision', () => {
  const { violations, opaque, checked } = scan();
  assert.ok(
    checked >= 3,
    `the scan found only ${checked} events.update() literal(s) — it has stopped ` +
      `matching the codebase's call shape and would pass vacuously. ` +
      `Opaque payloads seen: ${opaque.join(', ') || 'none'}`,
  );
  assert.deepEqual(
    violations,
    [],
    'These writes set events.event_date without advancing event_date_precision, ' +
      'so the row will claim year-level precision for a real calendar day and ' +
      'every countdown will skip the event:\n' +
      violations.map((v) => `  • ${v.file} → ${v.payload}`).join('\n'),
  );
});

test('the Save-the-Date backfill — the original defect — stays fixed', () => {
  // Named separately from the scan so the regression has its own red line: this
  // is the exact write that dated both production events at 'year' precision.
  const src = stripComments(
    readFileSync(
      resolve(WEB, 'app/dashboard/[eventId]/studio/save-the-date/actions.ts'),
      'utf8',
    ),
  );
  assert.match(
    src,
    /\.update\(\{\s*event_date:\s*filmDate,\s*event_date_precision:\s*'day'\s*\}\)/,
    'the film-date backfill must set precision to day in the SAME update',
  );
  assert.match(
    src,
    /\.is\('event_date',\s*null\)/,
    'and must stay guarded to events with no date, so it never clobbers a real one',
  );
});
