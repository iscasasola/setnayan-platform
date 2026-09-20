/**
 * Static scanner for TWO EXPORTED MONEY HELPERS THAT SHARE A NAME, and for a
 * money helper that throws the centavos away without saying why.
 *
 * WHY THIS EXISTS
 * ---------------
 * PR #5744: a real booking fee of ₱837.50 printed as **₱838** on the screen
 * whose only job is to name the figure to type into GCash. PR #5756: three
 * places rounded money BEFORE STORING IT, and traced the cause to
 * `lib/vendor-service-payment-schedules.ts` exporting `centavosToPhp` as
 * `Math.round(centavos / 100)` beside an identically-named, correct function in
 * `lib/payouts.ts`. On 2026-09-20 a sweep found the same shape four more times:
 *
 *     formatPhp          × 4 definitions, 2 behaviours (orders · budget · vendors · answer)
 *     formatCentavosPhp  × 3 definitions, 2 behaviours (payouts · vendor-packages · sku-catalog)
 *     formatCentavos     × 2 definitions
 *     centavosToPhp      × 2 definitions, 2 behaviours
 *     phpToCentavos      × 2 definitions
 *
 * 🔑 THE CALL SITE READS THE SAME EITHER WAY. `formatPhp(owedPhp)` is the same
 * fourteen characters whichever module the import line above it names; only
 * that line decides whether the couple is told ₱837.50 or ₱838. Nothing goes
 * red, because both definitions are correct TypeScript and both are correct
 * for SOMETHING. A reviewer reading the diff sees a function call, not a fork.
 *
 * WHAT IT ENFORCES (the test is money-formatter-scan.test.ts)
 * ----------------------------------------------------------
 *  R1 · COLLISION — no two DEFINITIONS of a money helper may be exported under
 *       one name. A re-export (`export { formatPhp } from './php'`) is not a
 *       definition and is the intended way to keep a name where its importers
 *       already look, so consolidating never forces an import churn.
 *  R2 · SILENT ROUNDING — a money helper that drops the fraction must carry the
 *       marker `@rounds-to-the-peso` in its own docblock. The marker is not a
 *       licence; it is a REASON that a reviewer can read and a grep can find.
 *
 * R1 runs against a committed baseline (house pattern:
 * `scripts/dup-rule.baseline.txt`). The baseline may only shrink: the test
 * fails on a collision that is NOT in it, AND on a baseline row that no longer
 * names a real collision, so a paid-down row cannot sit there rotting.
 *
 * HONEST LIMITS — read these before trusting a green run
 * ------------------------------------------------------
 *  1. REGEX OVER COMMENT-STRIPPED SOURCE, not a type checker. `export const f =
 *     (n) => …` arrow forms, destructured re-exports and `export *` are NOT
 *     seen. Under-reporting is the deliberate direction.
 *  2. A HELPER IS FOUND BY WHAT ITS BODY DOES, never by its name — it either
 *     emits a peso string (`₱` / `currency: 'PHP'`) or converts between pesos
 *     and centavos (`* 100` / `/ 100` under a php|peso|centavo name). Naming a
 *     function `renderAmount` does not hide it; naming one `formatPhp` when it
 *     formats nothing does not catch it.
 *  3. R2 CANNOT SEE INTENT. It sees `maximumFractionDigits: 0`, a peso-level
 *     `Math.round|floor|ceil|trunc`, or `toFixed(0)`. A helper that rounds by
 *     some other arithmetic passes — R2 is a floor under the obvious case, not
 *     a proof.
 *  4. TESTS ARE OUT OF SCOPE on both sides (see `isTestFile`): a fixture
 *     formatter is the normal way to write an expectation.
 *  5. CALL SITES ARE NOT CLASSIFIED. Green means "one definition per name, and
 *     every rounding one says why". It does NOT mean each call site picked the
 *     right helper — no static rule can know whether `totalPhp` is a bill or a
 *     benchmark. That judgement lives in the PR, not here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { collectSourceFiles, isTestFile, APP_ROOT } from './shadowed-export-scan';
import { stripComments } from './source-text';

/** One exported money helper, as defined in exactly one place. */
export type MoneyHelper = {
  /** apps/web-relative path */
  file: string;
  line: number;
  name: string;
  /** 'formatter' emits a ₱ string · 'converter' moves between pesos + centavos */
  kind: 'formatter' | 'converter';
  /** the helper drops the fraction (see limit 3) */
  roundsToThePeso: boolean;
  /** its docblock carries the `@rounds-to-the-peso` marker */
  declaresRounding: boolean;
};

/** Two or more definitions sharing one exported name. */
export type NameCollision = {
  name: string;
  /** apps/web-relative paths, sorted — the stable baseline key is `name\tfiles` */
  files: string[];
  key: string;
};

export const ROUNDING_MARKER = '@rounds-to-the-peso';

/**
 * THE ESCAPE HATCH, AND WHY IT IS A SEPARATE WORD. A few helpers round
 * something that is NOT money in a body that also renders money —
 * `setnayanGiftBillClause` formats a PHOTO COUNT with
 * `maximumFractionDigits: 0` and sends its pesos through `pesoText`. No static
 * rule can tell those apart, and writing `@rounds-to-the-peso` on such a
 * function would be a lie that a later reader acts on. This marker says
 * "the scanner is looking at the wrong number here", and it still costs a
 * sentence that a reviewer can check.
 */
export const NOT_MONEY_MARKER = '@not-a-money-rounder';

/** A peso figure, in source. */
const EMITS_PESO_RE = /₱|currency:\s*'PHP'|currency:\s*"PHP"/;

/** A body that moves between pesos and centavos … */
const CONVERTS_RE = /(?:\*|\/)\s*100\b/;
/**
 * …under a name that SAYS it is a unit conversion. `xToPhp` / `xToCentavos` is
 * the shape `centavosToPhp` and `phpToCentavos` share; a function merely
 * carrying `php` in its name (`bookingFeePhp`, `paidToVendorPhp`) computes a
 * figure rather than converting a unit, and is out of scope.
 */
const CONVERTER_NAME_RE = /To(?:Php|Peso|Pesos|Centavos)$/i;

/**
 * DOES THIS BODY THROW THE CENTAVOS AWAY?
 *
 * Three shapes count, and the third is where a regex alone kept getting it
 * wrong — so the rounding call's argument is extracted with balanced
 * parentheses rather than matched:
 *
 *   `maximumFractionDigits: 0`  · the Intl spelling
 *   `toFixed(0)`                · the string spelling
 *   `Math.round|floor|ceil|trunc(x)` where `x` is ALREADY IN PESOS
 *
 * ⚖ TWO ROUNDINGS ARE CENTAVO-PRECISE AND MUST NOT BE FLAGGED, and both live
 * in `lib/payouts.ts`, the module that had it right all along:
 *
 *   `Math.round(php * 100)`  → the product is centavos; rounding it is exact.
 *   `Math.round(centavos) / 100` → rounds BEFORE the divide, so nothing is lost.
 *
 * `Math.round(centavos / 100)` — one pair of parentheses away from the second —
 * is the bug PR #5756 traced. Telling those two apart is the entire job, which
 * is why it is a function with a paren counter and not an alternation.
 */
function roundedArgument(body: string, at: number): string {
  const open = body.indexOf('(', at);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < body.length; i += 1) {
    if (body[i] === '(') depth += 1;
    else if (body[i] === ')') {
      depth -= 1;
      if (depth === 0) return body.slice(open + 1, i);
    }
  }
  return '';
}

/** `* 100` / `* PESO` anywhere in the expression → the value is centavos. */
const TO_CENTAVOS_RE = /\*\s*(?:100|PESO)\b/;
/** `) / 100` immediately after the call → rounded first, divided after. */
const DIVIDED_AFTER_RE = /^\s*\/\s*(?:100|PESO)\b/;

export function dropsFraction(body: string): boolean {
  if (/maximumFractionDigits:\s*0\b/.test(body)) return true;
  if (/toFixed\(0\)/.test(body)) return true;
  const re = /Math\.(?:round|floor|ceil|trunc)\s*(?=\()/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const arg = roundedArgument(body, m.index);
    if (TO_CENTAVOS_RE.test(arg)) continue; // rounding centavos — exact
    const after = body.slice(m.index + m[0].length + arg.length + 2);
    if (DIVIDED_AFTER_RE.test(after)) continue; // round, then divide — exact
    return true;
  }
  return false;
}

/**
 * …but a body that also spells the centavos out is keeping them. `formatPhp`
 * groups its WHOLE part with `maximumFractionDigits: 0` after `toFixed(2)` has
 * already split the centavos off and is about to re-append them — the most
 * exact formatter in the app, and the one a naive fraction rule flags first.
 */
const KEEPS_FRACTION_RE = /toFixed\(2\)|FractionDigits:\s*2\b/;

/**
 * A FORMATTER RETURNS A PESO STRING. Requiring the marker inside a `return`
 * expression — not merely somewhere in the body — is what separates the ~20
 * real formatters from the ~30 functions that happen to mention ₱ in an email
 * template, a log line or an invariant message.
 *
 * Limit: the return expression is approximated as the text to the next `;`,
 * capped at 400 characters. A formatter whose return spans more than that is
 * missed — under-reporting, the deliberate direction.
 */
const MAX_FORMATTER_LINES = 30;

function returnsPeso(body: string): boolean {
  // A FORMATTER IS SMALL. A 200-line server action that returns
  // `Fee must be under ₱10,000` is returning an error message, not formatting
  // money, and pulling it in here is how a guard becomes noise and gets
  // switched off. Every real formatter in this app is under a dozen lines.
  if (body.split('\n').length > MAX_FORMATTER_LINES) return false;
  const re = /\breturn\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const rest = body.slice(m.index, m.index + 400);
    const end = rest.indexOf(';');
    if (EMITS_PESO_RE.test(end === -1 ? rest : rest.slice(0, end))) return true;
  }
  return false;
}

/**
 * The body of `export function name(` starting at `from`, to its closing brace.
 * Brace-counted over comment-stripped source so a `}` inside a docblock or a
 * string cannot end it early.
 */
function functionBody(stripped: string, from: number): string {
  const open = stripped.indexOf('{', from);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < stripped.length; i += 1) {
    const c = stripped[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return stripped.slice(open, i + 1);
    }
  }
  return stripped.slice(open);
}

/**
 * The docblock immediately above the declaration at `line` (1-based) in RAW
 * source — the one place the `@rounds-to-the-peso` marker can live. Read raw,
 * deliberately: `stripComments` blanks exactly the text R2 needs.
 */
export function docblockAbove(raw: string, line: number): string {
  const lines = raw.split('\n');
  let i = line - 2; // the line above the declaration, 0-based
  // Skip blank lines between the docblock and the declaration.
  while (i >= 0 && lines[i]?.trim() === '') i -= 1;
  if (i < 0 || !lines[i]?.trim().endsWith('*/')) return '';
  const end = i;
  while (i >= 0 && !lines[i]?.trim().startsWith('/*')) i -= 1;
  if (i < 0) return '';
  return lines.slice(i, end + 1).join('\n');
}

/**
 * A function that returns a call to a peso formatter DEFINED IN THE SAME FILE
 * is itself one. `formatCentavosPhp` is literally `return formatPhp(c / 100)`:
 * no ₱ appears in its body, and without this pass the app's own canonical
 * centavos formatter is INVISIBLE to its own guard — a second one could be
 * added under the same name and R1 would never fire. Found the hard way: the
 * anti-vacuity test caught it before this shipped, which is what that test is
 * for.
 *
 * One hop, and only within a file. Cross-module delegation is deliberately not
 * followed: a re-export is not a definition, so it needs no detection.
 */
function returnsCallTo(body: string, names: Set<string>): boolean {
  for (const n of names) {
    if (new RegExp(`\\breturn\\b[^;]*\\b${n}\\s*\\(`).test(body)) return true;
  }
  return false;
}

/** Every exported money helper defined in one file. */
export function extractMoneyHelpers(raw: string, file: string): MoneyHelper[] {
  const stripped = stripComments(raw);

  // Pass 0 — every function in the file, exported or not, with its body.
  type Found = { name: string; line: number; body: string; exported: boolean };
  const all: Found[] = [];
  const anyFn = /(?:^|\n)\s*(export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = anyFn.exec(stripped))) {
    const name = m[2];
    if (!name) continue;
    all.push({
      name,
      exported: Boolean(m[1]),
      line: stripped.slice(0, m.index + m[0].length).split('\n').length,
      body: functionBody(stripped, m.index + m[0].length),
    });
  }

  // Pass 1 — direct peso emitters. Pass 2 — one hop of same-file delegation.
  const emitters = new Set(all.filter((f) => returnsPeso(f.body)).map((f) => f.name));
  for (const f of all) {
    if (!emitters.has(f.name) && returnsCallTo(f.body, emitters)) emitters.add(f.name);
  }

  const out: MoneyHelper[] = [];
  for (const f of all) {
    if (!f.exported) continue;
    const emits = emitters.has(f.name);
    const converts = CONVERTS_RE.test(f.body) && CONVERTER_NAME_RE.test(f.name);
    if (!emits && !converts) continue;
    out.push({
      file,
      line: f.line,
      name: f.name,
      kind: emits ? 'formatter' : 'converter',
      roundsToThePeso: dropsFraction(f.body) && !KEEPS_FRACTION_RE.test(f.body),
      declaresRounding: (() => {
        const doc = docblockAbove(raw, f.line);
        return doc.includes(ROUNDING_MARKER) || doc.includes(NOT_MONEY_MARKER);
      })(),
    });
  }
  return out;
}

export type MoneyScanResult = {
  helpers: MoneyHelper[];
  collisions: NameCollision[];
  /** helpers that drop the fraction with no `@rounds-to-the-peso` reason */
  undeclaredRounders: MoneyHelper[];
  filesScanned: number;
};

/** Scan apps/web for exported money helpers. */
export function scanMoneyFormatters(root: string = APP_ROOT): MoneyScanResult {
  const files = collectSourceFiles(root).filter((f) => !isTestFile(path.basename(f)));
  const helpers: MoneyHelper[] = [];
  for (const abs of files) {
    let raw: string;
    try {
      raw = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (!EMITS_PESO_RE.test(raw) && !CONVERTS_RE.test(raw)) continue;
    helpers.push(...extractMoneyHelpers(raw, path.relative(root, abs)));
  }

  const byName = new Map<string, MoneyHelper[]>();
  for (const h of helpers) {
    const list = byName.get(h.name) ?? [];
    list.push(h);
    byName.set(h.name, list);
  }
  const collisions: NameCollision[] = [];
  for (const [name, list] of byName) {
    if (list.length < 2) continue;
    const seen = [...new Set(list.map((h) => h.file))].sort();
    if (seen.length < 2) continue; // two overloads in one file are not a fork
    collisions.push({ name, files: seen, key: `${name}\t${seen.join(' ')}` });
  }
  collisions.sort((a, b) => a.key.localeCompare(b.key));

  return {
    helpers,
    collisions,
    undeclaredRounders: helpers.filter((h) => h.roundsToThePeso && !h.declaresRounding),
    filesScanned: files.length,
  };
}

export const BASELINE_PATH = path.join(
  APP_ROOT,
  'lib',
  'security',
  'money-formatter.baseline.txt',
);

/** The committed baseline, split by rule. `#` lines and blanks are prose. */
export function readMoneyBaseline(file = BASELINE_PATH): { r1: string[]; r2: string[] } {
  const rows = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0 && !l.trimStart().startsWith('#'));
  const r1: string[] = [];
  const r2: string[] = [];
  for (const row of rows) {
    const tab = row.indexOf('\t');
    const rule = row.slice(0, tab);
    const key = row.slice(tab + 1);
    if (rule === 'R1') r1.push(key);
    else if (rule === 'R2') r2.push(key);
    else throw new Error(`money-formatter baseline: unknown rule '${rule}' in row: ${row}`);
  }
  return { r1, r2 };
}

/** The R2 key for a helper — `file\tname`, matching the baseline's spelling. */
export function rounderKey(h: MoneyHelper): string {
  return `${h.file}\t${h.name}`;
}

/** Render the whole scan as the baseline file's key lines (for `--write`). */
export function baselineKeys(result: MoneyScanResult): string[] {
  return [
    ...result.collisions.map((c) => `R1\t${c.key}`),
    ...result.undeclaredRounders.map((h) => `R2\t${rounderKey(h)}`),
  ].sort();
}
