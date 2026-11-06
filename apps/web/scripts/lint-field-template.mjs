#!/usr/bin/env node
/**
 * lint-field-template.mjs — EVERY TYPED ANSWER IS THE ONE FIELD TEMPLATE.
 *
 * The house Field is a Form row (`app/_components/form-row.tsx`: `TypedRow`, which opens `FormRowField`): the name on
 * the left, a white pill on the right; a tap stretches the box across the row, the name becomes its hint, a ✕ inside
 * clears it, tapping away or Enter keeps it. Owner, 1 Nov 2026, asked whether every field should follow it: *"It
 * should have beed follow since the day it was made"*. It was not: a template nothing checks is a template most
 * screens skip (measured 1 Nov: 27 screen files on the template against hundreds with a raw box). Corpus plan
 * `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §6 and §12 Step 1.
 *
 * ── WHAT IT COUNTS (the property, not a phrasing) ───────────────────────────
 * Per file, the JSX elements a person TYPES WORDS into, drawn by hand instead of by the template:
 *   · every `<textarea …>`;
 *   · every `<input …>` whose `type` is absent, or one of text · email · tel · url — or is not a literal at all
 *     (`type={kind}`), because an unknown kind COUNTS: a mis-read can only over-report, never hide a box.
 * The element is read as a whole opening tag (braces, strings and `=>` inside it are skipped), so an attribute on
 * the fifth line of a tag is still seen. Comments are stripped first with the repo's ONE stripper
 * (`port-controls.mjs`), so prose that names `<input>` is not an input.
 *
 * Not counted — the plan's §6 exceptions, by their KIND, never by their words:
 *   · type hidden · checkbox · radio · file · range · color · submit · button · reset · image (not typed words);
 *   · type date · time · datetime-local · month · week (the picker is the template);
 *   · type password, and `autoComplete="one-time-code"` (passwords and codes);
 *   · type search (the search bar is its own thumb-row template);
 *   · type number (amounts and numbers keep their own stretch, no ✕);
 *   · the template itself: `app/_components/form-row.tsx` (`TEMPLATE_FILES`), whose own box IS the Field;
 *   · an element carrying a `// field-ok: <why>` comment on a line of its tag, for a box that is genuinely another template (the
 *     guest Event Hub the couple designs, a chat composer). Say why in the same comment.
 *
 * ── A RATCHET, BOTH WAYS ────────────────────────────────────────────────────
 * The tree already holds hundreds of raw boxes; converting them is a sweep, area by area (Event Settings, Guests,
 * Suppliers first). So the committed baseline (`field-template.baseline.txt`) freezes today's per-file count, and:
 *   · a file whose count RISES, or a file not listed that holds any, FAILS — no new raw box;
 *   · a file whose count FELL also FAILS until the baseline is regenerated in the same PR, so a conversion is locked
 *     in and cannot quietly grow back. (The one-comment-stripper guard enforces its list the same way.)
 * The baseline is GENERATED — never hand-edit or hand-merge it; on a conflict, take either side and regenerate:
 *   node apps/web/scripts/lint-field-template.mjs --update-baseline
 * Regenerating to RAISE a count is never the fix: draw the field with `TypedRow`.
 *
 * Usage (from apps/web):
 *   pnpm lint:field-template
 *   node scripts/lint-field-template.mjs --update-baseline
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './port-controls.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = resolve(HERE, '..');
export const BASELINE_PATH = join(HERE, 'field-template.baseline.txt');

const SCAN_DIRS = ['app', 'components'];
const EXTENSIONS = ['.tsx', '.jsx'];
const INLINE_OK = 'field-ok';
/** The template's own file(s), relative to the repo root: their box IS the Field. */
export const TEMPLATE_FILES = new Set(['apps/web/app/_components/form-row.tsx']);
/** Below this the walk has gone blind and every file would "pass". */
export const MIN_FILES = 1000;

/** `<input type=…>` kinds a person does not type words into, or that §6 gives a template of their own. */
const NOT_TYPED_WORDS = new Set([
  'hidden', 'checkbox', 'radio', 'file', 'range', 'color', 'submit', 'button', 'reset', 'image',
  'date', 'time', 'datetime-local', 'month', 'week',
  'password', 'search', 'number',
]);

/**
 * The opening tag that starts at `start` (the `<`): its full text up to the `>` that closes it, skipping strings,
 * template literals and `{…}` expressions (where `=>` and `a > b` live). Null if it never closes.
 */
export function openingTag(src, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

/** The literal value of a top-level JSX attribute in an opening tag: a string, `null` when absent, `undefined` when not a literal. */
export function attrOf(tag, attr) {
  // Only attributes at brace depth 0 belong to the tag; blank out every `{…}` body first (keeping its braces).
  let flat = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < tag.length; i++) {
    const c = tag[i];
    if (depth > 0) {
      if (quote) {
        if (c === '\\') {
          flat += '  ';
          i++;
          continue;
        }
        if (c === quote) quote = null;
        flat += ' ';
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        quote = c;
        flat += ' ';
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          flat += '}';
          continue;
        }
      }
      flat += ' ';
      continue;
    }
    if (c === '{') depth++;
    flat += c;
  }
  const at = new RegExp(`(?:^|\\s)${attr}\\s*=\\s*`).exec(flat);
  if (!at) return null;
  const from = at.index + at[0].length;
  const q = tag[from];
  if (q === '"' || q === "'") {
    const end = tag.indexOf(q, from + 1);
    return end < 0 ? undefined : tag.slice(from + 1, end);
  }
  if (q === '{') {
    const inner = /^\{\s*(["'`])([^"'`$]*)\1\s*\}/.exec(tag.slice(from));
    return inner ? inner[2] : undefined;
  }
  return undefined;
}

/** Is this `<input …>` / `<textarea …>` opening tag a raw box a person types words into? */
export function isRawTypedBox(tag) {
  if (/^<textarea\b/.test(tag)) return true;
  if (!/^<input\b/.test(tag)) return false;
  const type = attrOf(tag, 'type');
  if (typeof type === 'string' && NOT_TYPED_WORDS.has(type.trim().toLowerCase())) return false;
  if (attrOf(tag, 'autoComplete') === 'one-time-code') return false;
  return true;
}

/** Every raw typed box in one file's source: `{ lineNumber, text }`. */
export function rawBoxes(source) {
  const raw = source.split('\n');
  const src = stripComments(source);
  const hits = [];
  const re = /<(input|textarea)(?=[\s/>])/g;
  for (let m; (m = re.exec(src)); ) {
    const tag = openingTag(src, m.index);
    if (!tag || !isRawTypedBox(tag)) continue;
    const lineNumber = src.slice(0, m.index).split('\n').length;
    const lastLine = lineNumber + tag.split('\n').length - 1;
    // The opt-out lives in a comment, which the stripper removed — read it from the raw lines the tag spans.
    if (raw.slice(lineNumber - 1, lastLine).some((l) => l.includes(INLINE_OK))) continue;
    hits.push({ lineNumber, text: (raw[lineNumber - 1] ?? '').trim() });
  }
  return hits;
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.some((e) => name.endsWith(e)) && !/\.test\.[jt]sx$/.test(name)) yield full;
  }
}

/** Scan the tree: `{ files, counts: { 'apps/web/…': n }, hits }`. */
export function scan(webRoot = WEB_ROOT) {
  const repoRoot = resolve(webRoot, '..', '..');
  let files = 0;
  const counts = {};
  const hits = {};
  for (const d of SCAN_DIRS) {
    const abs = join(webRoot, d);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      files++;
      const rel = relative(repoRoot, file).split(sep).join('/');
      if (TEMPLATE_FILES.has(rel)) continue;
      const found = rawBoxes(readFileSync(file, 'utf8'));
      if (found.length) {
        counts[rel] = found.length;
        hits[rel] = found;
      }
    }
  }
  return { files, counts, hits };
}

/** Baseline file → `{ path: count }`. Lines are `<count> <path>`; `#` is a comment. */
export function parseBaseline(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^(\d+)\s+(\S.*)$/);
    if (m) out[m[2]] = Number(m[1]);
  }
  return out;
}

export function formatBaseline(counts) {
  const rows = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  const total = rows.reduce((s, [, n]) => s + n, 0);
  return [
    '# lint:field-template baseline — raw typed boxes per file (<textarea>, and <input> of type',
    '# absent|text|email|tel|url|non-literal) not drawn by the Field template (TypedRow).',
    '# GENERATED — never hand-edit, never hand-merge (on a conflict take either side, then):',
    '#   node apps/web/scripts/lint-field-template.mjs --update-baseline',
    '# A RATCHET BOTH WAYS: a count may not rise, and a fall must be written here in the same PR.',
    `# ${rows.length} files · ${total} boxes`,
    ...rows.map(([p, n]) => `${n} ${p}`),
    '',
  ].join('\n');
}

/** `{ rose, fell }`: files above the baseline (or new with any), and files below it (a gain not yet locked in). */
export function compare(counts, baseline) {
  const rose = [];
  const fell = [];
  for (const [rel, count] of Object.entries(counts)) {
    const allowed = baseline[rel] ?? 0;
    if (count > allowed) rose.push({ rel, count, allowed });
  }
  for (const [rel, allowed] of Object.entries(baseline)) {
    const count = counts[rel] ?? 0;
    if (count < allowed) fell.push({ rel, count, allowed });
  }
  return { rose, fell };
}

function main() {
  const update = process.argv.includes('--update-baseline');
  const { files, counts, hits } = scan();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (files < MIN_FILES) {
    console.error(`FAIL · lint:field-template scanned only ${files} files (expected ≥ ${MIN_FILES}) — the walk has gone blind.`);
    process.exit(1);
  }
  for (const t of TEMPLATE_FILES) {
    const abs = resolve(WEB_ROOT, '..', '..', t);
    if (!existsSync(abs) || !/export function TypedRow\b/.test(readFileSync(abs, 'utf8'))) {
      console.error(`FAIL · lint:field-template: the template ${t} is gone or no longer exports TypedRow — update TEMPLATE_FILES.`);
      process.exit(1);
    }
  }

  if (update) {
    writeFileSync(BASELINE_PATH, formatBaseline(counts));
    console.log(`baseline updated · ${Object.keys(counts).length} files · ${total} raw boxes`);
    process.exit(0);
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error('FAIL · scripts/field-template.baseline.txt is missing. Run: node scripts/lint-field-template.mjs --update-baseline');
    process.exit(1);
  }
  const baseline = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'));
  const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
  if (baseTotal > 0 && total === 0) {
    console.error('FAIL · lint:field-template found ZERO raw boxes against a non-empty baseline — the matcher has gone blind.');
    process.exit(1);
  }

  const { rose, fell } = compare(counts, baseline);
  if (rose.length === 0 && fell.length === 0) {
    console.log(`OK · lint:field-template · ${files} files · ${total} raw typed boxes, exactly the baseline.`);
    process.exit(0);
  }

  const inCI = process.env.GITHUB_ACTIONS === 'true';
  if (rose.length) {
    console.error(`\nFAIL · lint:field-template: ${rose.length} file(s) added a raw typed box instead of the Field template:\n`);
    for (const v of rose) {
      console.error(`  ${v.rel} — ${v.count} raw box(es), baseline allows ${v.allowed}`);
      for (const h of hits[v.rel]) {
        console.error(`    :${h.lineNumber}  ${h.text.slice(0, 110)}`);
        if (inCI) {
          console.log(
            `::error file=${v.rel},line=${h.lineNumber}::A hand-drawn typed box. Every field is the one Field template — TypedRow from app/_components/form-row.tsx.`,
          );
        }
      }
      console.error('');
    }
  }
  if (fell.length) {
    console.error(`\nFAIL · lint:field-template: ${fell.length} file(s) hold FEWER raw boxes than the baseline — lock the gain in:\n`);
    for (const v of fell) console.error(`  ${v.rel} — ${v.count} now, baseline says ${v.allowed}`);
    console.error('\n  Run: node apps/web/scripts/lint-field-template.mjs --update-baseline   (and commit the baseline)\n');
  }
  if (rose.length) {
    console.error('How to fix a rise:');
    console.error('  1. Draw the field with TypedRow (app/_components/form-row.tsx). Inside a <form>, give it');
    console.error('     `fieldName` and it posts under that name exactly as the raw box did.');
    console.error('  2. A box that is genuinely another template (the guest Event Hub, a chat composer): add a');
    console.error('     `// field-ok: <why>` comment on a line of its tag.');
    console.error('  3. Never regenerate the baseline to RAISE a count.');
  }
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
